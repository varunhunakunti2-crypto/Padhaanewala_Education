import sys
from pathlib import Path

# Allow `python scripts/seed_x.py` from any working directory: the repo root
# (which contains the `app` package) is not on sys.path by default, because
# Python puts the *script's* directory there instead.
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import re
from datetime import date

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from app.data.india_colleges_courses import COURSES
from app.data.karnataka_colleges import (
    ADDITIONAL_AFFILIATING_UNIVERSITIES,
    KARNATAKA_COLLEGES,
    KARNATAKA_DISTRICTS,
    KARNATAKA_STATE_CODE,
)
from app.database import SessionLocal
from app.models import College, CollegeCourse, Course, District, State, University

# The source workbooks are a 2026-27 research compilation. Anything not stated in
# them (fees, intake, NAAC grade, website, email, hostel, overview) is left NULL
# rather than filled with a plausible guess.
RESEARCH_CUTOFF = date(2026, 9, 9)


def slugify(text: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", text.strip().lower()).strip("-")


def unique_slug(db, name: str) -> str:
    """Slugify `name`, appending -2, -3 ... only if the slug is already taken.

    `college_id` is unique too, so a collision there is resolved the same way
    rather than aborting the whole seed.
    """
    base = slugify(name)
    slug = base
    suffix = 2
    while db.scalar(select(College.id).where(College.slug == slug)):
        slug = f"{base}-{suffix}"
        suffix += 1
    return slug


def next_college_id_factory(db):
    """Return a callable that hands out the next free COLLEGE###### identifier.

    The high-water mark is computed once from the existing rows and then bumped
    locally. A counter derived from the number of rows inserted during this run
    collides with existing rows whenever a previous run was interrupted or rows
    were deleted in between, and re-querying the table per insert makes seeding
    quadratic.
    """
    highest = 0
    for (value,) in db.execute(
        select(College.college_id).where(College.college_id.like("COLLEGE%"))
    ):
        tail = value.removeprefix("COLLEGE")
        if tail.isdigit():
            highest = max(highest, int(tail))
    counter = highest

    def allocate() -> str:
        nonlocal counter
        counter += 1
        return f"COLLEGE{counter:06d}"

    return allocate


def main() -> None:
    with SessionLocal() as db:
        course_map: dict[str, int] = {}
        for name, short_label, degree, duration, category in COURSES:
            # The second tuple element is a short display label (e.g. "B.Tech"),
            # not a slug. The URL slug is always derived from the full name, and
            # the lookup must use that same value.
            slug = slugify(name)
            course = db.scalar(select(Course).where(Course.slug == slug))
            if course is None:
                course = Course(
                    name=name,
                    slug=slug,
                    degree=degree,
                    duration=duration,
                    category=category,
                    is_active=True,
                )
                db.add(course)
                db.flush()
            course_map[name] = course.id
            course_map[short_label] = course.id

        state = db.scalar(select(State).where(State.code == KARNATAKA_STATE_CODE))
        if state is None:
            print(
                f"  ! state {KARNATAKA_STATE_CODE} is missing - run seed_locations.py first"
            )
            db.rollback()
            return

        district_ids: dict[str, int] = {}
        for name in KARNATAKA_DISTRICTS:
            district = db.scalar(
                select(District).where(
                    District.name == name, District.state_id == state.id
                )
            )
            if district is not None:
                district_ids[name] = district.id
        unresolved = set(KARNATAKA_DISTRICTS) - set(district_ids)
        if unresolved:
            print(f"  ! districts not found, colleges will load without them: {unresolved}")

        # The health-science workbooks name their affiliating universities. Most are
        # already in india_universities.py; create only the ones that are missing.
        # Their location is left NULL because the workbooks do not state it.
        added_universities = 0
        for name, is_deemed in ADDITIONAL_AFFILIATING_UNIVERSITIES:
            if db.scalar(select(University.id).where(University.name == name)):
                continue
            db.add(
                University(
                    name=name,
                    slug=slugify(name),
                    type="Deemed University" if is_deemed else "University",
                    is_deemed=is_deemed,
                    is_active=True,
                )
            )
            added_universities += 1
        db.flush()
        print(f"Universities added: {added_universities}")

        university_ids = {row[0]: row[1] for row in db.execute(select(University.name, University.id))}

        created = 0
        skipped = 0
        missing_course: list[str] = []
        allocate_college_id = next_college_id_factory(db)
        for (
            name,
            sector,
            established_year,
            address,
            phone,
            city,
            district,
            affiliation,
            college_type,
            ownership,
            course_name,
        ) in KARNATAKA_COLLEGES:
            slug = unique_slug(db, name)
            if db.scalar(select(College.id).where(College.name == name)):
                skipped += 1
                continue
            college = College(
                college_id=allocate_college_id(),
                name=name,
                official_name=name,
                slug=slug,
                college_type=college_type,
                ownership=ownership,
                university_id=university_ids.get(affiliation) if affiliation else None,
                state_id=state.id,
                district_id=district_ids.get(district) if district else None,
                city=city,
                address=address,
                phone=phone,
                established_year=established_year,
                is_active=True,
                verification_status="verified",
                last_verified_date=RESEARCH_CUTOFF,
            )
            db.add(college)
            db.flush()

            course_id = course_map.get(course_name)
            if course_id is None:
                missing_course.append(f"{name}: {course_name}")
            else:
                db.add(
                    CollegeCourse(
                        college_id=college.id,
                        course_id=course_id,
                        annual_fee=None,
                        intake_seats=None,
                        admission_mode=None,
                        entrance_exam=None,
                        is_active=True,
                    )
                )
            created += 1
            if created % 100 == 0:
                db.commit()
                print(f"  ... {created} colleges so far")

        try:
            db.commit()
        except IntegrityError as exc:
            db.rollback()
            print(f"  ! commit failed: {exc}")
            raise

        if missing_course:
            print("  ! no course row for:")
            for line in missing_course:
                print(f"      {line}")

        print(
            f"Seeded: {db.query(Course).count()} courses, "
            f"{db.query(College).count()} colleges, "
            f"{db.query(CollegeCourse).count()} college_courses "
            f"(+{created} new, {skipped} already present)"
        )


if __name__ == "__main__":
    main()
