from datetime import datetime

from sqlalchemy import DateTime, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class AiSetting(Base):
    """The one row of AI-provider configuration a super admin edits.

    ## Why this is separate from ``SiteSetting``

    ``site_settings`` is published: the public site renders its support address
    and formatting choices. This row holds credentials and provider wiring, so
    it gets its own table and its own guard. Keeping the two apart means the
    existing ``PUT /settings`` route -- which ``admin`` may call -- can never be
    the path that writes an API key, and a future field added to the public
    settings does not silently widen what the AI row exposes.

    ## Why the keys are stored encrypted

    An API key is a bearer credential: whoever can read it can spend the
    provider account's budget. The database is the one place the application
    must keep it (so a super admin can change it without a redeploy), so it is
    encrypted with a key derived from ``SECRET_KEY`` and only ever decrypted in
    the process that is about to call the provider. No response schema mentions
    the plaintext, and ``AiSettingsResponse`` exposes only a ``set`` flag and a
    last-four hint so the console can say *which* key is active without
    shipping it back to a browser.

    ## Why ``id`` is pinned

    Same reason as ``SiteSetting``: one row is a property of the deployment,
    not a convention every caller has to remember. The migration seeds it and a
    ``CHECK (id = 1)`` makes a second row a database error rather than an
    ambiguous read.
    """

    __tablename__ = "ai_settings"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, default=1)

    #: OpenAI-compatible chat endpoint used by the student assistant.
    #:
    #: Nullable, and with no Python-side default, on purpose. ``NULL`` means
    #: "not configured here", which lets :mod:`app.services.ai_config` fall
    #: through to the environment and then to its built-in default. A
    #: non-nullable column with a server default would pin every existing
    #: deployment to ``gpt-4o-mini`` on upgrade and silently ignore its own
    #: ``OPENAI_MODEL``.
    chat_base_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    chat_model: Mapped[str | None] = mapped_column(String(120), nullable=True)
    chat_api_key_encrypted: Mapped[str | None] = mapped_column(Text, nullable=True)

    #: Native Gemini endpoint used by the PDF question importer. Nullable for
    #: the same reason: the environment value must survive the upgrade.
    gemini_model: Mapped[str | None] = mapped_column(String(120), nullable=True)
    gemini_api_key_encrypted: Mapped[str | None] = mapped_column(Text, nullable=True)

    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=datetime.now, onupdate=datetime.now
    )
    #: The user id that last saved this row. Plain integer rather than a FK:
    #: deleting an admin must not delete the record of who last rotated a
    #: production credential, and the audit log is the durable trail anyway.
    updated_by: Mapped[int | None] = mapped_column(Integer, nullable=True)
