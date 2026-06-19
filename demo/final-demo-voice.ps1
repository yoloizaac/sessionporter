# final-demo-voice.ps1
#
# Builds the AI-voice DRAFT for the final demo using Windows System.Speech
# (offline, local). One WAV per scene is synthesized, delayed to its scene start,
# mixed, and muxed onto demo/final-demo-captioned.mp4 to produce
# demo/final-demo-ai-voice-draft.mp4.
#
# This voice is synthetic and for review only; it is not the applicant's voice.
# No online TTS is used.
#
# Usage (from repo root):  pwsh demo/final-demo-voice.ps1

$ErrorActionPreference = 'Stop'
$repo  = Resolve-Path (Join-Path $PSScriptRoot '..')
$video = Join-Path $repo 'demo\final-demo-captioned.mp4'
$out   = Join-Path $repo 'demo\final-demo-ai-voice-draft.mp4'
$work  = Join-Path $env:TEMP 'sp-final-voice'
New-Item -ItemType Directory -Force $work | Out-Null

# Scene narration (identical to final-demo-narration.md / .srt).
$narr = @(
  'SessionPorter converts one selected AI coding session into a portable, validated, privacy-aware bundle.',
  'Logs are useful evidence but contain credentials, private paths, and tool-specific formats. SessionPorter discovers one session, redacts, validates, and exports.',
  'Source-specific adapters are separate from normalization, redaction, bundle creation, and validation. The Claude Code skill is a thin wrapper around the same core.',
  'Discovery is read-only and returns metadata first. SessionPorter never exports everything, and refuses to guess when the current session is ambiguous.',
  'Inspect one selected session, then preview likely redactions. The report shows categories and counts, never the original secret.',
  'Sanitized mode is the default. Private mode keeps more content and requires explicit confirmation; it never falls back silently.',
  'The transcript preserves chronological evidence. The redaction report explains changes, the manifest records mode and counts, and checksums make tampering detectable.',
  'The validator checks required files and SHA-256 checksums. Tests cover parsing, normalization, redaction, archive safety, path traversal, symlinks, and network isolation.',
  'Claude Code was the primary agent. Focused subagents independently reviewed formats, redaction, portability, skill UX, and final security. The main agent integrated their handoffs.',
  'One incorrect assumption: a flat JSONL would suffice for AgentTrace. A subagent read its parser and found analytics depend on linked tool-use and tool-result records. The design was corrected.',
  'To stay focused, there is no web app, database, account system, or cloud service. Deterministic local conversion is easier to test, cheaper, and safer for sensitive logs.',
  'The weakest area is current-session matching, because the CLI does not always receive the exact active session id. Redaction is heuristic and still needs manual review.',
  'SessionPorter turns one selected AI coding session into a portable, validated, privacy-aware evidence bundle while keeping sensitive processing local.'
)

# Scene start offsets in ms (0.4 s lead-in + cumulative scaled scene durations).
$starts = @(400,15880,33080,50280,67480,88120,105320,127680,146600,169820,191320,209380,226580)

Add-Type -AssemblyName System.Speech
$synth = New-Object System.Speech.Synthesis.SpeechSynthesizer
$synth.Rate = 0   # default pace; narration windows are sized for this

for ($i = 0; $i -lt $narr.Count; $i++) {
  $wav = Join-Path $work ("s{0:00}.wav" -f ($i + 1))
  $synth.SetOutputToWaveFile($wav)
  $synth.Speak($narr[$i])
}
$synth.Dispose()

# Build the ffmpeg amix graph: delay each scene WAV to its start, mix, mux.
$inputs = @('-i', $video)
$filters = @()
$labels = @()
for ($i = 0; $i -lt $narr.Count; $i++) {
  $wav = Join-Path $work ("s{0:00}.wav" -f ($i + 1))
  $inputs += @('-i', $wav)
  $d = $starts[$i]
  $idx = $i + 1
  $filters += "[$idx]adelay=$d|$d[a$idx]"
  $labels  += "[a$idx]"
}
$graph = ($filters -join ';') + ';' + ($labels -join '') + "amix=inputs=$($narr.Count):normalize=0[a]"

$ffargs = @('-y') + $inputs + @(
  '-filter_complex', $graph,
  '-map', '0:v', '-map', '[a]',
  '-c:v', 'copy', '-c:a', 'aac', '-b:a', '160k',
  '-shortest', $out
)
& ffmpeg @ffargs

$dur = [double](ffprobe -v error -show_entries format=duration -of csv=p=0 $out)
Write-Host ("AI-voice draft: {0} ({1:n2}s)" -f $out, $dur)
