// drawUtils.js — Freeform + rect draw helpers (ported from v8)
import Konva from 'konva'
import {
  BED_COLOURS, BUILDING_COLOURS, FENCE_COLOURS, HEDGE_COLOURS,
  PATH_COLOURS, WATER_COLOURS, DECKING_COLOURS, GATE_STYLES,
} from '../hooks/useGardenState'
import { buildRockBorderGroup, buildPicketFenceGroup, drawPicketFences } from './rockBorderUtils'

// ── Texture helper ─────────────────────────────────────────
// Apply a repeating texture (or solid fill) to any Konva shape based on colour token.
// If colour starts with '#TX:' it loads the texture and tiles it; otherwise uses solid fill.
// ── Path texture helper ──────────────────────────────────
// Strategy: mirror the rock-border approach exactly.
// - Original line becomes invisible hit target (native Konva hit, no custom funcs)
// - A visual-only clone Line (non-listening) gets sceneFunc for texture rendering
// - Both live inside a Konva.Group (id = 'ptxg_' + lineId) that is draggable
// - Group.click/tap fires onSelect; the original line's own listeners are removed
// - Restoring flat colour destroys the group and re-adds the bare line

export function applyPathTexture(line, colour, pathWidth, layer, TEXTURE_MAP, onSelect, onEnterEdit) {
  const lineId = line.id()

  // ─ Tear down any existing texture group ─
  const existingGroup = layer?.findOne(`#ptxg_${lineId}`)
  if (existingGroup) {
    // Pull line back out before destroying group
    line.remove()
    existingGroup.destroy()
    line.sceneFunc(null)
    line.hitFunc(null)
    line.clearCache()
    line.listening(true)
    line.draggable(true)
    layer?.add(line)
  }

  if (!colour?.startsWith('#TX:') || !TEXTURE_MAP?.[colour]) {
    // Flat colour — plain line, restore normal stroke
    line.stroke(colour)
    line.strokeWidth(pathWidth || 18)
    layer?.batchDraw()
    return
  }

  const txInfo = TEXTURE_MAP[colour]
  const sw = pathWidth || 18

  // ─ Make original line invisible but keep it as the native hit target ─
  line.stroke('transparent')
  line.strokeWidth(sw)
  line.hitStrokeWidth(sw + 16)   // wide hit area via native Konva stroke hit
  line.listening(true)
  line.draggable(false)          // group handles drag
  line.sceneFunc(null)
  line.hitFunc(null)
  line.clearCache()

  // ─ Build the group ─
  const group = new Konva.Group({
    id: `ptxg_${lineId}`,
    x: line.x(), y: line.y(),
    draggable: true,
  })

  // ─ Visual clone: same points/tension, non-listening, gets sceneFunc ─
  const visual = new Konva.Line({
    points: line.points(),
    tension: line.tension(),
    closed: false,
    stroke: 'transparent',
    strokeWidth: sw,
    strokeScaleEnabled: false,
    lineCap: 'round', lineJoin: 'round',
    listening: false,
    draggable: false,
  })

  // Load texture and apply via sceneFunc on visual clone
  const offscreen = document.createElement('canvas')
  const img = new window.Image()
  img.onload = () => {
    offscreen.width  = img.naturalWidth  || 256
    offscreen.height = img.naturalHeight || 256
    offscreen.getContext('2d').drawImage(img, 0, 0)

    visual.sceneFunc((ctx, shape) => {
      const c2d = ctx._context
      const pts = shape.points()
      const ten = shape.tension()
      if (pts.length < 4) return
      const pattern = c2d.createPattern(offscreen, 'repeat')
      c2d.save()
      c2d.beginPath()
      c2d.moveTo(pts[0], pts[1])
      if (ten > 0 && pts.length >= 6) {
        for (let i = 0; i < pts.length - 2; i += 2) {
          const x0 = i > 0 ? pts[i-2] : pts[i],   y0 = i > 0 ? pts[i-1] : pts[i+1]
          const x1 = pts[i],   y1 = pts[i+1]
          const x2 = pts[i+2], y2 = pts[i+3]
          const x3 = i < pts.length-4 ? pts[i+4] : x2
          const y3 = i < pts.length-4 ? pts[i+5] : y2
          c2d.bezierCurveTo(
            x1+(x2-x0)*ten/3, y1+(y2-y0)*ten/3,
            x2-(x3-x1)*ten/3, y2-(y3-y1)*ten/3,
            x2, y2
          )
        }
      } else {
        for (let i = 2; i < pts.length; i += 2) c2d.lineTo(pts[i], pts[i+1])
      }
      c2d.strokeStyle = pattern
      c2d.lineWidth = sw
      c2d.lineCap = 'round'
      c2d.lineJoin = 'round'
      c2d.stroke()
      c2d.restore()
    })
    layer?.batchDraw()
  }
  img.src = txInfo.src

  // Move original line into group (reset its local position — group carries world pos)
  line.remove()
  line.x(0); line.y(0)
  group.add(visual)
  group.add(line)   // line on top so its hit area is active

  // Group drag — sync back to line world position in structDataRef
  group.on('dragmove', () => { })
  group.on('dragend',  () => { })

  // Group click/tap → select (suppress when in add-point/edit mode so clicks reach useDrawTools)
  group.on('click tap', e => {
    // If the hit line's parent group is being edited, let the click propagate to stage
    if (line._ptxEditing) return
    e.cancelBubble = true
    if (onSelect) onSelect(lineId, group, e)
  })
  group.on('dblclick dbltap', e => {
    e.cancelBubble = true
    if (onEnterEdit) onEnterEdit(lineId)
  })

  // Store colour for width-change rebuilds
  group._ptxColour  = colour
  group._ptxOnSelect     = onSelect
  group._ptxOnEnterEdit  = onEnterEdit

  layer?.add(group)
  layer?.batchDraw()
}

