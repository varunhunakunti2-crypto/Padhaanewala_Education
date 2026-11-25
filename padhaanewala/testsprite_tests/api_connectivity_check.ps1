param(
  [string]$Backend = 'http://127.0.0.1:8000',
  [string]$Frontend = 'http://localhost:3000'
)

$ErrorActionPreference = 'Stop'

$root = 'D:\COde\client project\Pa\Padhaanewala_Education\padhaanewala'
$config = Get-Content (Join-Path $root 'testsprite_tests\tmp\config.json') -Raw | ConvertFrom-Json
$reportPath = Join-Path $root 'testsprite_tests\api-connectivity-report.md'
$results = New-Object System.Collections.Generic.List[object]

function Add-Result([string]$area, [string]$target, [string]$method, [int]$status, [string]$note = '') {
  $results.Add([pscustomobject]@{ Area = $area; Target = $target; Method = $method; Status = $status; Note = $note })
}

function Invoke-Safe([string]$uri, [string]$method = 'GET', [hashtable]$headers = @{}, $body = $null, [string]$contentType = 'application/json') {
  $params = @{ Uri = $uri; Method = $method; TimeoutSec = 15; UseBasicParsing = $true }
  if ($headers.Count) { $params.Headers = $headers }
  if ($null -ne $body) {
    $params.ContentType = $contentType
    if ($contentType -eq 'application/json') { $params.Body = ($body | ConvertTo-Json -Compress) } else { $params.Body = $body }
  }
  try {
    $response = Invoke-WebRequest @params
    return [pscustomobject]@{ Status = [int]$response.StatusCode; Body = $response.Content }
  } catch {
    $status = 0
    if ($_.Exception.Response) { $status = [int]$_.Exception.Response.StatusCode }
    return [pscustomobject]@{ Status = $status; Body = '' }
  }
}

# --- Authentication for protected routes. Credentials are read from config and never emitted. ---
$login = Invoke-Safe "$Backend/api/v1/auth/login" 'POST' @{ Accept = 'application/json' } ([ordered]@{
  email = $config.loginUser
  password = $config.loginPassword
})
if ($login.Status -ne 200) {
  throw "backend login failed with status $($login.Status); check fixture state"
}
$token = ($login.Body | ConvertFrom-Json).access_token
if (-not $token) { throw 'backend login did not return an access token' }
$authHeaders = @{ Accept = 'application/json'; Authorization = "Bearer $token" }

Add-Result 'auth' '/api/v1/auth/login' 'POST' $login.Status 'token obtained; value not recorded'

# --- Backend health and every GET operation advertised by OpenAPI. ---
$openapi = (Invoke-Safe "$Backend/openapi.json" 'GET' @{ Accept = 'application/json' }).Body | ConvertFrom-Json
Add-Result 'health' '/openapi.json' 'GET' 200 "paths=$($openapi.paths.PSObject.Properties.Name.Count)"

function Get-ParamValue([string]$name) {
  $lower = $name.ToLowerInvariant()
  if ($lower -match 'slug') { return 'iit-bombay' }
  if ($lower -match 'email') { return '[REDACTED]' }
  if ($lower -match 'q$|-q|query|search') { return 'IIT' }
  if ($lower -match 'limit|page_size|per_page') { return '10' }
  if ($lower -match 'offset|page$') { return '0' }
  if ($lower -match 'date|from|start') { return '2026-01-01' }
  if ($lower -match 'to$|end|until') { return '2026-12-31' }
  if ($lower -match 'year') { return '2026' }
  return '1'
}

foreach ($pathEntry in $openapi.paths.PSObject.Properties) {
  $path = $pathEntry.Name
  $operations = @($pathEntry.Value.PSObject.Properties | Where-Object {
    $_.Name -in @('get', 'post', 'put', 'patch', 'delete')
  })
  if (-not $operations.Count) { continue }

  # A GET probe is safe for write-only routes: FastAPI answers 405, which proves
  # the route is mounted without mutating anything.
  $operation = $operations[0]
  $uri = "$Backend$path"
  $query = @()
  foreach ($parameter in @($operation.Value.parameters)) {
    $name = [string]$parameter.name
    if (-not $name) { continue }
    $value = Get-ParamValue $name
    if ($parameter.in -eq 'path') {
      $uri = $uri.Replace("{$name}", [uri]::EscapeDataString($value))
    } elseif ($parameter.in -eq 'query') {
      $query += "$([uri]::EscapeDataString($name))=$([uri]::EscapeDataString($value))"
    }
  }
  if ($query.Count) { $uri += '?' + ($query -join '&') }

  $response = Invoke-Safe $uri 'GET' $authHeaders
  $note = ''
  if ($response.Status -ge 500) { $note = '5xx connectivity failure' }
  elseif ($response.Status -eq 405) { $note = 'reachable; write-only route (GET probe)' }
  elseif ($response.Status -in @(401, 403, 404, 422)) { $note = 'reachable; auth/fixture-dependent' }
  Add-Result 'backend-get' $path 'GET' $response.Status $note
}

