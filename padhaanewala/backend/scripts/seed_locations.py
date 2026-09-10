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
            state_districts = db.query(District).filter(District.state_id == state.id).all()
            for c_name in cities:
                if c_name in existing_cities:
                    continue

                def _match(entry):
                    return _match_city(c_name, entry)

                district = next(
                    (d for d in state_districts if _match(d)), None
                )
                if district is None:
                    continue
                db.add(
                    City(
                        name=c_name,
                        district_id=district.id,
                        is_metropolitan=True,
                    )
                )
                existing_cities.add(c_name)

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