// Update path texture width — rebuild group with new width
export function updatePathTextureWidth(shapeOrGroup, pathWidth, layer, TEXTURE_MAP) {
  // shapeOrGroup may be the group (if already textured) or the bare line
  const group = shapeOrGroup instanceof Konva.Group
    ? shapeOrGroup
    : layer?.findOne(`#ptxg_${shapeOrGroup.id()}`)
  if (!group || !group._ptxColour) return
  // Find the hit line inside the group
  const hitLine = group.findOne(`#${group.id().replace('ptxg_', '')}`)
  if (!hitLine) return
  applyPathTexture(hitLine, group._ptxColour, pathWidth, layer, TEXTURE_MAP, group._ptxOnSelect, group._ptxOnEnterEdit)
}

export function applyColourOrTexture(shape, colour, layer, TEXTURE_MAP, opaque = false) {
  if (colour && colour.startsWith('#TX:') && TEXTURE_MAP && TEXTURE_MAP[colour]) {
    const img = new window.Image()
    img.onload = () => {
      shape.fill(null)
      shape.fillPriority('pattern')
      shape.fillPatternImage(img)
      shape.fillPatternRepeat('repeat')
      shape.fillPatternOpacity(0.1)
      layer?.batchDraw()
    }
    img.src = TEXTURE_MAP[colour].src
  } else {
    shape.fillPriority('color')
    shape.fillPatternImage(null)
    shape.fill((colour || '#8B6340') + (opaque ? 'FF' : 'CC'))
    layer?.batchDraw()
  }
}

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