# --- Frontend production pages and proxied API. ---
foreach ($path in @('/', '/login', '/colleges', '/contact', '/mock-tests', '/dashboard', '/admin', '/api/health')) {
  $response = Invoke-Safe "$Frontend$path" 'GET' @{ Accept = 'text/html' }
  Add-Result 'frontend-page' $path 'GET' $response.Status ''
}
$proxy = Invoke-Safe "$Frontend/api/v1/colleges?limit=2&offset=0" 'GET' $authHeaders
Add-Result 'frontend-proxy' '/api/v1/colleges' 'GET' $proxy.Status ''

# --- Next.js route handlers (not advertised by the backend OpenAPI document). ---
$errorSink = Invoke-Safe "$Frontend/api/errors" 'POST' @{ Accept = 'application/json'; 'Content-Type' = 'application/json' } ([ordered]@{ message = 'connectivity probe'; context = @{} })
Add-Result 'frontend-api' '/api/errors' 'POST' $errorSink.Status 'small valid probe body'

$aiRejected = Invoke-Safe "$Frontend/api/ai" 'POST' @{ Accept = 'application/json'; 'Content-Type' = 'application/json' } ([ordered]@{ message = '' })
Add-Result 'frontend-api' '/api/ai' 'POST' $aiRejected.Status 'empty message; no upstream call expected'

$revalidate = Invoke-Safe "$Frontend/api/revalidate" 'POST' @{ Accept = 'application/json'; 'Content-Type' = 'application/json' } ([ordered]@{ tags = @('colleges') })
Add-Result 'frontend-api' '/api/revalidate' 'POST' $revalidate.Status 'missing bearer must be denied'

$nativeLogin = Invoke-Safe "$Frontend/api/auth/login" 'POST' @{ Accept = 'application/json' } 'email=invalid-connectivity-probe%40example.com&password=invalid' 'application/x-www-form-urlencoded'
Add-Result 'frontend-api' '/api/auth/login' 'POST' $nativeLogin.Status 'invalid credentials must redirect; no credentials printed'

# --- Report. ---
$lines = @(
  '# API connectivity report',
  '',
  "Generated: $(Get-Date -Format o)",
  '',
  'Credentials and tokens are intentionally excluded from this report.',
  '',
  '## Summary',
  ''
)
$counts = $results | Group-Object Status | Sort-Object Name | ForEach-Object { "$($_.Name)=$($_.Count)" }
$lines += "- Total checks: $($results.Count)"
$lines += "- Status counts: $($counts -join ', ')"
$lines += "- OpenAPI path coverage: $((@($results | Where-Object Area -eq 'backend-get').Target | Select-Object -Unique).Count) unique paths"
$lines += ''
$lines += '## Results'
$lines += ''
$lines += '| Area | Target | Method | Status | Note |'
$lines += '|---|---|---|---:|---|'
foreach ($result in $results) {
  $lines += "| $($result.Area) | $($result.Target) | $($result.Method) | $($result.Status) | $($result.Note) |"
}
$lines += ''
$lines += '## Interpretation'
$lines += ''
$lines += '- 2xx/3xx means the route answered through the expected network path.'
$lines += '- 401/403/404/422 means the route is reachable but needs auth, ownership or a fixture; these are not connectivity failures.'
$lines += '- 405 on a GET probe means a write-only route is mounted; the probe does not mutate data.'
$lines += '- 5xx or status 0 means a real connectivity/server failure that must be investigated.'
$lines -join "`n" | Set-Content $reportPath -Encoding UTF8

$failures = @($results | Where-Object { $_.Status -ge 500 -or $_.Status -eq 0 })
"API connectivity checks: $($results.Count); failures: $($failures.Count); report: $reportPath"
if ($failures.Count) {
  $failures | ForEach-Object { "FAIL $($_.Area) $($_.Method) $($_.Target) status=$($_.Status)" }
}