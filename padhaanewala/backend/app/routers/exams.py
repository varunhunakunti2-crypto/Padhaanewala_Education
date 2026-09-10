from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Exam
from app.schemas.catalog import ExamResponse

router = APIRouter(prefix="/api/v1/exams", tags=["exams"])


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


@router.get("/{exam_id}", response_model=ExamResponse)
def get_exam(exam_id: int, db: Session = Depends(get_db)):
    exam = db.scalar(
        select(Exam).where(Exam.id == exam_id, Exam.is_active)
    )
    if exam is None:
        raise HTTPException(status_code=404, detail="Exam not found")
    return exam