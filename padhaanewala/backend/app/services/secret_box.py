"""Encryption for provider credentials stored in the database.

The AI settings row has to hold an API key so a super admin can rotate it
without a redeploy. That is a secret at rest, and storing it as plain text
would make every database backup, every ``pg_dump`` pasted into a chat and every
read-only analytics user a copy of the provider account's spending authority.

The key is derived from the deployment's existing ``SECRET_KEY`` rather than
introducing a second required environment variable: an operator already has to
set that one in production, and a new "encryption key" variable would be added
to a checklist and then left at its default. ``HKDF`` with a fixed, versioned
``info`` string gives a stable Fernet key for this purpose only, so the same
``SECRET_KEY`` used for other things never becomes the AES key itself.

If ``SECRET_KEY`` changes, old ciphertext cannot be decrypted. That is
deliberate: :func:`decrypt` returns ``None`` and the caller falls back to the
environment value, which is a working assistant rather than a crash. The
super admin re-enters the key once.
"""

import base64

from cryptography.fernet import Fernet, InvalidToken
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.hkdf import HKDF

from app.config import settings

#: Versioned so a future algorithm change can derive a different key without
#: making existing rows look corrupt. Never reuse this string for another
#: purpose.
_HKDF_INFO = b"padhaanewala-ai-settings-v1"


def _fernet() -> Fernet:
    derived = HKDF(
        algorithm=hashes.SHA256(),
        length=32,
        # No salt: the input is already a high-entropy deployment secret, and a
        # random salt would have to be stored alongside the ciphertext. `info`
        # is what separates this key from any other use of `SECRET_KEY`.
        salt=None,
        info=_HKDF_INFO,
    ).derive(settings.SECRET_KEY.encode("utf-8"))
    return Fernet(base64.urlsafe_b64encode(derived))


def encrypt(value: str) -> str:
    """Encrypt a non-empty credential. Callers handle the clear case."""
    return _fernet().encrypt(value.encode("utf-8")).decode("ascii")


def decrypt(token: str | None) -> str | None:
    """Decrypt a stored credential, or ``None`` when it cannot be read.

    ``None`` covers three cases the caller must treat identically: no key was
    ever saved, the ``SECRET_KEY`` changed, or the column was tampered with. In
    all three the safe action is "fall back to the environment / report not
    configured", never "raise while serving a public chat request".
    """
    if not token:
        return None
    try:
        return _fernet().decrypt(token.encode("ascii")).decode("utf-8")
    except (InvalidToken, ValueError, UnicodeError):
        return None
