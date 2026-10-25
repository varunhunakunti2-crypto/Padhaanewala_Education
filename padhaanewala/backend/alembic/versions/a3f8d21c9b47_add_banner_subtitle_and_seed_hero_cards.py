"""Admin-editable hero cards: add `banners.subtitle` and seed the hero slot.

    Revision ID: a3f8d21c9b47
    Revises: 2f6cf2af09de
    Create Date: 2026-10-21 00:00:00.000000

Re-parented onto `2f6cf2af09de` when this migration met the
`add_colleges_filter_indexes` head on `feature/add-college`. It was authored
against `e6b2f4a90c31` on `main`, which left two heads once the branches
merged; the chain here is kept strictly linear (no merge revisions), so the
newer revision is the parent. Nothing in this migration depends on the order
of the two, it only touches `banners`.

The hero section's three floating cards ("Top Engineering Colleges",
"Scholarships", "Compare Colleges") were hardcoded in
`frontend/components/home/hero/HeroVisualPanel.tsx`, so an admin could not
surface a new exam or feature without a code change and a redeploy.

They are now `banners` rows at `position='hero_card'`. The `banners` table
already carried everything a promotable card needs — title, image, link,
`display_order`, `is_active`, and a start/end schedule — so this reuses it
rather than adding a parallel table. The one thing it lacked was the small
CTA line under the title ("Find opportunities"), which only the hero layout
renders, so `subtitle` is a nullable column rather than a required one:
`home_top` strip banners simply leave it NULL.

The three rows are seeded here (like `site_settings`) so a migrated database
shows the console what visitors already see, instead of an empty panel over
a still-hardcoded page. The values mirror the literals the hero shipped with.

Seeding is guarded on "no `hero_card` rows exist" rather than a primary key,
because `banners.id` is a plain autoincrement: re-running the insert would
otherwise duplicate the cards. An operator who has since deleted all hero
cards on purpose will get them back on the next `upgrade`, which is the
intended trade — losing the slot entirely is worse than re-seeding it, and
the admin can pause each card individually.
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "a3f8d21c9b47"
down_revision: str | Sequence[str] | None = "2f6cf2af09de"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

# (title, subtitle, image_url, link_url, display_order) — the three cards the
# hero rendered from `FLOATING_CARDS`, in their shipped order.
_HERO_CARDS = [
    (
        "Top Engineering Colleges in India",
        "Explore now",
        "https://images.unsplash.com/photo-1562774053-701939374585?auto=format&fit=crop&w=160&h=160&q=80",
        "/colleges?stream=engineering",
        1,
    ),
    (
        "Scholarships for Your Goals",
        "Find opportunities",
        "https://images.unsplash.com/photo-1523240795612-9a054b0db644?auto=format&fit=crop&w=160&h=160&q=80",
        "/scholarships",
        2,
    ),
    (
        "Compare Colleges Side by Side",
        "Make smarter choices",
        "https://images.unsplash.com/photo-1541339907198-e08756dedf3f?auto=format&fit=crop&w=160&h=160&q=80",
        "/compare",
        3,
    ),
]


def upgrade() -> None:
    op.add_column(
        "banners",
        sa.Column("subtitle", sa.String(length=120), nullable=True),
    )

    # Seed only on a database that has no hero cards yet. `created_at`/
    # `updated_at` are non-null without a server default (the model applies
    # `datetime.now` in Python), so the raw insert must set them itself.
    #
    # The guard is a separate `SELECT` rather than a `WHERE NOT EXISTS` on each
    # `INSERT`: the latter is re-evaluated per statement, so after the first
    # card lands the condition is false and the other two are silently skipped
    # — three rows intended, one row seeded. Reading the flag once is what
    # makes "seed the slot" atomic in intent, not just per-statement.
    #
    # `op.execute` accepts a single statement, not a `(sql, params)` pair, so
    # the values are bound onto the text with `bindparams`. Literal
    # interpolation would work for these constants, but binds keep the statement
    # that ran identical to the one in the log.
    already_seeded = op.get_bind().execute(
        sa.text("SELECT EXISTS (SELECT 1 FROM banners WHERE position = 'hero_card')")
    ).scalar()

    if not already_seeded:
        insert = sa.text(
            """
            INSERT INTO banners
                (title, subtitle, image_url, link_url, position,
                 display_order, is_active, created_at, updated_at)
            VALUES
                (:title, :subtitle, :image_url, :link_url, 'hero_card',
                 :display_order, TRUE, NOW(), NOW())
            """
        )
        for title, subtitle, image_url, link_url, display_order in _HERO_CARDS:
            op.execute(
                insert.bindparams(
                    title=title,
                    subtitle=subtitle,
                    image_url=image_url,
                    link_url=link_url,
                    display_order=display_order,
                )
            )


def downgrade() -> None:
    # The seeded cards go with the column; an admin-created hero card would
    # survive as a normal banner but with no layout that renders its subtitle.
    op.execute("DELETE FROM banners WHERE position = 'hero_card'")
    op.drop_column("banners", "subtitle")
