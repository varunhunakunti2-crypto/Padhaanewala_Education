from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class CollegeSubmission(Base):
    """A public "suggest a college" proposal awaiting staff review.

    Deliberately *not* a `College` row. A submission is untrusted, user-authored
    prose that a human has not yet checked, and the one property the whole
    workflow exists to guarantee is that it never becomes a published college
    record by itself. Approval is the only path from here to `colleges`, and it
    materialises the college explicitly rather than by flipping a flag.

    The `proposed_*` prefix is not decoration: it keeps the submitter's guesses
    (`proposed_university_name`, `proposed_state_name`) visibly distinct from the
    curated `universities`/`states` the admin console reads, so nobody mistakes
    a free-text field for a resolved foreign key.
    """

    __tablename__ = "college_submissions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)

    #: Who submitted it. SET NULL, not CASCADE: a submission is evidence, and
    #: deleting a student's account must not erase the record that they proposed
    #: a college — the queue row and its audit trail stay readable.
    submitted_by: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True
    )

    proposed_name: Mapped[str] = mapped_column(String(255), index=True)
    proposed_official_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    proposed_college_type: Mapped[str | None] = mapped_column(String(50), nullable=True)
    proposed_ownership: Mapped[str | None] = mapped_column(String(50), nullable=True)
    #: Free text, matched to a `University` row by exact name at approval time.
    proposed_university_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    proposed_state_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("states.id", ondelete="SET NULL"), nullable=True, index=True
    )
    proposed_state_name: Mapped[str | None] = mapped_column(String(100), nullable=True)
    proposed_city: Mapped[str | None] = mapped_column(String(100), nullable=True)
    proposed_address: Mapped[str | None] = mapped_column(Text, nullable=True)
    proposed_website: Mapped[str | None] = mapped_column(String(255), nullable=True)
    proposed_email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    proposed_phone: Mapped[str | None] = mapped_column(String(20), nullable=True)
    proposed_overview: Mapped[str | None] = mapped_column(Text, nullable=True)
    submitter_notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    #: `pending | approved | rejected | changes_requested`.
    status: Mapped[str] = mapped_column(String(20), default="pending", index=True)

    reviewer_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    reviewer_notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    reviewed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    #: The college this submission became or was linked to, once approved; NULL
    #: until then. Set for *both* approve outcomes — a name that already existed
    #: (live or archived) is linked rather than duplicated — because the response
    #: resolves `college_name`/`college_slug`/`college_is_active` from this id.
    college_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("colleges.id", ondelete="SET NULL"), nullable=True, index=True
    )
    #: A reviewer hint: the closest existing college seen at submit time. Advisory
    #: only — a human decides whether it is a true duplicate.
    possible_duplicate_college_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("colleges.id", ondelete="SET NULL"), nullable=True
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=datetime.now
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=datetime.now, onupdate=datetime.now
    )

    submitter: Mapped["User | None"] = relationship(
        foreign_keys=[submitted_by], back_populates="college_submissions"
    )
    reviewer: Mapped["User | None"] = relationship(foreign_keys=[reviewer_id])
    college: Mapped["College | None"] = relationship(foreign_keys=[college_id])
    possible_duplicate_college: Mapped["College | None"] = relationship(
        foreign_keys=[possible_duplicate_college_id]
    )
    proposed_state: Mapped["State | None"] = relationship(foreign_keys=[proposed_state_id])
