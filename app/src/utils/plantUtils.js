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
export function addPlant({ entry, x, y, stage, plantLayer, plantDataRef, plantIdCtr, showGridRef, onSelect }) {
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
  }

  const group = makePlantGroup(id, loadedImg, SIZE, x - SIZE / 2, y - SIZE / 2)

  group.on('dragmove', () => {
    const snap = showGridRef?.current ?? false
    if (snap) {
      group.x(Math.round(group.x() / SNAP_CELL) * SNAP_CELL)
      group.y(Math.round(group.y() / SNAP_CELL) * SNAP_CELL)
    }
  })

  group.on('click tap', e => {
    if (onSelect) onSelect(id, group, e)
  })

  plantLayer.add(group)
  plantLayer.batchDraw()

  if (onSelect) onSelect(id, group)
  return id
}
