"""CSV import for the M4 catalogue data gate.

The M4 gate in ``docs/padhaanewala-phase-checklist.md`` is specified in terms of
CSV files, but the repository has never had a CSV import path: there is no
``.csv`` anywhere in the tree and no ``import csv`` under ``app``. Every catalogue
row so far arrived through a hand-maintained Python module
(``app/data/karnataka_colleges.py`` and friends) or a seed script. So the
mechanism the gate assumes did not exist, and compiling the CSVs alone would not
have moved it.

This module is that mechanism. It is built around the failure mode that matters
for data import, which is **not** "the file was malformed" - that raises
immediately and is harmless. It is the silent kind:

* A misspelled column header. ``offical_website`` instead of ``official_website``
  is discarded by Pydantic, the row imports "successfully", and the column stays
  empty. :func:`check_headers` turns every unrecognised column into a hard error.
* A ``N/A`` sentinel. Left alone it becomes the literal string ``"N/A"`` in a
  ``website`` column, which the frontend then renders as a working link. See
  :data:`NULL_SENTINELS`.
* A fuzzy duplicate. Two real colleges in two districts genuinely share a name,
  and a real college and a typo also share a name. Auto-merging either is
  unrecoverable, and so is auto-skipping either. :func:`plan_import` never merges
  on a fuzzy match - it creates and warns, and a human decides.
* A re-run. Importing the same file twice must not double the table, so an exact
  slug match is an update.

## Dry run by default

:meth:`ImportPlan.apply` is never reached implicitly. The CLI runs
:func:`plan_import`, prints the plan, and writes nothing until ``--apply`` is
passed. The target table holds 331 curated colleges; a bulk import that mutates
before anyone has read the diff is not a risk worth taking.
"""

from __future__ import annotations

import csv
import difflib
import re
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Callable, Iterable, Literal, Sequence

from pydantic import BaseModel, ValidationError
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import College, Course, District, Exam, Scholarship, State, University
from app.schemas.catalog import (
    CollegeCreate,
    CourseCreate,
    ExamCreate,
    ScholarshipCreate,
)

# --------------------------------------------------------------------------- #
# Cell normalisation
# --------------------------------------------------------------------------- #

#: Cell contents that mean "this compiler had no value", not "the value is this
#: text". Compared casefolded and whitespace-collapsed.
#:
#: Without this list each of these becomes a stored value, because Pydantic
#: coerces ``str`` fields happily. ``website="N/A"`` then renders in the admin
#: table and on the public page as a link to a host called ``n/a``.
NULL_SENTINELS: frozenset[str] = frozenset(
    {
        "",
        "-",
        "--",
        "---",
        "?",
        "n/a",
        "n.a.",
        "na",
        "nil",
        "none",
        "null",
        "not available",
        "not applicable",
        "tbd",
        "tbc",
        "unknown",
    }
)

#: Default similarity above which two names are reported as possible duplicates.
#:
#: 0.90 is high on purpose. Much lower and the word "College" alone starts
#: matching every institution in the country, and the warnings drown out the
#: real ones.
DEFAULT_FUZZY_THRESHOLD = 0.90


def normalize_cell(value: Any) -> str | None:
    """Collapse a raw CSV cell to a trimmed string, or ``None`` if it is absent.

    ``None`` means *omit this field*, which is materially different from ``""``:
    an omitted field is left alone on update, an empty string overwrites it.
    """
    if value is None:
        return None
    text = re.sub(r"\s+", " ", str(value).strip())
    if not text or text.casefold() in NULL_SENTINELS:
        return None
    return text


def slugify(text: str) -> str:
    """Match the slug rule used by the routers and every seed script exactly.

    Transcribed from ``seed_colleges_courses.slugify``:
    ``re.sub(r"[^a-z0-9]+", "-", text.strip().lower()).strip("-")``. A second
    definition that disagreed by one character would silently fork every URL in
    the catalogue, so this deliberately has no "improvements".
    """
    return re.sub(r"[^a-z0-9]+", "-", text.strip().lower()).strip("-")


def similarity(left: str, right: str) -> float:
    """Fuzzy name similarity in ``[0.0, 1.0]``.

    ``difflib.SequenceMatcher`` over casefolded, punctuation-stripped names.
    Chosen over a dependency such as ``rapidfuzz`` because the standard library
    is always present in the deploy image and this is the only place in the
    project that needs fuzzy matching - a runtime package for one function is a
    worse trade than 0.92 instead of 0.94.
    """
    a = re.sub(r"[^a-z0-9]+", " ", left.casefold()).strip()
    b = re.sub(r"[^a-z0-9]+", " ", right.casefold()).strip()
    if a == b:
        return 1.0
    return difflib.SequenceMatcher(None, a, b).ratio()


