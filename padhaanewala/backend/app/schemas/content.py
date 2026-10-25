from datetime import date, datetime
from typing import Any

from pydantic import BaseModel, Field, field_validator


class ReviewCreate(BaseModel):
    college_id: int
    course_id: int | None = None
    rating: int = Field(ge=1, le=5)
    review_text: str | None = None
    year_of_study: str | None = None
    images: list[str] | None = None


class ReviewUpdate(BaseModel):
    rating: int | None = Field(None, ge=1, le=5)
    review_text: str | None = None
    year_of_study: str | None = None
    images: list[str] | None = None


class ReviewModerate(BaseModel):
    status: str = Field(..., pattern="^(approved|rejected)$")
    moderation_notes: str | None = None


class ReviewResponse(BaseModel):
    id: int
    college_id: int
    college_name: str | None = None
    course_id: int | None
    course_name: str | None = None
    student_id: int
    student_name: str | None = None
    rating: float
    review_text: str | None
    year_of_study: str | None
    images: list | None
    status: str
    moderation_notes: str | None
    is_verified: bool
    moderated_at: datetime | None
    created_at: datetime

    model_config = {"from_attributes": True}


class BlogCategoryCreate(BaseModel):
    name: str = Field(min_length=2, max_length=100)
    slug: str | None = None


class BlogCategoryResponse(BaseModel):
    id: int
    name: str
    slug: str
    is_active: bool
    blog_count: int = 0

    model_config = {"from_attributes": True}


class BlogCreate(BaseModel):
    title: str = Field(min_length=2, max_length=255)
    slug: str | None = None
    content: str
    excerpt: str | None = None
    featured_image_url: str | None = None
    category_id: int | None = None
    status: str = Field("draft", pattern="^(draft|published)$")
    meta_title: str | None = None
    meta_description: str | None = None
    canonical_url: str | None = None
    is_featured: bool = False


class BlogUpdate(BaseModel):
    title: str | None = None
    content: str | None = None
    excerpt: str | None = None
    featured_image_url: str | None = None
    category_id: int | None = None
    status: str | None = Field(None, pattern="^(draft|published)$")
    meta_title: str | None = None
    meta_description: str | None = None
    canonical_url: str | None = None
    is_featured: bool | None = None


class BlogResponse(BaseModel):
    id: int
    title: str
    slug: str
    content: str
    excerpt: str | None
    featured_image_url: str | None
    category_id: int | None
    category_name: str | None = None
    author_id: int | None
    author_name: str | None = None
    status: str
    published_at: datetime | None
    meta_title: str | None
    meta_description: str | None
    canonical_url: str | None
    is_featured: bool
    view_count: int
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class FAQCreate(BaseModel):
    question: str
    answer: str | None = None
    entity_type: str = Field(max_length=50)
    entity_id: int
    display_order: int = 0


class FAQUpdate(BaseModel):
    question: str | None = None
    answer: str | None = None
    display_order: int | None = None
    is_active: bool | None = None


class FAQResponse(BaseModel):
    id: int
    question: str
    answer: str | None
    entity_type: str
    entity_id: int
    display_order: int
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class MediaCreate(BaseModel):
    url: str
    file_name: str
    file_type: str | None = None
    file_size: int | None = None
    alt_text: str | None = None
    entity_type: str = Field(max_length=50)
    entity_id: int
    image_type: str | None = None
    display_order: int = 0


class MediaUpdate(BaseModel):
    alt_text: str | None = None
    file_name: str | None = None
    display_order: int | None = None
    image_type: str | None = None
    is_active: bool | None = None


class MediaResponse(BaseModel):
    id: int
    url: str
    file_name: str
    file_type: str | None
    file_size: int | None
    alt_text: str | None
    entity_type: str
    entity_id: int
    image_type: str | None
    display_order: int
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class SeoMetadataUpsert(BaseModel):
    meta_title: str | None = None
    meta_description: str | None = None
    og_title: str | None = None
    og_description: str | None = None
    og_image_url: str | None = None
    structured_data: dict[str, Any] | None = None
    canonical_url: str | None = None


class SeoMetadataResponse(BaseModel):
    id: int
    entity_type: str
    entity_id: int
    meta_title: str | None
    meta_description: str | None
    og_title: str | None
    og_description: str | None
    og_image_url: str | None
    structured_data: dict[str, Any] | None
    canonical_url: str | None
    updated_at: datetime

    model_config = {"from_attributes": True}


class NotificationCreate(BaseModel):
    """Send a notification.

    ``user_id`` is optional. Omitting it is a *broadcast*: one row is written per
    active student, because ``notifications.user_id`` is ``NOT NULL`` with a
    foreign key — there is no representation of "a message to everyone" in the
    schema, and pretending otherwise by accepting a null would mean every read
    path in the app had to handle a recipient-less row.

    Naming a ``user_id`` targets that one account and is what the per-user
    callers use.
    """

    user_id: int | None = None
    type: str = Field(max_length=50)
    title: str = Field(min_length=1, max_length=255)
    message: str | None = None
    data: dict[str, Any] | None = None
    channel: str = "in_app"


