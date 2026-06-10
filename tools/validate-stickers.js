#!/usr/bin/env node
/**
 * validate-stickers.js
 * Cross-checks all sticker entries in usePlantCatalog.js and GardenEditor.jsx (DECOR_CATALOG)
 * against actual PNG files in app/public/stickers/.
 *
 * Checks:
 *   1. src path in catalog → file must exist on disk
 *   2. key in catalog → key must match the filename (without .png)
 *   3. Orphaned PNGs → files on disk with no catalog entry referencing them
 *
 * Run: node tools/validate-stickers.js
 * Exit code: 0 = clean, 1 = mismatches found
 */

const fs   = require('fs')
const path = require('path')
const ROOT = path.resolve(__dirname, '..')
const STICKERS_DIR = path.join(ROOT, 'app', 'public', 'stickers')
const CATALOG_FILE = path.join(ROOT, 'app', 'src', 'hooks', 'usePlantCatalog.js')
const EDITOR_FILE  = path.join(ROOT, 'app', 'src', 'components', 'GardenEditor.jsx')

// ── Parse catalog entries from a JS file ─────────────────────────────────────
function parseEntries(filePath) {
  // Strip single-line comments before parsing to avoid false positives
  const raw = fs.readFileSync(filePath, 'utf8')
  const src = raw.replace(/\/\/.*$/gm, '')
  const entries = []

  // Match: key:'...' ... src:'...'  (single or double quotes, any order of fields)
  const entryRegex = /\{[^{}]*key\s*:\s*['"`]([^'"`]+)['"`][^{}]*src\s*:\s*['"`]([^'"`]+)['"`][^{}]*\}/g
  let m
  while ((m = entryRegex.exec(src)) !== null) {
    entries.push({ key: m[1], src: m[2], file: path.basename(filePath) })
  }
  return entries
}

// ── Get all PNG files in stickers dir ────────────────────────────────────────
function getStickerFiles() {
  return new Set(fs.readdirSync(STICKERS_DIR).filter(f => f.endsWith('.png')))
}

// ── Main validation ───────────────────────────────────────────────────────────
function validate() {
  const stickerFiles = getStickerFiles()
  const allEntries   = [
    ...parseEntries(CATALOG_FILE),
    ...parseEntries(EDITOR_FILE),
  ]

  // Deduplicate by key (catalog + editor may both have decor entries)
  const seen = new Map()
  for (const e of allEntries) {
    if (!seen.has(e.key)) seen.set(e.key, e)
  }
  const entries = [...seen.values()]

  const errors   = []
  const warnings = []
  const referencedFiles = new Set()

  for (const entry of entries) {
    // Normalize src: strip leading /stickers/ or /
    const filename = path.basename(entry.src)
    referencedFiles.add(filename)

    // Check 1: src file must exist
    if (!stickerFiles.has(filename)) {
      errors.push(`MISSING FILE  key="${entry.key}"  src="${entry.src}"  (from ${entry.file})`)
    }

    // Check 2: for decor/water items, key should match filename (without .png)
    // Plant keys are intentionally short (no size/region suffix) — skip those
    const isDecorKey = entry.key.startsWith('decor_') || entry.key.startsWith('water-feature_')
    if (isDecorKey) {
      const expectedKey = filename.replace('.png', '')
      if (entry.key !== expectedKey) {
        warnings.push(`KEY MISMATCH  key="${entry.key}"  src filename="${expectedKey}"  (from ${entry.file})`)
      }
    }
  }

  // Check 3: orphaned files (on disk but not in any catalog)
  for (const f of stickerFiles) {
    if (!referencedFiles.has(f)) {
      warnings.push(`ORPHAN FILE   "${f}" is on disk but not referenced in any catalog`)
    }
  }

  // ── Report ──────────────────────────────────────────────────────────────────
  const timestamp = new Date().toISOString()
  console.log(`\n🌿 Garden Mapper — Sticker Validation Report`)
  console.log(`   ${timestamp}`)
  console.log(`   Catalog entries: ${entries.length}`)
  console.log(`   Sticker files:   ${stickerFiles.size}\n`)

  if (errors.length === 0 && warnings.length === 0) {
    console.log('✅ All stickers validated — no issues found.\n')
    return 0
  }

  if (errors.length > 0) {
    console.log(`❌ ERRORS (${errors.length}) — these will cause ? placeholders in saved gardens:`)
    errors.forEach(e => console.log('   ' + e))
    console.log()
  }

  if (warnings.length > 0) {
    console.log(`⚠️  WARNINGS (${warnings.length}):`)
    warnings.forEach(w => console.log('   ' + w))
    console.log()
  }

  return errors.length > 0 ? 1 : 0
}

const exitCode = validate()
process.exit(exitCode)
