// GardenCanvas.jsx — Konva stage with grid, pan, zoom, property boundary
// Phase 2: + canvas click → world coords for plant placement

import { useEffect, useRef, useCallback } from 'react'
import Konva from 'konva'
import { UNIT_PX, CELL_PX, CELL_IN } from '../hooks/useGardenState'
import './GardenCanvas.css'

const SEASON_BG = {
  spring: '#C8E7BA',
  summer: '#B2D798',
  fall:   '#ADB681',
  winter: '#F0E4CD',
}
const SEASON_GRID = {
  spring: 'rgba(56,142,60,0.25)',
  summer: 'rgba(80,160,30,0.25)',
  fall:   'rgba(180,100,20,0.20)',
  winter: 'rgba(70,110,130,0.18)',
}
const SEASONS = ['spring','summer','fall','winter']

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
// Set to true to re-enable seasonal lawn textures on the property boundary
const LAWN_TEXTURES_ENABLED = false

function loadTexture(src) {
  return new Promise((resolve) => {
    const img = new window.Image()
    img.onload = () => resolve(img)
    img.onerror = () => resolve(null)
    img.src = src
  })
}

export default function GardenCanvas({
  gardenName, gardenW, gardenH, gardenUnit,
  currentSeason, showGrid,
  propBoundsRef,
  onStageReady,    // callback(stage, layers) — parent gets refs after init
  onCanvasClick,   // callback({x,y}) — world coords of click on empty canvas
  onScaleChange,   // callback(stage) — fired after zoom/pan so parent can update scale label
  onDrop,          // callback({x,y}) — world coords when a plant is dropped onto canvas
  editingShapeId,  // when set, background taps do NOT clear selection (edit-points mode)
  isPinchingRef,   // shared ref — set true while 2 fingers on screen, read by transformer to abort
  onPinchEnd,      // callback — fired after pinch ends so parent can re-apply lock/draggable state
  isMobile,        // true on mobile — changes initial zoom to fit height instead of smaller dimension
  isDreamGarden,   // true when currentGardenIndex === 0 — enables view-only overlay
  sandboxBoundsRef, // ref — parent writes sandbox world-coord bounds here for drop/click guards
}) {
  const containerRef    = useRef(null)
  const stageRef        = useRef(null)
  const layersRef       = useRef({})
  const showGridRef     = useRef(showGrid)
  const seasonRef       = useRef(currentSeason)
  const gardenUnitRef   = useRef(gardenUnit)
  const isMobileRef     = useRef(isMobile)
  const editingShapeRef = useRef(editingShapeId ?? null) // kept current via effect below

  // ── Init Konva stage ──────────────────────────────────
  useEffect(() => {
    if (!containerRef.current) return
    if (stageRef.current) return // already initialized

    const wrap = containerRef.current
    const W = wrap.clientWidth
    const H = wrap.clientHeight

    // Create stage
    const stage = new Konva.Stage({ container: wrap, width: W, height: H })
    stageRef.current = stage

    // Layers (order matters: grid → structs → plants → ui)
    const gridLayer   = new Konva.Layer()
    const structLayer = new Konva.Layer()
    const plantLayer  = new Konva.Layer()
    const uiLayer     = new Konva.Layer()
    stage.add(gridLayer, structLayer, plantLayer, uiLayer)
    layersRef.current = { gridLayer, structLayer, plantLayer, uiLayer }

    // Transformer (for resize handles)
    const tr = new Konva.Transformer({
      rotateEnabled: false,
      borderStroke: '#558B2F',
      borderStrokeWidth: 2,
      anchorFill: '#fff',
      anchorStroke: '#558B2F',
      anchorSize: 10,
      keepRatio: true,
    })
    uiLayer.add(tr)
    layersRef.current.tr = tr

    // Property boundary rect + label
    const pw = gardenW * UNIT_PX * (gardenUnit === 'm' ? 3.281 : 1)
    const ph = gardenH * UNIT_PX * (gardenUnit === 'm' ? 3.281 : 1)
    const ox = Math.max(16, (W - pw) / 2)
    const oy = Math.max(16, (H - ph) / 2)
    propBoundsRef.current = { x: ox, y: oy, w: pw, h: ph }

    const boundsRect = new Konva.Rect({
      x: ox, y: oy, width: pw, height: ph,
      stroke: '#558B2F', strokeWidth: 2,
      dash: [10, 5], fill: 'transparent',
      listening: false, strokeScaleEnabled: false,
      id: '__propBounds',
    })
    structLayer.add(boundsRect)

    // Load lawn texture for current season (disabled — set LAWN_TEXTURES_ENABLED=true to restore)
    if (LAWN_TEXTURES_ENABLED) {
      const seasonName = SEASONS[currentSeason] || 'spring'
      loadTexture(LAWN_TEXTURES[seasonName]).then((texImg) => {
        if (texImg) {
          boundsRect.fillPriority('pattern')
          boundsRect.fillPatternImage(texImg)
          boundsRect.fillPatternRepeat('repeat')
          boundsRect.opacity(LAWN_OPACITY[seasonName] ?? 1.0)
          structLayer.batchDraw()
        }
      })
    }
    structLayer.add(new Konva.Text({
      x: ox + 6, y: oy + 5,
      text: `${gardenName}  ${gardenW}×${gardenH} ${gardenUnit}`,
      fontSize: 11, fontStyle: 'bold',
      fill: '#558B2F', opacity: 0.65, listening: false,
      id: '__propLabel',
    }))
    structLayer.batchDraw()

    // ── Pan — only when in select mode and clicking empty canvas ──
    // Draw tools (useDrawTools) handle mousedown for all other modes
    let isPanning = false, panStart = null

    stage.on('mousedown touchstart', () => {
      if (document.activeElement && document.activeElement !== document.body) {
        document.activeElement.blur()
      }
    })

    stage.on('pan:start', () => {
      isPanning = true
      panStart = stage.getPointerPosition()
      wrap.style.cursor = 'grabbing'
    })
    stage.on('mousemove', () => {
      if (!isPanning || !panStart) return
      const pos = stage.getPointerPosition()
      stage.x(stage.x() + pos.x - panStart.x)
      stage.y(stage.y() + pos.y - panStart.y)
      panStart = pos
      drawGrid(stage, layersRef.current.gridLayer, showGridRef.current, gardenUnitRef.current, seasonRef.current)
      stage.batchDraw()
      if (onScaleChange) onScaleChange(stage)
    })
    stage.on('mouseup touchend', () => {
      if (isPanning) {
        isPanning = false
        panStart = null
        wrap.style.cursor = ''
      }
    })

    // ── Scroll to zoom (mouse wheel) ──
    stage.on('wheel', (e) => {
      e.evt.preventDefault()
      const oldScale = stage.scaleX()
      const pointer  = stage.getPointerPosition()
      const mousePointTo = {
        x: (pointer.x - stage.x()) / oldScale,
        y: (pointer.y - stage.y()) / oldScale,
      }
      const direction = e.evt.deltaY > 0 ? -1 : 1
      const factor    = 1.08
      const newScale  = direction > 0 ? oldScale * factor : oldScale / factor
      const clamped   = Math.min(Math.max(newScale, 0.1), 8)
      stage.scale({ x: clamped, y: clamped })
      stage.x(pointer.x - mousePointTo.x * clamped)
      stage.y(pointer.y - mousePointTo.y * clamped)
      drawGrid(stage, layersRef.current.gridLayer, showGridRef.current, gardenUnitRef.current, seasonRef.current)
      stage.batchDraw()
      if (onScaleChange) onScaleChange(stage)
    })

    // ── Touch: pinch-to-zoom + 1-finger pan ──
    // Uses native DOM touch events on the container (not Konva events)
    // so we get raw multi-touch data before Konva processes it.
    let lastTouchDist  = null  // distance between two fingers (pinch)
    let lastTouchMid   = null  // midpoint between two fingers (pinch pivot)
    let touchPanStart  = null  // single-finger pan origin
    let isPinching     = false // true while 2+ fingers are on screen — blocks object interaction

    function getTouchDist(t1, t2) {
      const dx = t1.clientX - t2.clientX
      const dy = t1.clientY - t2.clientY
      return Math.sqrt(dx * dx + dy * dy)
    }
    function getTouchMid(t1, t2, rect) {
      return {
        x: (t1.clientX + t2.clientX) / 2 - rect.left,
        y: (t1.clientY + t2.clientY) / 2 - rect.top,
      }
    }

    function onTouchStart(e) {
      if (e.touches.length === 2) {
        // Pinch start — record initial distance and midpoint
        e.preventDefault()
        isPinching = true
        if (isPinchingRef) isPinchingRef.current = true  // shared with transformer abort
        const rect = wrap.getBoundingClientRect()
        lastTouchDist = getTouchDist(e.touches[0], e.touches[1])
        lastTouchMid  = getTouchMid(e.touches[0], e.touches[1], rect)
        touchPanStart = null
        // Stop any in-progress drag and disable draggable on all shapes.
        // layer.listening(false) blocks new events but doesn't interrupt an
        // already-latched drag from the first finger — draggable(false) does.
        const { plantLayer, structLayer, tr } = layersRef.current
        // Cancel any active Konva drag immediately
        if (Konva.DD?.isDragging) Konva.DD.reset()
        // Disable draggable on every shape in both layers
        plantLayer?.find('Group').forEach(n => n.draggable(false))
        structLayer?.find('Line,Rect,Circle,Path').forEach(n => {
          if (n.id() !== '__propBounds') n.draggable(false)
        })
        if (plantLayer)  plantLayer.listening(false)
        if (structLayer) structLayer.listening(false)
        if (tr) { tr.nodes([]); tr.getLayer()?.batchDraw() }
      } else if (e.touches.length === 1) {
        // Single finger — pan start (only in select mode; draw tools handle their own touch)
        isPinching = false
        if (isPinchingRef) isPinchingRef.current = false
        touchPanStart = { x: e.touches[0].clientX, y: e.touches[0].clientY }
        lastTouchDist = null
      }
    }

    function onTouchMove(e) {
      if (e.touches.length === 2) {
        e.preventDefault()
        if (lastTouchDist === null) return
        const rect    = wrap.getBoundingClientRect()
        const newDist = getTouchDist(e.touches[0], e.touches[1])
        const newMid  = getTouchMid(e.touches[0], e.touches[1], rect)
        const oldScale = stage.scaleX()
        const scaleFactor = newDist / lastTouchDist
        const newScale = Math.min(Math.max(oldScale * scaleFactor, 0.1), 8)

        // Zoom around pinch midpoint
        const pivotWorld = {
          x: (lastTouchMid.x - stage.x()) / oldScale,
          y: (lastTouchMid.y - stage.y()) / oldScale,
        }
        stage.scale({ x: newScale, y: newScale })
        stage.x(newMid.x - pivotWorld.x * newScale)
        stage.y(newMid.y - pivotWorld.y * newScale)

        lastTouchDist = newDist
        lastTouchMid  = newMid
        drawGrid(stage, layersRef.current.gridLayer, showGridRef.current, gardenUnitRef.current, seasonRef.current)
        stage.batchDraw()
        if (onScaleChange) onScaleChange(stage)
      } else if (e.touches.length === 1 && touchPanStart && isPanning) {
        // Single-finger pan (only active when pan:start was fired by draw tools / select mode)
        const dx = e.touches[0].clientX - touchPanStart.x
        const dy = e.touches[0].clientY - touchPanStart.y
        stage.x(stage.x() + dx)
        stage.y(stage.y() + dy)
        touchPanStart = { x: e.touches[0].clientX, y: e.touches[0].clientY }
        drawGrid(stage, layersRef.current.gridLayer, showGridRef.current, gardenUnitRef.current, seasonRef.current)
        stage.batchDraw()
        if (onScaleChange) onScaleChange(stage)
      }
    }

    function onTouchEnd(e) {
      if (e.touches.length < 2) { lastTouchDist = null; lastTouchMid = null }
      if (e.touches.length === 0) {
        touchPanStart = null
        // Re-enable layer interaction after a short delay so the post-pinch
        // finger-lift tap doesn't immediately select whatever was underneath.
        setTimeout(() => {
          isPinching = false
          if (isPinchingRef) isPinchingRef.current = false
          const { plantLayer, structLayer } = layersRef.current
          // Re-enable draggable on all shapes (lock state re-applied by onPinchEnd in parent)
          plantLayer?.find('Group').forEach(n => n.draggable(true))
          structLayer?.find('Line,Rect,Circle,Path').forEach(n => {
            if (n.id() !== '__propBounds') n.draggable(true)
          })
          if (plantLayer)  plantLayer.listening(true)
          if (structLayer) structLayer.listening(true)
          onPinchEnd?.()  // parent re-applies locked state
        }, 120)
      }
    }

    wrap.addEventListener('touchstart',  onTouchStart, { passive: false })
    wrap.addEventListener('touchmove',   onTouchMove,  { passive: false })
    wrap.addEventListener('touchend',    onTouchEnd)
    wrap.addEventListener('touchcancel', onTouchEnd)

    // ── Canvas click → plant placement or deselect ──
    // While in edit-points mode (editingShapeRef.current is set), background taps
    // are used to add points — do NOT propagate to onCanvasClick which would clear selection.
    // During pinch-to-zoom, suppress all tap/click so objects aren't selected or moved.
    stage.on('click tap', e => {
      if (isPinching) return  // pinch in progress — ignore all taps
      if (e.target === stage) {
        if (editingShapeRef.current) return  // edit-points mode: ignore background tap
        const pos = stage.getRelativePointerPosition()
        if (onCanvasClick) onCanvasClick(pos)
      }
    })

    // Initial zoom-to-fit + draw (20px padding matches v8)
    zoomToFit(stage, propBoundsRef.current, 20, isMobileRef.current)
    drawGrid(stage, gridLayer, showGrid, gardenUnit, currentSeason)

    // Resize observer
    const ro = new ResizeObserver(() => {
      if (!stageRef.current) return
      stage.width(wrap.clientWidth)
      stage.height(wrap.clientHeight)
      drawGrid(stage, layersRef.current.gridLayer, showGridRef.current, gardenUnitRef.current, seasonRef.current)
      stage.batchDraw()
    })
    ro.observe(wrap)

    // Notify parent
    if (onStageReady) onStageReady(stage, layersRef.current)

    return () => {
      ro.disconnect()
      wrap.removeEventListener('touchstart',  onTouchStart)
      wrap.removeEventListener('touchmove',   onTouchMove)
      wrap.removeEventListener('touchend',    onTouchEnd)
      wrap.removeEventListener('touchcancel', onTouchEnd)
      stage.destroy()
      stageRef.current = null
    }
  }, []) // run once on mount

  // ── Keep refs current so pan/zoom handlers always use latest values ──
  useEffect(() => { showGridRef.current = showGrid }, [showGrid])
  useEffect(() => { seasonRef.current = currentSeason }, [currentSeason])
  useEffect(() => { gardenUnitRef.current = gardenUnit }, [gardenUnit])
  useEffect(() => { editingShapeRef.current = editingShapeId ?? null }, [editingShapeId])

  // ── Dream Garden overlay — reactive ──────────────────────────────────
  // Rebuilds whenever isDreamGarden changes (garden switch). On non-dream gardens
  // the overlay is destroyed so it never bleeds into user gardens.
  useEffect(() => {
    const stage = stageRef.current
    if (!stage) return

    // Always remove any existing overlay first (clean slate on every switch)
    const existing = stage.findOne('#__dreamOverlay')
    if (existing) existing.destroy()
    if (sandboxBoundsRef) sandboxBoundsRef.current = null

    const isLocalDev = typeof window !== 'undefined' && window.location.hostname === 'localhost'
    if (!isDreamGarden) return  // not dream garden — nothing to add

    const pb = propBoundsRef.current
    if (!pb) return

    // Sandbox: 15×15 ft, centered horizontally, shifted down 5ft from center
    const SANDBOX_FT = 15
    const sbW = SANDBOX_FT * UNIT_PX
    const sbH = SANDBOX_FT * UNIT_PX
    const sbX = pb.x + (pb.w - sbW) / 2
    const sbY = pb.y + (pb.h - sbH) / 2 + (5 * UNIT_PX)

    // Write bounds for parent drop/click guards
    if (sandboxBoundsRef) sandboxBoundsRef.current = { x: sbX, y: sbY, w: sbW, h: sbH }

    // Overlay layer — sits above uiLayer, intercepts all pointer events outside sandbox
    const overlayLayer = new Konva.Layer({ id: '__dreamOverlay' })
    stage.add(overlayLayer)

    if (!isLocalDev) {
      // Production only: 4-piece invisible frame blocking drops outside sandbox
      const BIG = 99999
      const frameRects = [
        { x: -BIG,      y: -BIG,      width: BIG * 2,   height: BIG + sbY },  // top
        { x: -BIG,      y: sbY + sbH, width: BIG * 2,   height: BIG },         // bottom
        { x: -BIG,      y: sbY,       width: BIG + sbX,  height: sbH },         // left
        { x: sbX + sbW, y: sbY,       width: BIG,        height: sbH },         // right
      ]
      frameRects.forEach(r => overlayLayer.add(new Konva.Rect({
        ...r,
        fill: 'rgba(0,0,0,0)',
        listening: true,
        perfectDrawEnabled: false,
      })))
    }

    // Sandbox dashed border (always visible on Dream Garden — orange dashes on dev)
    overlayLayer.add(new Konva.Rect({
      x: sbX, y: sbY, width: sbW, height: sbH,
      stroke: isLocalDev ? 'rgba(255,140,0,0.85)' : 'rgba(255,255,255,0.55)',
      strokeWidth: isLocalDev ? 3 : 2,
      dash: [10, 6], fill: 'transparent',
      listening: false, strokeScaleEnabled: false,
    }))

    // Label
    const lbl = new Konva.Text({
      x: sbX + sbW / 2,
      y: sbY + sbH - 28,
      text: isLocalDev ? '[ SANDBOX ZONE ]' : '✨ Try planting here',
      fontSize: 13, fontStyle: 'bold',
      fill: isLocalDev ? 'rgba(255,140,0,0.9)' : 'rgba(255,255,255,0.75)',
      listening: false,
    })
    overlayLayer.add(lbl)
    lbl.offsetX(lbl.width() / 2)  // center horizontally

    // Garden Mapper logo — centered horizontally in the property, above the sandbox
    const LOGO_W = 400  // display width in canvas pixels (~12.5ft)
    const LOGO_ASPECT = 747 / 1200  // height/width ratio of source image
    const LOGO_H = Math.round(LOGO_W * LOGO_ASPECT)
    const logoImg = new window.Image()
    logoImg.src = '/garden-mapper-logo.webp'
    logoImg.onload = () => {
      const logoNode = new Konva.Image({
        image: logoImg,
        x: pb.x + (pb.w - LOGO_W) / 2,
        y: sbY - LOGO_H - (4 * UNIT_PX),  // 4ft gap above sandbox
        width: LOGO_W,
        height: LOGO_H,
        listening: false,
        opacity: isLocalDev ? 0.5 : 0.92,  // dimmed on dev so it doesn't distract
      })
      overlayLayer.add(logoNode)
      overlayLayer.batchDraw()
    }

    overlayLayer.batchDraw()
  }, [isDreamGarden]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Redraw grid when season or showGrid changes ──
  useEffect(() => {
    const { gridLayer } = layersRef.current
    if (!stageRef.current || !gridLayer) return
    drawGrid(stageRef.current, gridLayer, showGrid, gardenUnit, currentSeason)
  }, [showGrid, currentSeason, gardenUnit])

  // ── Update canvas background colour on season change ──
  useEffect(() => {
    if (!containerRef.current) return
    const season = SEASONS[currentSeason] || 'spring'
    containerRef.current.style.background = SEASON_BG[season]
  }, [currentSeason])

  // ── Swap lawn texture on season change (disabled — set LAWN_TEXTURES_ENABLED=true to restore) ──
  useEffect(() => {
    if (!LAWN_TEXTURES_ENABLED) return
    const { structLayer } = layersRef.current
    if (!structLayer) return
    const rect = structLayer.findOne('#__propBounds')
    if (!rect) return
    const season = SEASONS[currentSeason] || 'spring'
    loadTexture(LAWN_TEXTURES[season]).then((texImg) => {
      if (texImg) {
        rect.fillPriority('pattern')
        rect.fillPatternImage(texImg)
        rect.fillPatternRepeat('repeat')
        rect.opacity(LAWN_OPACITY[season] ?? 1.0)
        structLayer.batchDraw()
      }
    })
  }, [currentSeason])

  // Convert a DOM clientX/Y position to Konva world coords
  const clientToWorld = (clientX, clientY) => {
    const stage = stageRef.current
    if (!stage) return null
    const rect = containerRef.current.getBoundingClientRect()
    const sx = stage.scaleX()
    return {
      x: (clientX - rect.left - stage.x()) / sx,
      y: (clientY - rect.top  - stage.y()) / sx,
    }
  }

  return (
    <div
      className="canvas-container"
      ref={containerRef}
      style={{ background: SEASON_BG[SEASONS[currentSeason]] }}
      onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy' }}
      onDrop={e => {
        e.preventDefault()
        if (!onDrop) return
        const pos = clientToWorld(e.clientX, e.clientY)
        if (pos) onDrop(pos)
      }}
    />
  )
}

// ── Helpers (pure, no React state) ────────────────────────

export function zoomToFit(stage, propBounds, padding = 80, isMobile = false) {
  if (!stage || !propBounds) return
  const W = stage.width()
  const H = stage.height()
  const scale = isMobile
    ? Math.min((H - padding * 2) / propBounds.h, 2)   // mobile: fit height
    : Math.min((W - padding * 2) / propBounds.w, (H - padding * 2) / propBounds.h, 2) // desktop: fit smaller dim
  stage.scale({ x: scale, y: scale })
  stage.x(W / 2 - (propBounds.x + propBounds.w / 2) * scale)
  stage.y(H / 2 - (propBounds.y + propBounds.h / 2) * scale)
  stage.batchDraw()
}

export function drawGrid(stage, gridLayer, showGrid, gardenUnit, currentSeason) {
  if (!stage || !gridLayer) return
  gridLayer.destroyChildren()
  if (!showGrid) { gridLayer.batchDraw(); return }

  const season = SEASONS[currentSeason] || 'spring'
  const col    = SEASON_GRID[season]
  const sc     = stage.scaleX()
  let mult = 1
  const maxCellPx = stage.width() / 4
  while (CELL_PX * sc * mult < 16 && CELL_PX * sc * mult < maxCellPx) mult *= 2
  if (mult < 2) mult = 2  // minimum cell: 6 inches

  const vc = CELL_PX * mult
  const sx = stage.x(), sy = stage.y()
  const W  = stage.width(), H = stage.height()
  const x0 = -sx / sc, y0 = -sy / sc
  const x1 = x0 + W / sc, y1 = y0 + H / sc
  const sX = Math.floor(x0 / vc) * vc
  const sY = Math.floor(y0 / vc) * vc

  for (let x = sX; x < x1 + vc; x += vc)
    gridLayer.add(new Konva.Line({ points: [x, y0 - vc, x, y1 + vc], stroke: col, strokeWidth: 0.5 / sc, listening: false }))
  for (let y = sY; y < y1 + vc; y += vc)
    gridLayer.add(new Konva.Line({ points: [x0 - vc, y, x1 + vc, y], stroke: col, strokeWidth: 0.5 / sc, listening: false }))

  gridLayer.batchDraw()
  return mult
}
