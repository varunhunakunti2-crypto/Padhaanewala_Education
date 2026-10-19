"""`scripts/purge_demo_data.py` deletes rows, so its guards are load-bearing.

The script lives in `scripts/`, not on the package path, so it is loaded by file
path. Only the pure environment guard is exercised here — no database is opened.
The destructive path is additionally opt-in behind `--execute` and
`--include-colleges` (the latter gates the only irreversible delete).
"""

from __future__ import annotations

import importlib.util
import sys
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).resolve().parents[2]
SCRIPT = REPO_ROOT / "backend" / "scripts" / "purge_demo_data.py"


def _load_script():
    spec = importlib.util.spec_from_file_location("purge_demo_data", SCRIPT)
    assert spec is not None and spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    sys.modules["purge_demo_data"] = module
    spec.loader.exec_module(module)
    return module


@pytest.mark.parametrize("app_env", ["staging", "production"])
def test_purge_refuses_a_deployed_environment(app_env: str) -> None:
    module = _load_script()
    refusal = module._deployment_refusal(app_env)
    assert refusal is not None
    assert app_env in refusal


def test_purge_allows_development() -> None:
    module = _load_script()
    assert module._deployment_refusal("development") is None
