import sys
from pathlib import Path

# Allow `python scripts/seed_x.py` from any working directory: the repo root
# (which contains the `app` package) is not on sys.path by default, because
# Python puts the *script's* directory there instead.
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.database import SessionLocal
from app.models import Role
from app.roles import ALL_ROLES


def main() -> None:
    with SessionLocal() as db:
        for i, name in enumerate(ALL_ROLES):
            exists = db.query(Role).filter(Role.name == name).first()
            if not exists:
                db.add(Role(name=name, description=f"Seed role: {name}"))
        db.commit()
        print(f"Seeded {len(ALL_ROLES)} roles")


if __name__ == "__main__":
    main()