# --------------------------------------------------------------------------- #
# Entity registry
# --------------------------------------------------------------------------- #


def _reference_map(db: Session, model: Any, *columns: Any) -> dict[str, int]:
    """Map every casefolded value of ``columns`` to a row id.

    Lets one CSV say ``state=Karnataka`` on one line and ``state=KA`` on the
    next and land on the same row, because a data compiler will use both in the
    same file.
    """
    out: dict[str, int] = {}
    for row in db.execute(select(model.id, *columns)).all():
        row_id = row[0]
        for value in row[1:]:
            if value is None:
                continue
            out.setdefault(str(value).strip().casefold(), row_id)
    return out


def _resolve_state(db: Session, value: str) -> int:
    found = _reference_map(db, State, State.name, State.code).get(value.casefold())
    if found is None:
        raise KeyError(f"no state matches {value!r} (tried both name and code)")
    return found


def _resolve_district(db: Session, value: str, state_id: int | None) -> int:
    found = _reference_map(db, District, District.name).get(value.casefold())
    if found is None:
        raise KeyError(f"no district matches {value!r}")
    if state_id is not None:
        row = db.get(District, found)
        if row is not None and row.state_id != state_id:
            # District names are not unique across India, so the row's state has
            # to agree. Silently taking the first match is how "Kolhapur" ends up
            # attached to the wrong state.
            raise KeyError(
                f"district {value!r} exists but belongs to a different state than this "
                f"row's state; correct the state column or leave district empty"
            )
    return found


def _resolve_university(db: Session, value: str) -> int:
    found = _reference_map(db, University, University.name).get(value.casefold())
    if found is None:
        raise KeyError(f"no university matches {value!r}")
    return found


@dataclass(frozen=True)
class EntitySpec:
    """Everything that differs between importable entities.

    Data rather than an ``if entity == "college"`` chain, so adding placements
    and cutoffs later is a registration rather than a new code path. Those two
    are deliberately absent: ``app/schemas/catalog.py`` has no
    ``PlacementCreate`` or ``CutoffCreate``, so there is no contract to validate
    a row against, and defining one here would settle a data shape the project
    has not agreed on yet.
    """

    key: str
    model: Any
    create_schema: type[BaseModel]
    #: Columns that name another table rather than holding a value.
    reference_columns: dict[str, Callable[..., int]] = field(default_factory=dict)
    #: Accepted spellings for each reference column.
    reference_aliases: dict[str, tuple[str, ...]] = field(default_factory=dict)
    #: True when ``state_id`` must resolve before ``district_id``.
    district_needs_state: bool = False
    #: Allocate an external id on create, as the college router does.
    external_id_column: str | None = None
    #: Columns that are legitimate in a CSV but must never be written from one.
    #:
    #: Needed because the create schemas are deliberately narrower than the
    #: tables. ``CollegeCreate`` has no ``is_active`` or ``is_featured``, and
    #: ``college_id`` is allocated by the server. A data compiler exporting the
    #: real table will include all three, and a round trip through
    #: ``export_catalog_csvs.py`` must not fail on its own output. Listed
    #: explicitly so that *unknown* columns stay a hard error, which is what
    #: catches ``offical_website``.
    read_only_columns: tuple[str, ...] = ()


ENTITY_SPECS: dict[str, EntitySpec] = {
    "college": EntitySpec(
        key="college",
        model=College,
        create_schema=CollegeCreate,
        reference_columns={
            "state_id": _resolve_state,
            "district_id": _resolve_district,
            "university_id": _resolve_university,
        },
        reference_aliases={
            "state_id": ("state", "state_name", "state_code"),
            "district_id": ("district", "district_name"),
            "university_id": ("university", "university_name"),
        },
        district_needs_state=True,
        external_id_column="college_id",
        read_only_columns=("college_id", "is_active", "is_featured"),
    ),
    "course": EntitySpec(
        key="course",
        model=Course,
        create_schema=CourseCreate,
    ),
    "scholarship": EntitySpec(
        key="scholarship",
        model=Scholarship,
        create_schema=ScholarshipCreate,
        reference_columns={"state_id": _resolve_state},
        reference_aliases={"state_id": ("state", "state_name", "state_code")},
    ),
    "exam": EntitySpec(
        key="exam",
        model=Exam,
        create_schema=ExamCreate,
    ),
}


# --------------------------------------------------------------------------- #
# Reading
# --------------------------------------------------------------------------- #


