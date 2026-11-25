# Windows machine setup: gitleaks, which the pre-commit and pre-push hooks (.githooks/) require.
# Installed machine-wide (C:\Program Files\WinGet\Links, on the system PATH), not per user: a per-user
# winget install lands in %LOCALAPPDATA%\Microsoft\WinGet\Links, which services such as Superfactory's
# processes don't have on their PATH. The hooks also look in both folders (.githooks/require-gitleaks.sh).
# Idempotent: installs nothing when a machine-wide gitleaks is already there.
$ErrorActionPreference = 'Stop'
$machineLink = Join-Path $env:ProgramFiles 'WinGet\Links\gitleaks.exe'
if (Test-Path $machineLink) { Write-Host "gitleaks: $machineLink"; exit 0 }
winget install --silent --scope machine --accept-package-agreements --accept-source-agreements --id Gitleaks.Gitleaks
if ($LASTEXITCODE -ne 0) { throw "winget install Gitleaks.Gitleaks failed ($LASTEXITCODE)" }
if (-not (Test-Path $machineLink)) { throw "gitleaks installed but $machineLink is missing" }
Write-Host "gitleaks: $machineLink"
