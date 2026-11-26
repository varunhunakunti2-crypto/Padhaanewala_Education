"""Fix 02 T1: isolated envelope-encryption primitive tests.

No plaintext, key material, nonce or decrypted value is logged. Test keys are
generated at runtime and are never printed.
"""

from __future__ import annotations

import base64
import logging
import secrets
import uuid

import pytest

from app.utils import pii_crypto as pc

PREFIX = pc.ENVELOPE_PREFIX
ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_"


def _key_hex() -> str:
    return secrets.token_hex(pc.KEY_BYTES)


def _keyring(previous: dict[int, str] | None = None) -> pc.PIIKeyring:
    return pc.PIIKeyring.from_hex(1, _key_hex(), previous_hex=previous or {})


def _context() -> uuid.UUID:
    return uuid.uuid4()


def _aad_args(context_id: uuid.UUID, **overrides) -> dict:
    args = {
        "table": "users",
        "column": "email",
        "pii_context_id": context_id,
        "purpose": "user_identity",
    }
    args.update(overrides)
    return args


def _encrypt(plaintext: str, keyring: pc.PIIKeyring, context_id: uuid.UUID, **overrides) -> str:
    return pc.encrypt_text(plaintext, keyring=keyring, **_aad_args(context_id, **overrides))


def _decrypt(envelope: str, keyring: pc.PIIKeyring, context_id: uuid.UUID, **overrides) -> str:
    return pc.decrypt_text(envelope, keyring=keyring, **_aad_args(context_id, **overrides))


def _raw(envelope: str) -> bytes:
    encoded = envelope[len(PREFIX) :]
    return base64.urlsafe_b64decode(encoded + "=" * (-len(encoded) % 4))


def _rebuild(raw: bytes) -> str:
    return PREFIX + base64.urlsafe_b64encode(raw).decode("ascii").rstrip("=")


def _flip(raw: bytes, index: int) -> bytes:
    mutated = bytearray(raw)
    mutated[index] ^= 0x01
    return bytes(mutated)


def _noncanonical_variant(encoded: str) -> str:
    """Return a different base64url string that decodes to the same bytes."""
    decoded = base64.urlsafe_b64decode(encoded + "=" * (-len(encoded) % 4))
    for candidate_last in ALPHABET:
        candidate = encoded[:-1] + candidate_last
        if candidate == encoded:
            continue
        try:
            candidate_decoded = base64.urlsafe_b64decode(
                candidate + "=" * (-len(candidate) % 4)
            )
        except Exception:
            continue
        if candidate_decoded == decoded:
            return candidate
    pytest.fail("could not construct a non-canonical base64url variant")


class TestRoundTrip:
    @pytest.mark.parametrize(
        "plaintext",
        [
            "",
            "simple@example.invalid",
            "अनुपम 🚀 — naïve-café",
        ],
    )
    def test_round_trip_including_unicode_and_empty(self, plaintext):
        keyring = _keyring()
        context_id = _context()
        envelope = _encrypt(plaintext, keyring, context_id)
        assert envelope.startswith(PREFIX)
        assert pc.envelope_key_version(envelope) == 1
        assert _decrypt(envelope, keyring, context_id) == plaintext

    def test_repeated_encryption_uses_fresh_nonces(self):
        keyring = _keyring()
        context_id = _context()
        first = _encrypt("identical", keyring, context_id)
        second = _encrypt("identical", keyring, context_id)
        assert first != second
        assert _raw(first)[2:14] != _raw(second)[2:14]
        assert _decrypt(first, keyring, context_id) == "identical"
        assert _decrypt(second, keyring, context_id) == "identical"

    def test_wrong_key_fails_closed(self):
        context_id = _context()
        envelope = _encrypt("wrong-key-secret", _keyring(), context_id)
        with pytest.raises(pc.DecryptionError):
            _decrypt(envelope, _keyring(), context_id)