class NotificationResponse(BaseModel):
    id: int
    user_id: int
    type: str
    title: str
    message: str | None
    data: dict[str, Any] | None
    is_read: bool
    channel: str
    created_at: datetime

    model_config = {"from_attributes": True}


class AdminNotificationResponse(NotificationResponse):
    """``NotificationResponse`` plus the recipient, for the admin broadcast log.

    A log that cannot say who received a message is not much of a log, so the
    recipient's display name travels with the row rather than being resolved by
    a second request per entry.
    """

    username: str | None = None


class NotificationBroadcastResult(BaseModel):
    """What a broadcast actually did.

    Returned instead of a bare row because a broadcast writes N rows and a
    client that cannot tell 1 from 500 has no way to report it accurately.
    """

    created: int
    recipients: list[AdminNotificationResponse]


class AuditLogResponse(BaseModel):
    id: int
    user_id: int | None
    username: str | None = None
    action: str
    entity_type: str
    entity_id: int | None
    old_value: dict[str, Any] | None
    new_value: dict[str, Any] | None
    ip_address: str | None
    created_at: datetime

    model_config = {"from_attributes": True}


def _validate_banner_link(value: str | None) -> str | None:
    """Accept an internal path or an absolute `http(s)` URL, nothing else.

    A banner link is rendered into an `<a href>`, so `javascript:` or
    `data:` would be stored XSS with an admin's blessing — and the console
    lets content roles, not just super admins, write it. `//evil.example`
    is rejected too: it is protocol-relative, so it leaves the site while
    looking like a path to everyone skimming the row.
    """
    if value is None:
        return None
    value = value.strip()
    if not value:
        return None
    lowered = value.lower()
    if lowered.startswith(("javascript:", "data:", "vbscript:", "file:")):
        raise ValueError("link_url must be an internal path or an http(s) URL")
    if value.startswith("//"):
        raise ValueError("protocol-relative links are not allowed")
    if value.startswith("/"):
        return value
    if lowered.startswith(("http://", "https://")):
        return value
    raise ValueError("link_url must start with '/' or 'http(s)://'")


def _validate_banner_title(value: str | None) -> str | None:
    """Trim a title and refuse one that is empty after trimming.

    `min_length=1` alone accepts `" "`, which stores a card that renders as a
    blank row — the title is the only text both layouts are guaranteed to show,
    so a whitespace-only value is a data-entry bug that looks like a layout bug
    from the admin's side. Returning the trimmed value also means the leading
    space does not survive in the database.
    """
    if value is None:
        return None
    trimmed = value.strip()
    if not trimmed:
        raise ValueError("title must not be blank")
    return trimmed


class BannerCreate(BaseModel):
    title: str = Field(min_length=1, max_length=255)
    #: CTA line under the title; only the `hero_card` position renders it.
    subtitle: str | None = Field(None, max_length=120)
    image_url: str
    link_url: str | None = None
    position: str = "home_top"
    display_order: int = 0
    is_active: bool = True
    start_date: date | None = None
    end_date: date | None = None

    @field_validator("title")
    @classmethod
    def _check_title(cls, value: str) -> str:
        return _validate_banner_title(value)  # type: ignore[return-value]

    @field_validator("link_url")
    @classmethod
    def _check_link(cls, value: str | None) -> str | None:
        return _validate_banner_link(value)


class BannerUpdate(BaseModel):
    title: str | None = Field(None, min_length=1, max_length=255)
    subtitle: str | None = Field(None, max_length=120)
    image_url: str | None = None
    link_url: str | None = None
    position: str | None = None
    display_order: int | None = None
    is_active: bool | None = None
    start_date: date | None = None
    end_date: date | None = None

    @field_validator("title")
    @classmethod
    def _check_title(cls, value: str | None) -> str | None:
        # `None` means the console did not send the field (an update that
        # leaves the title alone); a blank string is still an error.
        return _validate_banner_title(value)

    @field_validator("link_url")
    @classmethod
    def _check_link(cls, value: str | None) -> str | None:
        # `None` here means "the console sent an explicit null", i.e. clear the
        # link — which is a legal edit, and distinct from the field being
        # absent (`exclude_unset` keeps that out of the diff entirely).
        return _validate_banner_link(value)


class BannerResponse(BaseModel):
    id: int
    title: str
    subtitle: str | None = None
    image_url: str
    link_url: str | None
    position: str
    display_order: int
    is_active: bool
    start_date: date | None
    end_date: date | None
    created_at: datetime

    model_config = {"from_attributes": True}