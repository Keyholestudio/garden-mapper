// rockBorderUtils.js — Rock border / stepping stone path tiling

// ── Config presets ─────────────────────────────────────────────────────────────
export const ROCK_BORDER_PRESETS = {
  'rock-border':   { stoneSize: 28, overlap: -0.15 },
  'stepping-path': { stoneSize: 48, overlap: -0.40 },
  'picket-fence':   { stoneSize: 38, overlap: 0.0 },  // horizontal: H tile width (unchanged)
  'picket-fence-v':  { stoneSize: 38, overlap: 0.0 },  // vertical: V tile long axis (38px) = spacing along line
}

// ── Catmull-Rom curve sampling ────────────────────────────────────────────────
function catmullRomPoint(p0, p1, p2, p3, t, alpha = 0.5) {
  const t2 = t * t, t3 = t2 * t
  return {
    x: alpha * ((-p0.x + 3*p1.x - 3*p2.x + p3.x)*t3
              + (2*p0.x - 5*p1.x + 4*p2.x - p3.x)*t2
              + (-p0.x + p2.x)*t) + p1.x,
    y: alpha * ((-p0.y + 3*p1.y - 3*p2.y + p3.y)*t3
              + (2*p0.y - 5*p1.y + 4*p2.y - p3.y)*t2
              + (-p0.y + p2.y)*t) + p1.y,
  }
}

function buildDensePath(flatPoints, tension, samplesPerSegment = 30) {
  const pts = []
  for (let i = 0; i < flatPoints.length; i += 2)
    pts.push({ x: flatPoints[i], y: flatPoints[i + 1] })
  if (pts.length < 2) return pts
  if (tension <= 0) return pts
  const dense = []
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)], p1 = pts[i]
    const p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)]
    for (let s = 0; s <= samplesPerSegment; s++)
      dense.push(catmullRomPoint(p0, p1, p2, p3, s / samplesPerSegment))
  }
  return dense
}

function buildArcLengthTable(densePts) {
  const table = [0]
  for (let i = 1; i < densePts.length; i++) {
    const dx = densePts[i].x - densePts[i-1].x
    const dy = densePts[i].y - densePts[i-1].y
    table.push(table[i-1] + Math.hypot(dx, dy))
  }
  return table
}

function sampleAtDist(densePts, arcTable, dist) {
  const d = Math.min(dist, arcTable[arcTable.length - 1])
  let lo = 0, hi = arcTable.length - 1
  while (lo < hi - 1) {
    const mid = (lo + hi) >> 1
    if (arcTable[mid] <= d) lo = mid; else hi = mid
  }
  const t = (d - arcTable[lo]) / (arcTable[hi] - arcTable[lo] || 1)
  const p0 = densePts[lo], p1 = densePts[hi]
  return {
    x: p0.x + t * (p1.x - p0.x),
    y: p0.y + t * (p1.y - p0.y),
    angle: Math.atan2(p1.y - p0.y, p1.x - p0.x),
  }
}

export function computeStonePositions(flatPoints, tension, type = 'rock-border') {
  const { stoneSize, overlap } = ROCK_BORDER_PRESETS[type] || ROCK_BORDER_PRESETS['rock-border']
  const spacing = stoneSize * (1 - overlap)
  const dense = buildDensePath(flatPoints, tension)
  if (dense.length < 2) return []
  const arcTable = buildArcLengthTable(dense)
  const totalLen = arcTable[arcTable.length - 1]
  if (totalLen < spacing / 2) return []
  const positions = []
  let dist = stoneSize / 2
  while (dist <= totalLen - stoneSize / 2) {
    positions.push(sampleAtDist(dense, arcTable, dist))
    dist += spacing
  }
  return positions
}

export function getStoneSize(type) {
  return (ROCK_BORDER_PRESETS[type] || ROCK_BORDER_PRESETS['rock-border']).stoneSize
}

// ── Image cache ───────────────────────────────────────────────────────────────
const ROCK_SRCS = {
  grey:  '/stickers/decor_rock-small_M_CA-US-FR-GB-AU.png',
  brown: '/stickers/decor_rock-small_M_CA-US-FR-GB-AU.png',
  white: '/stickers/decor_rock-small_M_CA-US-FR-GB-AU.png',
  mixed: '/stickers/decor_rock-small_M_CA-US-FR-GB-AU.png',
}