// ── isFreeMode ────────────────────────────────────────────
export function isFreeMode(currentMode, bedSubTool, fenceSubTool, fenceType, buildingSubTool, waterSubTool, pathSubTool) {
  // null sub-tool = no tool selected yet, never freeform
  if (currentMode === 'beds'     && bedSubTool && bedSubTool !== 'square') return true
  if (currentMode === 'fences'   && fenceType === 'picket-fence') return true
  // fenceType === 'gate' is now sticker placement (not line drawing) — do not activate draw tool
  if (currentMode === 'fences'   && fenceType === 'rock-border') return true
  if (currentMode === 'fences'   && fenceSubTool && fenceSubTool !== 'square') return true
  if (currentMode === 'paths'    && pathSubTool) return true
  if (currentMode === 'water'    && waterSubTool === 'pond') return true
  if (currentMode === 'building' && (buildingSubTool === 'deck-curved' || buildingSubTool === 'deck-straight' || buildingSubTool === 'underground-electrical' || buildingSubTool === 'underground-plumbing')) return true
  if (currentMode === 'water'    && waterSubTool === 'underground-plumbing') return true
  return false
}

// ── Boundary snap helpers ─────────────────────────────────
export function getBoundaryEdge(pt, b, scale) {
  if (!b) return null
  const T = 28 / scale
  if (Math.abs(pt.y - b.y)       < T) return 0
  if (Math.abs(pt.x - (b.x+b.w)) < T) return 1
  if (Math.abs(pt.y - (b.y+b.h)) < T) return 2
  if (Math.abs(pt.x - b.x)       < T) return 3
  return null
}

export function getBoundaryClosure(ptLast, ptFirst, b, scale) {
  const edgeL = getBoundaryEdge(ptLast,  b, scale)
  const edgeF = getBoundaryEdge(ptFirst, b, scale)
  if (edgeL === null || edgeF === null) return []
  if (edgeL === edgeF) return []
  const corners = [
    { x: b.x,      y: b.y      },
    { x: b.x+b.w,  y: b.y      },
    { x: b.x+b.w,  y: b.y+b.h  },
    { x: b.x,      y: b.y+b.h  },
  ]
  const cwDist  = (edgeF - edgeL + 4) % 4
  const ccwDist = (4 - cwDist) % 4
  const result  = []
  if (cwDist <= ccwDist) {
    let e = edgeL
    for (let i = 0; i < cwDist; i++) { result.push(corners[(e+1)%4]); e = (e+1)%4 }
  } else {
    let e = edgeL
    for (let i = 0; i < ccwDist; i++) { result.push(corners[e]); e = (e+3)%4 }
  }
  return result
}

// ── Hybrid SVG path (curved user pts + straight boundary edges) ──
export function buildHybridSvgPath(userPts, boundaryCorners, tension) {
  if (userPts.length < 2) return ''
  const t = tension || 0.45
  function cp(p0, p1, p2, p3) {
    const d = t / 6
    return {
      cp1: { x: p1.x + (p2.x - p0.x) * d, y: p1.y + (p2.y - p0.y) * d },
      cp2: { x: p2.x - (p3.x - p1.x) * d, y: p2.y - (p3.y - p1.y) * d },
    }
  }
  const pts = userPts
  let d = `M ${pts[0].x} ${pts[0].y}`
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i-1)]
    const p1 = pts[i]
    const p2 = pts[i+1]
    const p3 = pts[Math.min(pts.length-1, i+2)]
    const { cp1, cp2 } = cp(p0, p1, p2, p3)
    d += ` C ${cp1.x} ${cp1.y} ${cp2.x} ${cp2.y} ${p2.x} ${p2.y}`
  }
  for (const c of boundaryCorners) { d += ` L ${c.x} ${c.y}` }
  d += ' Z'
  return d
}

