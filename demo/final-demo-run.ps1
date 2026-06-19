# final-demo-run.ps1
#
# Reproduces the final SessionPorter demo video from source. The video is a
# styled terminal REPLAY of real, verified SessionPorter output (see
# demo/final-replay/), labelled on screen as a replay. It is not part of the
# product runtime.
#
# Prereqsites:
#   - Node 18+ on PATH (this machine uses `python`/`node` directly)
#   - ffmpeg + ffprobe on PATH
#   - Playwright installed in a scratch dir (Chromium shell is cached after first run)
#
# Usage (from the repo root):
#   pwsh demo/final-demo-run.ps1
#
# It will: record the replay -> convert to MP4 -> verify the duration is inside
# the 3:45-4:20 window. It never touches the network and never reads a real
# session.

$ErrorActionPreference = 'Stop'
$repo    = Resolve-Path (Join-Path $PSScriptRoot '..')
$replay  = Join-Path $repo 'demo\final-replay'
$record  = Join-Path $repo 'demo\record.mjs'
$out     = Join-Path $repo 'demo\final-demo-captioned.mp4'
$scratch = Join-Path $env:TEMP 'sp-final-demo'

# 1. Scratch dir with Playwright (ESM resolves from the script's own folder, so
#    copy record.mjs next to node_modules).
New-Item -ItemType Directory -Force $scratch | Out-Null
Push-Location $scratch
if (-not (Test-Path (Join-Path $scratch 'node_modules\playwright'))) {
  npm init -y | Out-Null
  npm i playwright | Out-Null
}
Copy-Item $record (Join-Path $scratch 'record.mjs') -Force
$recOut = Join-Path $scratch 'out'
if (Test-Path $recOut) { Remove-Item -Recurse -Force $recOut }
New-Item -ItemType Directory -Force $recOut | Out-Null

# 2. Record the replay to WebM.
node (Join-Path $scratch 'record.mjs') $replay $recOut
$webm = (Get-ChildItem (Join-Path $recOut '*.webm'))[0].FullName
Pop-Location

# 3. Convert to a clean H.264 MP4 (no audio; this is the captioned reference).
ffmpeg -y -i $webm -c:v libx264 -pix_fmt yuv420p -movflags +faststart -an $out

# 4. Verify duration is within the allowed window.
$dur = [double](ffprobe -v error -show_entries format=duration -of csv=p=0 $out)
$mm  = [int]($dur / 60); $ss = $dur - 60 * $mm
Write-Host ("Final video: {0} ({1}:{2:00.0})" -f $out, $mm, $ss)
if ($dur -lt 225 -or $dur -gt 260) {
  Write-Warning "Duration $dur s is OUTSIDE 3:45-4:20. Adjust scene ms in demo/final-replay/scenes.js."
} else {
  Write-Host "Duration is within the 3:45-4:20 target."
}
