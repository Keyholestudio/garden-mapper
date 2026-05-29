// plantUtils.js — Plant placement helpers (ported from v8)
import Konva from 'konva'
import { SIZE_MAP } from '../hooks/useGardenState'

// Create a Konva group for a plant sticker with proper hit detection
// (transparent PNG needs explicit hit rect — L026)
export function makePlantGroup(id, img, SIZE, gx, gy) {
  const group = new Konva.Group({ id, x: gx, y: gy, draggable: true, width: SIZE, height: SIZE })
  const hitRect = new Konva.Rect({ x: 0, y: 0, width: SIZE, height: SIZE, fill: 'rgba(0,0,0,0.001)', listening: true })
  group.add(new Konva.Image({ image: img, x: 0, y: 0, width: SIZE, height: SIZE, listening: false }))
  group.add(hitRect)
  return group
}

// Place a plant on the canvas at world coords (x, y)
export function addPlant({ entry, x, y, stage, plantLayer, plantDataRef, plantIdCtr, showGrid, snapCell, onSelect }) {
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
    if (showGrid && snapCell) {
      group.x(Math.round(group.x() / snapCell) * snapCell)
      group.y(Math.round(group.y() / snapCell) * snapCell)
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
