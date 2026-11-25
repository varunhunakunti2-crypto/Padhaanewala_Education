<#
.SYNOPSIS
Runs the 50 frontend QA cases sequentially through Antigravity /browser.

.DESCRIPTION
Reads testsprite_tests/testsprite_frontend_test_plan.json, builds the /browser
task from each case's actions and assertions, invokes the Antigravity CLI in
print mode, and appends every response to a result file. Cases run one at a
time because a single IDE instance supports one Chrome debugging connection.

.PARAMETER Start
First case number (1-based) to run. Default: 1.

.PARAMETER End
Last case number (1-based) to run. Default: 50.

.PARAMETER Ids
Optional explicit case IDs, for example TC001, TC007. Overrides Start/End.

.PARAMETER OutputFile
Where to append combined output. Defaults to
testsprite_tests/antigravity-frontend-results.txt under the app root.

.PARAMETER Effort
Antigravity reasoning effort. Default: low.

.EXAMPLE
powershell -NoProfile -File .agents/skills/test-everything/scripts/run-frontend-cases.ps1 -Start 1 -End 10

.EXAMPLE
powershell -NoProfile -File .agents/skills/test-everything/scripts/run-frontend-cases.ps1 -Ids TC001,TC007
#>
[CmdletBinding()]
param(
    [int]$Start = 1,
    [int]$End = 50,
    [string[]]$Ids = @(),
    [string]$OutputFile,
    [string]$Effort = "low"
)

$ErrorActionPreference = "Continue"

$AppRoot = (Resolve-Path (Join-Path $PSScriptRoot '../../../..')).Path
$Plan = Join-Path $AppRoot 'testsprite_tests/testsprite_frontend_test_plan.json'

if (-not $OutputFile) {
    $OutputFile = Join-Path $AppRoot 'testsprite_tests/antigravity-frontend-results.txt'
}
$outputDirectory = Split-Path -Parent $OutputFile
if ($outputDirectory -and -not (Test-Path -LiteralPath $outputDirectory)) {
    New-Item -ItemType Directory -Force -Path $outputDirectory | Out-Null
}

$parsed = Get-Content -LiteralPath $Plan | ConvertFrom-Json
$allCases = @($parsed)
if ($Ids.Count -gt 0) {
    $selected = @($allCases | Where-Object { $Ids -contains $_.id })
}
else {
    $selected = @($allCases | Select-Object -Skip ($Start - 1) -First ($End - $Start + 1))
}

$loginUser = 'testsprite.student@example.com'
$loginPassword = 'SecurePass123!'

foreach ($case in $selected) {
    $actions = @($case.steps | Where-Object { $_.type -eq 'action' } | ForEach-Object { "- $($_.description)" })
    $assertions = @($case.steps | Where-Object { $_.type -eq 'assertion' } | ForEach-Object { "- $($_.description)" })

    $prompt = @"
/browser QA case $($case.id): $($case.title). Start at http://localhost:3000.
Context: $($case.description)
Perform:
$($actions -join "`n")
Verify:
$($assertions -join "`n")
If sign-in is required, use only the app's own test account ($loginUser / $loginPassword). Never enter real credentials, payment details, or CAPTCHAs. For signed-out or route-guard cases, make sure the session is signed out first. For forms that create records, use clearly test-labelled values. Do not edit code, the database, or configuration. Save a screenshot artifact for every FAIL and for the key state of every auth-related case. Report any console errors you see.
Reply with exactly one final line in this format, and nothing else after it:
CASE $($case.id) | PASS|FAIL|BLOCKED | evidence: [screenshot artifact path or console/network detail] | note: [one line].
"@

    $prompt = $prompt -replace '\{\{LOGIN_USER\}\}', $loginUser -replace '\{\{LOGIN_PASSWORD\}\}', $loginPassword

    Write-Output "===== CASE $($case.id) START $(Get-Date -Format o) =====" | Tee-Object -FilePath $OutputFile -Append
    $response = & agy -p $prompt --effort $Effort --dangerously-skip-permissions 2>&1
    $code = $LASTEXITCODE
    $response | Tee-Object -FilePath $OutputFile -Append
    Write-Output "===== CASE $($case.id) END exit=$code $(Get-Date -Format o) =====" | Tee-Object -FilePath $OutputFile -Append
}
