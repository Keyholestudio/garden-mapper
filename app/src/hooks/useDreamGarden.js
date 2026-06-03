// useDreamGarden.js — Hybrid dream garden seed + silent background fetch
//
// Strategy:
//   1. On first-ever launch (no gardens in LS), seed two gardens:
//        [0] Dream Garden (locked, read-only)
//        [1] My Garden    (blank, user-editable)
//   2. On every launch, silently fetch DREAM_GARDEN_URL in the background.
//      If the fetched _dreamVersion > stored version → update slot 0 + backup.
//
// The dream garden is always at index 0. It is flagged _isDreamGarden: true
// and locked: true so the UI can treat it as read-only.

import dreamGardenFallback from '../data/dreamGarden.json'

const LS_KEY        = 'gardenData'
const LS_BACKUP_KEY = 'gardenData_backup'
const SCHEMA_VERSION = 2

// Remote URL — update this once we have a GitHub raw URL or CDN path
// For now points to a placeholder that will 404 gracefully (no-op on failure)
const DREAM_GARDEN_URL =
  'https://raw.githubusercontent.com/placeholder/garden-mapper/main/public/dreamGarden.json'

// ── Helpers ───────────────────────────────────────────────────────────────────

function readGardens() {
  try {
    const raw = JSON.parse(localStorage.getItem(LS_KEY) || '[]')
    return Array.isArray(raw) ? raw : []
  } catch { return [] }
}

function writeGardens(gardens) {
  try {
    localStorage.setItem(LS_BACKUP_KEY, localStorage.getItem(LS_KEY) || '[]')
    localStorage.setItem(LS_KEY, JSON.stringify(gardens))
  } catch {}
}

function makeDreamGarden(data) {
  return {
    ...data,
    _schemaVersion: SCHEMA_VERSION,
    _isDreamGarden: true,
    locked: true,
  }
}

function makeBlankGarden() {
  return {
    _schemaVersion: SCHEMA_VERSION,
    _isDreamGarden: false,
    name: 'My Garden',
    width: 20,
    height: 15,
    unit: 'ft',
    plants: [],
    structs: [],
  }
}

// ── Seed: called once when gardens array is empty (brand-new user) ─────────────
export function seedDreamGarden() {
  const gardens = readGardens()
  if (gardens.length > 0) return  // already seeded

  const dream = makeDreamGarden(dreamGardenFallback)
  const blank = makeBlankGarden()
  writeGardens([dream, blank])

  // Start on the dream garden so the first thing users see is the beautiful example
  try { localStorage.setItem('gardenLastIndex', '0') } catch {}
}

// ── Silent background fetch: runs after UI is loaded ─────────────────────────
// Returns a promise that resolves when done (caller can ignore it)
export async function fetchDreamGardenUpdate() {
  try {
    const res = await fetch(DREAM_GARDEN_URL, { cache: 'no-cache' })
    if (!res.ok) return  // 404 or network error — silent no-op

    const remote = await res.json()
    if (!remote || typeof remote._dreamVersion !== 'number') return

    const gardens = readGardens()
    if (gardens.length === 0) return  // shouldn't happen, but guard

    const stored = gardens[0]
    const storedVersion = stored?._dreamVersion ?? 0

    // Only update if remote is newer
    if (remote._dreamVersion <= storedVersion) return

    gardens[0] = makeDreamGarden(remote)
    writeGardens(gardens)
    console.log(`[DreamGarden] Updated to v${remote._dreamVersion}`)
  } catch {
    // Network offline or CORS error — silent no-op
  }
}
