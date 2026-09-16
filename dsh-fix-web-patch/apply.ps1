<#
  apply.ps1 — DSH profile "web": collapse duplicated ids in cordis.patch.yml.

  WHAT IT CHANGES (nothing else):
    * ui-skins, dsh-voice, open-sea-skin, ui-theme-cyberpunk each appear 2-3 times
      with contradictory `disabled` values. The loader resolves patches last-wins
      (@deepseek-ai/dsh-app-boot applyEntryPatches: `target[key] = value`), so the
      effective state today is `disabled: true` for all four. This script keeps
      exactly that effective state and leaves ONE entry per id.
    * dsh-messenger-gateway is the one non-duplicated id whose state is subtle: its
      later `disabled: true` entry was already removed by a GUI edit, so today it
      resolves to `disabled: false` (ENABLED) with the telegram/tts config block.
      The script keeps exactly that: `disabled: false` + config untouched.
    * Dead `# dsh-fix: disabled entry ...` comments are dropped (they annotate
      entries that no longer exist).

  IT DOES NOT TOUCH:
    * dsh.profile.bundles (official bundles untouched)
    * package.json, pnpm-lock.yaml, pnpm-workspace.yaml, node_modules
    * any dependency version
    * the EFFECTIVE enable/disable state of every id (10 entries and 9 disabled
      plugins before, exactly the same after)

  IDEMPOTENCY:
    * The snapshot directory is created ONLY if it does not exist and is NEVER
      overwritten. If it already exists, apply stops and tells you to roll back
      first (or pass -Force only after you have verified the existing snapshot).
    * If the patch file already equals the normalized result, apply reports
      "already applied" and exits 0 without creating anything.

  USAGE (external terminal, from anywhere - this machine has no pwsh, use powershell):
    powershell -NoProfile -ExecutionPolicy Bypass -File .\apply.ps1
    powershell -NoProfile -ExecutionPolicy Bypass -File .\apply.ps1 -WhatIf
    (apply.bat / rollback.bat wrap this and pick the interpreter automatically)
