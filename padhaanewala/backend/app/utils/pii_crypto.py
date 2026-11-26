"""Isolated AES-256-GCM envelope encryption primitives for Fix 02 T1.

This module is deliberately independent of SQLAlchemy, FastAPI, routing, OTP,
authentication, environment files and secret managers. It encrypts and decrypts
``str`` values supplied by a caller using keys supplied by a caller. No model,
column, migration or application workflow is changed by importing it.

Scope
-----
T1 provides reusable primitives only. It does **not** decide which database
fields are encrypted, does not read ``PII_ENCRYPTION_*`` from the environment,
does not create HMAC lookup tokens, and does not supersede ADR-0009. ADR-0009's
decision against integrated field-level encryption remains in force until the
separate D-01 approval recorded in the Fix 02 plan is granted.

Envelope format (version 1)
---------------------------
Stored value::

    pe1.<base64url-no-padding(BODY)>

``pe1`` is the **envelope format version**. ``BODY`` is::

    byte 0      envelope format marker, always 0x01
    byte 1      encryption key version, 1..255
    bytes 2-13  96-bit random nonce, freshly generated per encryption
    bytes 14..  AES-256-GCM ciphertext with the 128-bit tag appended

The format marker and key version are separate fields on purpose: rotating the
encryption key must not change the envelope format, and changing the envelope
format must not be mistaken for a key rotation.

AAD
---
Canonical AAD is the UTF-8 bytes of::

    padhaanewala|pii-aad|v1|{table}|{column}|{pii_context_id}|{purpose}

``table`` and ``column`` are lower snake_case identifiers, ``pii_context_id``
is a canonical lowercase UUIDv4 string, and ``purpose`` must be in
``PII_PURPOSES``. None of those components may contain ``|``, so the delimiter
is unambiguous. AAD is bound at encryption time and must be reproduced exactly
for decryption; wrong table, column, context or purpose fails closed.

Keys and custody
----------------
Keys are 32 raw bytes. Hex strings are accepted only as exactly 64 hex
characters. Placeholder strings and low-variety byte strings are rejected.
``PIIKeyring`` holds one current write key and zero or more previous read-only
keys. The caller owns custody: in a deployed service the keys must come from the
approved secret manager, never from source, logs, error messages, environment
files in this T1 change, or a request. New encryptions always use the current
version; decryptions accept the current version and configured previous
versions only. Future rotation adds a new current version, keeps the old one as
a previous read key until re-encryption and verification are complete, then
retires it in a separately approved change.

No logging is performed here. Exceptions carry generic reasons only: never
plaintext, key material, nonces, AAD values or decrypted output.
"""

from __future__ import annotations

import base64
import binascii
import re
import secrets
import uuid
from collections.abc import Mapping
from dataclasses import dataclass, field
from typing import Final

from cryptography.hazmat.primitives.ciphers.aead import AESGCM

ENVELOPE_PREFIX: Final = "pe1."
ENVELOPE_FORMAT_VERSION: Final = 1
AAD_SERIALIZATION_VERSION: Final = "v1"

FORMAT_MARKER: Final = 0x01
KEY_BYTES: Final = 32
NONCE_BYTES: Final = 12
TAG_BYTES: Final = 16
MIN_KEY_DISTINCT_BYTES: Final = 16

PII_PURPOSES: Final = frozenset(
    {
        "user_identity",
        "student_profile",
        "admin_staff",
        "counsellor_staff",
        "enquiry",
        "lead_note",
        "guardian_consent",
        "otp",
        "consent_record",
        "data_request",
        "audit_ip",
        "refresh_token_ip",
        "college_submission",
    }
)

_ENVIRONMENTS: Final = frozenset({"development", "staging", "production"})
_PLACEHOLDERS: Final = frozenset(
    {
        "",
        "change-me",
        "changeme",
        "change_me",
        "todo",
        "xxx",
        "your-api-key",
        "your_api_key",
        "none",
        "null",
    }
)
_IDENTIFIER_RE: Final = re.compile(r"[a-z][a-z0-9_]{0,63}\Z")
_HEX_KEY_RE: Final = re.compile(r"[0-9a-fA-F]{64}\Z")
_BASE64URL_RE: Final = re.compile(r"[A-Za-z0-9_-]+\Z")


class PIICryptoError(ValueError):
    """Base class for safe, non-sensitive encryption failures."""


class InvalidContextError(PIICryptoError):
    """AAD inputs were missing, malformed or outside the fixed allowlist."""


class InvalidKeyError(PIICryptoError):
    """Key material or version configuration failed validation."""


class InvalidEnvelopeError(PIICryptoError):
    """The stored envelope is malformed or has an unsupported format version."""


class UnknownKeyVersionError(PIICryptoError):
    """The envelope references a key version that is not configured."""


