// useDreamGarden.js — Hybrid dream garden seed + silent background fetch
//
// Strategy:
//   1. On every launch, ensure index 0 is always the Dream Garden.
//      - New user (empty LS): seed [Dream Garden, My Garden]
//      - Existing user missing Dream Garden at index 0: prepend it
//      - This means Dream Garden is always present and loadable, for everyone.
//   2. On every launch, silently fetch DREAM_GARDEN_URL in the background.
//      If the fetched _dreamVersion > stored version → update slot 0 + backup.
//
// The dream garden is always at index 0. It is flagged _isDreamGarden: true
// and locked: true so the UI can treat it as read-only (no delete, no edit).

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
    w: 60,
    h: 40,
    unit: 'ft',
    plants: [],
    structs: [],
  }
}

// ── Seed: ensures Dream Garden is always present at index 0 ──────────────────
export function seedDreamGarden() {
  const gardens = readGardens()

  if (gardens.length === 0) {
    // Brand-new user: seed Dream Garden + blank My Garden
    const dream = makeDreamGarden(dreamGardenFallback)
    const blank = makeBlankGarden()
    writeGardens([dream, blank])
    try { localStorage.setItem('gardenLastIndex', '0') } catch {}
    return
  }

  // Existing user: check if Dream Garden is already at index 0
  if (!gardens[0]?._isDreamGarden) {
    // Prepend Dream Garden; existing user gardens shift to index 1+
    const dream = makeDreamGarden(dreamGardenFallback)
    writeGardens([dream, ...gardens])
    // Shift last-used index forward so the user stays on their own garden
    try {
      const last = parseInt(localStorage.getItem('gardenLastIndex') || '0')
      localStorage.setItem('gardenLastIndex', String(last + 1))
    } catch {}
  }
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
