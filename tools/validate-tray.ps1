# validate-tray.ps1 — Garden Mapper plant tray health check
# Checks for: missing PNGs, cross-duplicates between catalog and packs, pack-only missing PNGs
# Run daily via cron or manually: pwsh tools\validate-tray.ps1

$ROOT     = "C:\Users\RG\.openclaw\workspace\projects\garden-planner"
$CATALOG  = "$ROOT\app\src\hooks\usePlantCatalog.js"
$STICKERS = "$ROOT\app\public\stickers"

# Auto-load all pack files from packs directory
$PACK_DIR = "$ROOT\app\src\data\packs"
$PACK_FILES = Get-ChildItem "$PACK_DIR\pack-*.js" | Select-Object -ExpandProperty FullName

$errors   = @()
$warnings = @()

# ── Extract all keys + src paths from a file ───────────────────────────────────
function Get-Entries($file) {
    # Strip commented-out lines before parsing
    $content = (Get-Content $file) | Where-Object { $_ -notmatch '^\s*//' } | Out-String
    $keys  = [regex]::Matches($content, "key:\s*'([^']+)'")   | ForEach-Object { $_.Groups[1].Value }
    $srcs  = [regex]::Matches($content, "src:\s*'([^']+)'")   | ForEach-Object { $_.Groups[1].Value }
    $result = @()
    for ($i = 0; $i -lt $keys.Count; $i++) {
        $result += [PSCustomObject]@{ Key = $keys[$i]; Src = if ($i -lt $srcs.Count) { $srcs[$i] } else { '' } }
    }
    return $result
}

$catalogEntries = Get-Entries $CATALOG
$allPackEntries = @()
foreach ($packFile in $PACK_FILES) {
    $allPackEntries += Get-Entries $packFile
}

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

# ── 3. Missing sticker files (explicit src: entries) ─────────────────────────
$allEntries = $catalogEntries + $allPackEntries
foreach ($entry in $allEntries) {
    if (-not $entry.Src) { continue }
    $filename = $entry.Src -replace '^/stickers/', ''
    $path = "$STICKERS\$filename"
    if (-not (Test-Path $path)) {
        $errors += "MISSING STICKER: '$($entry.Key)' → $filename"
    }
}

# ── 3b. Key-as-filename entries (pack entries with no src:) ───────────────────
# Pack entries that omit src: rely on key-based filename: /stickers/<key>.webp
foreach ($entry in $allPackEntries) {
    if ($entry.Src) { continue }  # already checked above
    $filename = "$($entry.Key).webp"
    $path = "$STICKERS\$filename"
    if (-not (Test-Path $path)) {
        $warnings += "MISSING KEY-AS-FILENAME: '$($entry.Key)' → $filename (key-as-filename pack entry)"
    }
}

# ── 4. Orphaned stickers (in folder but not in any catalog/pack) ──────────────
$allSrcs = $allEntries | ForEach-Object { ($_.Src -replace '^/stickers/', '') }
$stickerFiles = Get-ChildItem "$STICKERS\*.webp", "$STICKERS\*.png" -ErrorAction SilentlyContinue | ForEach-Object { $_.Name }
foreach ($file in $stickerFiles) {
    # Also check key-as-filename coverage
    $keyMatch = $allPackEntries | Where-Object { -not $_.Src -and "$($_.Key).webp" -eq $file }
    if ($allSrcs -notcontains $file -and -not $keyMatch) {
        $warnings += "ORPHAN STICKER (not in any catalog): $file"
    }
}

# ── Report ────────────────────────────────────────────────────────────────────
$timestamp = Get-Date -Format "yyyy-MM-dd HH:mm"
Write-Host "=== Garden Mapper Tray Validator — $timestamp ===" -ForegroundColor Cyan
Write-Host "Catalog entries:  $($catalogEntries.Count)"
Write-Host "Pack entries:     $($allPackEntries.Count)"
Write-Host "Sticker files:    $($stickerFiles.Count) (.webp + .png)"
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
