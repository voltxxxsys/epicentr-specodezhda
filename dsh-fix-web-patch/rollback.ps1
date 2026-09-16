<#
  rollback.ps1 — undo apply.ps1 for DSH profile "web" (cordis.patch.yml dedupe).

  Restores cordis.patch.yml byte-for-byte from the snapshot apply.ps1 created.
  Both a partially completed apply and a repeated rollback are safe:
    * snapshot missing        -> reports it, changes nothing, exit 0
    * file already restored   -> reports "already rolled back", changes nothing, exit 0
    * file edited after apply -> refuses to overwrite without -Force (exit 6)
  The snapshot is kept by default (use -RemoveSnapshot to delete it afterwards).

  USAGE (this machine has no pwsh, use powershell):
    powershell -NoProfile -ExecutionPolicy Bypass -File .\rollback.ps1
    powershell -NoProfile -ExecutionPolicy Bypass -File .\rollback.ps1 -WhatIf
    (rollback.bat wraps this and picks the interpreter automatically)
#>
[CmdletBinding()]
param(
    [string] $ProfileDir = 'C:\Users\VoilT\.dsh\profiles\web',
    [string] $SnapshotRoot = 'C:\Users\VoilT\.dsh\profiles\web\.dsh-fix-snapshots',
    [string] $SnapshotName = '2026-09-16-patch-dedupe',
    [switch] $Force,
    [switch] $RemoveSnapshot,
    [switch] $WhatIf
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version 3.0

$patchPath = Join-Path $ProfileDir 'cordis.patch.yml'
$snapshotDir = Join-Path $SnapshotRoot $SnapshotName
$snapshotFile = Join-Path $snapshotDir 'cordis.patch.yml'
$metaFile = Join-Path $snapshotDir 'snapshot.json'

Write-Host "== DSH profile web / rollback cordis.patch.yml =="
Write-Host "patch    : $patchPath"
Write-Host "snapshot : $snapshotDir"

if (-not (Test-Path -LiteralPath $snapshotDir)) {
    Write-Host ""
    Write-Host "no snapshot found - apply.ps1 was never run (or the snapshot was removed)."
    Write-Host "nothing to roll back; nothing was changed."
    exit 0
}
if (-not (Test-Path -LiteralPath $snapshotFile)) {
    Write-Warning "snapshot directory exists but $snapshotFile is missing."
    Write-Host "Nothing was changed. Inspect the directory manually."
    exit 7
}

$meta = $null
if (Test-Path -LiteralPath $metaFile) {
    $meta = Get-Content -LiteralPath $metaFile -Raw | ConvertFrom-Json
}

$snapshotHash = (Get-FileHash -LiteralPath $snapshotFile -Algorithm SHA256).Hash
$snapshotInfo = Get-Item -LiteralPath $snapshotFile
Write-Host ("snapshot : size={0}  mtime={1:o}  sha256={2}" -f $snapshotInfo.Length, $snapshotInfo.LastWriteTime, $snapshotHash)
if ($meta -and $meta.originalSha256 -and ($meta.originalSha256 -ne $snapshotHash)) {
    Write-Warning "snapshot content does not match its recorded sha256 in snapshot.json."
    Write-Host ("recorded: {0}" -f $meta.originalSha256)
    Write-Host ("actual  : {0}" -f $snapshotHash)
    Write-Host "Refusing to restore an unverified snapshot. Nothing was changed."
    exit 7
}

# ---- already rolled back?
if (Test-Path -LiteralPath $patchPath) {
    $currentHash = (Get-FileHash -LiteralPath $patchPath -Algorithm SHA256).Hash
    Write-Host ("current  : sha256={0}" -f $currentHash)

    if ($currentHash -eq $snapshotHash) {
        Write-Host ""
        Write-Host "already rolled back: the patch file already matches the snapshot."
        if ($RemoveSnapshot -and -not $WhatIf) {
            Remove-Item -LiteralPath $snapshotDir -Recurse -Force
            Write-Host "snapshot removed: $snapshotDir"
        }
        exit 0
    }

    $normalizedHash = if ($meta) { $meta.normalizedSha256 } else { $null }
    $isAppliedState = ($normalizedHash -and ($currentHash -eq $normalizedHash))
    $isForeignState = -not $isAppliedState

    if ($isForeignState -and -not $Force) {
        Write-Host ""
        Write-Warning "the patch file was edited after apply (neither the applied nor the snapshot state)."
        if ($normalizedHash) { Write-Host ("applied state hash: {0}" -f $normalizedHash) }
        Write-Host "Restoring would discard those edits. Re-run with -Force if you really want that."
        Write-Host "Nothing was changed."
        exit 6
    }
} else {
    Write-Host "current  : (patch file is missing - it will be recreated from the snapshot)"
}

if ($WhatIf) {
    Write-Host ""
    Write-Host "-WhatIf: nothing was written. Re-run without -WhatIf to restore."
    exit 0
}

# ---- restore, then verify
$tmp = Join-Path ([System.IO.Path]::GetTempPath()) ("dsh-patch-rb-" + [guid]::NewGuid().ToString('N') + ".yml")
Copy-Item -LiteralPath $snapshotFile -Destination $tmp
$tmpHash = (Get-FileHash -LiteralPath $tmp -Algorithm SHA256).Hash
if ($tmpHash -ne $snapshotHash) {
    Remove-Item -LiteralPath $tmp -Force -ErrorAction SilentlyContinue
    throw "copy verification failed before restore"
}
Move-Item -LiteralPath $tmp -Destination $patchPath -Force

$finalHash = (Get-FileHash -LiteralPath $patchPath -Algorithm SHA256).Hash
if ($finalHash -ne $snapshotHash) {
    Write-Error "restore verification FAILED: $patchPath does not match the snapshot"
    exit 5
}
Write-Host ("restored : sha256={0}  size={1}" -f $finalHash, (Get-Item -LiteralPath $patchPath).Length)
Write-Host "cordis.patch.yml is back to its pre-apply content (duplicates and dsh-fix comments included)."

if ($RemoveSnapshot) {
    Remove-Item -LiteralPath $snapshotDir -Recurse -Force
    Write-Host "snapshot removed: $snapshotDir"
} else {
    Write-Host "snapshot kept at: $snapshotDir"
}
exit 0