def read_csv(path: str | Path) -> tuple[list[str], list[dict[str, Any]]]:
    """Return ``(headers, rows)``, tolerating the encoding mess real CSVs carry.

    ``utf-8-sig`` because a file exported from Excel leads with a BOM that would
    otherwise become part of the first column's name and read as an unknown
    header. ``newline=""`` per the stdlib's own guidance, so a quoted field
    containing a newline survives.

    Rows are returned raw, including the ``None`` key ``DictReader`` uses for
    overflow columns; :func:`plan_import` reports those rather than dropping them
    here, so the operator sees which line is malformed.
    """
    file_path = Path(path)
    with file_path.open("r", encoding="utf-8-sig", newline="") as handle:
        reader = csv.DictReader(handle)
        headers = [h.strip() for h in (reader.fieldnames or [])]
        rows = [{k: v for k, v in raw.items()} for raw in reader]
    return headers, rows


def check_headers(headers: Sequence[str], spec: EntitySpec) -> list[str]:
    """Return problems with the header row. Any entry is a hard error.

    Two failures are caught here that Pydantic cannot see, because it silently
    discards keys it does not recognise:

    * an unknown column - almost always a typo, and the most expensive import
      bug there is, because the row loads clean and the field stays empty;
    * a missing required column - which would otherwise surface as the same
      per-row error repeated a thousand times, instead of once before any row is
      read.
    """
    problems: list[str] = []
    known = set(spec.create_schema.model_fields)
    accepted = {"name", "slug"} | set(spec.read_only_columns)
    for aliases in spec.reference_aliases.values():
        accepted.update(aliases)
    for column in spec.reference_columns:
        accepted.add(column)

    seen: set[str] = set()
    for header in headers:
        lowered = header.casefold()
        if lowered in seen:
            problems.append(f"duplicate column {header!r} in the header row")
        seen.add(lowered)
        if lowered not in known and lowered not in accepted:
            close = difflib.get_close_matches(lowered, sorted(known), n=1)
            hint = f" (did you mean {close[0]!r}?)" if close else ""
            problems.append(f"unknown column {header!r}{hint}")
    for field_name, info in spec.create_schema.model_fields.items():
        # `FieldInfo.alias` is None unless the field declared `alias=`, so the
        # field *name* from the dict key is the only reliable label here. Using
        # `.alias` reports every required column as missing-and-called-None.
        if info.is_required() and field_name not in accepted and field_name not in seen:
            problems.append(f"missing required column {field_name!r}")
    return problems


# --------------------------------------------------------------------------- #
# Planning
# --------------------------------------------------------------------------- #


@dataclass
class RowProblem:
    """One thing wrong with one row. Never fatal to the rest of the file."""

    line: int
    column: str | None
    message: str
    severity: Literal["error", "warning"] = "error"


@dataclass
class PlannedRow:
    line: int
    action: Literal["create", "update", "skip"]
    slug: str
    name: str
    payload: dict[str, Any] = field(default_factory=dict)
    existing_id: int | None = None
    warnings: list[str] = field(default_factory=list)
    reason: str = ""


@dataclass
class ImportPlan:
    """The full result of reading a CSV. Applying it is a separate, explicit step."""

    entity: str
    source: str
    rows: list[PlannedRow] = field(default_factory=list)
    problems: list[RowProblem] = field(default_factory=list)
    fuzzy_threshold: float = DEFAULT_FUZZY_THRESHOLD
    on_fuzzy: Literal["create", "skip"] = "create"
    update_existing: bool = True

    @property
    def to_create(self) -> list[PlannedRow]:
        return [r for r in self.rows if r.action == "create"]

    @property
    def to_update(self) -> list[PlannedRow]:
        return [r for r in self.rows if r.action == "update"]

    @property
    def to_skip(self) -> list[PlannedRow]:
        return [r for r in self.rows if r.action == "skip"]

    @property
    def errors(self) -> list[RowProblem]:
        return [p for p in self.problems if p.severity == "error"]

    @property
    def warnings(self) -> list[RowProblem]:
        return [p for p in self.problems if p.severity == "warning"]

    def summary(self) -> str:
        return (
            f"{self.entity} from {self.source}: {len(self.to_create)} to create, "
            f"{len(self.to_update)} to update, {len(self.to_skip)} skipped, "
            f"{len(self.errors)} errors, {len(self.warnings)} warnings"
        )


