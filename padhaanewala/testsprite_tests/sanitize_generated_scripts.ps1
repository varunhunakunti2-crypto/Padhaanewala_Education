$ErrorActionPreference = 'Stop'

$root = 'D:\COde\client project\Pa\Padhaanewala_Education\padhaanewala\testsprite_tests'
$configPath = Join-Path $root 'tmp\config.json'
$config = Get-Content $configPath -Raw | ConvertFrom-Json
$email = [string]$config.loginUser
$password = [string]$config.loginPassword
$marker = '_TESTSPRITE_FIXTURE_HELPER'
$helper = @'

# Loaded from tmp/config.json so generated scripts never embed credentials.
_TESTSPRITE_FIXTURE_HELPER = True
import json as _json
from pathlib import Path as _Path

_TESTSPRITE_CONFIG = _json.loads(
    (_Path(__file__).resolve().parent / "tmp" / "config.json").read_text(encoding="utf-8")
)
TEST_EMAIL = _TESTSPRITE_CONFIG["loginUser"]
TEST_PASSWORD = _TESTSPRITE_CONFIG["loginPassword"]
'@

$changed = 0
$scanned = 0

foreach ($file in (Get-ChildItem -LiteralPath $root -Recurse -File)) {
  if ($file.FullName -eq $configPath) { continue }
  if ($file.Name -eq 'sanitize_generated_scripts.ps1') { continue }
  if ($file.Extension -notin @('.py', '.md', '.json', '.ps1', '.log', '.txt')) { continue }

  $scanned++
  $original = Get-Content -LiteralPath $file.FullName -Raw
  if ([string]::IsNullOrEmpty($original)) { continue }
  $text = $original

  # Signed video URLs carry short-lived AWS credentials in their query string.
  # This runs for EVERY file, including ones with no QA credentials at all.
  $text = [regex]::Replace(
    $text,
    'https?://[^\s"'']*(?:X-Amz-|X-Goog-|sig=|token=)[^\s"'']*',
    '[REDACTED_URL]'
  )

  if ($text.Contains($email) -or $text.Contains($password)) {
    if ($file.Extension -eq '.py') {
      if (-not $text.Contains($marker)) {
        $text = $helper + "`n" + $text
      }
      $text = $text.Replace('"' + $email + '"', 'TEST_EMAIL')
      $text = $text.Replace("'" + $email + "'", 'TEST_EMAIL')
      $text = $text.Replace('"' + $password + '"', 'TEST_PASSWORD')
      $text = $text.Replace("'" + $password + "'", 'TEST_PASSWORD')
    }

    $text = $text.Replace($email, '[REDACTED]')
    $text = $text.Replace($password, '[REDACTED]')
  }

  if ($text -eq $original) { continue }

  [System.IO.File]::WriteAllText($file.FullName, $text, [System.Text.UTF8Encoding]::new($false))
  $changed++
}

"Scanned $scanned text files under testsprite_tests; redacted credentials in $changed files."
