from logging.config import fileConfig
import os

from sqlalchemy import engine_from_config
from sqlalchemy import pool
from sqlalchemy import text

from alembic import context

from app.config import settings
from app.database import Base
from app.models import admission as admission_models  # noqa: F401
from app.models import audit_log as audit_log_models  # noqa: F401
from app.models import banner as banner_models  # noqa: F401
from app.models import blog as blog_models  # noqa: F401
from app.models import college as college_models  # noqa: F401
from app.models import consent as consent_models  # noqa: F401
from app.models import cutoff as cutoff_models  # noqa: F401
from app.models import course as course_models  # noqa: F401
from app.models import enquiry as enquiry_models  # noqa: F401
from app.models import exam as exam_models  # noqa: F401
from app.models import faq as faq_models  # noqa: F401
from app.models import fee as fee_models  # noqa: F401
from app.models import location as location_models  # noqa: F401
from app.models import media as media_models  # noqa: F401
from app.models import mock_test as mock_test_models  # noqa: F401
from app.models import notification as notification_models  # noqa: F401
from app.models import placement as placement_models  # noqa: F401
from app.models import ranking as ranking_models  # noqa: F401
from app.models import review as review_models  # noqa: F401
from app.models import saved_college as saved_college_models  # noqa: F401
from app.models import scholarship as scholarship_models  # noqa: F401
from app.models import seat_matrix as seat_matrix_models  # noqa: F401
from app.models import seo_metadata as seo_metadata_models  # noqa: F401
from app.models import university as university_models  # noqa: F401
from app.models import user as user_models  # noqa: F401

# this is the Alembic Config object, which provides
# access to the values within the .ini file in use.
config = context.config

# Use DATABASE_URL from application settings (reads .env.development)
config.set_main_option("sqlalchemy.url", settings.DATABASE_URL)

# Optional schema isolation, used by the test suite so migrations never touch the
# public schema. Set PADHAANEWALA_SCHEMA=test_suite to migrate a scratch schema.
target_schema = os.environ.get("PADHAANEWALA_SCHEMA")
if target_schema:
    url = config.get_main_option("sqlalchemy.url")
    sep = "&" if "?" in url else "?"
    # `public` stays on the search_path so database-level extensions installed
    # there (pg_trgm, used by the trigram indexes) remain resolvable.
    # Alembic's Config uses ConfigParser interpolation, so a literal percent
    # sign in the URL must be doubled.
    config.set_main_option(
        "sqlalchemy.url",
        f"{url}{sep}options=-csearch_path%%3D{target_schema},public",
    )

# Interpret the config file for Python logging.
# This line sets up loggers basically.
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# add your model's MetaData object here
# for 'autogenerate' support
# from myapp import mymodel
# target_metadata = mymodel.Base.metadata
target_metadata = Base.metadata

# other values from the config, defined by the needs of env.py,
# can be acquired:
# my_important_option = config.get_main_option("my_important_option")
# ... etc.


def run_migrations_offline() -> None:
    """Run migrations in 'offline' mode.

    This configures the context with just a URL
    and not an Engine, though an Engine is acceptable
    here as well.  By skipping the Engine creation
    we don't even need a DBAPI to be available.

    Calls to context.execute() here emit the given string to the
    script output.

    """
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """Run migrations in 'online' mode.

    In this scenario we need to create an Engine
    and associate a connection with the context.

    """
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    with connectable.connect() as connection:
        if target_schema:
            # The version table must live in the target schema, otherwise
            # `alembic upgrade` reads the public schema's version and concludes
            # there is nothing to do.
            connection.execute(text(f'CREATE SCHEMA IF NOT EXISTS "{target_schema}"'))
            connection.commit()

        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            version_table_schema=target_schema,
            include_schemas=bool(target_schema),
        )

        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