class TestAadBinding:
    @pytest.mark.parametrize(
        "overrides",
        [
            {"purpose": "student_profile"},
            {"table": "leads"},
            {"column": "mobile"},
        ],
    )
    def test_wrong_purpose_table_or_column_fails(self, overrides):
        keyring = _keyring()
        context_id = _context()
        envelope = _encrypt("context-bound", keyring, context_id)
        with pytest.raises(pc.DecryptionError):
            _decrypt(envelope, keyring, context_id, **overrides)

    def test_wrong_context_uuid_fails(self):
        keyring = _keyring()
        envelope = _encrypt("context-bound", keyring, _context())
        with pytest.raises(pc.DecryptionError):
            _decrypt(envelope, keyring, _context())

    def test_aad_is_deterministic_and_explicit(self):
        context_id = _context()
        args = _aad_args(context_id)
        expected = (
            f"padhaanewala|pii-aad|v1|users|email|{context_id}|user_identity"
        )
        assert pc.canonical_aad(**args) == expected
        assert pc.canonical_aad(**args) == pc.canonical_aad(**args)

    def test_aad_rejects_delimiter_injection_and_unknown_purpose(self):
        context_id = _context()
        with pytest.raises(pc.InvalidContextError):
            pc.canonical_aad(**_aad_args(context_id, table="users|email"))
        with pytest.raises(pc.InvalidContextError):
            pc.canonical_aad(**_aad_args(context_id, column="e|mail"))
        with pytest.raises(pc.InvalidContextError):
            pc.canonical_aad(**_aad_args(context_id, purpose="custom"))

    @pytest.mark.parametrize(
        "bad_context",
        [
            "not-a-uuid",
            uuid.UUID(int=0),
            lambda: str(uuid.uuid4()).upper(),
        ],
    )
    def test_aad_rejects_non_canonical_or_non_v4_contexts(self, bad_context):
        value = bad_context() if callable(bad_context) else bad_context
        with pytest.raises(pc.InvalidContextError):
            pc.canonical_aad(**_aad_args(value))


class TestEnvelopeValidation:
    @pytest.mark.parametrize("index,label", [(20, "ciphertext"), (-1, "tag"), (3, "nonce")])
    def test_tampering_with_ciphertext_tag_or_nonce_fails(self, index, label):
        keyring = _keyring()
        context_id = _context()
        raw = _raw(_encrypt("tamper-target", keyring, context_id))
        with pytest.raises(pc.DecryptionError):
            _decrypt(_rebuild(_flip(raw, index)), keyring, context_id)

    def test_tampered_envelope_format_version_and_marker_fail(self):
        keyring = _keyring()
        context_id = _context()
        envelope = _encrypt("format-target", keyring, context_id)
        with pytest.raises(pc.InvalidEnvelopeError):
            _decrypt("pe2." + envelope[len(PREFIX) :], keyring, context_id)
        raw = _raw(envelope)
        raw = bytes((0x02, *raw[1:]))
        with pytest.raises(pc.InvalidEnvelopeError):
            _decrypt(_rebuild(raw), keyring, context_id)

    def test_unknown_key_version_fails(self):
        keyring = _keyring()
        context_id = _context()
        envelope = _encrypt("version-target", keyring, context_id)
        raw = bytearray(_raw(envelope))
        raw[1] = 99
        with pytest.raises(pc.UnknownKeyVersionError):
            _decrypt(_rebuild(bytes(raw)), keyring, context_id)

    def test_wrong_key_at_a_configured_version_fails(self):
        context_id = _context()
        old_key = _key_hex()
        envelope = pc.encrypt_text(
            "rotation-target",
            keyring=pc.PIIKeyring.from_hex(1, old_key),
            **_aad_args(context_id),
        )
        wrong_keyring = pc.PIIKeyring.from_hex(
            2, _key_hex(), previous_hex={1: _key_hex()}
        )
        assert pc.envelope_key_version(envelope) == 1
        with pytest.raises(pc.DecryptionError):
            pc.decrypt_text(envelope, keyring=wrong_keyring, **_aad_args(context_id))

    def test_previous_key_can_decrypt_after_rotation(self):
        context_id = _context()
        old_key = _key_hex()
        envelope = pc.encrypt_text(
            "grace-window",
            keyring=pc.PIIKeyring.from_hex(1, old_key),
            **_aad_args(context_id),
        )
        rotated = pc.PIIKeyring.from_hex(2, _key_hex(), previous_hex={1: old_key})
        assert pc.envelope_key_version(envelope) == 1
        assert pc.decrypt_text(envelope, keyring=rotated, **_aad_args(context_id)) == "grace-window"
        assert pc.envelope_key_version(
            pc.encrypt_text("new", keyring=rotated, **_aad_args(context_id))
        ) == 2

    @pytest.mark.parametrize(
        "mutation",
        [
            lambda e: e.replace(PREFIX, "", 1),
            lambda e: PREFIX + e[len(PREFIX) :] + "=",
            lambda e: PREFIX + " " + e[len(PREFIX) :],
            lambda e: PREFIX + "+" + e[len(PREFIX) + 1 :],
            lambda e: PREFIX,
            lambda e: PREFIX + base64.urlsafe_b64encode(bytes([1, 1, 0, 0])).decode().rstrip("="),
        ],
    )
    def test_malformed_encodings_fail(self, mutation):
        keyring = _keyring()
        context_id = _context()
        envelope = mutation(_encrypt("encoding-target", keyring, context_id))
        with pytest.raises(pc.InvalidEnvelopeError):
            _decrypt(envelope, keyring, context_id)

    def test_noncanonical_base64url_encoding_fails(self):
        keyring = _keyring()
        context_id = _context()
        envelope = _encrypt("x", keyring, context_id)
        encoded = envelope[len(PREFIX) :]
        noncanonical = _noncanonical_variant(encoded)
        with pytest.raises(pc.InvalidEnvelopeError):
            _decrypt(PREFIX + noncanonical, keyring, context_id)


