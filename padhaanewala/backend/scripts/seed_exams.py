import re

from sqlalchemy import select

from app.database import SessionLocal
from app.models import Exam


def slugify(text: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", text.strip().lower()).strip("-")


SAMPLE_EXAMS = [
    {
        "name": "Joint Entrance Examination (Main)",
        "conducting_authority": "National Testing Agency (NTA)",
        "exam_type": "national",
        "eligibility": "Class 12 with Physics, Chemistry and Mathematics",
        "official_website": "https://jeemain.nta.nic.in",
    },
    {
        "name": "Joint Entrance Examination (Advanced)",
        "conducting_authority": "IIT Joint Admission Board",
        "exam_type": "national",
        "eligibility": "Top 2,50,000 rank holders of JEE Main",
        "official_website": "https://jeeadv.ac.in",
    },
    {
        "name": "National Eligibility cum Entrance Test (Undergraduate)",
        "conducting_authority": "National Testing Agency (NTA)",
        "exam_type": "national",
        "eligibility": "Class 12 with Physics, Chemistry, Biology",
        "official_website": "https://neet.nta.nic.in",
    },
    {
        "name": "Common University Entrance Test",
        "conducting_authority": "National Testing Agency (NTA)",
        "exam_type": "national",
        "eligibility": "Class 12 pass",
        "official_website": "https://cuet.nta.nic.in",
    },
    {
        "name": "Common Admission Test",
        "conducting_authority": "Indian Institutes of Management (IIMs)",
        "exam_type": "national",
        "eligibility": "Graduate with 50% marks",
        "official_website": "https://iimcat.ac.in",
    },
    {
        "name": "Karnataka Common Entrance Test",
        "conducting_authority": "Karnataka Examinations Authority",
        "exam_type": "state",
        "eligibility": "Class 12 from Karnataka with relevant subjects",
        "official_website": "https://cetonline.karnataka.gov.in",
    },
]


def main() -> None:
    with SessionLocal() as db:
        created = 0
        for item in SAMPLE_EXAMS:
            if db.scalar(select(Exam).where(Exam.slug == slugify(item["name"]))):
                continue
            db.add(
                Exam(
                    name=item["name"],
                    slug=slugify(item["name"]),
                    conducting_authority=item["conducting_authority"],
                    exam_type=item["exam_type"],
                    eligibility=item["eligibility"],
                    official_website=item["official_website"],
                    is_active=True,
                )
            )
            created += 1
        db.commit()
        print(f"Seeded {created} new exams (total {db.query(Exam).count()})")


if __name__ == "__main__":
    main()