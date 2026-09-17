import re
from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import require_role
from app.models import Exam
from app.schemas.catalog import ExamCreate, ExamResponse, ExamUpdate

router = APIRouter(prefix="/api/v1/exams", tags=["exams"])


def _slugify(text: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", text.strip().lower()).strip("-")


@router.get("", response_model=list[ExamResponse])
def list_exams(
    q: str | None = None,
    exam_type: str | None = None,
    upcoming: bool = False,
    limit: int = 50,
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
    dependencies=[Depends(require_role("admin", "super_admin", "content_manager"))],
)
def create_exam(payload: ExamCreate, db: Session = Depends(get_db)):
    slug = _slugify(payload.name)
    if db.scalar(select(Exam).where(Exam.slug == slug)):
        raise HTTPException(status_code=400, detail="Exam with this name exists")
    exam = Exam(**payload.model_dump(exclude={"name"}), name=payload.name, slug=slug)
    db.add(exam)
    db.commit()
    db.refresh(exam)
    return exam


@router.put(
    "/{exam_ref}",
    response_model=ExamResponse,
    dependencies=[Depends(require_role("admin", "super_admin", "content_manager"))],
)
def update_exam(
    exam_ref: str, payload: ExamUpdate, db: Session = Depends(get_db)
):
    exam = _find_exam(db, exam_ref)
    if exam is None:
        raise HTTPException(status_code=404, detail="Exam not found")

    data = payload.model_dump(exclude_unset=True)
    if "name" in data and data["name"] != exam.name:
        slug = _slugify(data["name"])
        if db.scalar(select(Exam).where(Exam.slug == slug, Exam.id != exam.id)):
            raise HTTPException(status_code=400, detail="Exam with this name exists")
        exam.slug = slug
    for field, value in data.items():
        setattr(exam, field, value)
    db.commit()
    db.refresh(exam)
    return exam


@router.delete(
    "/{exam_ref}",
    status_code=204,
    dependencies=[Depends(require_role("admin", "super_admin"))],
)
def delete_exam(exam_ref: str, db: Session = Depends(get_db)):
    exam = _find_exam(db, exam_ref)
    if exam is None:
        raise HTTPException(status_code=404, detail="Exam not found")
    db.delete(exam)
    db.commit()