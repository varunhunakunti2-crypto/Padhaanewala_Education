"""Pydantic schemas for the public "suggest a college" submission workflow.

Three shapes, one rule: a submission is *proposed*, never *asserted*. Every field
a submitter can touch is prefixed `proposed_` so the API never presents a
user's guess as a resolved fact. The response model adds the resolved names
(`submitter_name`, `college_slug`) the console needs to render a row without an
N+1 lookup.

`CollegeSubmissionCreate` is the only place the public write surface is
validated, and it is deliberately stricter than `CollegeCreate`: it sanitises
control characters out of free text and validates the website as an absolute
http(s) URL, because the data arrives from anonymous-ish callers and is echoed
back to reviewers and (on approval) to the public site.
"""

import re
from datetime import datetime
from typing import Literal
from urllib.parse import urlparse

from pydantic import BaseModel, ConfigDict, Field, field_validator

#: Submitted-college status values an admin can move a row to.
ReviewedStatus = Literal["approved", "rejected", "changes_requested"]


def _strip_control_chars(value: str) -> str:
    """Drop C0/C1 control characters and trim.

    Free text typed by a public submitter can carry stray control bytes (from a
    paste, a bad keyboard, or an attempt to smuggle formatting). They are never
    meaningful in a college name or overview, they break terminal/log rendering
    of the review queue, and stripping here keeps the stored value clean rather
    than leaving every consumer to sanitise independently.
    """
    cleaned = "".join(ch for ch in value if ch >= " " and ch != "\x7f")
    return cleaned.strip()


def _validated_name(value: str) -> str:
    """Sanitise a proposed name and re-check what ``Field(min_length=…)`` cannot.

    Pydantic applies `min_length` to the **raw** input, before this runs, so
    `"  a  "` satisfies `min_length=2` and reaches the cleaning step as five
    characters — and `"\x01\x01"` does the same. Checked against the raw value,
    a name that is one character long (or, after a control-byte paste, no
    characters at all) is stored in a NOT NULL column and later approved into a
    college whose `slug` is `""`.

    The letter-or-digit rule closes the sibling hole: punctuation alone
    (`"--"`) clears the length check but slugifies to `""`, and `_slugify` is
    exactly what `_create_college_from_submission` writes into the unique
    `colleges.slug`. Refusing it here turns a 500 on the unique index into a 422
    at the keyboard.
    """
    cleaned = _strip_control_chars(value)
    if len(cleaned) < 2:
        raise ValueError("A college name needs at least 2 characters.")
    if not re.search(r"[a-z0-9]", cleaned.lower()):
        raise ValueError("A college name needs at least one letter or number.")
    return cleaned


def _validate_website_value(value: str | None) -> str | None:
    """Require an absolute http(s) URL with a host.

    The value is published on the college card and detail page once approved, and
    is rendered inside an anchor `href`. A relative or scheme-less value would
    either 404 or be interpreted as a relative path on our own origin (an
    open-redirect foot-gun), and a `javascript:` scheme would be an XSS vector.
    Validating here means the bad value never reaches the table.
    """
    if value is None:
        return None
    candidate = value.strip()
    if not candidate:
        return None
    parsed = urlparse(candidate)
    if parsed.scheme not in ("http", "https"):
        raise ValueError("Website must start with http:// or https://")
    if not parsed.netloc:
        raise ValueError("Website must include a host, e.g. https://example.edu.in")
    return candidate


def _validate_email_value(value: str | None) -> str | None:
    """A light shape check, not RFC compliance.

    Full RFC 5322 validation needs the `email-validator` dependency, which this
    project does not carry. A `local@host.tld` shape check rejects the typos that
    actually arrive (a missing `@`, a missing dot) without adding a dependency to
    catch the rest.
    """
    if value is None:
        return None
    candidate = value.strip()
    if not candidate:
        return None
    if candidate.count("@") != 1 or "." not in candidate.split("@", 1)[1]:
        raise ValueError("Enter a valid email address")
    return candidate


