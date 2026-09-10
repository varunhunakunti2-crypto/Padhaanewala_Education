import re

from sqlalchemy import select

from app.database import SessionLocal
from app.data.india_colleges_courses import COURSES, SAMPLE_COLLEGES
from app.models import College, CollegeCourse, Course, State, University


def slugify(text: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", text.strip().lower()).strip("-")


def main() -> None:
    with SessionLocal() as db:
        course_map = {}
        for name, slug, degree, duration, category in COURSES:
            course = db.scalar(select(Course).where(Course.slug == slug))
            if course is None:
                course = Course(
                    name=name,
                    slug=slugify(name),
                    degree=degree,
                    duration=duration,
                    category=category,
                    is_active=True,
                )
                db.add(course)
                db.flush()
            course_map[slug] = course.id

        created = 0
        for item in SAMPLE_COLLEGES:
            if db.scalar(select(College).where(College.slug == slugify(item["name"]))):
                continue
            state = db.scalar(select(State).where(State.code == item["state"]))
            university = db.scalar(
                select(University).where(University.name == item["university"])
            )
            college = College(
                college_id=f"COLLEGE{created + 1:06d}",
                name=item["name"],
                official_name=item["official_name"],
                slug=slugify(item["name"]),
                college_type=item["type"],
                ownership=item["ownership"],
                university_id=university.id if university else None,
                state_id=state.id if state else None,
                city=item["city"],
                website=item["website"],
                email=item["email"],
                phone=item["phone"],
                established_year=item["established_year"],
                accreditation_naac=item["accreditation_naac"],
                overview=item["overview"],
                facilities=item["facilities"],
                has_hostel=item["has_hostel"],
                is_active=True,
                verification_status="verified",
            )
            db.add(college)
            db.flush()

            for cc in item["courses"]:
                course_id = course_map.get(cc["name"])
                if course_id is None:
                    continue
                db.add(
                    CollegeCourse(
                        college_id=college.id,
                        course_id=course_id,
                        annual_fee=cc["annual_fee"],
                        intake_seats=cc.get("intake_seats"),
                        admission_mode=cc.get("admission_mode"),
                        entrance_exam=cc.get("entrance_exam"),
                        is_active=True,
                    )
                )
            created += 1

        db.commit()
        print(
            f"Seeded: {db.query(Course).count()} courses, "
            f"{db.query(College).count()} colleges, "
            f"{db.query(CollegeCourse).count()} college_courses"
        )


if __name__ == "__main__":
    main()