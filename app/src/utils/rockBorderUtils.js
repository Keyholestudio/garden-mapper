// rockBorderUtils.js — Utilities for rock border / stepping stone path tiling
// Computes evenly-spaced positions + tangent angles along a polyline or Catmull-Rom curve

// ── Config presets ─────────────────────────────────────────────────────────────
// stoneSize: diameter of each stone in canvas px (at 1:1 scale = 1 px per canvas unit)
// overlap:   fraction of stoneSize that adjacent stones overlap (negative = gap)
//   overlap = 0.35  → stones overlap 35% (rock border feel)
//   overlap = 0.0   → stones touch edge-to-edge (picket fence feel)
//   overlap = -0.4  → stones have a 40% gap (stepping stone feel)

export const ROCK_BORDER_PRESETS = {
  'rock-border':   { stoneSize: 28, overlap: -0.15 },  // negative = gap between stones
  'stepping-path': { stoneSize: 48, overlap: -0.40 },
  'picket-fence':  { stoneSize: 24, overlap: 0.0  },
}

// ── Catmull-Rom sample ─────────────────────────────────────────────────────────
function catmullRomPoint(p0, p1, p2, p3, t, alpha = 0.5) {
  const t2 = t * t, t3 = t2 * t
  return {
    x: alpha * ((-p0.x + 3*p1.x - 3*p2.x + p3.x)*t3
              + (2*p0.x - 5*p1.x + 4*p2.x - p3.x)*t2
              + (-p0.x + p2.x)*t)
       + p1.x,
    y: alpha * ((-p0.y + 3*p1.y - 3*p2.y + p3.y)*t3
              + (2*p0.y - 5*p1.y + 4*p2.y - p3.y)*t2
              + (-p0.y + p2.y)*t)
       + p1.y,
  }
}

// ── Build a dense polyline from Konva flat points + tension ───────────────────
function buildDensePath(flatPoints, tension, samplesPerSegment = 30) {
  const pts = []
  for (let i = 0; i < flatPoints.length; i += 2) {
    pts.push({ x: flatPoints[i], y: flatPoints[i + 1] })
  }
  if (pts.length < 2) return pts
  if (tension <= 0) return pts

  const dense = []
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)]
    const p1 = pts[i]
    const p2 = pts[i + 1]
    const p3 = pts[Math.min(pts.length - 1, i + 2)]
    for (let s = 0; s <= samplesPerSegment; s++) {
      dense.push(catmullRomPoint(p0, p1, p2, p3, s / samplesPerSegment))
    }
  }
  return dense
}

// ── Arc length table ──────────────────────────────────────────────────────────
function buildArcLengthTable(densePts) {
  const table = [0]
  for (let i = 1; i < densePts.length; i++) {
    const dx = densePts[i].x - densePts[i-1].x
    const dy = densePts[i].y - densePts[i-1].y
    table.push(table[i-1] + Math.hypot(dx, dy))
  }
  return table
}

