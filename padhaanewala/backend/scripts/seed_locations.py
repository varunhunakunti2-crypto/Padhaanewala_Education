import sys
from pathlib import Path

# Allow `python scripts/seed_x.py` from any working directory: the repo root
# (which contains the `app` package) is not on sys.path by default, because
# Python puts the *script's* directory there instead.
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.database import SessionLocal
from app.data.india_locations import STATES, DISTRICT_TOTAL
from app.models import City, District, State

# Major cities whose name substring-matches multiple districts; pin the right one.
CITY_DISTRICT_OVERRIDES = {
    "Bengaluru": "Bengaluru Urban",
    "Delhi": "Central Delhi",
}


def _match_city(c_name: str, district: District) -> bool:
    candidate = CITY_DISTRICT_OVERRIDES.get(c_name, c_name)
    if candidate.lower() == district.name.lower():
        return True
    if candidate == c_name:
        return (
            c_name.lower() in district.name.lower()
            or district.name.lower() in c_name.lower()
        )
    return False


def main() -> None:
    with SessionLocal() as db:
        for code, name, is_ut, districts, cities in STATES:
            state = db.query(State).filter(State.code == code).first()
            if state is None:
                state = State(
                    name=name, code=code, is_union_territory=is_ut, is_active=True
                )
                db.add(state)
                db.flush()
            else:
                state.name = name
                state.is_union_territory = is_ut

            existing = {d.name for d in state.districts}
            existing_codes = {d.code for d in state.districts}
            for idx, d_name in enumerate(districts, start=1):
                if d_name not in existing:
                    db.add(
                        District(
                            name=d_name,
                            code=f"{code}{idx:02d}",
                            state_id=state.id,
                        )
                    )
                    existing.add(d_name)
                else:
                    district_obj = next(
                        d for d in state.districts if d.name == d_name
                    )
                    if f"{code}{idx:02d}" not in existing_codes and not district_obj.code:
                        district_obj.code = f"{code}{idx:02d}"

            existing_cities = {c.name for c in db.query(City).join(District).filter(District.state_id == state.id).all()}

            # `SessionLocal` is configured with autoflush=False, so districts added
            # a moment ago are still pending and would be invisible to a query.
            # Collect them from the identity map as well, otherwise the city
            # matcher below never sees them and silently seeds zero cities.
            state_districts = list(
                db.query(District).filter(District.state_id == state.id).all()
            )
            known_district_ids = {d.id for d in state_districts}
            state_districts.extend(
                d
                for d in db.identity_map.values()
                if isinstance(d, District) and d.state_id == state.id and d.id not in known_district_ids
            )

            matched_cities = 0
            unmatched_cities: list[str] = []
            for c_name in cities:
                if c_name in existing_cities:
                    continue

                district = next(
                    (d for d in state_districts if _match_city(c_name, d)), None
                )
                if district is None:
                    unmatched_cities.append(c_name)
                    continue
                db.add(
                    City(
                        name=c_name,
                        district_id=district.id,
                        is_metropolitan=True,
                    )
                )
                existing_cities.add(c_name)
                matched_cities += 1

            db.flush()
            if matched_cities or unmatched_cities:
                print(
                    f"  {name}: {matched_cities} cities linked"
                    + (f", {len(unmatched_cities)} unmatched" if unmatched_cities else "")
                )

        db.commit()

        state_count = db.query(State).count()
        district_count = db.query(District).count()
        city_count = db.query(City).count()
        print(
            f"Seeded: {state_count} states/UTs, {district_count} districts, {city_count} cities"
        )
        print(f"Data source contains {DISTRICT_TOTAL} districts")


if __name__ == "__main__":
    main()