// GardenCanvas.jsx — Konva stage with grid, pan, zoom, property boundary
// Phase 1: canvas init + grid + zoom-to-fit + pan

import { useEffect, useRef, useCallback } from 'react'
import Konva from 'konva'
import { UNIT_PX, CELL_PX, CELL_IN } from '../hooks/useGardenState'
import './GardenCanvas.css'

const SEASON_BG = {
  spring: '#C8E6C9',
  summer: '#8BC34A',
  fall:   '#FFCC80',
  winter: '#E3F2FD',
}
const SEASON_GRID = {
  spring: 'rgba(56,142,60,0.25)',
  summer: 'rgba(80,160,30,0.25)',
  fall:   'rgba(180,100,20,0.20)',
  winter: 'rgba(70,110,130,0.18)',
}
const SEASONS = ['spring','summer','fall','winter']

export default function GardenCanvas({
  gardenName, gardenW, gardenH, gardenUnit,
  currentSeason, showGrid,
  propBoundsRef,
  onStageReady,   // callback(stage, layers) — parent gets refs after init
}) {
  const containerRef = useRef(null)
  const stageRef     = useRef(null)
  const layersRef    = useRef({})   // {gridLayer, structLayer, plantLayer, uiLayer}

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

    structLayer.add(new Konva.Rect({
      x: ox, y: oy, width: pw, height: ph,
      stroke: '#558B2F', strokeWidth: 2,
      dash: [10, 5], fill: 'transparent',
      listening: false, strokeScaleEnabled: false,
      id: '__propBounds',
    }))
    structLayer.add(new Konva.Text({
      x: ox + 6, y: oy + 5,
      text: `${gardenName}  ${gardenW}×${gardenH} ${gardenUnit}`,
      fontSize: 11, fontStyle: 'bold',
      fill: '#558B2F', opacity: 0.65, listening: false,
      id: '__propLabel',
    }))
    structLayer.batchDraw()

    // ── Pan (drag on empty canvas in select mode) ──
    let isPanning = false, panStart = null

    stage.on('mousedown touchstart', (e) => {
      // Blur inputs so Enter key reaches keydown handlers
      if (document.activeElement && document.activeElement !== document.body) {
        document.activeElement.blur()
      }
    })

    stage.on('mousedown', (e) => {
      if (e.target === stage) {
        isPanning = true
        panStart = stage.getPointerPosition()
        wrap.style.cursor = 'grabbing'
      }
    })
    stage.on('mousemove', () => {
      if (!isPanning || !panStart) return
      const pos = stage.getPointerPosition()
      stage.x(stage.x() + pos.x - panStart.x)
      stage.y(stage.y() + pos.y - panStart.y)
      panStart = pos
      drawGrid(stage, layersRef.current.gridLayer, showGrid, gardenUnit, currentSeason)
      stage.batchDraw()
    })
    stage.on('mouseup touchend', () => {
      if (isPanning) {
        isPanning = false
        panStart = null
        wrap.style.cursor = ''
      }
    })

    // ── Scroll to zoom ──
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
      drawGrid(stage, layersRef.current.gridLayer, showGrid, gardenUnit, currentSeason)
      stage.batchDraw()
    })

    // Initial zoom-to-fit + draw
    zoomToFit(stage, propBoundsRef.current)
    drawGrid(stage, gridLayer, showGrid, gardenUnit, currentSeason)

    // Resize observer
    const ro = new ResizeObserver(() => {
      if (!stageRef.current) return
      stage.width(wrap.clientWidth)
      stage.height(wrap.clientHeight)
      drawGrid(stage, layersRef.current.gridLayer, showGrid, gardenUnit, currentSeason)
      stage.batchDraw()
    })
    ro.observe(wrap)

    // Notify parent
    if (onStageReady) onStageReady(stage, layersRef.current)

    return () => {
      ro.disconnect()
      stage.destroy()
      stageRef.current = null
    }
  }, []) // run once on mount

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

  return (
    <div
      className="canvas-container"
      ref={containerRef}
      style={{ background: SEASON_BG[SEASONS[currentSeason]] }}
    />
  )
}

// ── Helpers (pure, no React state) ────────────────────────

export function zoomToFit(stage, propBounds, padding = 80) {
  if (!stage || !propBounds) return
  const W = stage.width()
  const H = stage.height()
  const scaleX = (W - padding * 2) / propBounds.w
  const scaleY = (H - padding * 2) / propBounds.h
  const scale  = Math.min(scaleX, scaleY, 2) // cap at 2×
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
