"""Export catalogue tables to CSV for the import pipeline.

Writes CSVs under `data/exports/YYYY-MM-DD/` by default with headers that match
the column names and aliases accepted by `scripts/import_csv.py`. FK fields are
exported as readable names (state name, district name, university name) so the
result can be re-imported without manual ID lookups.
"""

import sys
from pathlib import Path
from datetime import datetime

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import csv

from app.database import SessionLocal
from app.models import College, Course, District, Exam, Scholarship, State, University


def write_csv(path: Path, headers: list[str], rows: list[dict]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=headers, extrasaction="ignore")
        w.writeheader()
        for r in rows:
            w.writerow(r)


def export_courses(db, outdir: Path) -> None:
    headers = ["name", "slug", "degree", "duration", "category", "is_active"]
    rows = []
    for c in db.query(Course).order_by(Course.id):
        rows.append({
            "name": c.name,
            "slug": c.slug,
            "degree": c.degree or "",
            "duration": c.duration or "",
            "category": c.category or "",
            "is_active": "true" if c.is_active else "false",
        })
    write_csv(outdir / "courses.csv", headers, rows)
    print(f"  courses.csv -> {len(rows)} rows")


def export_exams(db, outdir: Path) -> None:
    headers = [
        "name",
        "slug",
        "conducting_authority",
        "exam_type",
        "eligibility",
        "application_start_date",
        "application_deadline",
        "exam_date",
        "admit_card_date",
        "result_date",
        "official_website",
        "official_notification",
        "is_active",
    ]
    rows = []
    for e in db.query(Exam).order_by(Exam.id):
        def d(v): return v.isoformat() if v else ""
        rows.append({
            "name": e.name,
            "slug": e.slug,
            "conducting_authority": e.conducting_authority,
            "exam_type": e.exam_type,
            "eligibility": e.eligibility or "",
            "application_start_date": d(e.application_start_date),
            "application_deadline": d(e.application_deadline),
            "exam_date": d(e.exam_date),
            "admit_card_date": d(e.admit_card_date),
            "result_date": d(e.result_date),
            "official_website": e.official_website or "",
            "official_notification": e.official_notification or "",
            "is_active": "true" if e.is_active else "false",
        })
    write_csv(outdir / "exams.csv", headers, rows)
    print(f"  exams.csv -> {len(rows)} rows")


def export_scholarships(db, outdir: Path) -> None:
    headers = [
        "name",
        "slug",
        "provider",
        "ownership",
        "eligibility",
        "state",
        "course",
        "category",
        "income_criteria",
        "amount",
        "application_deadline",
        "application_procedure",
        "official_website",
        "verification_status",
        "last_verified_date",
        "next_verification_date",
        "is_active",
    ]
    state_by_id = {s.id: s for s in db.query(State).all()}
    rows = []
    for s in db.query(Scholarship).order_by(Scholarship.id):
        def d(v): return v.isoformat() if v else ""
        st = state_by_id.get(s.state_id)
        rows.append({
            "name": s.name,
            "slug": s.slug,
            "provider": s.provider,
            "ownership": s.ownership,
            "eligibility": s.eligibility or "",
            "state": st.name if st else "",
            "course": s.course or "",
            "category": s.category or "",
            "income_criteria": s.income_criteria or "",
            "amount": s.amount or "",
            "application_deadline": d(s.application_deadline),
            "application_procedure": s.application_procedure or "",
            "official_website": s.official_website or "",
            "verification_status": s.verification_status,
            "last_verified_date": d(s.last_verified_date),
            "next_verification_date": d(s.next_verification_date),
            "is_active": "true" if s.is_active else "false",
        })
    write_csv(outdir / "scholarships.csv", headers, rows)
    print(f"  scholarships.csv -> {len(rows)} rows")


def export_colleges(db, outdir: Path) -> None:
    headers = [
        "name",
        "slug",
        "college_id",
        "official_name",
        "college_type",
        "ownership",
        "university",
        "state",
        "district",
        "city",
        "address",
        "pincode",
        "lat",
        "lng",
        "website",
        "email",
        "phone",
        "established_year",
        "accreditation_naac",
        "accreditation_nba",
        "overview",
        "has_hostel",
        "is_featured",
        "is_active",
    ]
    uni = {u.id: u for u in db.query(University).all()}
    st = {s.id: s for s in db.query(State).all()}
    di = {d.id: d for d in db.query(District).all()}
    rows = []
    for c in db.query(College).order_by(College.id):
        rows.append({
            "name": c.name,
            "slug": c.slug,
            "college_id": c.college_id,
            "official_name": c.official_name or "",
            "college_type": c.college_type or "",
            "ownership": c.ownership or "",
            "university": uni[c.university_id].name if c.university_id and c.university_id in uni else "",
            "state": st[c.state_id].name if c.state_id and c.state_id in st else "",
            "district": di[c.district_id].name if c.district_id and c.district_id in di else "",
            "city": c.city or "",
            "address": c.address or "",
            "pincode": c.pincode or "",
            "lat": str(c.lat) if c.lat else "",
            "lng": str(c.lng) if c.lng else "",
            "website": c.website or "",
            "email": c.email or "",
            "phone": c.phone or "",
            "established_year": str(c.established_year) if c.established_year else "",
            "accreditation_naac": c.accreditation_naac or "",
            "accreditation_nba": "true" if c.accreditation_nba else ("false" if c.accreditation_nba is False else ""),
            "overview": c.overview or "",
            "has_hostel": "true" if c.has_hostel else ("false" if c.has_hostel is False else ""),
            "is_featured": "true" if c.is_featured else "false",
            "is_active": "true" if c.is_active else "false",
        })
    write_csv(outdir / "colleges.csv", headers, rows)
    print(f"  colleges.csv -> {len(rows)} rows")


def main() -> None:
    ts = datetime.now().strftime("%Y-%m-%d_%H%M%S")
    base = Path(__file__).resolve().parent.parent / "data" / "exports" / ts
    with SessionLocal() as db:
        export_courses(db, base)
        export_exams(db, base)
        export_scholarships(db, base)
        export_colleges(db, base)
    print(f"\nWrote exports to {base}")


if __name__ == "__main__":
    main()
