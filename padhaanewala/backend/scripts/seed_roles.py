from app.database import SessionLocal
from app.models import Role

ROLES = [
    "super_admin",
    "admin",
    "content_manager",
    "seo_manager",
    "data_manager",
    "test_admin",
    "proctor",
    "counsellor_manager",
    "counsellor",
    "reviewer",
    "support",
    "analytics",
    "student",
    "user",
]


def main() -> None:
    with SessionLocal() as db:
        for i, name in enumerate(ROLES):
            exists = db.query(Role).filter(Role.name == name).first()
            if not exists:
                db.add(Role(name=name, description=f"Seed role: {name}"))
        db.commit()
        print(f"Seeded {len(ROLES)} roles")


if __name__ == "__main__":
    main()