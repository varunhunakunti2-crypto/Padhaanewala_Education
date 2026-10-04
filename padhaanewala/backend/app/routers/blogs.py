import re
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response
from sqlalchemy import func, or_, select, update
from sqlalchemy.orm import Session, selectinload

from app.database import get_db
from app.dependencies import get_current_user, get_current_user_roles, get_optional_current_user, require_role
from app.roles import ADMIN_ROLES, BLOG_ROLES as CONTENT_ROLES
from app.models import Blog, BlogCategory, User
from app.schemas.content import (
    BlogCategoryCreate,
    BlogCategoryResponse,
    BlogCreate,
    BlogResponse,
    BlogUpdate,
)
from app.utils import audit

router = APIRouter(prefix="/api/v1", tags=["blogs"])


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
def list_categories(
    # No `limit`/`offset` existed here, so the frontend's paged walk received the
    # same full list on every page and duplicated rows until it hit its 5000-row
    # ceiling. See `universities.list_universities`.
    limit: int = Query(50, ge=1, le=50),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
):
    rows = db.execute(
        select(BlogCategory, func.count(Blog.id))
        .outerjoin(Blog, Blog.category_id == BlogCategory.id)
        .where(BlogCategory.is_active)
        .group_by(BlogCategory.id)
        .order_by(BlogCategory.name)
        .limit(limit)
        .offset(offset)
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
    limit: int = Query(20, ge=1, le=50),
    offset: int = 0,
    db: Session = Depends(get_db),
    user: User | None = Depends(get_optional_current_user),
):
    query = (
        select(Blog)
        .order_by(Blog.published_at.desc().nullslast(), Blog.created_at.desc())
    )
    is_content_user = user is not None and not get_current_user_roles(user).isdisjoint(CONTENT_ROLES)
    if is_content_user and status:
        query = query.where(Blog.status == status)
    else:
        query = query.where(Blog.status == "published")
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
    # 4.6 — a GET must not mutate. `view_count` was incremented and committed
    # here, which was neither safe nor idempotent and let a loop inflate the
    # counter. The explicit `POST /blogs/{ref}/view` endpoint owns it now.
    cond = (
        Blog.id == int(blog_ref) if blog_ref.isdigit() else Blog.slug == blog_ref
    )
    blog = db.scalar(select(Blog).where(cond, Blog.status == "published"))
    if blog is None:
        raise HTTPException(status_code=404, detail="Blog not found")
    return _to_blog_response(db, blog)


@router.post("/blogs/{blog_ref}/view", status_code=204)
def record_blog_view(blog_ref: str, db: Session = Depends(get_db)):
    """Count one view atomically, in isolation from the read path.

    Answers 204 whether or not the blog (or an unpublished one) exists, so the
    endpoint is not a blog-existence oracle for someone enumerating slugs.
    `view_count = Blog.view_count + 1` is a single UPDATE, so two concurrent
    views can never overwrite each other.
    """
    cond = (
        Blog.id == int(blog_ref) if blog_ref.isdigit() else Blog.slug == blog_ref
    )
    blog = db.scalar(select(Blog).where(cond, Blog.status == "published"))
    if blog is not None:
        db.execute(
            update(Blog)
            .where(Blog.id == blog.id)
            .values(view_count=Blog.view_count + 1)
        )
        db.commit()
    return Response(status_code=204)

@router.post(
    "/blogs",
    response_model=BlogResponse,
    status_code=201,
    dependencies=[Depends(require_role(*CONTENT_ROLES))],
)
def create_blog(
    payload: BlogCreate,
    request: Request,
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
    # 4.4 — the update and delete paths were already audited, so a blog that
    # only ever existed could not be traced back to whoever created it.
    # Flushed first so `blog.id` can be stamped on the row, and written after
    # the slug check, so a refused create leaves no phantom entry.
    db.flush()
    audit.record(
        db,
        request=request,
        action="create_blog",
        entity_type="blog",
        entity_id=blog.id,
        actor=user,
        new_value=payload.model_dump(),
    )
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
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    cond = Blog.id == int(blog_ref) if blog_ref.isdigit() else Blog.slug == blog_ref
    blog = db.scalar(select(Blog).where(cond))
    if blog is None:
        raise HTTPException(status_code=404, detail="Blog not found")

    audit.record(
        db,
        request=request,
        action="update_blog",
        entity_type="blog",
        entity_id=blog.id,
        actor=user,
        old_value={"title": blog.title, "status": blog.status},
        new_value=payload.model_dump(exclude_unset=True),
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
    dependencies=[Depends(require_role(*ADMIN_ROLES))],
)
def delete_blog(
    blog_ref: str,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    cond = Blog.id == int(blog_ref) if blog_ref.isdigit() else Blog.slug == blog_ref
    blog = db.scalar(select(Blog).where(cond))
    if blog is None:
        raise HTTPException(status_code=404, detail="Blog not found")
    # 4.4/4.5 — enough to reconstruct what existed after the row is gone, plus
    # the caller's IP. The row is written before the delete.
    audit.record(
        db,
        request=request,
        action="delete_blog",
        entity_type="blog",
        entity_id=blog.id,
        actor=user,
        old_value={
            "title": blog.title,
            "slug": blog.slug,
            "content_length": len(blog.content) if blog.content else 0,
        },
    )
    db.delete(blog)
    db.commit()