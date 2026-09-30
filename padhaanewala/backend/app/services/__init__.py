"""Outbound delivery providers and the OTP lifecycle.

Split by responsibility so each piece can fail on its own terms:

* `sms_service` / `email_service` — talk to a provider, or to the log when no
  provider is configured. They never touch the database.
* `otp_service` — owns issuance, hashing, expiry, rate limiting and attempt
  counting. It never talks to a provider.
"""
