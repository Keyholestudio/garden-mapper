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
  'https://raw.githubusercontent.com/Keyholestudio/garden-mapper/main/app/src/data/dreamGarden.json'

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
    // Brand-new user: seed Dream Garden only.
    // Do NOT seed a blank My Garden here — if the user has cloud gardens,
    // the blank would make hasLocalData=true and block the restore prompt.
    // GardenEditor handles the zero-user-gardens state (shows New Garden prompt).
    const dream = makeDreamGarden(dreamGardenFallback)
    writeGardens([dream])
    try { localStorage.setItem('gardenLastIndex', '0') } catch {}
    return
  }

  // Helper: is this entry a dream garden (by flag OR by name fallback)
  const isDream = (g) => !!(g?._isDreamGarden || g?.name === '🌸 Dream Garden' || g?.name === 'Dream Garden')

  // Remove any duplicate dream gardens (keep only first occurrence)
  const deduplicated = gardens.filter((g, i) => {
    if (!isDream(g)) return true          // always keep user gardens
    return gardens.findIndex(isDream) === i  // keep only first dream entry
  })

  // Ensure the one dream entry is stamped with _isDreamGarden: true
  const hasDream = deduplicated.some(isDream)
  if (hasDream) {
    const di = deduplicated.findIndex(isDream)
    deduplicated[di] = makeDreamGarden(deduplicated[di])
    // Move dream to index 0 if it isn't already
    if (di !== 0) {
      const [dream] = deduplicated.splice(di, 1)
      deduplicated.unshift(dream)
      // Adjust last-used index
      try {
        const last = parseInt(localStorage.getItem('gardenLastIndex') || '0')
        if (last < di) localStorage.setItem('gardenLastIndex', String(last + 1))
      } catch {}
    }
    writeGardens(deduplicated)
    return
  }

  // No dream garden found at all — prepend one
  const dream = makeDreamGarden(dreamGardenFallback)
  writeGardens([dream, ...deduplicated])
  try {
    const last = parseInt(localStorage.getItem('gardenLastIndex') || '0')
    localStorage.setItem('gardenLastIndex', String(last + 1))
  } catch {}
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