def _map_columns(row: dict[str, Any], spec: EntitySpec) -> dict[str, Any]:
    """Fold accepted aliases onto canonical schema field names.

    ``reference_aliases`` maps *canonical field* -> *accepted spellings*, so the
    lookup tests the header against the tuple, not the key. Inverting those two
    is silent: every `state` column is then simply not mapped, no error is
    raised, and the row imports with a null `state_id` that nobody notices until
    the college renders with no location.
    """
    out: dict[str, Any] = {}
    for key, value in row.items():
        if not isinstance(key, str):
            continue
        lowered = key.casefold()
        if lowered in spec.create_schema.model_fields:
            out[lowered] = value
            continue
        for canonical, aliases in spec.reference_aliases.items():
            if lowered in aliases:
                out[canonical] = value
                break
    return out


def _row_width_problem(row: dict[str, Any]) -> str | None:
    """Catch a row whose field count disagrees with the header.

    ``DictReader`` parks overflow columns under a ``None`` key and pads short
    rows with ``None`` values. Both are silent otherwise: the overflow value is
    dropped and the row imports with a field quietly shifted out of alignment.
    """
    if None in row:
        return f"row has {len(row[None] or [])} more field(s) than the header row"
    missing = [key for key, value in row.items() if isinstance(value, list)]
    if missing:
        return f"row is short of the header row; missing value(s) for {', '.join(missing)}"
    return None


def plan_import(
    db: Session,
    entity: str,
    rows: Iterable[dict[str, Any]],
    *,
    headers: Sequence[str] | None = None,
    source: str = "<memory>",
    fuzzy_threshold: float = DEFAULT_FUZZY_THRESHOLD,
    on_fuzzy: Literal["create", "skip"] = "create",
    update_existing: bool = True,
) -> ImportPlan:
    """Validate every row and decide what would happen to it. Writes nothing.

    ``on_fuzzy`` decides what happens to a row whose *name* is a near-match for
    an existing row but whose *slug* is new. The default is ``create``, and the
    reasoning is worth stating, because ``skip`` looks more careful:

    * Overwriting the existing record from the CSV value is destroying
      hand-checked data on the strength of a 0.91 similarity score. Unrecoverable.
    * Dropping the row is losing a real college because its name resembles
      another. "Government First Grade College" in two districts is two colleges,
      and this file is the only place they exist. Also unrecoverable, because the
      compiler has no other copy.

    A duplicate row is cheap to delete and obvious in the report. A missing one
    is invisible. So: create, and warn loudly enough that a human resolves it.
    """
    spec = ENTITY_SPECS[entity]
    plan = ImportPlan(
        entity=entity,
        source=source,
        fuzzy_threshold=fuzzy_threshold,
        on_fuzzy=on_fuzzy,
        update_existing=update_existing,
    )
    if headers is not None:
        for message in check_headers(headers, spec):
            plan.problems.append(RowProblem(line=1, column=None, message=message))
        if plan.errors:
            return plan

    model = spec.model
    existing_by_slug = {row.slug: row for row in db.execute(select(model)).scalars().all()}
    existing_names = [(row.id, row.name, row.slug) for row in existing_by_slug.values()]

    planned_slugs: dict[str, int] = {}
    planned_names: list[tuple[str, int]] = []

    def note_warnings(line: int, warnings: list[str]) -> None:
        for message in warnings:
            plan.problems.append(
                RowProblem(line=line, column="name", message=message, severity="warning")
            )

    for offset, row in enumerate(rows):
        line = offset + 2  # 1-based, and row 1 is the header
        width_problem = _row_width_problem(row)
        if width_problem:
            plan.problems.append(RowProblem(line=line, column=None, message=width_problem))
            continue

        mapped = _map_columns(row, spec)
        name = normalize_cell(mapped.get("name"))
        if name is None:
            plan.problems.append(
                RowProblem(line=line, column="name", message="name is required and was empty")
            )
            continue

        slug = slugify(normalize_cell(mapped.get("slug")) or name)
        if not slug:
            plan.problems.append(
                RowProblem(
                    line=line,
                    column="name",
                    message=(
                        f"name {name!r} contains no letters or digits once lowercased, so it "
                        "yields an empty slug"
                    ),
                )
            )
            continue

        if slug in planned_slugs:
            plan.problems.append(
                RowProblem(
                    line=line,
                    column="slug",
                    message=(
                        f"slug {slug!r} is already used by line {planned_slugs[slug]} of this "
                        "same file; merge the two rows or rename one"
                    ),
                )
            )
            continue

        warnings: list[str] = []
        for other_name, other_line in planned_names:
            score = similarity(name, other_name)
            if score >= fuzzy_threshold:
                warnings.append(f"resembles line {other_line} ({other_name!r}), score {score:.2f}")
                break

        existing = existing_by_slug.get(slug)
        if existing is not None and not update_existing:
            planned_slugs[slug] = line
            note_warnings(line, warnings)
            plan.rows.append(
                PlannedRow(
                    line=line,
                    action="skip",
                    slug=slug,
                    name=name,
                    existing_id=existing.id,
                    warnings=warnings,
                    reason="slug already exists and --no-update was passed",
                )
            )
            continue

        # Build the payload the way the API would, so the importer cannot write
        # a row the admin panel could not have written itself.
        payload: dict[str, Any] = {}
        for field_name in spec.create_schema.model_fields:
            if field_name in spec.reference_columns or field_name == "slug":
                continue
            raw = normalize_cell(mapped.get(field_name))
            if raw is not None:
                payload[field_name] = raw

        reference_failed = False
        resolved_state: int | None = None
        for column in spec.reference_columns:
            raw = normalize_cell(mapped.get(column))
            if raw is None:
                continue
            resolver = spec.reference_columns[column]
            try:
                if spec.district_needs_state and column == "district_id":
                    value = resolver(db, raw, resolved_state)
                else:
                    value = resolver(db, raw)
            except KeyError as exc:
                plan.problems.append(RowProblem(line=line, column=column, message=str(exc)))
                reference_failed = True
                break
            if column == "state_id":
                resolved_state = value
            payload[column] = value
        if reference_failed:
            continue

        try:
            validated = spec.create_schema(**payload)
        except ValidationError as exc:
            for detail in exc.errors():
                column = ".".join(str(part) for part in detail["loc"]) or None
                plan.problems.append(
                    RowProblem(line=line, column=column, message=detail["msg"])
                )
            continue

        planned_slugs[slug] = line
        planned_names.append((name, line))

        if existing is not None:
            note_warnings(line, warnings)
            plan.rows.append(
                PlannedRow(
                    line=line,
                    action="update",
                    slug=slug,
                    name=name,
                    payload=validated.model_dump(exclude_unset=True),
                    existing_id=existing.id,
                    warnings=warnings,
                )
            )
            continue

        for row_id, other_name, other_slug in existing_names:
            score = similarity(name, other_name)
            if score >= fuzzy_threshold:
                warnings.append(
                    f"possible duplicate of id {row_id} ({other_name!r}, {other_slug!r}), "
                    f"score {score:.2f}"
                )
                break

        if on_fuzzy == "skip" and warnings:
            note_warnings(line, warnings)
            plan.rows.append(
                PlannedRow(
                    line=line,
                    action="skip",
                    slug=slug,
                    name=name,
                    warnings=warnings,
                    reason="possible duplicate and --on-fuzzy=skip",
                )
            )
            continue

        note_warnings(line, warnings)
        plan.rows.append(
            PlannedRow(
                line=line,
                action="create",
                slug=slug,
                name=name,
                payload=validated.model_dump(exclude_unset=True),
                warnings=warnings,
            )
        )

    return plan


