// useSaveLoad.js — Phase 5: localStorage save/load/switcher
// Mirrors v8 saveGarden/loadGarden/newGarden/showGardenSwitcher faithfully

import Konva from 'konva'
import { addPlant } from '../utils/plantUtils'

const LS_KEY = 'gardenData'
const MAX_GARDENS = 2

// ── Read / Write helpers ──────────────────────────────────────────────────────
export function readGardens() {
  try { return JSON.parse(localStorage.getItem(LS_KEY) || '[]') } catch { return [] }
}
function writeGardens(arr) {
  localStorage.setItem(LS_KEY, JSON.stringify(arr))
}

// ── Save current canvas to localStorage ──────────────────────────────────────
export function saveGarden({
  stage, layers, state, currentGardenIndex, loadedImages,
}) {
  if (!stage) return

  const { plantLayer, structLayer } = layers
  const propBounds = state.propBoundsRef.current

  // Collect plants
  const plants = []
  plantLayer?.find('Group').forEach(g => {
    const d = state.plantDataRef.current[g.id()]
    if (!d) return
    plants.push({
      id: g.id(), x: g.x(), y: g.y(),
      scaleX: g.scaleX(), scaleY: g.scaleY(),
      label: d.label, family: d.family, key: d.key, size: d.size,
      notes: d.notes, seasons: d.seasons, transparent: d.transparent,
    })
  })

  // Collect structs
  const structs = []
  structLayer?.find('Line,Rect,Circle,Path').forEach(s => {
    const id = s.id()
    if (!id || id === '__propBounds' || id === '__propLabel') return
    const d = state.structDataRef.current[id]
    if (!d) return
    const entry = {
      id, type: d.type, colour: d.colour, label: d.label,
      pathWidth: d.pathWidth, tension: d.tension,
      transparent: d.transparent || false,
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
    name: state.gardenName,
    unit: state.gardenUnit,
    w: state.gardenW,
    h: state.gardenH,
    originX: propBounds?.x ?? 0,
    originY: propBounds?.y ?? 0,
    plants,
    structs,
  }

  const gardens = readGardens()
  gardens[currentGardenIndex] = gardenEntry
  writeGardens(gardens)
  return gardenEntry
}

// ── Load garden from localStorage by index ───────────────────────────────────
export function loadGarden({
  idx, stage, layers, state, loadedImages,
  showGridRef, snapCellRef,
  onSelectPlant, onSelectStruct, onClearSelection,
  onSetGardenName, onSetGardenW, onSetGardenH, onSetGardenUnit,
  onSetIsSetup, onZoomToFit,
  structIdCtr, plantIdCtr,
}) {
  const gardens = readGardens()
  const g = gardens[idx]
  if (!g) return null

  const { plantLayer, structLayer, uiLayer } = layers

  // Clear canvas
  plantLayer?.destroyChildren()
  structLayer?.destroyChildren()
  if (uiLayer) {
    uiLayer.find('Circle,Line').forEach(n => n.destroy())
  }
  Object.keys(state.plantDataRef.current).forEach(k => delete state.plantDataRef.current[k])
  Object.keys(state.structDataRef.current).forEach(k => delete state.structDataRef.current[k])
  onClearSelection()

  // Apply garden metadata
  onSetGardenName(g.name)
  onSetGardenUnit(g.unit)
  onSetGardenW(g.w)
  onSetGardenH(g.h)
  onSetIsSetup(true)

  // Recalculate propBounds for current window size
  const W = stage.width(), H = stage.height()
  const px = 32 * (g.unit === 'm' ? 3.281 : 1)
  const pw = g.w * px, ph = g.h * px
  const ox = Math.max(16, (W - pw) / 2)
  const oy = Math.max(16, (H - ph) / 2)
  const propBounds = { x: ox, y: oy, w: pw, h: ph }
  state.propBoundsRef.current = propBounds

  // Re-draw boundary
  structLayer?.add(new Konva.Rect({
    id: '__propBounds',
    x: ox, y: oy, width: pw, height: ph,
    stroke: '#558B2F', strokeWidth: 2, dash: [10, 5],
    fill: 'transparent', listening: false, strokeScaleEnabled: false,
  }))
  structLayer?.add(new Konva.Text({
    id: '__propLabel',
    x: ox + 6, y: oy + 5,
    text: `${g.name}  ${g.w}x${g.h} ${g.unit}`,
    fontSize: 11, fontStyle: 'bold', fill: '#558B2F', opacity: 0.65, listening: false,
  }))

  // Origin delta (corrects for different window size)
  const savedOX = g.originX ?? ox
  const savedOY = g.originY ?? oy
  const dX = ox - savedOX, dY = oy - savedOY

  let maxSId = structIdCtr.current
  let maxPId = plantIdCtr.current

  // Restore structs
  ;(g.structs || []).forEach(entry => {
    const n = parseInt((entry.id || '').split('_')[1] || '0')
    if (n >= maxSId) maxSId = n + 1

    state.structDataRef.current[entry.id] = {
      type: entry.type, colour: entry.colour, label: entry.label,
      pathWidth: entry.pathWidth, tension: entry.tension,
      transparent: entry.transparent || false,
    }

    let shape
    const snapShape = (s) => {
      s.on('dragmove', () => {
        if (showGridRef.current && snapCellRef?.current) {
          const c = snapCellRef.current
          s.x(Math.round(s.x() / c) * c)
          s.y(Math.round(s.y() / c) * c)
        }
      })
    }

    if (entry.svgPath !== undefined) {
      const isUG = entry.type === 'underground-electrical' || entry.type === 'underground-plumbing'
      const fillC  = isUG ? 'transparent' : entry.colour + 'CC'
      const strokeC = isUG || entry.type === 'path' ? entry.colour : '#3A2A10'
      shape = new Konva.Path({
        id: entry.id,
        data: entry.svgPath,
        x: (entry.lx || 0) + dX, y: (entry.ly || 0) + dY,
        fill: fillC, stroke: strokeC, strokeWidth: entry.pathWidth || 2,
        strokeScaleEnabled: false, lineCap: 'round', lineJoin: 'round', draggable: true,
      })
    } else if (entry.points !== undefined) {
      const isPath = entry.type === 'path'
      const isFenceType = entry.type === 'fence' || entry.type === 'gate'
      const cl = !isPath && !isFenceType
      shape = new Konva.Line({
        id: entry.id,
        points: entry.points,
        x: (entry.lx || 0) + dX, y: (entry.ly || 0) + dY,
        tension: entry.tension || 0,
        closed: cl,
        fill: isPath || isFenceType ? 'transparent' : entry.colour + 'CC',
        stroke: isPath || isFenceType ? entry.colour : '#3A2A10',
        strokeWidth: isPath ? (entry.pathWidth || 18) : isFenceType ? 6 : 2,
        strokeScaleEnabled: false, lineCap: 'round', lineJoin: 'round', draggable: true,
        hitStrokeWidth: isPath ? (entry.pathWidth || 18) + 10 : undefined,
      })
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
    } else if (entry.cx !== undefined) {
      shape = new Konva.Circle({
        id: entry.id,
        x: entry.cx + dX, y: entry.cy + dY,
        radius: entry.radius,
        fill: entry.colour + 'CC', stroke: entry.colour,
        strokeWidth: 2, draggable: true,
      })
    }

    if (shape) {
      snapShape(shape)
      shape.on('click tap', e => onSelectStruct(entry.id, shape, e))
      structLayer?.add(shape)
    }
  })

  // Restore plants
  ;(g.plants || []).forEach(entry => {
    const n = parseInt((entry.id || '').split('_')[1] || '0')
    if (n >= maxPId) maxPId = n + 1

    state.plantDataRef.current[entry.id] = {
      label: entry.label, family: entry.family,
      notes: entry.notes || '', seasons: entry.seasons || ['spring','summer','fall','winter'],
      transparent: entry.transparent || false,
      size: entry.size, key: entry.key,
    }

    const img = loadedImages[entry.key]
    if (!img) return

    const SIZE_MAP = { XS: 24, S: 40, M: 64, L: 96 }
    const size = SIZE_MAP[entry.size] || 64

    // Build group manually (mirrors makePlantGroup from v8)
    const group = new Konva.Group({
      id: entry.id,
      x: entry.x + dX, y: entry.y + dY,
      draggable: true,
      scaleX: entry.scaleX || 1, scaleY: entry.scaleY || 1,
    })
    const imgNode = new Konva.Image({
      image: img, width: size, height: size,
      offsetX: size / 2, offsetY: size / 2,
      listening: false,
    })
    group.hitFunc((ctx, shape) => {
      ctx.beginPath()
      ctx.rect(-size / 2, -size / 2, size, size)
      ctx.closePath()
      ctx.fillStrokeShape(shape)
    })
    group.add(imgNode)

    if (showGridRef.current && snapCellRef?.current) {
      group.on('dragmove', () => {
        const c = snapCellRef.current
        group.x(Math.round(group.x() / c) * c)
        group.y(Math.round(group.y() / c) * c)
      })
    }
    group.on('click tap', () => onSelectPlant(entry.id, group))
    plantLayer?.add(group)
  })

  // Update counters
  structIdCtr.current = maxSId
  plantIdCtr.current  = maxPId

  // Restore transparency + z-order
  ;(g.structs || []).forEach(entry => {
    const shape = structLayer?.findOne('#' + entry.id)
    if (!shape) return
    if (entry.transparent) {
      shape.opacity(0.35)
      try { shape.zIndex(Math.max(2, entry.zIndex || 2)) } catch {}
    } else if (entry.zIndex !== undefined) {
      try { shape.zIndex(entry.zIndex) } catch {}
    }
  })

  structLayer?.batchDraw()
  plantLayer?.batchDraw()

  // Zoom to fit after a tick (stage needs to settle)
  setTimeout(() => onZoomToFit(), 50)

  return idx
}

// ── New garden ────────────────────────────────────────────────────────────────
export function createNewGarden({ currentGardenIndex, stage, layers, state }) {
  const gardens = readGardens()
  if (gardens.length >= MAX_GARDENS) return { limitReached: true }
  // Save current first
  saveGarden({ stage, layers, state, currentGardenIndex })
  const updated = readGardens()
  updated.push({ name: 'New Garden', unit: 'ft', w: 60, h: 40, plants: [], structs: [] })
  writeGardens(updated)
  return { newIndex: updated.length - 1, limitReached: false }
}

// ── Delete garden ─────────────────────────────────────────────────────────────
export function deleteGarden(idx) {
  const gardens = readGardens()
  gardens.splice(idx, 1)
  writeGardens(gardens)
  return gardens
}
