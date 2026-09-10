from datetime import date, datetime
from typing import Any

from pydantic import BaseModel, Field


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
    user_id: int
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


class BannerCreate(BaseModel):
    title: str
    image_url: str
    link_url: str | None = None
    position: str = "home_top"
    display_order: int = 0
    is_active: bool = True
    start_date: date | None = None
    end_date: date | None = None


class BannerUpdate(BaseModel):
    title: str | None = None
    image_url: str | None = None
    link_url: str | None = None
    position: str | None = None
    display_order: int | None = None
    is_active: bool | None = None
    start_date: date | None = None
    end_date: date | None = None


class BannerResponse(BaseModel):
    id: int
    title: str
    image_url: str
    link_url: str | None
    position: str
    display_order: int
    is_active: bool
    start_date: date | None
    end_date: date | None
    created_at: datetime

    model_config = {"from_attributes": True}