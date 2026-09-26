"""Create or update the bootstrap admin account (R8.1, R8.2).

Idempotent and deliberately hard to misuse. Run order matters:

    python scripts/seed_roles.py     # R8.2: roles must exist first
    python scripts/seed_admin.py

R8.1 safety rules enforced here:

* The target email must appear in ``ADMIN_EMAIL_ALLOWLIST``. Without that guard a
  typo in ``ADMIN_EMAIL`` silently promotes a real student to super_admin.
* An existing user is **never** re-hashed unless ``--reset-password`` is passed,
  so a mis-pointed run cannot quietly take over somebody's account.
* Promoting an account that already holds ``student`` requires
  ``--promote-existing`` — that is the "you are about to escalate a real user"
  case, and it should be typed on purpose.
* The password is only read from the environment and is never printed.

Environment:
    ADMIN_EMAIL              target account (default contact@padhaanewala.in)
    ADMIN_PASSWORD           required, no default
    ADMIN_EMAIL_ALLOWLIST    comma-separated emails this script may touch
    ADMIN_NAME               display name for the admins row
    ADMIN_MOBILE             unique 10-digit mobile (users.mobile is NOT NULL UNIQUE)
    ADMIN_ROLES              default "admin,super_admin"
"""

import argparse
import os
import sys
from pathlib import Path

# Allow `python scripts/seed_x.py` from any working directory: the repo root
# (which contains the `app` package) is not on sys.path by default, because
# Python puts the *script's* directory there instead.
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from sqlalchemy import select

from app.database import SessionLocal
from app.models import Admin, Role, StudentProfile, User
from app.roles import ALL_ROLES
from app.utils.security import hash_password


def _csv(name: str, default: str = "") -> list[str]:
    return [v.strip() for v in os.environ.get(name, default).split(",") if v.strip()]


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Seed the bootstrap admin account.")
    parser.add_argument(
        "--reset-password",
        action="store_true",
        help="Re-hash the password on an account that already exists.",
    )
    parser.add_argument(
        "--promote-existing",
        action="store_true",
        help="Allow granting admin to an account that already has the student role.",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()

    email = os.environ.get("ADMIN_EMAIL", "contact@padhaanewala.in").strip().lower()
    password = os.environ.get("ADMIN_PASSWORD", "")
    name = os.environ.get("ADMIN_NAME", "Padhaanewala Admin")
    mobile = os.environ.get("ADMIN_MOBILE", "9999999999")
    role_names = _csv("ADMIN_ROLES", "admin,super_admin")
    allowlist = {e.lower() for e in _csv("ADMIN_EMAIL_ALLOWLIST", email)}

    unknown = [r for r in role_names if r not in ALL_ROLES]
    if unknown:
        raise SystemExit(
            f"Unknown role(s) {unknown}. Canonical roles are: {', '.join(ALL_ROLES)}"
        )

    if not password:
        raise SystemExit(
            "ADMIN_PASSWORD is not set. Refusing to create an admin with an empty password.\n"
            'Example (PowerShell):  $env:ADMIN_PASSWORD="..."; python scripts/seed_admin.py'
        )

    # R8.1 — allowlist gate. Checked before the DB is touched.
    if email not in allowlist:
        raise SystemExit(
            f"Refusing to modify {email}: not in ADMIN_EMAIL_ALLOWLIST.\n"
            f"Allowed: {', '.join(sorted(allowlist))}\n"
            "Set ADMIN_EMAIL_ALLOWLIST explicitly if this really is a service account."
        )

    with SessionLocal() as db:
        user = db.scalar(select(User).where(User.email == email))
        created = user is None

        if user is None:
            clash = db.scalar(select(User).where(User.mobile == mobile))
            if clash is not None:
                raise SystemExit(
                    f"ADMIN_MOBILE {mobile} is already used by {clash.email}. "
                    "Pick a different ADMIN_MOBILE."
                )
            user = User(
                email=email,
                mobile=mobile,
                password_hash=hash_password(password),
                is_active=True,
                is_email_verified=True,
                is_mobile_verified=True,
            )
            db.add(user)
            db.flush()
            print(f"Created admin user {email}")
        else:
            existing = {role.name for role in user.roles}
            # R8.1 — refuse to hijack a real student account by accident.
            if "student" in existing and not args.promote_existing:
                raise SystemExit(
                    f"{email} already exists and holds the 'student' role.\n"
                    "Re-run with --promote-existing if you really intend to escalate "
                    "this account to admin."
                )
            if not args.reset_password:
                print(f"Account {email} already exists; leaving password untouched.")
            else:
                user.password_hash = hash_password(password)
                print(f"Reset password for {email}")
            user.is_active = True
            user.is_email_verified = True

        assigned: list[str] = []
        for role_name in role_names:
            role = db.scalar(select(Role).where(Role.name == role_name))
            if role is None:
                print(f"  ! role '{role_name}' does not exist - run scripts/seed_roles.py first")
                continue
            if role not in user.roles:
                user.roles.append(role)
                assigned.append(role_name)

        if db.scalar(select(Admin).where(Admin.user_id == user.id)) is None:
            db.add(Admin(user_id=user.id, name=name, department="Operations"))

        # A staff account should not also carry the student profile/role set,
        # otherwise it shows up in student-facing lists.
        if created:
            db.add(StudentProfile(user_id=user.id, name=name))

        db.commit()

        print(f"Email:    {email}")
        print(f"Roles:    {', '.join(sorted(r.name for r in user.roles)) or '(none)'}")
        if assigned:
            print(f"Added:    {', '.join(assigned)}")
        print("Admin login is now ready.")


if __name__ == "__main__":
    main()
