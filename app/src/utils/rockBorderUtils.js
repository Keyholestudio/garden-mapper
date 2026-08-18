// rockBorderUtils.js — Rock border / stepping stone path tiling

// ── Config presets ─────────────────────────────────────────────────────────────
export const ROCK_BORDER_PRESETS = {
  'rock-border':   { stoneSize: 28, overlap: -0.15 },
  'stepping-path': { stoneSize: 48, overlap: -0.40 },
  'picket-fence':  { stoneSize: 24, overlap: 0.0  },
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

  // Live drag: redraw stones at world position so they follow the finger.
  // flatPoints stay unchanged — we pass a temporarily shifted array for rendering only.
  group.on('dragmove', () => {
    if (showGrid && snapCell) {
      group.x(Math.round(group.x() / snapCell) * snapCell)
      group.y(Math.round(group.y() / snapCell) * snapCell)
    }
    const dx = group.x(), dy = group.y()
    if (dx === 0 && dy === 0) return
    // Render stones at shifted positions WITHOUT modifying hitLine.points()
    const flat = hitLine.points()
    const shifted = flat.map((v, i) => i % 2 === 0 ? v + dx : v + dy)
    // Temporarily move group to (0,0) for rendering, then restore
    group.x(0); group.y(0)
    addStonesToGroup(group, shifted, hitLine.tension(), variant, id, Konva)
    group.x(dx); group.y(dy)
    group.getLayer()?.batchDraw()
  })

  // After drag ends: absorb the group offset back into flatPoints so group stays at (0,0).
  // This keeps flatPoints in world coords and getShapeWorldPts correct at all times.
  group.on('dragend', () => {
    const dx = group.x(), dy = group.y()
    // Also absorb any hitLine-own offset (can accumulate on mobile touch drag)
    const lx = hitLine.x(), ly = hitLine.y()
    const totalDx = dx + lx, totalDy = dy + ly
    if (totalDx === 0 && totalDy === 0) return
    const flat = hitLine.points()
    const newFlat = flat.map((v, i) => i % 2 === 0 ? v + totalDx : v + totalDy)
    hitLine.points(newFlat)
    hitLine.x(0); hitLine.y(0)  // always reset hitLine position to (0,0)
    group.x(0); group.y(0)
    addStonesToGroup(group, newFlat, hitLine.tension(), variant, id, Konva)
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
