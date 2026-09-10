import re
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session, selectinload

from app.database import get_db
from app.dependencies import get_current_user, require_role
from app.models import AuditLog, Blog, BlogCategory, User
from app.schemas.content import (
    BlogCategoryCreate,
    BlogCategoryResponse,
    BlogCreate,
    BlogResponse,
    BlogUpdate,
)

router = APIRouter(prefix="/api/v1", tags=["blogs"])

CONTENT_ROLES = ("admin", "super_admin", "content_manager", "author")


def _slugify(text: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", text.strip().lower()).strip("-")
    return slug or "blog"


def _to_blog_response(db: Session, blog: Blog) -> BlogResponse:
    author = db.get(User, blog.author_id) if blog.author_id else None
    category = db.get(BlogCategory, blog.category_id) if blog.category_id else None
    return BlogResponse(
        id=blog.id,
        title=blog.title,
        slug=blog.slug,
        content=blog.content,
        excerpt=blog.excerpt,
        featured_image_url=blog.featured_image_url,
        category_id=blog.category_id,
        category_name=category.name if category else None,
        author_id=blog.author_id,
        author_name=author.display_name if author else None,
        status=blog.status,
        published_at=blog.published_at,
        meta_title=blog.meta_title,
        meta_description=blog.meta_description,
        canonical_url=blog.canonical_url,
        is_featured=blog.is_featured,
        view_count=blog.view_count,
        created_at=blog.created_at,
        updated_at=blog.updated_at,
    )


@router.get("/blog-categories", response_model=list[BlogCategoryResponse])
def list_categories(db: Session = Depends(get_db)):
    rows = db.execute(
        select(BlogCategory, func.count(Blog.id))
        .outerjoin(Blog, Blog.category_id == BlogCategory.id)
        .where(BlogCategory.is_active)
        .group_by(BlogCategory.id)
        .order_by(BlogCategory.name)
    ).all()
    return [
        BlogCategoryResponse(
            id=cat.id, name=cat.name, slug=cat.slug, is_active=cat.is_active, blog_count=count
        )
        for cat, count in rows
    ]


@router.post(
    "/blog-categories",
    response_model=BlogCategoryResponse,
    status_code=201,
    dependencies=[Depends(require_role(*CONTENT_ROLES))],
)
def create_category(
    payload: BlogCategoryCreate, db: Session = Depends(get_db)
):
    slug = payload.slug or _slugify(payload.name)
    if db.scalar(select(BlogCategory).where(BlogCategory.slug == slug)):
        raise HTTPException(status_code=400, detail="Category with this slug exists")
    category = BlogCategory(name=payload.name, slug=slug)
    db.add(category)
    db.commit()
    db.refresh(category)
    return BlogCategoryResponse(
        id=category.id, name=category.name, slug=category.slug,
        is_active=category.is_active,
    )


@router.get("/blogs", response_model=list[BlogResponse])
def list_blogs(
    category: str | None = None,
    status: str | None = Query(None, pattern="^(draft|published)$"),
    featured: bool | None = None,
    limit: int = 20,
    offset: int = 0,
    db: Session = Depends(get_db),
):
    query = (
        select(Blog)
        .where(Blog.status == "published")
        .order_by(Blog.published_at.desc().nullslast(), Blog.created_at.desc())
    )
    if category:
        cat = db.scalar(select(BlogCategory).where(BlogCategory.slug == category))
        if cat is None:
            return []
        query = query.where(Blog.category_id == cat.id)
    if featured:
        query = query.where(Blog.is_featured)
    blogs = db.scalars(query.limit(limit).offset(offset)).all()
    return [_to_blog_response(db, b) for b in blogs]


@router.get("/blogs/{blog_ref}", response_model=BlogResponse)
def get_blog(blog_ref: str, db: Session = Depends(get_db)):
    cond = (
        Blog.id == int(blog_ref) if blog_ref.isdigit() else Blog.slug == blog_ref
    )
    blog = db.scalar(select(Blog).where(cond, Blog.status == "published"))
    if blog is None:
        raise HTTPException(status_code=404, detail="Blog not found")
    blog.view_count += 1
    db.commit()
    return _to_blog_response(db, blog)


@router.post(
    "/blogs",
    response_model=BlogResponse,
    status_code=201,
    dependencies=[Depends(require_role(*CONTENT_ROLES))],
)
def create_blog(
    payload: BlogCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    slug = payload.slug or _slugify(payload.title)
    if db.scalar(select(Blog).where(Blog.slug == slug)):
        raise HTTPException(status_code=400, detail="Blog with this slug exists")
    blog = Blog(
        title=payload.title,
        slug=slug,
        content=payload.content,
        excerpt=payload.excerpt,
        featured_image_url=payload.featured_image_url,
        category_id=payload.category_id,
        author_id=user.id,
        status=payload.status,
        published_at=datetime.now(timezone.utc) if payload.status == "published" else None,
        meta_title=payload.meta_title,
        meta_description=payload.meta_description,
        canonical_url=payload.canonical_url,
        is_featured=payload.is_featured,
    )
    db.add(blog)
    db.commit()
    db.refresh(blog)
    return _to_blog_response(db, blog)


@router.put(
    "/blogs/{blog_ref}",
    response_model=BlogResponse,
    dependencies=[Depends(require_role(*CONTENT_ROLES))],
)
def update_blog(
    blog_ref: str,
    payload: BlogUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    cond = Blog.id == int(blog_ref) if blog_ref.isdigit() else Blog.slug == blog_ref
    blog = db.scalar(select(Blog).where(cond))
    if blog is None:
        raise HTTPException(status_code=404, detail="Blog not found")

    db.add(
        AuditLog(
            user_id=user.id,
            action="update_blog",
            entity_type="blog",
            entity_id=blog.id,
            old_value={"title": blog.title, "status": blog.status},
            new_value=payload.model_dump(exclude_unset=True),
        )
    )

    data = payload.model_dump(exclude_unset=True)
    if "title" in data and data["title"] != blog.title:
        slug = _slugify(data["title"])
        if db.scalar(select(Blog).where(Blog.slug == slug, Blog.id != blog.id)):
            raise HTTPException(status_code=400, detail="Blog with this slug exists")
        blog.slug = slug
    if "status" in data and data["status"] == "published" and blog.published_at is None:
        blog.published_at = datetime.now(timezone.utc)
    for field, value in data.items():
        setattr(blog, field, value)
    db.commit()
    db.refresh(blog)
    return _to_blog_response(db, blog)


@router.delete(
    "/blogs/{blog_ref}",
    status_code=204,
    dependencies=[Depends(require_role("admin", "super_admin"))],
)
def delete_blog(
    blog_ref: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    cond = Blog.id == int(blog_ref) if blog_ref.isdigit() else Blog.slug == blog_ref
    blog = db.scalar(select(Blog).where(cond))
    if blog is None:
        raise HTTPException(status_code=404, detail="Blog not found")
    db.add(
        AuditLog(
            user_id=user.id,
            action="delete_blog",
            entity_type="blog",
            entity_id=blog.id,
            old_value={"title": blog.title},
        )
    )
    db.delete(blog)
    db.commit()