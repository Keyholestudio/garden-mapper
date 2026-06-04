// useSaveLoad.js — Phase 5: localStorage save/load/switcher
// Direct port of v8 saveGarden / loadGarden / newGarden
// Designed to run synchronously against Konva layer refs (no React state async issues)

import Konva from 'konva'
import { SIZE_MAP } from './useGardenState'
import { makePlantGroup } from '../utils/plantUtils'

const LAWN_TEXTURES = {
  spring: '/textures/lawn-spring.jpg',
  summer: '/textures/lawn-summer.jpg',
  fall:   '/textures/lawn-fall-early.jpg',
  winter: '/textures/lawn-winter.jpg',
}
const LAWN_OPACITY = {
  spring: 1.0,
  summer: 1.0,
  fall:   0.7,
  winter: 1.0,
}
const SEASON_NAMES = ['spring', 'summer', 'fall', 'winter']

function applyHedgeTexture(shape, layer) {
  const img = new window.Image()
  img.onload = () => {
    shape.fillPriority('pattern')
    shape.fillPatternImage(img)
    shape.fillPatternRepeat('repeat')
    layer?.batchDraw()
  }
  img.src = '/textures/hedge.jpg'
}

function applyLawnTexture(boundsRect, currentSeason, structLayer) {
  const season = SEASON_NAMES[currentSeason] || 'spring'
  const img = new window.Image()
  img.onload = () => {
    boundsRect.fillPriority('pattern')
    boundsRect.fillPatternImage(img)
    boundsRect.fillPatternRepeat('repeat')
    boundsRect.opacity(LAWN_OPACITY[season] ?? 1.0)
    structLayer?.batchDraw()
  }
  img.src = LAWN_TEXTURES[season]
}

const LS_KEY          = 'gardenData'
const LS_BACKUP_KEY   = 'gardenData_backup'   // last-known-good snapshot
const LS_LAST_IDX_KEY = 'gardenLastIndex'
const MAX_GARDENS     = 2
const SCHEMA_VERSION  = 2  // increment when save format changes

// ── Schema migration ──────────────────────────────────────────────────────────────────
function migrateGarden(g) {
  if (!g || typeof g !== 'object') return null
  const v = g._schemaVersion || 1

  // v1 → v2: ensure all plant entries have seasons array + transparent flag
  if (v < 2) {
    if (Array.isArray(g.plants)) {
      g.plants = g.plants.map(p => ({
        ...p,
        seasons:     p.seasons     || ['spring','summer','fall','winter'],
        transparent: p.transparent ?? false,
        notes:       p.notes       || '',
      }))
    }
    if (Array.isArray(g.structs)) {
      g.structs = g.structs.map(s => ({
        ...s,
        transparent: s.transparent ?? false,
      }))
    }
  }

  g._schemaVersion = SCHEMA_VERSION
  return g
}

// ── Last-used index helpers ───────────────────────────────────────────────────
export function readLastGardenIndex() {
  try {
    const v = parseInt(localStorage.getItem(LS_LAST_IDX_KEY) ?? '0')
    return isNaN(v) ? 0 : v
  } catch { return 0 }
}
export function writeLastGardenIndex(idx) {
  try { localStorage.setItem(LS_LAST_IDX_KEY, String(idx)) } catch {}
}

// ── localStorage helpers ──────────────────────────────────────────────────────
export function readGardens() {
  try {
    const raw = JSON.parse(localStorage.getItem(LS_KEY) || '[]')
    if (!Array.isArray(raw)) return []
    return raw.map(g => migrateGarden(g)).filter(Boolean)
  } catch {
    return readGardensBackup()
  }
}
function readGardensBackup() {
  try {
    const raw = JSON.parse(localStorage.getItem(LS_BACKUP_KEY) || '[]')
    if (!Array.isArray(raw)) return []
    console.warn('[GardenMapper] Loaded from backup — primary was corrupt')
    return raw.map(g => migrateGarden(g)).filter(Boolean)
  } catch { return [] }
}
function writeGardens(arr) {
  try {
    const json = JSON.stringify(arr)
    const current = localStorage.getItem(LS_KEY)
    if (current) localStorage.setItem(LS_BACKUP_KEY, current)
    localStorage.setItem(LS_KEY, json)
  } catch (e) {
    console.error('[GardenMapper] Save failed:', e)
  }
}