class CollegeSubmissionCreate(BaseModel):
    """The public proposal payload. All fields optional except the name."""

    model_config = ConfigDict(extra="forbid")

    proposed_name: str = Field(min_length=2, max_length=255)
    proposed_official_name: str | None = Field(default=None, max_length=255)
    proposed_college_type: str | None = Field(default=None, max_length=50)
    proposed_ownership: str | None = Field(default=None, max_length=50)
    proposed_university_name: str | None = Field(default=None, max_length=255)
    proposed_state_id: int | None = None
    proposed_state_name: str | None = Field(default=None, max_length=100)
    proposed_city: str | None = Field(default=None, max_length=100)
    proposed_address: str | None = None
    proposed_website: str | None = Field(default=None, max_length=255)
    proposed_email: str | None = Field(default=None, max_length=255)
    proposed_phone: str | None = Field(default=None, max_length=20)
    proposed_overview: str | None = None
    submitter_notes: str | None = None

    @field_validator(
        "proposed_official_name",
        "proposed_college_type",
        "proposed_ownership",
        "proposed_university_name",
        "proposed_state_name",
        "proposed_city",
        "proposed_address",
        "proposed_overview",
        "submitter_notes",
    )
    @classmethod
    def _clean_text(cls, value: str | None) -> str | None:
        if value is None:
            return None
        return _strip_control_chars(value)

    @field_validator("proposed_name")
    @classmethod
    def _clean_name(cls, value: str) -> str:
        # Deliberately separate from `_clean_text`: the name carries two rules
        # the other free-text fields do not (a minimum length, and a character
        # class the slugifier can actually turn into a slug), both of which have
        # to be evaluated *after* the strip rather than on the raw input.
        return _validated_name(value)

    @field_validator("proposed_website")
    @classmethod
    def _validate_website(cls, value: str | None) -> str | None:
        return _validate_website_value(value)

    @field_validator("proposed_email")
    @classmethod
    def _validate_email(cls, value: str | None) -> str | None:
        return _validate_email_value(value)

    @field_validator("proposed_phone")
    @classmethod
    def _clean_phone(cls, value: str | None) -> str | None:
        return _strip_control_chars(value) if value is not None else None


class CollegeSubmissionUpdate(BaseModel):
    """Owner edit while a submission is still revisable."""

    model_config = ConfigDict(extra="forbid")

    proposed_name: str | None = Field(default=None, min_length=2, max_length=255)
    proposed_official_name: str | None = Field(default=None, max_length=255)
    proposed_college_type: str | None = Field(default=None, max_length=50)
    proposed_ownership: str | None = Field(default=None, max_length=50)
    proposed_university_name: str | None = Field(default=None, max_length=255)
    proposed_state_id: int | None = None
    proposed_state_name: str | None = Field(default=None, max_length=100)
    proposed_city: str | None = Field(default=None, max_length=100)
    proposed_address: str | None = None
    proposed_website: str | None = Field(default=None, max_length=255)
    proposed_email: str | None = Field(default=None, max_length=255)
    proposed_phone: str | None = Field(default=None, max_length=20)
    proposed_overview: str | None = None
    submitter_notes: str | None = None

    @field_validator("proposed_name")
    @classmethod
    def _clean_name(cls, value: str | None) -> str | None:
        # An explicit `null` is *set*, not omitted: `model_dump(exclude_unset=True)`
        # keeps it, the router does `setattr`, and the NOT NULL column then raises
        # a unique/constraint IntegrityError — a 500 for what is a plain client
        # mistake. Absent (the default) never reaches here with `validate_default`
        # off, which is what keeps "leave the name alone" working.
        if value is None:
            raise ValueError("College name cannot be null.")
        return _validated_name(value)

    @field_validator("proposed_website")
    @classmethod
    def _validate_website(cls, value: str | None) -> str | None:
        return _validate_website_value(value)

    @field_validator("proposed_email")
    @classmethod
    def _validate_email(cls, value: str | None) -> str | None:
        return _validate_email_value(value)


class SubmissionReview(BaseModel):
    """Reviewer note carried by approve / reject / request-changes."""

    model_config = ConfigDict(extra="forbid")

    reviewer_notes: str | None = Field(default=None, max_length=2000)

    @field_validator("reviewer_notes")
    @classmethod
    def _clean_notes(cls, value: str | None) -> str | None:
        return _strip_control_chars(value) if value is not None else None


class CollegeSubmissionResponse(BaseModel):
    """A queue row plus the resolved names the console renders."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    submitted_by: int | None
    submitter_name: str | None = None

    proposed_name: str
    proposed_official_name: str | None
    proposed_college_type: str | None
    proposed_ownership: str | None
    proposed_university_name: str | None
    proposed_state_id: int | None
    proposed_state_name: str | None
    proposed_city: str | None
    proposed_address: str | None
    proposed_website: str | None
    proposed_email: str | None
    proposed_phone: str | None
    proposed_overview: str | None
    submitter_notes: str | None

    status: str
    reviewer_id: int | None
    reviewer_name: str | None = None
    reviewer_notes: str | None
    reviewed_at: datetime | None

    college_id: int | None
    college_name: str | None = None
    college_slug: str | None = None
    #: Whether the linked college is live in the catalogue. Exposed rather than
    #: left out because approval now *links* an archived college instead of
    #: creating a duplicate slug, and `GET /colleges/{slug}` filters on
    #: `is_active` — so the UI has to know, or it renders a link that 404s.
    college_is_active: bool | None = None
    possible_duplicate_college_id: int | None
    possible_duplicate_college_name: str | None = None

    created_at: datetime
    updated_at: datetime