class DecryptionError(PIICryptoError):
    """Authentication failed or the decrypted bytes were not valid UTF-8."""


def _validate_identifier(value: str, label: str) -> str:
    if not isinstance(value, str) or not _IDENTIFIER_RE.fullmatch(value):
        raise InvalidContextError(f"{label} must be a lower snake_case identifier")
    return value


def _validate_purpose(value: str) -> str:
    if not isinstance(value, str) or value not in PII_PURPOSES:
        raise InvalidContextError("purpose is outside the PII AAD allowlist")
    return value


def _canonical_context_id(value: str | uuid.UUID) -> str:
    try:
        parsed = value if isinstance(value, uuid.UUID) else uuid.UUID(value)
    except (TypeError, ValueError, AttributeError):
        raise InvalidContextError("pii_context_id must be a UUIDv4") from None
    if parsed.version != 4:
        raise InvalidContextError("pii_context_id must be a UUIDv4")
    canonical = str(parsed)
    if isinstance(value, str) and value != canonical:
        raise InvalidContextError("pii_context_id must be in canonical UUIDv4 form")
    return canonical


def canonical_aad(
    *,
    table: str,
    column: str,
    pii_context_id: str | uuid.UUID,
    purpose: str,
) -> str:
    """Return the canonical AAD string shared by encryption and decryption."""
    return "|".join(
        (
            "padhaanewala",
            "pii-aad",
            AAD_SERIALIZATION_VERSION,
            _validate_identifier(table, "table"),
            _validate_identifier(column, "column"),
            _canonical_context_id(pii_context_id),
            _validate_purpose(purpose),
        )
    )


def _validate_key_bytes(material: bytes) -> bytes:
    if not isinstance(material, bytes) or len(material) != KEY_BYTES:
        raise InvalidKeyError("PII encryption key must be exactly 32 bytes")
    if len(set(material)) < MIN_KEY_DISTINCT_BYTES:
        raise InvalidKeyError("PII encryption key has insufficient byte variety")
    return material


def _decode_hex_key(value: str) -> bytes:
    if not isinstance(value, str):
        raise InvalidKeyError("PII encryption key must be 64 hex characters")
    text = value.strip()
    if text.lower() in _PLACEHOLDERS:
        raise InvalidKeyError("PII encryption key is empty or a placeholder")
    if not _HEX_KEY_RE.fullmatch(text):
        raise InvalidKeyError("PII encryption key must be 64 hex characters")
    return _validate_key_bytes(bytes.fromhex(text))


@dataclass(frozen=True, repr=False)
class PIIEncryptionKey:
    """One versioned 32-byte AES key. Material is redacted from ``repr``."""

    version: int
    material: bytes = field(repr=False)

    def __post_init__(self) -> None:
        if (
            not isinstance(self.version, int)
            or isinstance(self.version, bool)
            or not 1 <= self.version <= 255
        ):
            raise InvalidKeyError("PII encryption key version must be 1..255")
        _validate_key_bytes(self.material)

    def __repr__(self) -> str:
        return f"PIIEncryptionKey(version={self.version}, material=<redacted>)"


def key_from_hex(version: int, value: str) -> PIIEncryptionKey:
    """Build a versioned key from a 64-character hex string."""
    return PIIEncryptionKey(version=version, material=_decode_hex_key(value))


@dataclass(frozen=True, repr=False)
class PIIKeyring:
    """Current write key plus zero or more previous read-only keys.

    ``environment`` is explicit so a caller can refuse placeholder keys in a
    deployed environment without this primitive reading an env file. Key
    material never appears in ``repr``.
    """

    current: PIIEncryptionKey
    previous: tuple[PIIEncryptionKey, ...] = ()
    environment: str = "development"

    def __post_init__(self) -> None:
        if not isinstance(self.current, PIIEncryptionKey):
            raise InvalidKeyError("current key is invalid")
        if self.environment not in _ENVIRONMENTS:
            raise InvalidKeyError("unsupported PII environment")
        previous = tuple(self.previous)
        object.__setattr__(self, "previous", previous)
        for key in previous:
            if not isinstance(key, PIIEncryptionKey):
                raise InvalidKeyError("previous key is invalid")
        versions = [self.current.version, *(key.version for key in previous)]
        if len(set(versions)) != len(versions):
            raise InvalidKeyError("PII encryption key versions must be unique")

    @classmethod
    def from_hex(
        cls,
        current_version: int,
        current_hex: str,
        *,
        previous_hex: Mapping[int, str] | None = None,
        environment: str = "development",
    ) -> "PIIKeyring":
        """Build a keyring from hex strings without reading process env."""
        previous = tuple(
            key_from_hex(version, material)
            for version, material in (previous_hex or {}).items()
        )
        return cls(
            current=key_from_hex(current_version, current_hex),
            previous=previous,
            environment=environment,
        )

    def __repr__(self) -> str:
        previous_versions = tuple(key.version for key in self.previous)
        return (
            f"PIIKeyring(current_version={self.current.version}, "
            f"previous_versions={previous_versions}, "
            f"environment={self.environment!r})"
        )

    @property
    def active_versions(self) -> tuple[int, ...]:
        """Configured versions only; safe to log or display."""
        return (self.current.version, *(key.version for key in self.previous))

    def read_key(self, version: int) -> PIIEncryptionKey:
        for key in (self.current, *self.previous):
            if key.version == version:
                return key
        raise UnknownKeyVersionError("unknown PII encryption key version")


