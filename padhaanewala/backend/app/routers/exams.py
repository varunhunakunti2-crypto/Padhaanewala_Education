import re
from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import require_role
from app.models import Exam, User
from app.schemas.catalog import ExamCreate, ExamResponse, ExamUpdate
from app.roles import ADMIN_ROLES, CONTENT_ROLES
from app.utils import audit

router = APIRouter(prefix="/api/v1/exams", tags=["exams"])


def _slugify(text: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", text.strip().lower()).strip("-")


@router.get("", response_model=list[ExamResponse])
def list_exams(
    q: str | None = None,
    exam_type: str | None = None,
    upcoming: bool = False,
    limit: int = Query(50, ge=1, le=100),
    offset: int = 0,
    db: Session = Depends(get_db),
):
    query = select(Exam).where(Exam.is_active)
    if q:
        term = f"%{q.strip()}%"
        query = query.where(
            or_(Exam.name.ilike(term), Exam.conducting_authority.ilike(term))
        )
    if exam_type:
        query = query.where(Exam.exam_type == exam_type)
    if upcoming:
        query = query.where(
            or_(
                Exam.exam_date >= date.today(),
                Exam.application_deadline >= date.today(),
            )
        )

    if upcoming:
        query = query.order_by(Exam.exam_date.is_(None), Exam.exam_date)
    else:
        query = query.order_by(Exam.name)

    return db.scalars(query.limit(limit).offset(offset)).all()


@router.get("/upcoming", response_model=list[ExamResponse])
def upcoming_exams(
    limit: int = Query(10, ge=1, le=50),
    db: Session = Depends(get_db),
):
    exams = db.scalars(
        select(Exam)
        .where(
            Exam.is_active,
            or_(
                Exam.exam_date >= date.today(),
                Exam.application_deadline >= date.today(),
            ),
        )
        .order_by(Exam.exam_date.is_(None), Exam.exam_date)
        .limit(limit)
    ).all()
    return exams


@router.get("/{exam_ref}", response_model=ExamResponse)
def get_exam(exam_ref: str, db: Session = Depends(get_db)):
    exam = db.scalar(
        select(Exam).where(
            Exam.is_active,
            (Exam.id == int(exam_ref) if exam_ref.isdigit() else Exam.slug == exam_ref),
        )
    )
    if exam is None:
        raise HTTPException(status_code=404, detail="Exam not found")
    return exam


def _find_exam(db: Session, ref: str) -> Exam | None:
    cond = Exam.id == int(ref) if ref.isdigit() else Exam.slug == ref
    return db.scalar(select(Exam).where(cond))


@router.post(
    "",
    response_model=ExamResponse,
    status_code=201,
    dependencies=[Depends(require_role(*CONTENT_ROLES))],
)
def create_exam(
    payload: ExamCreate,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(require_role(*CONTENT_ROLES)),
):
    slug = _slugify(payload.name)
    if db.scalar(select(Exam).where(Exam.slug == slug)):
        raise HTTPException(status_code=400, detail="Exam with this name exists")
    exam = Exam(**payload.model_dump(exclude={"name"}), name=payload.name, slug=slug)
    db.add(exam)
    # 4.4 — exams were mutated with no audit row at all, so an exam date or
    # deadline could be changed with nothing in the trail to say who moved it.
    # Flushed first so `exam.id` exists to stamp, and written after the slug
    # check so a refused create leaves no phantom entry.
    db.flush()
    audit.record(
        db,
        request=request,
        action="create_exam",
        entity_type="exam",
        entity_id=exam.id,
        actor=user,
        new_value=payload.model_dump(),
    )
    db.commit()
    db.refresh(exam)
    return exam


@router.put(
    "/{exam_ref}",
    response_model=ExamResponse,
    dependencies=[Depends(require_role(*CONTENT_ROLES))],
)
def update_exam(
    exam_ref: str,
    payload: ExamUpdate,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(require_role(*CONTENT_ROLES)),
):
    exam = _find_exam(db, exam_ref)
    if exam is None:
        raise HTTPException(status_code=404, detail="Exam not found")

    data = payload.model_dump(exclude_unset=True)
    # Captured before the setattr loop so the trail holds the values the edit
    # actually replaced, narrowed to the keys the caller sent — a full dump
    # would log untouched columns as changes and make the row unreadable.
    old_value = {field: getattr(exam, field) for field in data}
    if "name" in data and data["name"] != exam.name:
        slug = _slugify(data["name"])
        if db.scalar(select(Exam).where(Exam.slug == slug, Exam.id != exam.id)):
            raise HTTPException(status_code=400, detail="Exam with this name exists")
        exam.slug = slug
    for field, value in data.items():
        setattr(exam, field, value)
    audit.record(
        db,
        request=request,
        action="update_exam",
        entity_type="exam",
        entity_id=exam.id,
        actor=user,
        old_value=old_value,
        new_value=data,
    )
    db.commit()
    db.refresh(exam)
    return exam


@router.delete(
    "/{exam_ref}",
    status_code=204,
    dependencies=[Depends(require_role(*ADMIN_ROLES))],
)
def delete_exam(
    exam_ref: str,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(require_role(*ADMIN_ROLES)),
):
    exam = _find_exam(db, exam_ref)
    if exam is None:
        raise HTTPException(status_code=404, detail="Exam not found")
    # Enough of the row to reconstruct what existed, read before the delete so
    # the values are not fetched from an expired instance afterwards.
    audit.record(
        db,
        request=request,
        action="delete_exam",
        entity_type="exam",
        entity_id=exam.id,
        actor=user,
        old_value={
            "name": exam.name,
            "slug": exam.slug,
            "exam_type": exam.exam_type,
            "exam_date": exam.exam_date,
            "is_active": exam.is_active,
        },
    )
    db.delete(exam)
    db.commit()