// ── Snap a point to property boundary edges/corners ──────
export function snapToBoundary(pos, propBounds, scale) {
  if (!propBounds) return pos
  const b   = propBounds
  const T   = 22 / scale
  const edges = [
    { snap: { y: b.y },      test: p => Math.abs(p.y - b.y)       < T, apply: p => ({ ...p, y: b.y,      onBoundary: true }) },
    { snap: { x: b.x+b.w },  test: p => Math.abs(p.x - (b.x+b.w)) < T, apply: p => ({ ...p, x: b.x+b.w, onBoundary: true }) },
    { snap: { y: b.y+b.h },  test: p => Math.abs(p.y - (b.y+b.h)) < T, apply: p => ({ ...p, y: b.y+b.h, onBoundary: true }) },
    { snap: { x: b.x },      test: p => Math.abs(p.x - b.x)       < T, apply: p => ({ ...p, x: b.x,      onBoundary: true }) },
  ]
  for (const e of edges) { if (e.test(pos)) { pos = e.apply(pos); break } }
  // Corner snap
  const corners = [
    { x: b.x, y: b.y }, { x: b.x+b.w, y: b.y },
    { x: b.x+b.w, y: b.y+b.h }, { x: b.x, y: b.y+b.h },
  ]
  for (const c of corners) {
    if (Math.hypot(pos.x - c.x, pos.y - c.y) < T * 1.5) { pos = { ...c, onBoundary: true }; break }
  }
  // Clamp inside boundary
  pos = {
    ...pos,
    x: Math.max(b.x, Math.min(b.x + b.w, pos.x)),
    y: Math.max(b.y, Math.min(b.y + b.h, pos.y)),
  }
  return pos
}

// ── Type → colour/style lookup ───────────────────────────
export function getShapeStyle(type, opts = {}) {
  const { undergroundColour, undergroundWidth, defaultPathWidth, gateType } = opts
  const gs = GATE_STYLES[gateType] || GATE_STYLES.wood
  switch (type) {
    case 'path':       return { fillC: 'transparent', strokeC: PATH_COLOURS[0],    sWidth: defaultPathWidth || 18, tension: 0.4,  closed: false }
    case 'gate':       return { fillC: 'transparent', strokeC: gs.stroke,          sWidth: gs.strokeWidth,         tension: 0,    closed: false }
    case 'fence':      return { fillC: 'transparent', strokeC: FENCE_COLOURS[0],   sWidth: 8,  tension: 0,    closed: false }
    case 'hedge':      return { fillC: HEDGE_COLOURS[0]+'CC',   strokeC: 'transparent', sWidth: 0,  tension: 0.45, closed: true  }
    case 'pond':       return { fillC: WATER_COLOURS[0]+'CC',   strokeC: '#1976D2', sWidth: 2,  tension: 0.45, closed: true  }
    case 'deck':       return { fillC: DECKING_COLOURS[0]+'CC', strokeC: '#3A2A10', sWidth: 2,  tension: 0.45, closed: true  }
    case 'bed':        return { fillC: BED_COLOURS[0]+'FF',     strokeC: 'transparent', sWidth: 2,  tension: 0.45, closed: true  }
    default:
      if (type?.startsWith('underground')) {
        return { fillC: 'transparent', strokeC: undergroundColour || '#111', sWidth: undergroundWidth || 4, tension: 0.4, closed: false }
      }
      return { fillC: BED_COLOURS[0]+'FF', strokeC: 'transparent', sWidth: 2, tension: 0.45, closed: true }
  }
}