// ── Export gardens as JSON file (user backup) ─────────────────────────────────
export function exportGardensJSON() {
  const data = { _schemaVersion: SCHEMA_VERSION, gardens: readGardens(), exportedAt: new Date().toISOString() }
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href = url; a.download = 'garden-mapper-backup.json'
  a.click(); URL.revokeObjectURL(url)
}

// ── saveGarden ────────────────────────────────────────────────────────────────
// Mirrors v8 saveGarden() exactly. All data comes from refs (synchronous).
export function saveGarden({ stage, layers, state, currentGardenIndex }) {
  if (!stage) return false

  const { plantLayer, structLayer } = layers
  const propBounds = state.propBoundsRef.current

  // Collect plants (from Konva layer — same as v8)
  const plants = []
  plantLayer?.find('Group').forEach(g => {
    const d = state.plantDataRef.current[g.id()]
    if (!d) return
    plants.push({
      id: g.id(), x: g.x(), y: g.y(),
      scaleX: g.scaleX(), scaleY: g.scaleY(),
      label: d.label, family: d.family, key: d.key, size: d.size,
      notes: d.notes, seasons: d.seasons, transparent: d.transparent, locked: d.locked || false,
      zIndex: g.zIndex(),
    })
  })

  // Collect structs (from Konva layer — same as v8)
  const structs = []
  structLayer?.find('Line,Rect,Circle,Path').forEach(s => {
    const id = s.id()
    if (!id || !state.structDataRef.current[id]) return  // skips __propBounds, __propLabel
    const d = state.structDataRef.current[id]
    const entry = {
      id, type: d.type, colour: d.colour, label: d.label,
      pathWidth: d.pathWidth, tension: d.tension,
      transparent: d.transparent || false,
      locked: d.locked || false,
      zIndex: s.getZIndex(),
    }
    if (s instanceof Konva.Rect) {
      entry.rx = s.x(); entry.ry = s.y()
      entry.rw = s.width(); entry.rh = s.height()
    } else if (s instanceof Konva.Path) {
      entry.svgPath = s.data(); entry.lx = s.x(); entry.ly = s.y()
    } else if (s instanceof Konva.Line) {
      entry.points = s.points(); entry.lx = s.x(); entry.ly = s.y()
    } else if (s instanceof Konva.Circle) {
      entry.cx = s.x(); entry.cy = s.y(); entry.radius = s.radius()
    }
    structs.push(entry)
  })

  const gardenEntry = {
    _schemaVersion: SCHEMA_VERSION,
    name:    state.gardenName,
    unit:    state.gardenUnit,
    w:       state.gardenW,
    h:       state.gardenH,
    originX: propBounds?.x ?? 0,
    originY: propBounds?.y ?? 0,
    plants,
    structs,
  }

  const gardens = readGardens()
  // Safe write: if index is within bounds, overwrite; otherwise append
  if (currentGardenIndex < gardens.length) {
    gardens[currentGardenIndex] = gardenEntry
  } else {
    gardens.push(gardenEntry)
  }
  writeGardens(gardens)
  writeLastGardenIndex(currentGardenIndex)
  return true
}

