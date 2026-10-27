# Trust Caddy's local CA on Windows.
#
#   .\docker\trust-local-ca.ps1
#
# WHY THIS EXISTS
#   `docker-compose.localtest.yml` points Caddy at `SITE_ADDRESS=localhost:<port>`,
#   and Caddy issues for `localhost` from its OWN internal CA — not from a public
#   one, because a public CA cannot issue for a laptop. That root is not in
#   Windows' certificate store, so the browser shows a red "Not secure" warning
#   on https://localhost:<port> even though the certificate is perfectly valid.
#
#   The port in the site address is irrelevant here. A certificate names a host,
#   never a port, so changing the localtest ports does not change the
#   certificate — the same root keeps covering `localhost` and this script does
#   not need to be re-run for that reason.
#
#   The fix is to add that root to the CURRENT USER's trusted root store. It is
#   a locally generated, offline key that only ever signs `localhost` leaves, it
#   expires in 2036, and it is scoped to your user account — not the machine.
#
#   Chrome and Edge read the Windows store, so this fixes the browser. Firefox
#   does not: it has its own store, and either import the cert by hand or set
#   `security.enterprise_roots.enabled` to true in about:config.
#
# WHEN YOU NEED TO RUN IT AGAIN
#   The root lives in the `caddy_data` volume. `docker compose down -v` deletes
#   that volume, Caddy generates a NEW root on the next start, and the browser
#   warning comes back. This script re-installs whichever root is current.
#
# WHY NOT INSTALL IT TO LocalMachine
#   A machine-wide trusted root applies to every account on the box, including
#   any elevated process. The user scope gets you the same effect for your own
#   browser with a much smaller blast radius. Nothing in this project needs
#   machine scope.

[CmdletBinding()]
param(
    # Container holding the CA. Defaults to the localtest stack's Caddy.
    [string]$Container = 'padhaanewala-localtest-caddy-1'
)

$ErrorActionPreference = 'Stop'

$rootPathInContainer = '/data/caddy/pki/authorities/local/root.crt'

if (-not (docker ps --format '{{.Names}}' | Select-String -SimpleMatch $Container)) {
    throw "Container '$Container' is not running. Start the stack first: docker compose -f docker-compose.prod.yml -f docker-compose.localtest.yml --env-file .env.localtest up -d"
}

$tmp = Join-Path ([System.IO.Path]::GetTempPath()) "caddy-local-root-$PID.crt"
try {
    docker cp "${Container}:${rootPathInContainer}" $tmp | Out-Null
    if (-not (Test-Path $tmp)) { throw "Failed to copy the CA root out of the container." }

    $cert = [System.Security.Cryptography.X509Certificates.X509Certificate2]::new($tmp)
    Write-Host "CA root : $($cert.Subject)"
    Write-Host "Expires : $($cert.NotAfter)"
    Write-Host "Installing into Cert:\CurrentUser\Root ..."

    # certutil rather than Import-Certificate: adding to the Root store shows a
    # Windows "Security Warning" confirmation, and Import-Certificate fails
    # outright when that dialog cannot be displayed.
    $proc = Start-Process -FilePath 'certutil.exe' `
        -ArgumentList @('-user', '-addstore', 'Root', $tmp) `
        -PassThru -WindowStyle Normal
    $null = $proc.WaitForExit(120000)

    if ($proc.ExitCode -ne 0) {
        throw "certutil failed with exit code $($proc.ExitCode). Approve the Windows security prompt if one appeared."
    }

    $installed = Get-ChildItem 'Cert:\CurrentUser\Root' |
        Where-Object { $_.Thumbprint -eq $cert.Thumbprint }
    if (-not $installed) {
        throw 'The certificate did not appear in Cert:\CurrentUser\Root.'
    }

    Write-Host ''
    Write-Host "Trusted: $($installed.Subject)" -ForegroundColor Green
    Write-Host "Reload https://localhost:<port> in Chrome/Edge (Ctrl+Shift+R to bypass the cached interstitial)."
}
finally {
    Remove-Item $tmp -Force -ErrorAction SilentlyContinue
}