// ── Close freeform shape → Konva shape ───────────────────
export function closeFreeShape({
  freePts, currentMode, bedSubTool, fenceSubTool, fenceType,
  pathSubTool, gateType,
  buildingSubTool, waterSubTool, undergroundType, undergroundColour,
  undergroundWidth, undergroundOpaque, defaultPathWidth,
  propBounds, structIdCtr, structDataRef, snapCell, showGrid,
  structLayer, uiLayer, onSelect, onModeChange, onEnterEdit,
}) {
  if (freePts.length < 2) return null

  const isPath       = currentMode === 'paths'
  const isGate       = currentMode === 'paths' && pathSubTool === 'gate'
  const isFenceOpen  = currentMode === 'fences' && fenceType === 'fence'
  const isRockBorder   = currentMode === 'fences' && fenceType === 'rock-border'
  const isPicketFence  = currentMode === 'fences' && fenceType === 'picket-fence'
  const isUnderground= (currentMode === 'building' && (buildingSubTool === 'underground' || buildingSubTool === 'underground-electrical' || buildingSubTool === 'underground-plumbing'))
                     || (currentMode === 'water' && waterSubTool === 'underground-plumbing')
  const isDeckFree   = currentMode === 'building' && (buildingSubTool === 'deck-curved' || buildingSubTool === 'deck-straight')
  const isWaterPond  = currentMode === 'water'    && waterSubTool === 'pond'
  const closedShape  = !isPath && !isGate && !isFenceOpen && !isUnderground && !isRockBorder && !isPicketFence

  // ── Rock border: Group containing hit line + stone images ────────────────

  // -- Picket fence: Group containing hit line + tiled picket images --------
  if (isPicketFence) {
    const flat = freePts.flatMap(p => [p.x, p.y])
    const id   = 'struct_' + structIdCtr.current++
    structDataRef.current[id] = {
      type: 'picket-fence', label: 'Fences',
      colour: '#F5F5F5', tension: 0, picketVariant: 'white',
    }
    const group = buildPicketFenceGroup({
      id, flatPoints: flat, tension: 0, variant: 'white',
      x: 0, y: 0, Konva, showGrid, snapCell,
      onSelect, structDataRef,
      onReady: () => structLayer.batchDraw(),
    })
    structLayer.add(group)
    group.moveToTop()
    structLayer.batchDraw()
    // Render tiles immediately after placement (drawPicketFences preloads images then renders)
    drawPicketFences(structLayer, structDataRef, Konva)
    if (onSelect) onSelect(id, group)
    if (onModeChange) onModeChange('select')
    return id
  }
  if (isRockBorder) {
    const isCurved = fenceSubTool === 'rock-border-curved'
    const tension  = isCurved ? 0.4 : 0
    const flat     = freePts.flatMap(p => [p.x, p.y])
    const id       = 'struct_' + structIdCtr.current++
    structDataRef.current[id] = {
      type: 'rock-border', label: 'Rock Border',
      colour: '#888888', tension, rockVariant: 'grey',
    }
    const group = buildRockBorderGroup({
      id, flatPoints: flat, tension, variant: 'grey',
      x: 0, y: 0, Konva,
      showGrid, snapCell,
      onSelect,
      onReady: () => structLayer.batchDraw(),
    })
    structLayer.add(group)
    group.moveToTop()  // rock borders render above beds/water by default
    structLayer.batchDraw()
    if (onSelect) onSelect(id, group)
    if (onModeChange) onModeChange('select')
    return id
  }

  // Tension
  let tension = 0.45
  if (isPath) tension = 0.4
  if (currentMode === 'beds'     && bedSubTool === 'straight')             tension = 0
  if (currentMode === 'fences'   && fenceSubTool === 'straight')           tension = 0
  if (isFenceOpen)                                                          tension = 0
  if (isDeckFree  && buildingSubTool === 'deck-straight')                  tension = 0
  if (isDeckFree  && buildingSubTool === 'deck-curved')                    tension = 0.45
  if (isUnderground)                                                        tension = 0.4

  // Type
  let type, label
  if (isGate)        { type = 'gate';                      label = GATE_STYLES[gateType]?.label || 'Gate' }
  else if (isPath)   { type = 'path';                      label = 'Path'      }
  else if (isUnderground) {
    // Check both building and water modes for plumbing
    const ugSub = currentMode === 'water' ? waterSubTool : buildingSubTool
    const ugType = ugSub.includes('plumbing') ? 'plumbing' : 'electrical'
    type = 'underground-' + ugType
    label = ugType === 'electrical' ? 'Electrical' : 'Plumbing'
  }
  else if (isFenceOpen)   { type = 'fence';                label = 'Fence'     }
  else if (currentMode === 'fences')   { type = 'hedge';   label = 'Hedge'     }
  else if (isWaterPond)                { type = 'pond';    label = 'Pond'      }
  else if (isDeckFree)                 { type = 'deck';    label = 'Deck'      }
  else                                 { type = 'bed';     label = 'Garden Bed'}

  const style  = getShapeStyle(type, { undergroundColour, undergroundWidth, defaultPathWidth, gateType })
  const id     = 'struct_' + structIdCtr.current++
  const opacity = (isUnderground && !undergroundOpaque) ? 0.45 : 1

  // Boundary-closed curved shape → hybrid SVG path
  let useSvgPath = false, boundaryCornersForPath = []
  if (closedShape && tension > 0 && freePts.length >= 3 && propBounds) {
    const first = freePts[0], last = freePts[freePts.length - 1]
    if (first.onBoundary && last.onBoundary) {
      boundaryCornersForPath = getBoundaryClosure(last, first, propBounds, 1)
      useSvgPath = true
    }
  }

  let shape
  if (useSvgPath) {
    const d = buildHybridSvgPath(freePts, boundaryCornersForPath, tension)
    structDataRef.current[id] = { type, colour: style.strokeC, label, pathWidth: defaultPathWidth, tension, svgPath: d, opacity }
    shape = new Konva.Path({
      id, data: d, fill: style.fillC, stroke: style.strokeC, strokeWidth: style.sWidth,
      strokeScaleEnabled: false, lineCap: 'round', lineJoin: 'round', draggable: true,
    })
  } else {
    const flat = freePts.flatMap(p => [p.x, p.y])
    structDataRef.current[id] = { type, colour: style.strokeC, label, pathWidth: isUnderground ? undergroundWidth : defaultPathWidth, tension, opacity }
    shape = new Konva.Line({
      id, points: flat, tension, closed: closedShape,
      fill: style.fillC, stroke: style.strokeC, strokeWidth: style.sWidth,
      strokeScaleEnabled: false, lineCap: 'round', lineJoin: 'round', draggable: true,
      hitStrokeWidth: isPath || isUnderground ? style.sWidth + 10 : undefined,
    })
  }

  shape.on('dragmove', () => {
    if (showGrid && snapCell) {
      shape.x(Math.round(shape.x() / snapCell) * snapCell)
      shape.y(Math.round(shape.y() / snapCell) * snapCell)
    }
  })
  shape.on('click tap', e => { if (onSelect) onSelect(id, shape, e) })
  shape.on('dblclick dbltap', () => { if (onEnterEdit) onEnterEdit(id) })

  if (opacity < 1) shape.opacity(opacity)
  structLayer.add(shape)
  // Paths should render above beds so they remain clickable when overlapping
  if (isPath) shape.moveToTop()
  if (type === 'hedge') applyHedgeTexture(shape, structLayer)
  structLayer.batchDraw()

  if (onSelect) onSelect(id, shape)
  if (onModeChange) onModeChange('select')
  return id
}

