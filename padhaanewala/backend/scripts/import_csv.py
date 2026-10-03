"""Import a catalogue CSV into the database.

    python scripts/import_csv.py data/colleges.csv --entity college
    python scripts/import_csv.py data/colleges.csv --entity college --apply

**Nothing is written without ``--apply``.** The first invocation is a dry run
that prints what would happen to every row, which is the only way to read a
thousand-row plan.

Exit codes, so this can gate a pipeline:

* ``0`` - plan is clean (warnings are allowed; they need a human, not a retry)
* ``1`` - the plan has errors, or ``--apply`` was not passed and errors exist
* ``2`` - ``--apply`` was passed and the write failed
"""

import sys
from pathlib import Path

# Allow `python scripts/import_csv.py` from any working directory: the repo root
# (which contains the `app` package) is not on sys.path by default, because
# Python puts the *script's* directory there instead. Same shim the seed scripts
# use.
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import argparse
import json

from app.database import SessionLocal
from app.services.csv_import import (
    DEFAULT_FUZZY_THRESHOLD,
    ENTITY_SPECS,
    ImportPlan,
    apply_plan,
    plan_import,
    read_csv,
)

#: How many problems to print before summarising the rest. A 1000-row file with
#: one bad column produces 1000 identical errors, and printing all of them buries
#: the handful of rows that are individually wrong.
MAX_PROBLEMS_SHOWN = 40

#: `--entity` accepts singular and plural. A data compiler writing a command line
#: will reach for "colleges", and having that be a usage error is a papercut that
#: makes the tool look unfinished.
_ENTITY_CHOICES: dict[str, str] = {}
for _key in ENTITY_SPECS:
    _ENTITY_CHOICES[_key] = _key
    _ENTITY_CHOICES[f"{_key}s"] = _key


def _print_plan(plan: ImportPlan, *, show_rows: bool, row_limit: int) -> None:
    print(plan.summary())
    print()

    if plan.errors:
        print(f"errors ({len(plan.errors)}):")
        for problem in plan.errors[:MAX_PROBLEMS_SHOWN]:
            where = f"line {problem.line}"
            if problem.column:
                where += f", column {problem.column!r}"
            print(f"  {where}: {problem.message}")
        if len(plan.errors) > MAX_PROBLEMS_SHOWN:
            print(f"  ... and {len(plan.errors) - MAX_PROBLEMS_SHOWN} more")
        print()

    if plan.warnings:
        print(f"warnings ({len(plan.warnings)}):")
        for problem in plan.warnings[:MAX_PROBLEMS_SHOWN]:
            print(f"  line {problem.line}: {problem.message}")
        if len(plan.warnings) > MAX_PROBLEMS_SHOWN:
            print(f"  ... and {len(plan.warnings) - MAX_PROBLEMS_SHOWN} more")
        print()

    if show_rows:
        print("rows:")
        for row in plan.rows[:row_limit]:
            target = f" (existing id {row.existing_id})" if row.existing_id else ""
            reason = f" - {row.reason}" if row.reason else ""
            print(f"  line {row.line}: {row.action} {row.name!r} -> {row.slug}{target}{reason}")
        if len(plan.rows) > row_limit:
            print(f"  ... and {len(plan.rows) - row_limit} more rows")
        print()

    if plan.warnings and not show_rows:
        print(
            "note: possible duplicates are reported, never merged. Review them with "
            "--show-rows, or re-run with --on-fuzzy skip to leave them out."
        )


def _as_json(plan: ImportPlan) -> str:
    return json.dumps(
        {
            "entity": plan.entity,
            "source": plan.source,
            "counts": {
                "create": len(plan.to_create),
                "update": len(plan.to_update),
                "skip": len(plan.to_skip),
                "errors": len(plan.errors),
                "warnings": len(plan.warnings),
            },
            "problems": [
                {
                    "line": p.line,
                    "column": p.column,
                    "severity": p.severity,
                    "message": p.message,
                }
                for p in plan.problems
            ],
            "rows": [
                {
                    "line": r.line,
                    "action": r.action,
                    "name": r.name,
                    "slug": r.slug,
                    "existing_id": r.existing_id,
                    "warnings": r.warnings,
                    "reason": r.reason,
                }
                for r in plan.rows
            ],
        },
        indent=2,
        ensure_ascii=False,
    )


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description=__doc__,
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument("csv_path", help="Path to the CSV file.")
    parser.add_argument(
        "--entity",
        required=True,
        choices=_ENTITY_CHOICES,
        help="Which table this file loads into. Singular or plural both work.",
    )
    parser.add_argument(
        "--apply",
        action="store_true",
        help="Actually write. Without this, the run is a dry run and prints a plan.",
    )
    parser.add_argument(
        "--no-update",
        action="store_true",
        help="Skip rows whose slug already exists instead of updating them.",
    )
    parser.add_argument(
        "--on-fuzzy",
        choices=["create", "skip"],
        default="create",
        help=(
            "What to do with a row whose name closely matches an existing row but "
            "whose slug is new. 'create' (default) imports it and warns; 'skip' drops "
            "it. Nothing is ever merged automatically."
        ),
    )
    parser.add_argument(
        "--fuzzy-threshold",
        type=float,
        default=DEFAULT_FUZZY_THRESHOLD,
        help=f"Similarity at which to warn about a possible duplicate. Default {DEFAULT_FUZZY_THRESHOLD}.",
    )
    parser.add_argument(
        "--show-rows",
        action="store_true",
        help="Print the per-row plan, not just the summary and problems.",
    )
    parser.add_argument(
        "--row-limit",
        type=int,
        default=50,
        help="With --show-rows, how many rows to print. Default 50.",
    )
    parser.add_argument(
        "--json",
        dest="as_json",
        action="store_true",
        help="Emit the plan as JSON instead of text.",
    )
    args = parser.parse_args(argv)

    path = Path(args.csv_path)
    if not path.is_file():
        print(f"error: no such file: {path}", file=sys.stderr)
        return 2

    try:
        headers, rows = read_csv(path)
    except (OSError, UnicodeDecodeError, csv.Error) as exc:  # noqa: F821
        print(f"error: could not read {path}: {exc}", file=sys.stderr)
        return 2

    with SessionLocal() as db:
        plan = plan_import(
            db,
            _ENTITY_CHOICES[args.entity],
            rows,
            headers=headers,
            source=str(path),
            fuzzy_threshold=args.fuzzy_threshold,
            on_fuzzy=args.on_fuzzy,
            update_existing=not args.no_update,
        )

        if args.as_json:
            print(_as_json(plan))
        else:
            _print_plan(plan, show_rows=args.show_rows, row_limit=args.row_limit)

        if plan.errors:
            if not args.as_json:
                print(
                    f"\nrefusing to apply: {len(plan.errors)} row(s) could not be "
                    "validated. Fix the CSV and re-run; nothing was written."
                )
            return 1

        if not args.apply:
            if not args.as_json:
                print("\ndry run. Re-run with --apply to write these changes.")
            return 0

        if not plan.rows:
            if not args.as_json:
                print("\nnothing to do.")
            return 0

        try:
            result = apply_plan(db, plan)
        except Exception as exc:  # noqa: BLE001 - reported, then re-raised as a code
            print(f"\napply failed, transaction rolled back: {exc}", file=sys.stderr)
            return 2

        if not args.as_json:
            print(
                f"\napplied: {result['created']} created, {result['updated']} updated, "
                f"{result['skipped']} skipped."
            )
        else:
            print(json.dumps({"applied": result}, indent=2))
        return 0


if __name__ == "__main__":
    raise SystemExit(main())
