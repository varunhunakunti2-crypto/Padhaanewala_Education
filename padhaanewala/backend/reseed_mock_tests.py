"""Re-seed mock tests into the running container, byte-exact.

The first attempt piped the file through PowerShell's text pipeline, which
re-encoded it and turned every U+221A and U+2014 into '?'. That silently
corrupted 75 questions in the demo database. This version moves the bytes with
no text decoding anywhere in the path, and verifies the result before seeding.
"""
import base64
import hashlib
import json
import pathlib
import subprocess
import sys

SRC = pathlib.Path(r"D:\Client-Project\padhaanewala\frontend\lib\data\mockTests.json")
CONTAINER = "padhaanewala-localtest-backend-1"
DEST = "/tmp/mockTests.json"

raw = SRC.read_bytes()
local_sha = hashlib.sha256(raw).hexdigest()
print(f"source: {len(raw)} bytes  sha256={local_sha[:16]}")

# Chunked base64 so the value never has to survive a shell command line.
chunks = [base64.b64encode(raw)[i:i + 3000] for i in range(0, len(base64.b64encode(raw)), 3000)]
subprocess.run(["docker", "exec", CONTAINER, "sh", "-c", f"rm -f {DEST}"], check=True)
for chunk in chunks:
    subprocess.run(
        ["docker", "exec", "-i", CONTAINER, "sh", "-c", f"cat >> {DEST}.b64"],
        input=chunk, check=True,
    )
subprocess.run(["docker", "exec", CONTAINER, "sh", "-c",
                f"base64 -d {DEST}.b64 > {DEST} && rm -f {DEST}.b64"], check=True)

# Verify the transfer before seeding: same bytes, and the non-ASCII survived.
out = subprocess.run(
    ["docker", "exec", CONTAINER, "sh", "-c", f"sha256sum {DEST} | cut -d' ' -f1"],
    capture_output=True, text=True, check=True,
).stdout.strip()
print(f"in container: sha256={out[:16]}")
if out != local_sha:
    print("FATAL: transfer corrupted the file", file=sys.stderr)
    raise SystemExit(1)

text = raw.decode("utf-8")
print(f"  U+221A present: {chr(0x221A) in text}   U+2014 present: {chr(0x2014) in text}")

# The paper already exists, and the seed is idempotent by default, so an
# existing paper would be left holding the corrupted questions. --refresh
# rebuilds them; it cascades to saved answers, which is acceptable here because
# the only attempts in this stack are smoke-test ones.
print("\n-- purging previously seeded paper --")
subprocess.run(["docker", "exec", CONTAINER, "python", "-c",
                "from app.database import SessionLocal; from app.models import MockTest; "
                "db=SessionLocal(); n=db.query(MockTest).delete(synchronize_session=False); db.commit(); "
                "print('deleted', n)"], check=True, cwd=None)

print("\n-- seeding --")
r = subprocess.run(["docker", "exec", "-w", "/app", CONTAINER, "python",
                    "scripts/seed_mock_tests.py", "--source", DEST, "--refresh"],
                   capture_output=True, text=True)
print(r.stdout.strip() or r.stderr.strip())
raise SystemExit(r.returncode)