// ── Sample point + tangent at arc-length distance ─────────────────────────────
function sampleAtDist(densePts, arcTable, dist) {
  const total = arcTable[arcTable.length - 1]
  const d = Math.min(dist, total)
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

// ── Compute stone positions ────────────────────────────────────────────────────
export function computeStonePositions(flatPoints, tension, type = 'rock-border') {
  const preset = ROCK_BORDER_PRESETS[type] || ROCK_BORDER_PRESETS['rock-border']
  const { stoneSize, overlap } = preset
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

// ── Rock sticker sources by variant ──────────────────────────────────────────
const ROCK_SRCS = {
  grey:  '/stickers/decor_rock-small_M_CA-US-FR-GB-AU.png',
  brown: '/stickers/decor_rock-small_M_CA-US-FR-GB-AU.png',  // TODO: brown variant PNG
  white: '/stickers/decor_rock-small_M_CA-US-FR-GB-AU.png',  // TODO: white variant PNG
  mixed: '/stickers/decor_rock-small_M_CA-US-FR-GB-AU.png',  // TODO: mixed uses grey for now
}

// Image cache
const _imgCache = {}
function loadRockImage(src) {
  if (_imgCache[src]) return Promise.resolve(_imgCache[src])
  return new Promise((resolve) => {
    const img = new window.Image()
    img.onload  = () => { _imgCache[src] = img; resolve(img) }
    img.onerror = () => resolve(null)
    img.src = src
  })
}

// ── Seeded PRNG (mulberry32) ──────────────────────────────────────────────────
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

// ── Generation counter — cancels stale async runs ────────────────────────────
let _drawGeneration = 0

// ── Draw all rock border structs ──────────────────────────────────────────────
// Removes old stone groups synchronously FIRST (so delete is instant),
// then re-draws only borders still in structDataRef.
export async function drawRockBorders(structLayer, structDataRef, Konva) {
  if (!structLayer || !structDataRef?.current) return

  // Bump generation — any older in-flight call will bail after its next await
  const myGen = ++_drawGeneration

  // Remove all stone groups immediately (synchronous) — this is what makes delete instant
  structLayer.find('[id^=__rb_]').forEach(n => n.destroy())
  structLayer.batchDraw()

  const entries = Object.entries(structDataRef.current)
    .filter(([, d]) => d.type === 'rock-border')

  if (entries.length === 0) return

  for (const [id, data] of entries) {
    if (myGen !== _drawGeneration) return  // newer call started — bail

    const guideShape = structLayer.findOne('#' + id)
    if (!guideShape) continue

    const flatPoints = guideShape.points()
    if (!flatPoints || flatPoints.length < 4) continue

    // Apply guide line's current drag offset to get world-space points
    const ox = guideShape.x(), oy = guideShape.y()
    const offsetPts = []
    for (let i = 0; i < flatPoints.length; i += 2) {
      offsetPts.push(flatPoints[i] + ox, flatPoints[i+1] + oy)
    }

    const positions = computeStonePositions(offsetPts, data.tension || 0, 'rock-border')
    if (positions.length === 0) continue

    const src = ROCK_SRCS[data.rockVariant || 'grey'] || ROCK_SRCS.grey
    const img = await loadRockImage(src)

    // Check after await — delete may have fired while image was loading
    if (myGen !== _drawGeneration) return
    if (!img || !structDataRef.current[id]) continue

    const stoneSize = getStoneSize('rock-border')
    const group = new Konva.Group({ id: '__rb_' + id, listening: false })

    // Seeded shuffle for stable z-order across redraws
    const seed = id.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0)
    const rng = seededRandom(seed)
    const drawOrder = shuffleIndexes(positions.length, rng)

    for (let i = 0; i < drawOrder.length; i++) {
      const { x, y, angle } = positions[drawOrder[i]]
      const rotJitter = (rng() - 0.5) * 50  // ±25° organic rotation
      group.add(new Konva.Image({
        image: img, x, y,
        width: stoneSize, height: stoneSize,
        rotation: (angle * 180 / Math.PI) + rotJitter,
        offsetX: stoneSize / 2, offsetY: stoneSize / 2,
        listening: false,
      }))
    }

    structLayer.add(group)
    group.moveToTop()

    // ── Wire drag sync on guide line ──────────────────────────────────────────
    // Stone positions are baked in world space (ox/oy already applied),
    // so group starts at x=0,y=0. On drag we move the group by the delta
    // from the guide line's position at drag-start to its current position.
    // We store the guide line's position at draw time as the baseline so
    // repeated drags (each followed by a redraw) always start clean.
    guideShape.off('dragstart.rb dragmove.rb')
    const baseX = guideShape.x()  // guide line position when stones were drawn
    const baseY = guideShape.y()
    guideShape.on('dragmove.rb', () => {
      // Group offset = how far guide line has moved since stones were drawn
      group.x(guideShape.x() - baseX)
      group.y(guideShape.y() - baseY)
      structLayer.batchDraw()
    })
  }

  if (myGen === _drawGeneration) structLayer.batchDraw()
}
