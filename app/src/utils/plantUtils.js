// plantUtils.js — Plant placement helpers (ported from v8)
import Konva from 'konva'
import { SIZE_MAP } from '../hooks/useGardenState'

const SNAP_CELL = 16 // 6 inches — minimum grid cell (matches v8 mult≥2 rule)

// Create a Konva group for a plant sticker with proper hit detection
// (transparent PNG needs explicit hit rect — L026)
// Uses natural image aspect ratio so non-square stickers (e.g. rectangular tables) aren't squished.
export function makePlantGroup(id, img, SIZE, gx, gy) {
  const aspect = (img.naturalWidth && img.naturalHeight) ? img.naturalWidth / img.naturalHeight : 1
  const W = aspect >= 1 ? SIZE : SIZE * aspect
  const H = aspect >= 1 ? SIZE / aspect : SIZE
  const group = new Konva.Group({ id, x: gx, y: gy, draggable: true, width: W, height: H })
  const hitRect = new Konva.Rect({ x: 0, y: 0, width: W, height: H, fill: 'rgba(0,0,0,0.001)', listening: true })
  group.add(new Konva.Image({ image: img, x: 0, y: 0, width: W, height: H, listening: false }))
  group.add(hitRect)
  return group
}

// Place a plant on the canvas at world coords (x, y)
// showGridRef: a React ref so dragmove always sees the current grid toggle state
// onSelect: fired on click/tap AND auto-called after placement (pass handlePlantSelect)
// autoSelect: if false, suppresses the auto-call after placement (used by copy handler which selects manually after writing data)
// onLongPress: fired after 500 ms touch hold or double-click — triggers multi-select mode
export function addPlant({ entry, x, y, stage, plantLayer, plantDataRef, plantIdCtr, showGridRef, onSelect, onLongPress, autoSelect = true }) {
  const id = 'plant_' + plantIdCtr.current++
  const SIZE = SIZE_MAP[entry.size] || 64
  const loadedImg = entry._img
  if (!loadedImg) return

  plantDataRef.current[id] = {
    label: entry.label,
    family: entry.family,
    notes: '',
    seasons: ['spring', 'summer', 'fall', 'winter'],
    transparent: false,
    size: entry.size,
    key: entry.key,
    src: entry.src || null,
    decorGroup: entry.decorGroup || null,
  }

  const _aspect = (loadedImg.naturalWidth && loadedImg.naturalHeight) ? loadedImg.naturalWidth / loadedImg.naturalHeight : 1
  const _W = _aspect >= 1 ? SIZE : SIZE * _aspect
  const _H = _aspect >= 1 ? SIZE / _aspect : SIZE
  const group = makePlantGroup(id, loadedImg, SIZE, x - _W / 2, y - _H / 2)
  group._family = entry.family || ''  // stamp family for zone-aware layer stepping

  group.on('dragmove', () => {
    const snap = showGridRef?.current ?? false
    if (snap) {
      group.x(Math.round(group.x() / SNAP_CELL) * SNAP_CELL)
      group.y(Math.round(group.y() / SNAP_CELL) * SNAP_CELL)
    }
  })

  // ── Long-press timer for mobile multi-select ───────────────────
  let _lpTimer = null
  let _lpFired  = false
  group.on('touchstart', () => {
    _lpFired = false
    _lpTimer = setTimeout(() => {
      _lpFired = true
      if (onLongPress) onLongPress(id, group)
    }, 500)
  })
  group.on('touchend touchcancel', () => {
    clearTimeout(_lpTimer)
    _lpTimer = null
  })
  group.on('touchmove', () => {
    // Movement cancels long-press so drag still works normally
    clearTimeout(_lpTimer)
    _lpTimer = null
  })

  // ── Click / tap → select (normal) or add-to-multi (after long-press) ──
  group.on('click tap', e => {
    if (_lpFired) {
      // Long-press already fired — suppress this tap so it doesn't also single-select
      _lpFired = false
      e.cancelBubble = true
      return
    }
    if (onSelect) onSelect(id, group, e)
  })

  // ── Double-click → multi-select (desktop) ────────────────────
  group.on('dblclick', e => {
    if (onLongPress) { onLongPress(id, group, e); e.cancelBubble = true }
  })

  plantLayer.add(group)
  plantLayer.batchDraw()

  if (autoSelect && onSelect) onSelect(id, group)
  return id
}