export const PICKET_SRCS = {
  white: {
    h: '/stickers/decor_picket-fence-white-h_M_CA-US-FR-GB-AU.png',  // front-facing pickets (horizontal lines)
    v: '/stickers/decor_picket-fence-white-v_M_CA-US-FR-GB-AU.png',  // aerial top-down (vertical lines)
  },
  sage: {
    h: '/stickers/decor_picket-fence-sage-h_M_CA-US-FR-GB-AU.png',
    v: '/stickers/decor_picket-fence-sage-v_M_CA-US-FR-GB-AU.png',
  },
  black: {
    h: '/stickers/decor_picket-fence-black-h_M_CA-US-FR-GB-AU.png',
    v: '/stickers/decor_picket-fence-black-v_M_CA-US-FR-GB-AU.png',
  },
  blue: {
    h: '/stickers/decor_picket-fence-blue-h_M_CA-US-FR-GB-AU.png',
    v: '/stickers/decor_picket-fence-blue-v_M_CA-US-FR-GB-AU.png',
  },
  cedar: {
    h: '/stickers/decor_picket-fence-cedar-h_M_CA-US-FR-GB-AU.png',
    v: '/stickers/decor_picket-fence-cedar-v_M_CA-US-FR-GB-AU.png',
  },
  red: {
    h: '/stickers/decor_picket-fence-red-h_M_CA-US-FR-GB-AU.png',
    v: '/stickers/decor_picket-fence-red-v_M_CA-US-FR-GB-AU.png',
  },
}

const _imgCache = {}
export function loadRockImage(src) {
  if (_imgCache[src]) return Promise.resolve(_imgCache[src])
  return new Promise((resolve) => {
    const img = new window.Image()
    img.onload  = () => { _imgCache[src] = img; resolve(img) }
    img.onerror = () => resolve(null)
    img.src = src
  })
}
export function getRockImageCached(variant) {
  const src = ROCK_SRCS[variant || 'grey'] || ROCK_SRCS.grey
  return _imgCache[src] || null
}
export function getRockSrc(variant) {
  return ROCK_SRCS[variant || 'grey'] || ROCK_SRCS.grey
}
export function getPicketSrc(variant, type = 'h') {
  const entry = PICKET_SRCS[variant || 'white'] || PICKET_SRCS.white
  return entry[type] || entry.h
}
export function getPicketImageCached(variant, type = 'h') {
  return _imgCache[getPicketSrc(variant, type)] || null
}
export function loadPicketImage(src) {
  return loadRockImage(src)  // reuse same cache + loader
}
export function loadPicketImages(variant) {
  // Preload both H and V tiles for a given variant
  const entry = PICKET_SRCS[variant || 'white'] || PICKET_SRCS.white
  return Promise.all([loadRockImage(entry.h), loadRockImage(entry.v)])
}

