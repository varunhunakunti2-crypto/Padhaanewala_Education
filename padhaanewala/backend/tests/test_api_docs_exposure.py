"""Production must not publish an interactive map of the API."""

from app.main import docs_paths_for_env


def test_production_disables_all_public_api_docs():
    assert docs_paths_for_env("production") == (None, None, None)


def test_non_production_keeps_local_docs():
    assert docs_paths_for_env("development") == (
        "/docs",
        "/redoc",
        "/openapi.json",
    )