class TestKeyValidation:
    @pytest.mark.parametrize("bad", ["change-me", "short", "ab" * 32 + "zz", "00" * 32])
    def test_weak_or_placeholder_keys_are_rejected(self, bad):
        with pytest.raises(pc.InvalidKeyError):
            pc.key_from_hex(1, bad)

    def test_short_raw_key_is_rejected(self):
        with pytest.raises(pc.InvalidKeyError):
            pc.PIIEncryptionKey(version=1, material=secrets.token_bytes(16))

    @pytest.mark.parametrize("version", [0, -1, 256, True])
    def test_invalid_key_versions_are_rejected(self, version):
        with pytest.raises(pc.InvalidKeyError):
            pc.PIIEncryptionKey(version=version, material=secrets.token_bytes(32))

    def test_duplicate_versions_are_rejected(self):
        key = pc.key_from_hex(1, _key_hex())
        with pytest.raises(pc.InvalidKeyError):
            pc.PIIKeyring(current=key, previous=(key,))

    def test_unknown_environment_is_rejected(self):
        with pytest.raises(pc.InvalidKeyError):
            pc.PIIKeyring.from_hex(1, _key_hex(), environment="qa")

    def test_production_accepts_strong_keys_and_rejects_placeholders(self):
        strong = pc.PIIKeyring.from_hex(1, _key_hex(), environment="production")
        assert strong.active_versions == (1,)
        with pytest.raises(pc.InvalidKeyError):
            pc.PIIKeyring.from_hex(1, "change-me", environment="production")


class TestNoLeakage:
    def test_errors_logs_and_repr_do_not_contain_sensitive_values(self, caplog):
        secret = "LEAK-CHECK-π-🚀"
        key_hex = _key_hex()
        keyring = pc.PIIKeyring.from_hex(1, key_hex)
        context_id = _context()
        envelope = _encrypt(secret, keyring, context_id)

        with caplog.at_level(logging.DEBUG):
            with pytest.raises(pc.DecryptionError) as exc_info:
                _decrypt(envelope, keyring, context_id, purpose="student_profile")

        assert secret not in str(exc_info.value)
        assert secret not in caplog.text
        assert key_hex not in caplog.text
        assert key_hex not in repr(keyring)
        assert key_hex not in repr(keyring.current)
        assert envelope not in caplog.text