// ── loadGarden ────────────────────────────────────────────────────────────────
// Direct port of v8 loadGarden(idx). All Konva work is synchronous.
// React state setters are called at the END so they don't race with Konva ops.
export function loadGarden({
  idx,
  stage, layers, state, loadedImages,
  showGridRef,
  onSelectPlant, onSelectStruct, onClearSelection,
  setGardenName, setGardenW, setGardenH, setGardenUnit, setIsSetup,
  onZoomToFit,
}) {
  const gardens = readGardens()
  const g = gardens[idx]
  if (!g) return false

  const { plantLayer, structLayer, uiLayer } = layers

  // ── Clear canvas (mirrors v8) ──
  plantLayer?.destroyChildren()
  structLayer?.destroyChildren()
  // Clear edit handles from uiLayer (keep transformer)
  if (uiLayer) {
    uiLayer.find('Circle,Line').forEach(n => n.destroy())
    const tr = layers.tr
    if (tr) tr.nodes([])
  }

  // Clear data registries
  Object.keys(state.plantDataRef.current).forEach(k => delete state.plantDataRef.current[k])
  Object.keys(state.structDataRef.current).forEach(k => delete state.structDataRef.current[k])
  onClearSelection()

  // ── Recalculate propBounds (matches v8 exactly) ──
  const W = stage.width(), H = stage.height()
  const UNIT_PX = 32
  const pw = g.w * UNIT_PX * (g.unit === 'm' ? 3.281 : 1)
  const ph = g.h * UNIT_PX * (g.unit === 'm' ? 3.281 : 1)
  const ox = Math.max(16, (W - pw) / 2)
  const oy = Math.max(16, (H - ph) / 2)
  state.propBoundsRef.current = { x: ox, y: oy, w: pw, h: ph }

  // Re-draw boundary (same as v8)
  const boundsRect = new Konva.Rect({
    id: '__propBounds',
    x: ox, y: oy, width: pw, height: ph,
    stroke: '#558B2F', strokeWidth: 2, dash: [10, 5],
    fill: 'transparent', listening: false, strokeScaleEnabled: false,
  })
  structLayer?.add(boundsRect)
  applyLawnTexture(boundsRect, state.currentSeason ?? 0, structLayer)
  structLayer?.add(new Konva.Text({
    id: '__propLabel',
    x: ox + 6, y: oy + 5,
    text: `${g.name}  ${g.w}x${g.h} ${g.unit}`,
    fontSize: 11, fontStyle: 'bold', fill: '#558B2F', opacity: 0.65, listening: false,
  }))

  // Origin delta (same as v8)
  const savedOX = g.originX ?? ox
  const savedOY = g.originY ?? oy
  const dX = ox - savedOX
  const dY = oy - savedOY

  let maxSId = state.structIdCtr.current
  let maxPId = state.plantIdCtr.current

  // ── Restore structs (mirrors v8 exactly) ──
  ;(g.structs || []).forEach(entry => {
    const n = parseInt((entry.id || '').split('_')[1] || '0')
    if (n >= maxSId) maxSId = n + 1

    state.structDataRef.current[entry.id] = {
      type: entry.type, colour: entry.colour, label: entry.label,
      pathWidth: entry.pathWidth, tension: entry.tension,
      transparent: entry.transparent || false,
      locked: entry.locked || false,
    }

    let shape

    if (entry.svgPath !== undefined) {
      const isUG = entry.type === 'underground-electrical' || entry.type === 'underground-plumbing'
      shape = new Konva.Path({
        id: entry.id,
        data: entry.svgPath,
        x: (entry.lx || 0) + dX, y: (entry.ly || 0) + dY,
        fill: isUG ? 'transparent' : entry.colour + 'CC',
        stroke: (isUG || entry.type === 'path') ? entry.colour : '#3A2A10',
        strokeWidth: 2,
        strokeScaleEnabled: false, lineCap: 'round', lineJoin: 'round', draggable: true,
      })
      shape.on('click tap', e => { if (!state.editingShapeIdRef?.current) onSelectStruct(entry.id, shape, e) })
      shape.on('dblclick dbltap', () => { /* enterEditMode wired via useSelection */ })

    } else if (entry.points !== undefined) {
      const isPath     = entry.type === 'path'
      const isFenceType = entry.type === 'fence' || entry.type === 'gate'
      const cl = !isPath && !isFenceType
      shape = new Konva.Line({
        id: entry.id,
        points: entry.points,
        x: (entry.lx || 0) + dX, y: (entry.ly || 0) + dY,
        tension: entry.tension || 0,
        closed: cl,
        fill: (isPath || isFenceType) ? 'transparent' : entry.colour + 'CC',
        stroke: (isPath || isFenceType) ? entry.colour : '#3A2A10',
        strokeWidth: isPath ? (entry.pathWidth || 18) : isFenceType ? 6 : 2,
        strokeScaleEnabled: false, lineCap: 'round', lineJoin: 'round', draggable: true,
        hitStrokeWidth: isPath ? (entry.pathWidth || 18) + 10 : undefined,
      })
      shape.on('click tap', e => { if (!state.editingShapeIdRef?.current) onSelectStruct(entry.id, shape, e) })

    } else if (entry.rx !== undefined) {
      const cornerR = entry.type === 'building' ? 3 : 0
      shape = new Konva.Rect({
        id: entry.id,
        x: entry.rx + dX, y: entry.ry + dY,
        width: entry.rw, height: entry.rh,
        fill: entry.colour + 'CC', stroke: '#3A2A10', strokeWidth: 2,
        cornerRadius: cornerR, draggable: true, strokeScaleEnabled: false,
      })
      shape.on('transformend', () => {
        shape.width(shape.width() * shape.scaleX())
        shape.height(shape.height() * shape.scaleY())
        shape.scaleX(1); shape.scaleY(1)
        structLayer?.batchDraw()
      })
      shape.on('click tap', e => { if (!state.editingShapeIdRef?.current) onSelectStruct(entry.id, shape, e) })

    } else if (entry.cx !== undefined) {
      shape = new Konva.Circle({
        id: entry.id,
        x: entry.cx + dX, y: entry.cy + dY,
        radius: entry.radius,
        fill: entry.colour + 'CC', stroke: entry.colour,
        strokeWidth: 2, draggable: true,
      })
      shape.on('click tap', e => { if (!state.editingShapeIdRef?.current) onSelectStruct(entry.id, shape, e) })
    }

    if (shape) {
      structLayer?.add(shape)
      if (entry.type === 'hedge' || entry.type === 'hedge-sq') applyHedgeTexture(shape, structLayer)
    }
  })

  // ── Restore plants (mirrors v8 exactly) ──
  ;(g.plants || []).forEach(entry => {
    const n = parseInt((entry.id || '').split('_')[1] || '0')
    if (n >= maxPId) maxPId = n + 1

    state.plantDataRef.current[entry.id] = {
      label: entry.label, family: entry.family,
      notes: entry.notes || '',
      seasons: entry.seasons || ['spring', 'summer', 'fall', 'winter'],
      transparent: entry.transparent || false,
      locked: entry.locked || false,
      size: entry.size, key: entry.key,
    }

    const img = loadedImages[entry.key]
    if (!img) return

    const size = SIZE_MAP[entry.size] || 64

    // Use the same makePlantGroup factory as addPlant (v8: makePlantGroup)
    // x/y are world coords; makePlantGroup expects top-left corner
    const group = makePlantGroup(entry.id, img, size, entry.x + dX, entry.y + dY)
    if (entry.scaleX) group.scaleX(entry.scaleX)
    if (entry.scaleY) group.scaleY(entry.scaleY)
    if (entry.locked) group.draggable(false)  // restore locked state
    if (entry.transparent) {
      group.opacity(0.35)   // restore visual transparency (flag is in plantDataRef, opacity must be set on group)
      try { group.zIndex(Math.max(0, entry.zIndex || 0)) } catch {}
    } else if (entry.zIndex !== undefined) {
      try { group.zIndex(entry.zIndex) } catch {}
    }
    group.on('click tap', () => onSelectPlant(entry.id, group))
    plantLayer?.add(group)
  })

  // Update counters (same as v8)
  state.structIdCtr.current = maxSId
  state.plantIdCtr.current  = maxPId

  // ── Restore transparency, lock, + z-order (same as v8) ──
  ;(g.structs || []).forEach(entry => {
    const shape = structLayer?.findOne('#' + entry.id)
    if (!shape) return
    if (entry.transparent) {
      shape.opacity(0.35)
      try { shape.zIndex(Math.max(2, entry.zIndex || 2)) } catch {}
    } else if (entry.zIndex !== undefined) {
      try { shape.zIndex(entry.zIndex) } catch {}
    }
    if (entry.locked) shape.draggable(false)  // restore locked state
  })

  structLayer?.batchDraw()
  plantLayer?.batchDraw()

  // ── Update React state AFTER all Konva work (avoid async races) ──
  setGardenName(g.name)
  setGardenUnit(g.unit)
  setGardenW(g.w)
  setGardenH(g.h)
  setIsSetup(true)

  // Zoom to fit (same as v8 — called last)
  setTimeout(() => onZoomToFit(), 30)

  return true
}

// ── createNewGarden ───────────────────────────────────────────────────────────
// Mirrors v8 newGarden(). Saves current, pushes new entry, returns new index.
export function createNewGarden({ currentGardenIndex, stage, layers, state }) {
  const gardens = readGardens()
  if (gardens.length >= MAX_GARDENS) return { limitReached: true }

  // Save current garden first (same as v8)
  saveGarden({ stage, layers, state, currentGardenIndex })

  const updated = readGardens()
  updated.push({ name: 'New Garden', unit: 'ft', w: 60, h: 40, plants: [], structs: [] })
  writeGardens(updated)
  return { newIndex: updated.length - 1, limitReached: false }
}

// ── deleteGarden ──────────────────────────────────────────────────────────────
export function deleteGarden(idx) {
  const gardens = readGardens()
  gardens.splice(idx, 1)
  writeGardens(gardens)
  return [...gardens]
}
