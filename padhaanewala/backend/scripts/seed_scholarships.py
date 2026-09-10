import re

from sqlalchemy import select

from app.database import SessionLocal
from app.models import Scholarship, State


def slugify(text: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", text.strip().lower()).strip("-")


SAMPLE_SCHOLARSHIPS = [
    {
        "name": "National Scholarship Portal - Pre Matric",
        "provider": "Department of Higher Education, Government of India",
        "ownership": "government",
        "state_code": None,
        "category": "Pre-Matric",
        "eligibility": "Students of Class 1 to 10 with family income less than INR 1 lakh per annum",
        "course": "School Education",
        "income_criteria": "Family income less than INR 1,00,000 per annum",
        "amount": "INR 1,000 - 2,000 per annum",
        "documents_required": ["Aadhaar", "Income Certificate", "Bank Account"],
    },
    {
        "name": "Post Matric Scholarship for SC Students",
        "provider": "Ministry of Social Justice and Empowerment",
        "ownership": "government",
        "state_code": None,
        "category": "Post-Matric",
        "eligibility": "SC students pursuing post-matric courses with family income up to INR 2.5 lakh per annum",
        "course": "All recognized courses",
        "income_criteria": "Family income up to INR 2,50,000 per annum",
        "amount": "Tuition fee + maintenance allowance",
        "documents_required": ["Caste Certificate", "Fee Receipt", "Bank Account"],
    },
    {
        "name": "Vidyadhan Scholarship",
        "provider": "S. D. Shibulal Family Endowment",
        "ownership": "private",
        "state_code": None,
        "category": "Merit-cum-Means",
        "eligibility": "Class 10 students with 80%+ marks and family income less than INR 2 lakh per annum",
        "course": "Pre-University / Engineering / Medical",
        "income_criteria": "Family income less than INR 2,00,000 per annum",
        "amount": "Up to INR 60,000 per year",
        "documents_required": ["Marksheet", "Income Proof", "Aadhaar"],
    },
    {
        "name": "Vidyasiri Scholarship Karnataka",
        "provider": "Government of Karnataka - Social Welfare Department",
        "ownership": "government",
        "state_code": "KA",
        "category": "Post-Matric",
        "eligibility": "SC/ST/Category-1 students of Karnataka pursuing post-matric education",
        "course": "All recognized courses",
        "income_criteria": "No income limit for SC/ST",
        "amount": "Up to INR 20,000 per annum",
        "documents_required": ["Caste Certificate", "Domicile", "Bank Account"],
    },
    {
        "name": "Tamil Nadu Adi Dravidar Welfare Scholarship",
        "provider": "Government of Tamil Nadu - Adi Dravidar Welfare Department",
        "ownership": "government",
        "state_code": "TN",
        "category": "Post-Matric",
        "eligibility": "Adi Dravidar students of Tamil Nadu pursuing higher education",
        "course": "UG / PG / Professional",
        "income_criteria": "Family income up to INR 1 lakh per annum",
        "amount": "Up to INR 12,000 per annum",
        "documents_required": ["Community Certificate", "Income Certificate", "Bank Account"],
    },
    {
        "name": "Central Sector Scholarship Scheme",
        "provider": "Department of Higher Education, Government of India",
        "ownership": "government",
        "state_code": None,
        "category": "Merit-based",
        "eligibility": "Students who scored above 80 percentile in Class 12 and pursuing UG/PG",
        "course": "UG / PG",
        "income_criteria": "Family income less than INR 8 lakh per annum",
        "amount": "INR 12,000 per annum (UG)", 
        "documents_required": ["Marksheet", "Income Certificate", "College Bonafide"],
    },
]


def main() -> None:
    with SessionLocal() as db:
        created = 0
        for item in SAMPLE_SCHOLARSHIPS:
            if db.scalar(select(Scholarship).where(Scholarship.slug == slugify(item["name"]))):
                continue
            state = (
                db.scalar(select(State).where(State.code == item["state_code"]))
                if item["state_code"]
                else None
            )
            db.add(
                Scholarship(
                    name=item["name"],
                    slug=slugify(item["name"]),
                    provider=item["provider"],
                    ownership=item["ownership"],
                    state_id=state.id if state else None,
                    category=item["category"],
                    eligibility=item["eligibility"],
                    course=item["course"],
                    income_criteria=item["income_criteria"],
                    amount=item["amount"],
                    documents_required=item["documents_required"],
                    verification_status="verified",
                    is_active=True,
                )
            )
            created += 1
        db.commit()
        print(f"Seeded {created} new scholarships (total {db.query(Scholarship).count()})")


if __name__ == "__main__":
    main()