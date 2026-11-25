<#
.SYNOPSIS
Runs the ten backend TestSprite cases with pytest and writes a result file.

.DESCRIPTION
Black-box helper for the test-everything skill. It resolves the app root from
the skill folder, runs the ten backend case files in one pytest invocation,
tees stdout/stderr to a result file, and returns pytest's exit code.

.PARAMETER Python
Python executable to use. Default: python

.PARAMETER OutputFile
Where to write the combined pytest output. Defaults to
testsprite_tests/antigravity-backend-results.txt under the app root.

.EXAMPLE
pwsh -File .agents/skills/test-everything/scripts/run-backend-cases.ps1 -?

.EXAMPLE
pwsh -File .agents/skills/test-everything/scripts/run-backend-cases.ps1
#>
[CmdletBinding()]
param(
    [string]$Python = "python",
    [string]$OutputFile
)

$ErrorActionPreference = "Stop"

$AppRoot = (Resolve-Path (Join-Path $PSScriptRoot '../../../..')).Path
$TestsDir = Join-Path $AppRoot 'testsprite_tests'

if (-not $OutputFile) {
    $OutputFile = Join-Path $TestsDir 'antigravity-backend-results.txt'
}

$cases = @(
    'TC001_browse_colleges_with_filters.py'
    'TC002_retrieve_college_details.py'
    'TC003_browse_course_catalog.py'
    'TC004_submit_enquiry_form.py'
    'TC005_submit_college_suggestion.py'
    'TC006_save_college_to_student_account.py'
    'TC007_mark_notification_as_read.py'
    'TC008_submit_mock_test_attempt.py'
    'TC009_send_ai_assistant_question.py'
    'TC010_create_compliance_data_request.py'
)

$relativeCases = $cases | ForEach-Object { Join-Path 'testsprite_tests' $_ }
$newOutputDirectory = Split-Path -Parent $OutputFile
if ($newOutputDirectory -and -not (Test-Path -LiteralPath $newOutputDirectory)) {
    New-Item -ItemType Directory -Force -Path $newOutputDirectory | Out-Null
}

$fixtureScript = Join-Path $TestsDir 'tmp/reset_backend_fixtures.py'
if (Test-Path -LiteralPath $fixtureScript) {
    Write-Host "Fixtures  : $fixtureScript"
    & $Python $fixtureScript
    if ($LASTEXITCODE -ne 0) {
        throw "Backend fixture reset failed with exit code $LASTEXITCODE"
    }
}

Push-Location $AppRoot
try {
    $pytestArgs = @('-m', 'pytest') + $relativeCases + @('-q', '--tb=short')
    Write-Host "App root : $AppRoot"
    Write-Host "Python   : $Python"
    Write-Host "Command  : $Python $($pytestArgs -join ' ')"
    & $Python @pytestArgs 2>&1 | Tee-Object -FilePath $OutputFile
    $code = $LASTEXITCODE
    Write-Host "pytest exit code: $code"
    Write-Host "Results written to: $OutputFile"
    exit $code
}
finally {
    Pop-Location
}