// ── Add a rect structure (bed-square, building, pool-sq, hedge-sq, deck) ──
// ── tryMergeRects — direct port of v8 tryMergeRects + getGroupMembers ────────────────
// Called on dragend of any rect-type struct. Merges into a Konva.Group when
// dragged adjacent to another same-type rect or existing group.
const MAX_GROUP = 4
const MERGE_TYPES = ['bed-square', 'building', 'deck', 'pool-sq', 'hedge-sq']

function getGroupMembers(group, structDataRef) {
  return group.getChildren().filter(c => c instanceof Konva.Rect).map(r => ({
    x: r.x() + group.x(), y: r.y() + group.y(),
    w: r.width(), h: r.height(),
    colour: r.fill().replace(/FF$|CC$/, ''),
    type: structDataRef.current[group.id()]?.type,
    label: structDataRef.current[group.id()]?.label,
  }))
}

export function tryMergeRects(id, rect, { structDataRef, structIdCtr, groupIdCtr, structLayer, snapCell, showGrid, onSelect }) {
  const d = structDataRef.current[id]
  if (!d || !MERGE_TYPES.includes(d.type)) return
  const SNAP = showGrid && snapCell ? snapCell : 12
  const ax = rect.x(), ay = rect.y(), aw = rect.width(), ah = rect.height()

  // ── Pass 1: add to existing group ──
  for (const [oid, od] of Object.entries(structDataRef.current)) {
    if (oid === id || !od.isGroup || od.type !== d.type) continue
    const grp = structLayer.findOne('#' + oid)
    if (!grp || !(grp instanceof Konva.Group)) continue
    const members = grp.getChildren().filter(c => c instanceof Konva.Rect)
    if (members.length >= MAX_GROUP) continue
    let adjacent = false
    for (const m of members) {
      const mx = m.x() + grp.x(), my = m.y() + grp.y(), mw = m.width(), mh = m.height()
      const xOv = ax < mx + mw + SNAP && ax + aw + SNAP > mx
      const yOv = ay < my + mh + SNAP && ay + ah + SNAP > my
      const edge = Math.abs(ax - (mx + mw)) < SNAP || Math.abs(ax + aw - mx) < SNAP ||
                   Math.abs(ay - (my + mh)) < SNAP || Math.abs(ay + ah - my) < SNAP
      if (xOv && yOv && edge) { adjacent = true; break }
    }
    if (!adjacent) continue
    rect.destroy(); delete structDataRef.current[id]
    const newR = new Konva.Rect({
      x: ax - grp.x(), y: ay - grp.y(), width: aw, height: ah,
      fill: d.colour + (d.type === 'bed' || d.type === 'bed-square' ? 'FF' : 'CC'), stroke: d.type === 'bed' || d.type === 'bed-square' ? 'transparent' : '#3A2A10', strokeWidth: 2,
      cornerRadius: d.type === 'building' ? 3 : 0, strokeScaleEnabled: false,
    })
    grp.add(newR)
    structLayer.batchDraw()
    return
  }

  // ── Pass 2: merge two lone rects into a new group ──
  for (const [oid, od] of Object.entries(structDataRef.current)) {
    if (oid === id || od.type !== d.type || od.isGroup) continue
    const other = structLayer.findOne('#' + oid)
    if (!other || !(other instanceof Konva.Rect)) continue
    const bx = other.x(), by = other.y(), bw = other.width(), bh = other.height()
    const xOv = ax < bx + bw + SNAP && ax + aw + SNAP > bx
    const yOv = ay < by + bh + SNAP && ay + ah + SNAP > by
    const edge = Math.abs(ax - (bx + bw)) < SNAP || Math.abs(ax + aw - bx) < SNAP ||
                 Math.abs(ay - (by + bh)) < SNAP || Math.abs(ay + ah - by) < SNAP
    if (!xOv || !yOv || !edge) continue

    rect.destroy(); delete structDataRef.current[id]
    other.destroy(); delete structDataRef.current[oid]

    const gid = 'group_' + groupIdCtr.current++
    structDataRef.current[gid] = { type: d.type, colour: d.colour, label: d.label, isGroup: true }
    const group = new Konva.Group({ id: gid, x: 0, y: 0, draggable: true })
    const rA = new Konva.Rect({ x: ax, y: ay, width: aw, height: ah,
      fill: d.colour + (d.type === 'bed' || d.type === 'bed-square' ? 'FF' : 'CC'), stroke: d.type === 'bed' || d.type === 'bed-square' ? 'transparent' : '#3A2A10', strokeWidth: 2,
      cornerRadius: d.type === 'building' ? 3 : 0, strokeScaleEnabled: false })
    const rB = new Konva.Rect({ x: bx, y: by, width: bw, height: bh,
      fill: od.colour + (od.type === 'bed' || od.type === 'bed-square' ? 'FF' : 'CC'), stroke: od.type === 'bed' || od.type === 'bed-square' ? 'transparent' : '#3A2A10', strokeWidth: 2,
      cornerRadius: od.type === 'building' ? 3 : 0, strokeScaleEnabled: false })
    group.add(rA, rB)
    group.on('dragmove', () => {
      if (showGrid && snapCell) {
        group.x(Math.round(group.x() / snapCell) * snapCell)
        group.y(Math.round(group.y() / snapCell) * snapCell)
      }
    })
    group.on('click tap', e => { if (onSelect) onSelect(gid, group, e) })
    structLayer.add(group)
    structLayer.batchDraw()
    return
  }
}

