<#
  SessionPorter demo run (reproducible, deterministic, synthetic data only).
  Runs real SessionPorter CLI commands against the bundled SYNTHETIC fixture, so
  no real session and no private path is ever shown. Exits non-zero if any
  demonstrated command fails.
#>
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'

$repo = Split-Path -Parent $PSScriptRoot
Set-Location $repo

function Step($name) { Write-Host ""; Write-Host "== $name ==" -ForegroundColor Cyan }
function Run($cmd)   { Write-Host "> $cmd" -ForegroundColor Yellow; Invoke-Expression $cmd; if ($LASTEXITCODE -ne 0) { throw "command failed: $cmd" } }

# Synthetic fixture as the source. Nothing real is touched.
$env:SESSIONPORTER_CLAUDE_PROJECTS = Join-Path $repo 'fixtures\claude'
$cli = 'node dist/cli/index.js'
$sid = 'a9ca177b0cfd'   # safe (hashed) id of the synthetic session
$demoOut = Join-Path $env:TEMP ('sessionporter-demo-out')
if (Test-Path $demoOut) { Remove-Item -Recurse -Force $demoOut }

Step 'Build'
if (-not (Test-Path 'dist/cli/index.js')) { Run 'npm run build' } else { Write-Host 'dist present' }

Step 'Discover (read-only, metadata only)'
Run "$cli discover --source claude"

Step 'Inspect the selected synthetic session'
Run "$cli inspect --source claude --session $sid"

Step 'Redact preview (nothing written yet)'
Run "$cli redact-preview --source claude --session $sid"

Step 'Export (sanitized by default)'
Run "$cli export --source claude --session $sid --mode sanitized --no-zip --out `"$demoOut`" --yes"

$bundleDir = (Get-ChildItem $demoOut -Directory | Select-Object -First 1).FullName

Step 'Bundle contents'
Get-ChildItem $bundleDir -File | Select-Object -ExpandProperty Name

Step 'Transcript (first lines)'
Get-Content (Join-Path $bundleDir 'session.transcript.md') -TotalCount 14

Step 'Redaction report (counts only, never values)'
Get-Content (Join-Path $bundleDir 'REDACTION_REPORT.md') -TotalCount 18

Step 'Validate the bundle (checksums + structure)'
Run "$cli validate `"$bundleDir`""

Step 'Security tests (bounded worker pool)'
Run 'npx vitest run tests/security --pool=forks --poolOptions.forks.maxForks=2'

Step 'Done'
Write-Host 'SessionPorter turned one selected session into a portable, validated, privacy-aware bundle.' -ForegroundColor Green
Remove-Item -Recurse -Force $demoOut -ErrorAction SilentlyContinue
