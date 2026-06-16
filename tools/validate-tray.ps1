# validate-tray.ps1 — Garden Mapper plant tray health check
# Checks for: missing PNGs, cross-duplicates between catalog and packs, pack-only missing PNGs
# Run daily via cron or manually: pwsh tools\validate-tray.ps1

$ROOT     = "C:\Users\RG\.openclaw\workspace\projects\garden-planner"
$CATALOG  = "$ROOT\app\src\hooks\usePlantCatalog.js"
$PACK1    = "$ROOT\app\src\data\packs\pack-cacti-succulents.js"
$PACK2    = "$ROOT\app\src\data\packs\pack-tropical.js"
$STICKERS = "$ROOT\app\public\stickers"

$errors   = @()
$warnings = @()

# ── Extract all keys + src paths from a file ───────────────────────────────────
function Get-Entries($file) {
    # Strip commented-out lines before parsing
    $content = (Get-Content $file) | Where-Object { $_ -notmatch '^\s*//' } | Out-String
    $keys  = [regex]::Matches($content, "key:'([^']+)'")   | ForEach-Object { $_.Groups[1].Value }
    $srcs  = [regex]::Matches($content, "src:'([^']+)'")   | ForEach-Object { $_.Groups[1].Value }
    $result = @()
    for ($i = 0; $i -lt $keys.Count; $i++) {
        $result += [PSCustomObject]@{ Key = $keys[$i]; Src = if ($i -lt $srcs.Count) { $srcs[$i] } else { '' } }
    }
    return $result
}

$catalogEntries = Get-Entries $CATALOG
$pack1Entries   = Get-Entries $PACK1
$pack2Entries   = Get-Entries $PACK2
$allPackEntries = $pack1Entries + $pack2Entries

# ── 1. Cross-duplicates (key in both catalog and any pack) ─────────────────────
$catalogKeys = $catalogEntries | ForEach-Object { $_.Key }
$packKeys    = $allPackEntries  | ForEach-Object { $_.Key }
$crossDups   = $packKeys | Where-Object { $catalogKeys -contains $_ }
foreach ($dup in $crossDups) {
    $errors += "DUPLICATE: '$dup' exists in both usePlantCatalog.js and a pack file (will show twice in tray)"
}

# ── 2. Internal catalog duplicates ────────────────────────────────────────────
$catalogDups = $catalogKeys | Group-Object | Where-Object { $_.Count -gt 1 }
foreach ($d in $catalogDups) {
    $errors += "CATALOG DUPLICATE: '$($d.Name)' appears $($d.Count) times in usePlantCatalog.js"
}

# ── 3. Missing PNGs ───────────────────────────────────────────────────────────
$allEntries = $catalogEntries + $allPackEntries
foreach ($entry in $allEntries) {
    if (-not $entry.Src) { continue }
    $filename = $entry.Src -replace '^/stickers/', ''
    $path = "$STICKERS\$filename"
    if (-not (Test-Path $path)) {
        $errors += "MISSING PNG: '$($entry.Key)' → $filename"
    }
}

# ── 4. Orphaned PNGs (in folder but not in any catalog/pack) ──────────────────
$allSrcs = $allEntries | ForEach-Object { ($_.Src -replace '^/stickers/', '') }
$pngFiles = Get-ChildItem "$STICKERS\*.png" | ForEach-Object { $_.Name }
foreach ($png in $pngFiles) {
    if ($allSrcs -notcontains $png) {
        $warnings += "ORPHAN PNG (not in any catalog): $png"
    }
}

# ── Report ────────────────────────────────────────────────────────────────────
$timestamp = Get-Date -Format "yyyy-MM-dd HH:mm"
Write-Host "=== Garden Mapper Tray Validator — $timestamp ===" -ForegroundColor Cyan
Write-Host "Catalog entries:  $($catalogEntries.Count)"
Write-Host "Pack entries:     $($allPackEntries.Count)"
Write-Host "Sticker PNGs:     $($pngFiles.Count)"
Write-Host ""

if ($errors.Count -eq 0 -and $warnings.Count -eq 0) {
    Write-Host "All good — no issues found." -ForegroundColor Green
} else {
    if ($errors.Count -gt 0) {
        Write-Host "ERRORS ($($errors.Count)):" -ForegroundColor Red
        $errors | ForEach-Object { Write-Host "  $_" -ForegroundColor Red }
        Write-Host ""
    }
    if ($warnings.Count -gt 0) {
        Write-Host "WARNINGS ($($warnings.Count)):" -ForegroundColor Yellow
        $warnings | ForEach-Object { Write-Host "  $_" -ForegroundColor Yellow }
    }
}

# ── Exit code for cron ────────────────────────────────────────────────────────
if ($errors.Count -gt 0) { exit 1 } else { exit 0 }
