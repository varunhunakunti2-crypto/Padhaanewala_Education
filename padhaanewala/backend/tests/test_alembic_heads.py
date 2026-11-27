"""A merged branch must leave Alembic with exactly one head.

`upgrade head` with two heads either fails or silently applies only one line of
history. The AI-settings and site-email revisions were both authored from
`a7d3c5e1f924` on separate branches and had to be re-parented when the branches
were merged; this test pins the result.
"""

import re
from pathlib import Path

VERSIONS = Path(__file__).resolve().parents[1] / "alembic" / "versions"
_REVISION = re.compile(r'^revision\s*[:=].*?["\']([0-9a-f]+)["\']', re.M)
_DOWN_REVISION = re.compile(r'^down_revision\s*[:=].*?["\']([0-9a-f]+)["\']', re.M)


def _graph() -> tuple[dict[str, str], set[str]]:
    revisions: dict[str, str] = {}
    parents: set[str] = set()
    for path in VERSIONS.glob("*.py"):
        source = path.read_text(encoding="utf-8")
        revision = _REVISION.search(source)
        if revision:
            revisions[revision.group(1)] = path.name
        parent = _DOWN_REVISION.search(source)
        if parent:
            parents.add(parent.group(1))
    return revisions, parents


def test_exactly_one_alembic_head():
    revisions, parents = _graph()
    heads = [revision for revision in revisions if revision not in parents]
    assert len(heads) == 1, f"multiple Alembic heads: {heads}"


def test_ai_settings_follows_the_main_line_revision():
    source = (VERSIONS / "b2f8c4d9e731_add_ai_settings.py").read_text(
        encoding="utf-8"
    )
    assert '"f4a1c6d8e902"' in source