export function addRectStruct({
  type, x, y, w, h, colour,
  structIdCtr, structDataRef, groupIdCtr, snapCell, showGrid,
  structLayer, onSelect, onModeChange, onEnterEdit,
}) {
  if (!colour) {
    if (type === 'building') colour = BUILDING_COLOURS[0]
    else if (type === 'deck') colour = DECKING_COLOURS[0]
    else if (type === 'pool-sq') colour = WATER_COLOURS[0]
    else if (type === 'hedge-sq') colour = HEDGE_COLOURS[0]
    else colour = BED_COLOURS[0]
  }
  const labelMap = { building: 'Building', deck: 'Deck', 'pool-sq': 'Pool', 'hedge-sq': 'Hedge' }
  const id = 'struct_' + structIdCtr.current++
  structDataRef.current[id] = { type, colour, label: labelMap[type] || 'Garden Bed' }

  const cornerR = type === 'building' ? 3 : 0
  const bedType = type === 'bed' || type === 'bed-square'
  const hedgeType = type === 'hedge-sq'
  const rect = new Konva.Rect({
    id, x, y, width: w, height: h,
    fill: colour + (bedType ? 'FF' : 'CC'), stroke: (bedType || hedgeType) ? 'transparent' : '#3A2A10', strokeWidth: hedgeType ? 0 : 2,
    cornerRadius: cornerR, draggable: true, strokeScaleEnabled: false,
  })
  rect.on('transformend', () => {
    rect.width(rect.width() * rect.scaleX()); rect.height(rect.height() * rect.scaleY())
    rect.scaleX(1); rect.scaleY(1); structLayer.batchDraw()
  })
  rect.on('click tap', e => { if (onSelect) onSelect(id, rect, e) })
  // No dblclick for rects — they have no editable points
  rect.on('dragmove', () => {
    if (showGrid && snapCell) {
      rect.x(Math.round(rect.x() / snapCell) * snapCell)
      rect.y(Math.round(rect.y() / snapCell) * snapCell)
    }
  })
  rect.on('dragend', () => {
    tryMergeRects(id, rect, { structDataRef, structIdCtr, groupIdCtr, structLayer, snapCell, showGrid, onSelect })
  })

  structLayer.add(rect)
  if (type === 'hedge-sq') applyHedgeTexture(rect, structLayer)
  structLayer.batchDraw()
  if (onSelect) onSelect(id, rect)
  if (onModeChange) onModeChange('select')
  return id
}