# --------------------------------------------------------------------------- #
# Applying
# --------------------------------------------------------------------------- #


def _next_external_id(db: Session, model: Any, column: str) -> str:
    """Allocate the next ``COLLEGE000123`` id, matching ``routers/colleges.py``.

    Duplicated rather than imported because the router's version is inline in the
    route handler, and refactoring a live router to share a helper is a larger
    change than this import path warrants. The two must stay in step; the unique
    index on the column is what makes a drift loud rather than silent.
    """
    highest = db.scalar(select(func.max(model.id))) or 0
    return f"COLLEGE{highest + 1:06d}"


def apply_plan(db: Session, plan: ImportPlan, *, batch_size: int = 200) -> dict[str, int]:
    """Write a plan. All-or-nothing, so a mid-file failure leaves the DB untouched.

    A partial import of a thousand-row file is the worst outcome available: the
    next run cannot tell which half landed, and the report that described the
    failure is gone. So the whole plan is one transaction and one rollback.
    """
    spec = ENTITY_SPECS[plan.entity]
    model = spec.model
    created = updated = 0
    try:
        for planned in plan.rows:
            if planned.action == "skip":
                continue
            values = dict(planned.payload)
            if planned.action == "create" and spec.external_id_column:
                values[spec.external_id_column] = _next_external_id(db, model, spec.external_id_column)
            if planned.action == "update":
                target = db.get(model, planned.existing_id)
                for key, value in values.items():
                    setattr(target, key, value)
                updated += 1
            else:
                db.add(model(slug=planned.slug, **values))
                created += 1
            if (created + updated) % batch_size == 0:
                db.flush()
        db.commit()
    except Exception:
        db.rollback()
        raise
    return {"created": created, "updated": updated, "skipped": len(plan.to_skip)}
