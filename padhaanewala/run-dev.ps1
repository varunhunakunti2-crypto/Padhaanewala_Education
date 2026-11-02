# Starts the Padhaanewala dev stack: Postgres + Redis (Docker), backend, frontend.
# Ports 8001/3001 are used because 8000/3000 are taken by another local project.
# Usage: powershell -ExecutionPolicy Bypass -File .\run-dev.ps1

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$logDir = Join-Path $root 'logs'
New-Item -ItemType Directory -Force -Path $logDir | Out-Null

$backendPort = 8001
$frontendPort = 3001

# 1. Docker engine
docker info --format '{{.ServerVersion}}' *> $null
if ($LASTEXITCODE -ne 0) {
    Write-Host 'Starting Docker Desktop...'
    Start-Process "$env:ProgramFiles\Docker\Docker\Docker Desktop.exe"
    $deadline = (Get-Date).AddMinutes(3)
    do {
        Start-Sleep -Seconds 5
        docker info --format '{{.ServerVersion}}' *> $null
    } until ($LASTEXITCODE -eq 0 -or (Get-Date) -gt $deadline)
    if ($LASTEXITCODE -ne 0) { throw 'Docker engine did not start within 3 minutes.' }
}

# 2. Database + Redis
Write-Host 'Starting Postgres and Redis...'
docker compose -f (Join-Path $root 'docker-compose.dev.yml') up -d db redis | Out-Null
$deadline = (Get-Date).AddMinutes(2)
do {
    Start-Sleep -Seconds 2
    $dbReady = (docker exec padhaanewala-db-1 pg_isready -U padhaanewala -d padhaanewala_dev 2>$null) -match 'accepting connections'
    $redisReady = (docker exec padhaanewala-redis-1 redis-cli ping 2>$null) -match 'PONG'
} until (($dbReady -and $redisReady) -or (Get-Date) -gt $deadline)
if (-not ($dbReady -and $redisReady)) { throw 'Postgres/Redis did not become ready.' }

# 3. Backend
$backend = Join-Path $root 'backend'
$python = Join-Path $backend 'venv\Scripts\python.exe'
Start-Process -FilePath $python `
    -ArgumentList '-m', 'uvicorn', 'app.main:app', '--host', '127.0.0.1', '--port', "$backendPort", '--no-proxy-headers' `
    -WorkingDirectory $backend `
    -WindowStyle Hidden `
    -RedirectStandardOutput (Join-Path $logDir 'dev-backend.out.log') `
    -RedirectStandardError (Join-Path $logDir 'dev-backend.err.log')

# 4. Frontend (proxy must point at the backend port above)
$frontend = Join-Path $root 'frontend'
$env:BACKEND_URL = "http://localhost:$backendPort"
Start-Process -FilePath 'npm.cmd' `
    -ArgumentList 'run', 'dev', '--', '--port', "$frontendPort" `
    -WorkingDirectory $frontend `
    -WindowStyle Hidden `
    -RedirectStandardOutput (Join-Path $logDir 'dev-frontend.out.log') `
    -RedirectStandardError (Join-Path $logDir 'dev-frontend.err.log')

Write-Host ''
Write-Host "Frontend: http://localhost:$frontendPort"
Write-Host "Backend : http://localhost:$backendPort  (health: /health, docs: /docs)"
Write-Host "Logs    : $logDir\dev-backend.*.log, dev-frontend.*.log"