def _b64url_encode(raw: bytes) -> str:
    return base64.urlsafe_b64encode(raw).decode("ascii").rstrip("=")


def _b64url_decode(encoded: str) -> bytes:
    if not encoded or not _BASE64URL_RE.fullmatch(encoded):
        raise InvalidEnvelopeError("malformed PII ciphertext envelope encoding")
    try:
        return base64.urlsafe_b64decode(encoded + "=" * (-len(encoded) % 4))
    except (binascii.Error, ValueError):
        raise InvalidEnvelopeError("malformed PII ciphertext envelope encoding") from None


def _parse_envelope(envelope: str) -> tuple[bytes, bytes, bytes]:
    """Return ``(key_version, nonce, ciphertext_with_tag)`` without decrypting."""
    if not isinstance(envelope, str):
        raise InvalidEnvelopeError("PII ciphertext envelope must be a string")
    if not envelope.startswith(ENVELOPE_PREFIX):
        raise InvalidEnvelopeError("unsupported PII envelope format version")
    encoded = envelope[len(ENVELOPE_PREFIX) :]
    raw = _b64url_decode(encoded)
    if _b64url_encode(raw) != encoded:
        raise InvalidEnvelopeError("non-canonical PII ciphertext envelope encoding")
    minimum = 2 + NONCE_BYTES + TAG_BYTES
    if len(raw) < minimum:
        raise InvalidEnvelopeError("PII ciphertext envelope is too short")
    if raw[0] != FORMAT_MARKER:
        raise InvalidEnvelopeError("unsupported PII envelope format marker")
    return raw[1:2], raw[2 : 2 + NONCE_BYTES], raw[2 + NONCE_BYTES :]


def envelope_key_version(envelope: str) -> int:
    """Read the key-version byte only. Does not decrypt or expose PII."""
    version_byte, _, _ = _parse_envelope(envelope)
    return version_byte[0]


def encrypt_text(
    plaintext: str,
    *,
    table: str,
    column: str,
    pii_context_id: str | uuid.UUID,
    purpose: str,
    keyring: PIIKeyring,
) -> str:
    """Encrypt one UTF-8 string into a canonical versioned envelope."""
    if not isinstance(plaintext, str):
        raise InvalidContextError("plaintext must be a string")
    if not isinstance(keyring, PIIKeyring):
        raise InvalidKeyError("PII keyring is invalid")
    aad = canonical_aad(
        table=table,
        column=column,
        pii_context_id=pii_context_id,
        purpose=purpose,
    ).encode("utf-8")
    key = keyring.current
    nonce = secrets.token_bytes(NONCE_BYTES)
    ciphertext = AESGCM(key.material).encrypt(
        nonce, plaintext.encode("utf-8"), aad
    )
    body = bytes((FORMAT_MARKER, key.version)) + nonce + ciphertext
    return ENVELOPE_PREFIX + _b64url_encode(body)


def decrypt_text(
    envelope: str,
    *,
    table: str,
    column: str,
    pii_context_id: str | uuid.UUID,
    purpose: str,
    keyring: PIIKeyring,
) -> str:
    """Decrypt one canonical envelope, failing closed on any mismatch."""
    if not isinstance(keyring, PIIKeyring):
        raise InvalidKeyError("PII keyring is invalid")
    version_byte, nonce, ciphertext = _parse_envelope(envelope)
    key = keyring.read_key(version_byte[0])
    aad = canonical_aad(
        table=table,
        column=column,
        pii_context_id=pii_context_id,
        purpose=purpose,
    ).encode("utf-8")
    try:
        plaintext = AESGCM(key.material).decrypt(nonce, ciphertext, aad)
    except Exception:
        # InvalidTag is the normal case; every other failure is also mapped to
        # one generic error so no library detail can carry sensitive context.
        raise DecryptionError("PII ciphertext authentication failed") from None
    try:
        return plaintext.decode("utf-8")
    except UnicodeDecodeError:
        raise DecryptionError("decrypted PII value is not valid UTF-8") from None