// ── Add circle (pool-circle) ──────────────────────────────
export function addCircleStruct({
  cx, cy, radius,
  structIdCtr, structDataRef, snapCell, showGrid,
  structLayer, onSelect, onModeChange, onEnterEdit,
}) {
  const id = 'struct_' + structIdCtr.current++
  structDataRef.current[id] = { type: 'pool-circle', colour: '#64B5F6', label: 'Pool' }
  const circle = new Konva.Circle({
    id, x: cx, y: cy, radius,
    fill: '#64B5F6CC', stroke: '#1976D2', strokeWidth: 2, draggable: true,
  })
  circle.on('dragmove', () => {
    if (showGrid && snapCell) {
      circle.x(Math.round(circle.x() / snapCell) * snapCell)
      circle.y(Math.round(circle.y() / snapCell) * snapCell)
    }
  })
  circle.on('transformend', () => {
    // Bake scale into radius so stroke width stays consistent
    circle.radius(circle.radius() * Math.max(circle.scaleX(), circle.scaleY()))
    circle.scaleX(1); circle.scaleY(1)
    structLayer.batchDraw()
  })
  circle.on('click tap', e => { if (onSelect) onSelect(id, circle, e) })
  // No dblclick for circles — they have no editable points
  structLayer.add(circle)
  structLayer.batchDraw()
  if (onSelect) onSelect(id, circle)
  if (onModeChange) onModeChange('select')
  return id
}