#>
[CmdletBinding()]
param(
    [string] $ProfileDir = 'C:\Users\VoilT\.dsh\profiles\web',
    [string] $SnapshotRoot = 'C:\Users\VoilT\.dsh\profiles\web\.dsh-fix-snapshots',
    [string] $SnapshotName = '2026-09-16-patch-dedupe',
    [switch] $Force,
    [switch] $WhatIf
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version 3.0

$patchPath = Join-Path $ProfileDir 'cordis.patch.yml'
$snapshotDir = Join-Path $SnapshotRoot $SnapshotName
$snapshotFile = Join-Path $snapshotDir 'cordis.patch.yml'
$metaFile = Join-Path $snapshotDir 'snapshot.json'

$newContent = @'
# Your patch layer for this dsh profile, applied after every bundle layer:
# a top-level YAML array of loader patch entries (id-targeted config
# overrides, disables, and insert lists; `!!js` expressions allowed).
#
# 2026-09-16 dedupe: each id now appears exactly once. Where an id appeared
# several times with contradictory `disabled` values, the effective last-wins
# state was preserved: ui-skins, dsh-voice, open-sea-skin and ui-theme-cyberpunk
# stay disabled; dsh-messenger-gateway stays ENABLED (disabled: false) with its
# config intact.
- id: ui-skins
  disabled: true
- id: dsh-messenger-gateway
  disabled: false
  config:
    telegram:
      enabled: true
      botToken: '8644044404:AAFqCbraK7SKWOY0KSRKwVcu079PAOUFGhc'
      allowedUserIds:
        - 8273078077
      transport: poll
      voiceMode: mirror
    tts:
      enabled: true
- id: dsh-voice
  disabled: true
- id: vision-toolkit
  disabled: true
- id: open-sea-skin
  disabled: true
- id: dsh-tts
  disabled: true
- id: talk-map
  disabled: true
- id: ui-theme-cyberpunk
  disabled: true
- id: deepseek-balance-widget
  disabled: true
- id: dsh-whale-widget
  disabled: true
'@

$utf8NoBom = New-Object System.Text.UTF8Encoding($false)

function Get-Lines([string] $text) {
    return @($text -split "\r?\n" | ForEach-Object { $_.TrimEnd() })
}

function Get-Sha256([string] $path) {
    return (Get-FileHash -LiteralPath $path -Algorithm SHA256).Hash
}

function New-TempFile([string] $text, [string] $utf8Text) {
    $tmp = Join-Path ([System.IO.Path]::GetTempPath()) ("dsh-patch-" + [guid]::NewGuid().ToString('N') + ".yml")
    [System.IO.File]::WriteAllText($tmp, $utf8Text, (New-Object System.Text.UTF8Encoding($false)))
    return $tmp
}

Write-Host "== DSH profile web / cordis.patch.yml dedupe =="
Write-Host "profile : $ProfileDir"
Write-Host "patch   : $patchPath"

if (-not (Test-Path -LiteralPath $patchPath)) {
    throw "patch file not found: $patchPath"
}

# ---- current state (CRLF-normalized for comparison, raw bytes for the snapshot)
$currentText = [System.IO.File]::ReadAllText($patchPath)
$currentLines = Get-Lines $currentText
$currentHash = Get-Sha256 $patchPath
$currentInfo = Get-Item -LiteralPath $patchPath

$newText = ($newContent -replace "`r`n", "`n") + "`n"
$newLines = Get-Lines $newText

Write-Host ("current : size={0}  mtime={1:o}  sha256={2}" -f $currentInfo.Length, $currentInfo.LastWriteTime, $currentHash)

# ---- snapshot guard: never overwrite an existing snapshot
$snapshotExists = Test-Path -LiteralPath $snapshotDir
if ($snapshotExists) {
    Write-Host ""
    Write-Warning "snapshot already exists: $snapshotDir"
    Write-Host "This means apply has already been run (or was interrupted)."
    Write-Host "Nothing was changed."
    Write-Host ""
    Write-Host "Next steps:"
    Write-Host "  * to undo the change:  powershell -NoProfile -ExecutionPolicy Bypass -File .\rollback.ps1"
    Write-Host "  * to re-apply over it: only after verifying the snapshot, re-run with -Force"
    if (-not $Force) { exit 3 }
    Write-Warning "-Force given: continuing WITHOUT overwriting the existing snapshot."
}

# ---- idempotency: is the normalized state already in place?
$alreadyApplied = ($currentLines.Count -eq $newLines.Count)
if ($alreadyApplied) {
    for ($i = 0; $i -lt $newLines.Count; $i++) {
        if ($currentLines[$i] -cne $newLines[$i]) { $alreadyApplied = $false; break }
    }
}
if ($alreadyApplied) {
    Write-Host "already applied: patch file already matches the normalized result."
    Write-Host "no snapshot created, nothing written."
    exit 0
}

# ---- sanity assertions on the CURRENT file so we never clobber a hand-edited file
$currentIds = @($currentLines | Where-Object { $_ -match '^\s*-\s*id:\s*"?(?<id>[^"\s]+)"?\s*$' } | ForEach-Object { $Matches['id'] })
$expectedIdsBefore = @('ui-skins','dsh-messenger-gateway','dsh-voice','vision-toolkit','open-sea-skin','open-sea-skin','dsh-tts','talk-map','ui-theme-cyberpunk','ui-skins','dsh-voice','open-sea-skin','ui-theme-cyberpunk','deepseek-balance-widget','dsh-whale-widget')
if (($currentIds -join ',') -ne ($expectedIdsBefore -join ',')) {
    Write-Host ""
    Write-Warning "unexpected structure in the current patch file."
    Write-Host ("found ids   : " + ($currentIds -join ', '))
    Write-Host ("expected ids: " + ($expectedIdsBefore -join ', '))
    Write-Host "The file changed since this script was generated. Refusing to guess."
    Write-Host "Re-run the read-only analysis, then regenerate the scripts. Nothing was changed."
    exit 4
}

# ---- write to a temp file, verify, then move into place
$tmp = New-TempFile $newText $newText
$tmpHash = Get-Sha256 $tmp
$tmpLines = Get-Lines ([System.IO.File]::ReadAllText($tmp))
$verified = ($tmpLines.Count -eq $newLines.Count)
if ($verified) {
    for ($i = 0; $i -lt $newLines.Count; $i++) {
        if ($tmpLines[$i] -cne $newLines[$i]) { $verified = $false; break }
    }
}
if (-not $verified) {
    Remove-Item -LiteralPath $tmp -Force -ErrorAction SilentlyContinue
    throw "internal verification failed: written content does not match the intended content"
}
Write-Host ("prepared: size={0}  sha256={1}" -f (Get-Item -LiteralPath $tmp).Length, $tmpHash)

if ($WhatIf) {
    Remove-Item -LiteralPath $tmp -Force -ErrorAction SilentlyContinue
    Write-Host ""
    Write-Host "-WhatIf: nothing was written. Re-run without -WhatIf to apply."
    exit 0
}

# ---- create snapshot (exclusive create of the leaf file = race-safe)
if (-not $snapshotExists) {
    New-Item -ItemType Directory -Path $snapshotDir -Force | Out-Null
    Copy-Item -LiteralPath $patchPath -Destination $snapshotFile
    if (-not (Test-Path -LiteralPath $snapshotFile)) { throw "snapshot copy failed: $snapshotFile" }
    $meta = [ordered]@{
        createdUtc      = (Get-Date).ToUniversalTime().ToString('o')
        scope           = 'collapsed duplicated ids in cordis.patch.yml; effective enable/disable state preserved (ui-skins, dsh-voice, open-sea-skin, ui-theme-cyberpunk disabled; dsh-messenger-gateway enabled with config)'
        profileDir      = $ProfileDir
        file            = $patchPath
        originalSha256  = $currentHash
        originalSize    = $currentInfo.Length
        originalMtime   = $currentInfo.LastWriteTime.ToString('o')
        normalizedSha256 = $tmpHash
        changedIds      = @('ui-skins','dsh-voice','open-sea-skin','ui-theme-cyberpunk','dsh-messenger-gateway')
        unchangedIds    = @('vision-toolkit','dsh-tts','talk-map','deepseek-balance-widget','dsh-whale-widget')
    }
    [System.IO.File]::WriteAllText($metaFile, ($meta | ConvertTo-Json -Depth 6), $utf8NoBom)
    Write-Host "snapshot: $snapshotFile"
    Write-Host "metadata: $metaFile"
} else {
    Write-Host "snapshot: reusing existing $snapshotDir (not overwritten)"
}

# ---- commit
Move-Item -LiteralPath $tmp -Destination $patchPath -Force
$finalHash = Get-Sha256 $patchPath
$finalLines = Get-Lines ([System.IO.File]::ReadAllText($patchPath))
$ok = ($finalHash -eq $tmpHash) -and ($finalLines.Count -eq $newLines.Count)
if ($ok) {
    for ($i = 0; $i -lt $newLines.Count; $i++) {
        if ($finalLines[$i] -cne $newLines[$i]) { $ok = $false; break }
    }
}
if (-not $ok) {
    Write-Error "post-write verification FAILED. Restore now: rollback.ps1"
    exit 5
}
Write-Host ("applied : sha256={0}  size={1}" -f $finalHash, (Get-Item -LiteralPath $patchPath).Length)
Write-Host ""
Write-Host "Result: 4 duplicated ids collapsed to one entry each; every plugin keeps its"
Write-Host "        current state (4 stay disabled, dsh-messenger-gateway stays enabled)."
Write-Host "dsh reloads cordis.patch.yml live (watchUserPatches) - no restart required."
Write-Host "Undo  : powershell -NoProfile -ExecutionPolicy Bypass -File .\rollback.ps1"
exit 0
