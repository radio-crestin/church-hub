# gitleaks for the git hooks (.githooks): every commit and push runs it, Superfactory's own pushes too.
# Machine scope, so it lands on the machine PATH (C:\Program Files\WinGet\Links) that services see, not only
# the signed-in user's. Idempotent: installs only when that copy is missing.
$ErrorActionPreference = 'Stop'
if (-not (Test-Path "$env:ProgramFiles\WinGet\Links\gitleaks.exe")) {
  winget install --silent --scope machine --accept-package-agreements --accept-source-agreements Gitleaks.Gitleaks
  if ($LASTEXITCODE -ne 0) { throw "winget install Gitleaks.Gitleaks failed ($LASTEXITCODE)" }
}
