import re

from app.database import SessionLocal
from app.data.india_universities import UNIVERSITIES
from app.models import State, University


def slugify(text: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", text.strip().lower()).strip("-")


def main() -> None:
    with SessionLocal() as db:
        for name, state_code, city, univ_type, is_deemed, website in UNIVERSITIES:
            state = db.query(State).filter(State.code == state_code).first()
            exists = db.query(University).filter(University.name == name).first()
            if exists:
                continue
            db.add(
                University(
                    name=name,
                    slug=slugify(name),
                    state_id=state.id if state else None,
                    city=city,
                    type=univ_type,
                    is_deemed=is_deemed,
                    website=website,
                    is_active=True,
                )
            )
        db.commit()
        print(f"Seeded {db.query(University).count()} universities")


if __name__ == "__main__":
    main()