// ── Seeded PRNG ───────────────────────────────────────────────────────────────
function seededRandom(seed) {
  let s = seed >>> 0
  return () => {
    s += 0x6D2B79F5
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
function shuffleIndexes(n, rng) {
  const arr = Array.from({ length: n }, (_, i) => i)
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

// ── Build stone images inside a Konva.Group ───────────────────────────────────
// Points are in the group's LOCAL coordinate space (no external offset needed).
// The group itself is positioned/dragged by Konva — stones move with it for free.
export function addStonesToGroup(group, flatPoints, tension, variant, id, Konva) {
  const img = getRockImageCached(variant)
  if (!img) return  // image not loaded yet — caller must await and call again

  // Remove any existing stone images (keeping the guide line child)
  group.getChildren(c => c instanceof Konva.Image).forEach(c => c.destroy())

  const positions = computeStonePositions(flatPoints, tension, 'rock-border')
  if (positions.length === 0) return

  const stoneSize = getStoneSize('rock-border')
  const seed = (id || '').split('').reduce((acc, c) => acc + c.charCodeAt(0), 0)
  const rng  = seededRandom(seed)
  const drawOrder = shuffleIndexes(positions.length, rng)

  for (let i = 0; i < drawOrder.length; i++) {
    const { x, y, angle } = positions[drawOrder[i]]
    const rotJitter = (rng() - 0.5) * 50
    group.add(new Konva.Image({
      image: img, x, y,
      width: stoneSize, height: stoneSize,
      rotation: (angle * 180 / Math.PI) + rotJitter,
      offsetX: stoneSize / 2, offsetY: stoneSize / 2,
      // listening:true so touch events on stones bubble up to the draggable Group.
      // Without this, Konva can't initiate drag on mobile when the touch lands on a stone.
      listening: true,
    }))
  }

  // Keep hitLine on top for consistent tap/click handling (hitLine has the wide hit area)
  const hitLine = group.getChildren(c => c instanceof Konva.Line)[0]
  if (hitLine) hitLine.moveToTop()
}

// ── Build a complete rock border Konva.Group ──────────────────────────────────
// Returns a draggable Konva.Group containing:
//   - an invisible Konva.Line (hit target, id = structId)
//   - Konva.Image stones (added synchronously if image cached, async otherwise)
//
// The group id = structId so existing select/save/delete wiring works unchanged.
// onReady(group) called after async image load completes (if image wasn't cached).
export function buildRockBorderGroup({ id, flatPoints, tension, variant, x, y, Konva, showGrid, snapCell, onSelect, onReady }) {
  // flatPoints are in the group's LOCAL coordinate space.
  // x/y set the group's world position. getShapeWorldPts adds group.x/y to get world coords.
  // dragend absorbs the drag offset into flatPoints and resets group to (0,0) so they stay in sync.

  const group = new Konva.Group({
    id,
    x: x || 0, y: y || 0,
    draggable: true,
  })

  // Hit line — listening:true so clicks are absorbed by the Group, not the stage
  // Wide hitStrokeWidth means you can click anywhere near the stone border
  const hitLine = new Konva.Line({
    points: flatPoints,
    tension, closed: false,
    stroke: 'rgba(0,0,0,0)', strokeWidth: 0,
    strokeScaleEnabled: false, lineCap: 'round', lineJoin: 'round',
    hitStrokeWidth: 40,
    listening: true,
  })
  group.add(hitLine)

  // Drag: Konva moves the Group natively, all children (stones + hitLine) move with it.
  // Only grid-snap here — no manual stone redraw needed during drag.
  group.on('dragmove', () => {
    if (showGrid && snapCell) {
      group.x(Math.round(group.x() / snapCell) * snapCell)
      group.y(Math.round(group.y() / snapCell) * snapCell)
    }
  })

  // dragend: absorb any hitLine-own x/y drift into flatPoints (mobile can cause this),
  // then reset hitLine to (0,0). Group x/y is NOT reset — it accumulates like a fence Line.
  // flatPoints are LOCAL coords relative to group origin. Konva applies group.x/y as transform.
  group.on('dragend', () => {
    const lx = hitLine.x(), ly = hitLine.y()
    if (lx !== 0 || ly !== 0) {
      const flat = hitLine.points()
      const newFlat = flat.map((v, i) => i % 2 === 0 ? v + lx : v + ly)
      hitLine.points(newFlat)
      hitLine.x(0); hitLine.y(0)
    }
    addStonesToGroup(group, hitLine.points(), hitLine.tension(), variant, id, Konva)
    group.getLayer()?.batchDraw()
  })

  // Group catches all click/tap events — stones bubble up (listening:true) and
  // hitLine events also bubble to the Group. Single handler on Group is sufficient.
  // hitLine.on('click tap') removed — it caused double-firing when touch hit both.
  group.on('click tap', e => {
    e.cancelBubble = true  // stop event reaching stage after group handles it
    if (onSelect) onSelect(id, group, e)
  })

  // Add stones — synchronous if image cached, async otherwise
  const src = getRockSrc(variant)
  if (_imgCache[src]) {
    addStonesToGroup(group, flatPoints, tension, variant, id, Konva)
  } else {
    loadRockImage(src).then(img => {
      if (!img) return
      addStonesToGroup(group, flatPoints, tension, variant, id, Konva)
      group.getLayer()?.batchDraw()
      if (onReady) onReady(group)
    })
  }

  return group
}

// ── Refresh stones in an existing rock border group ───────────────────────────
// Call this after point editing changes the guide line shape.
// Reads current points from the hit line child.
export function refreshRockBorderGroup(group, structData, Konva) {
  if (!group) return
  const hitLine = group.getChildren(c => c instanceof Konva.Line)[0]
  if (!hitLine) return
  // Normalize hitLine position — should always be (0,0), absorb any drift into points
  const lx = hitLine.x(), ly = hitLine.y()
  if (lx !== 0 || ly !== 0) {
    const normalized = hitLine.points().map((v, i) => i % 2 === 0 ? v + lx : v + ly)
    hitLine.points(normalized)
    hitLine.x(0); hitLine.y(0)
  }
  const flat    = hitLine.points()
  const variant = structData?.rockVariant || 'grey'
  const id      = group.id()
  addStonesToGroup(group, flat, hitLine.tension(), variant, id, Konva)
  group.getLayer()?.batchDraw()
}

// ── Redraw all rock borders (called after load) ───────────────────────────────
// Only needed on garden load when images may not be cached yet.
export async function drawRockBorders(structLayer, structDataRef, Konva) {
  if (!structLayer || !structDataRef?.current) return
  const entries = Object.entries(structDataRef.current)
    .filter(([, d]) => d.type === 'rock-border')
  for (const [id] of entries) {
    const group = structLayer.findOne('#' + id)
    if (!group || !(group instanceof Konva.Group)) continue
    const hitLine = group.getChildren(c => c instanceof Konva.Line)[0]
    if (!hitLine) continue
    const d = structDataRef.current[id]
    const src = getRockSrc(d?.rockVariant)
    const img = await loadRockImage(src)
    if (!img) continue
    // Normalize hitLine position on load
    const lx = hitLine.x(), ly = hitLine.y()
    if (lx !== 0 || ly !== 0) {
      const normalized = hitLine.points().map((v, i) => i % 2 === 0 ? v + lx : v + ly)
      hitLine.points(normalized)
      hitLine.x(0); hitLine.y(0)
    }
    addStonesToGroup(group, hitLine.points(), hitLine.tension(), d?.rockVariant, id, Konva)
    group.moveToTop()  // rock borders render above beds/water
  }
  structLayer.batchDraw()
}

// ── Picket Fence ────────────────────────────────────────────────────────────────────
// H tile: front-facing pickets (horizontal lines) - source 151x256 -> 38x64px display
// V tile: aerial top-down (vertical lines)        - source 606x138 -> 96x22px display
//   When Konva rotates V tile ~90° for a vertical line, 96px runs along line, 22px is depth
const PICKET_TILE_H  = 64  // H tile display height
const PICKET_H_W     = 38  // H tile display width (front-facing)
const PICKET_V_TW    = 38  // V tile long axis (runs along the vertical line)
const PICKET_V_TH    = 9   // V tile short axis (fence depth/width on screen)
const PICKET_V_W     = PICKET_V_TW  // spacing alias
// Angle threshold: lines more vertical than this use the V (aerial) tile
const VERTICAL_THRESHOLD_DEG = 45

export function addPicketsToGroup(group, flatPoints, tension, variant, Konva) {
  const imgV = getPicketImageCached(variant, 'v')  // front-facing pickets (steep angles)
  const imgH = getPicketImageCached(variant, 'h')  // aerial top-down (shallow angles)
  if (!imgV && !imgH) {
    // Images not cached yet — load them then re-render. Don't clear existing tiles.
    loadPicketImages(variant).then(() => {
      addPicketsToGroup(group, flatPoints, tension, variant, Konva)
      group.getLayer()?.batchDraw()
    })
    return
  }

  // Remove existing picket images (keep hit line)
  group.getChildren(c => c instanceof Konva.Image).forEach(c => c.destroy())

  // Normalize so tiles always run left-to-right — prevents upside-down pickets
  let pts = flatPoints
  if (pts.length >= 4) {
    const x1 = pts[0], x2 = pts[pts.length - 2]
    if (x1 > x2) {
      const pairs = []
      for (let i = 0; i < pts.length; i += 2) pairs.push([pts[i], pts[i+1]])
      pairs.reverse()
      pts = pairs.flat()
    }
  }

  // Pick preset based on overall line angle — vertical lines need wider spacing
  const overallAngle = pts.length >= 4
    ? Math.atan2(pts[pts.length-1] - pts[1], pts[pts.length-2] - pts[0]) * 180 / Math.PI
    : 0
  const lineIsVertical = Math.abs(overallAngle) > VERTICAL_THRESHOLD_DEG
  const preset = lineIsVertical ? 'picket-fence-v' : 'picket-fence'

  const positions = computeStonePositions(pts, tension, preset)
  if (positions.length === 0) return

  for (const { x, y, angle } of positions) {
    const deg = angle * 180 / Math.PI
    const isVertical = lineIsVertical
    const img  = isVertical ? (imgV || imgH) : (imgH || imgV)
    const tileW = isVertical ? PICKET_V_TW : PICKET_H_W
    const tileH = isVertical ? PICKET_V_TH : PICKET_TILE_H
    group.add(new Konva.Image({
      image: img,
      x, y,
      width: tileW,
      height: tileH,
      rotation: deg,
      offsetX: tileW / 2,
      offsetY: tileH / 2,
      listening: true,
    }))
  }

  const hitLine = group.getChildren(c => c instanceof Konva.Line)[0]
  if (hitLine) hitLine.moveToTop()
}

export function buildPicketFenceGroup({ id, flatPoints, tension, variant, x, y, Konva, showGrid, snapCell, onSelect, onReady, structDataRef }) {
  const group = new Konva.Group({ id, x: x || 0, y: y || 0, draggable: true })

  const hitLine = new Konva.Line({
    points: flatPoints,
    tension, closed: false,
    stroke: 'rgba(0,0,0,0)', strokeWidth: 0,
    strokeScaleEnabled: false, lineCap: 'round', lineJoin: 'round',
    hitStrokeWidth: 40,
    listening: true,
  })
  group.add(hitLine)

  group.on('dragmove', () => {
    if (showGrid && snapCell) {
      group.x(Math.round(group.x() / snapCell) * snapCell)
      group.y(Math.round(group.y() / snapCell) * snapCell)
    }
  })

  group.on('dragend', () => {
    const lx = hitLine.x(), ly = hitLine.y()
    if (lx !== 0 || ly !== 0) {
      const flat = hitLine.points()
      const newFlat = flat.map((v, i) => i % 2 === 0 ? v + lx : v + ly)
      hitLine.points(newFlat)
      hitLine.x(0); hitLine.y(0)
    }
    // Always read current variant from structDataRef so colour changes persist after drag
    const currentVariant = structDataRef?.current?.[id]?.picketVariant || variant
    addPicketsToGroup(group, hitLine.points(), hitLine.tension(), currentVariant, Konva)
    group.getLayer()?.batchDraw()
  })

  group.on('click tap', e => {
    e.cancelBubble = true
    if (onSelect) onSelect(id, group, e)
  })

  const srcH = getPicketSrc(variant, 'h')
  const srcV = getPicketSrc(variant, 'v')
  const bothCached = _imgCache[srcH] && _imgCache[srcV]
  if (bothCached) {
    addPicketsToGroup(group, flatPoints, tension, variant, Konva)
  } else {
    loadPicketImages(variant).then(() => {
      addPicketsToGroup(group, flatPoints, tension, variant, Konva)
      group.getLayer()?.batchDraw()
      if (onReady) onReady(group)
    })
  }

  return group
}

export function refreshPicketFenceGroup(group, structData, Konva) {
  if (!group) return
  const hitLine = group.getChildren(c => c instanceof Konva.Line)[0]
  if (!hitLine) return
  const lx = hitLine.x(), ly = hitLine.y()
  if (lx !== 0 || ly !== 0) {
    const normalized = hitLine.points().map((v, i) => i % 2 === 0 ? v + lx : v + ly)
    hitLine.points(normalized); hitLine.x(0); hitLine.y(0)
  }
  addPicketsToGroup(group, hitLine.points(), hitLine.tension(), structData?.picketVariant || 'white', Konva)
  group.getLayer()?.batchDraw()
}

export async function drawPicketFences(structLayer, structDataRef, Konva, plantLayer) {
  if (!structDataRef?.current) return
  const entries = Object.entries(structDataRef.current).filter(([, d]) => d.type === 'picket-fence')
  for (const [id] of entries) {
    // Search both structLayer and plantLayer (fence may have been moved Forward)
    const group = structLayer?.findOne('#' + id) || plantLayer?.findOne('#' + id)
    if (!group || !(group instanceof Konva.Group)) continue
    const hitLine = group.getChildren(c => c instanceof Konva.Line)[0]
    if (!hitLine) continue
    const d = structDataRef.current[id]
    await loadPicketImages(d?.picketVariant || 'white')
    const imgH = getPicketImageCached(d?.picketVariant || 'white', 'h')
    const imgV = getPicketImageCached(d?.picketVariant || 'white', 'v')
    if (!imgH && !imgV) continue
    const lx = hitLine.x(), ly = hitLine.y()
    if (lx !== 0 || ly !== 0) {
      const normalized = hitLine.points().map((v, i) => i % 2 === 0 ? v + lx : v + ly)
      hitLine.points(normalized); hitLine.x(0); hitLine.y(0)
    }
    addPicketsToGroup(group, hitLine.points(), hitLine.tension(), d?.picketVariant || 'white', Konva)
    group.moveToTop()
  }
  structLayer.batchDraw()
}
