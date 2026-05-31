// useDrawTools.js — Wires all draw-mode stage events to Konva
// Called once after stage is ready; registers/unregisters event handlers reactively

import { useEffect, useRef } from 'react'
import Konva from 'konva'
import {
  isFreeMode, snapToBoundary, closeFreeShape,
  addRectStruct, addCircleStruct, getBoundaryClosure, getShapeStyle,
} from '../utils/drawUtils'
import { PATH_COLOURS, WATER_COLOURS, HEDGE_COLOURS, DECKING_COLOURS } from './useGardenState'

export function useDrawTools({
  stage, layers, propBoundsRef, state, onStructSelect, onModeChange, onPushUndo, onEnterEdit, onAddPointDone,
}) {
  // Keep current state in refs so event handlers always see latest values
  const sRef = useRef(state)
  useEffect(() => {
    sRef.current = state
    snapCellRef.current = state.showGrid ? 16 : 0
  }, [state])

  const freePtsRef     = useRef([])
  const freeDotsRef    = useRef([])
  const freePreviewRef = useRef(null)
  const drawStartRef   = useRef(null)
  const previewRectRef = useRef(null)
  const waterStartRef  = useRef(null)
  const circlePreviewRef = useRef(null)
  const snapCellRef    = useRef(8) // updated reactively below

  // ── Hint bar (floating hint over canvas) ──────────────────
  function updateHint(pts, currentMode, buildingSubTool, pathSubTool) {
    const n = pts.length
    const isPath = currentMode === 'paths'
    const isUnderground = currentMode === 'building' && buildingSubTool === 'underground'
    const hintEl = document.getElementById('draw-hint')
    if (!hintEl) return
    if (currentMode === 'paths' && pathSubTool === 'gate') {
      hintEl.textContent = n === 0 ? 'Click first gate post' : 'Click second gate post to place gate'
    } else if (isPath || isUnderground) {
      hintEl.textContent = `${n} point${n !== 1 ? 's' : ''} · Enter or double-click to finish`
    } else {
      hintEl.textContent = n < 3
        ? `${n} point${n !== 1 ? 's' : ''} · Need ${3 - n} more`
        : `${n} points · Enter, double-click, or click near start to close`
    }
    hintEl.style.display = 'block'
  }

  function hideHint() {
    const hintEl = document.getElementById('draw-hint')
    if (hintEl) hintEl.style.display = 'none'
  }

  // ── Cancel freeform draw ──────────────────────────────────
  function cancelFree(uiLayer) {
    freePtsRef.current = []
    freeDotsRef.current.forEach(d => d.destroy())
    freeDotsRef.current = []
    if (freePreviewRef.current) { freePreviewRef.current.destroy(); freePreviewRef.current = null }
    hideHint()
    if (uiLayer) uiLayer.batchDraw()
  }

  // ── Handle freeform click ─────────────────────────────────
  function handleFreeClick(pos, uiLayerArg) {
    const s = sRef.current
    const { uiLayer } = layers || {}
    const ul = uiLayerArg || uiLayer
    const propBounds = propBoundsRef.current
    const scale = stage.scaleX()

    // Snap to boundary
    pos = snapToBoundary(pos, propBounds, scale)

    // Close-on-click-near-start
    const freePts = freePtsRef.current
    const T = 22 / scale
    if (freePts.length >= 3 && s.currentMode !== 'paths') {
      const first = freePts[0]
      if (Math.hypot(pos.x - first.x, pos.y - first.y) < T * 1.2) {
        doClose()
        return
      }
    }

    freePtsRef.current = [...freePts, pos]

    const dotFill = s.currentMode === 'paths' ? '#795548'
      : s.currentMode === 'fences' ? '#2E7D32'
      : s.currentMode === 'water'  ? '#1976D2'
      : '#558B2F'
    const dot = new Konva.Circle({
      x: pos.x, y: pos.y,
      radius: 5 / scale,
      fill: dotFill, stroke: '#fff', strokeWidth: 1.5 / scale,
      listening: false,
    })
    ul.add(dot)
    freeDotsRef.current.push(dot)
    ul.batchDraw()

    updateHint(freePtsRef.current, s.currentMode, s.buildingSubTool, s.pathSubTool)
  }

  // ── Close the freeform shape ──────────────────────────────
  function doClose() {
    const s = sRef.current
    const { structLayer, uiLayer } = layers || {}
    if (!structLayer) return

    const closedId = closeFreeShape({
      freePts:         freePtsRef.current,
      currentMode:     s.currentMode,
      bedSubTool:      s.bedSubTool,
      fenceSubTool:    s.fenceSubTool,
      fenceType:       s.fenceType,
      pathSubTool:     s.pathSubTool,
      gateType:        s.gateType,
      buildingSubTool: s.buildingSubTool,
      waterSubTool:    s.waterSubTool,
      undergroundType: s.undergroundType,
      undergroundColour: s.undergroundColour,
      undergroundWidth:  s.undergroundWidth,
      undergroundOpaque: s.undergroundOpaque,
      defaultPathWidth:  s.defaultPathWidth,
      propBounds:     propBoundsRef.current,
      structIdCtr:    s.structIdCtr,
      structDataRef:  s.structDataRef,
      snapCell:       snapCellRef.current,
      showGrid:       s.showGrid,
      structLayer,
      uiLayer,
      onSelect:       onStructSelect,
      onModeChange,
      onEnterEdit,
    })
    if (closedId && onPushUndo) {
      onPushUndo(() => {
        const sh = structLayer.findOne('#' + closedId)
        if (sh) { sh.destroy(); delete s.structDataRef.current[closedId]; structLayer.batchDraw() }
      })
    }

    cancelFree(uiLayer)
  }

  // ── Register stage events ─────────────────────────────────
  useEffect(() => {
    if (!stage || !layers) return
    const { structLayer, uiLayer } = layers

    // ── Mouse move: freeform preview + rect drag preview ──
    const onMouseMove = () => {
      const s = sRef.current
      const freePts = freePtsRef.current
      const free = isFreeMode(s.currentMode, s.bedSubTool, s.fenceSubTool, s.fenceType, s.buildingSubTool, s.waterSubTool, s.pathSubTool)

      // Freeform preview line
      if (free && freePts.length > 0) {
        const pos = stage.getRelativePointerPosition()
        const pts = [...freePts.flatMap(p => [p.x, p.y]), pos.x, pos.y]
        const isFences = s.currentMode === 'fences'
        const isPath   = s.currentMode === 'paths'
        const isGate   = s.currentMode === 'paths' && s.pathSubTool === 'gate'
        const isWater  = s.currentMode === 'water'
        const isBldg   = s.currentMode === 'building'
        const strokeC  = isFences ? '#4CAF50' : isPath ? '#D7CCC8' : isWater ? '#1976D2' : isBldg ? DECKING_COLOURS[0] : '#558B2F'
        const previewTension =
          (s.currentMode === 'beds'     && s.bedSubTool === 'straight') ||
          (s.currentMode === 'fences'   && s.fenceSubTool === 'straight') ||
          (s.currentMode === 'fences'   && s.fenceType === 'fence') ||
          (s.currentMode === 'building' && s.buildingSubTool === 'deck-straight') ? 0 : 0.4
        // Gate + path preview: always dashed thin line, never scaled with path width
        const previewStrokeW = (isPath && !isGate) ? s.defaultPathWidth / stage.scaleX() : 1.5 / stage.scaleX()
        const previewDash    = (isPath && !isGate) ? [] : [4, 3]
        const previewOpacity = (isPath && !isGate) ? 0.55 : 1

        if (!freePreviewRef.current) {
          freePreviewRef.current = new Konva.Line({
            points: pts, tension: previewTension,
            stroke: strokeC,
            strokeWidth: previewStrokeW,
            dash: previewDash,
            strokeScaleEnabled: false, listening: false, closed: false,
            opacity: previewOpacity,
          })
          uiLayer.add(freePreviewRef.current)
        } else {
          freePreviewRef.current.strokeWidth(previewStrokeW)
          freePreviewRef.current.dash(previewDash)
          freePreviewRef.current.opacity(previewOpacity)
          freePreviewRef.current.points(pts)
          freePreviewRef.current.tension(previewTension)
        }
        uiLayer.batchDraw()
      }

      // Rect drag preview
      if (drawStartRef.current && previewRectRef.current) {
        const pos = stage.getRelativePointerPosition()
        previewRectRef.current.x(Math.min(drawStartRef.current.x, pos.x))
        previewRectRef.current.y(Math.min(drawStartRef.current.y, pos.y))
        previewRectRef.current.width(Math.abs(pos.x - drawStartRef.current.x))
        previewRectRef.current.height(Math.abs(pos.y - drawStartRef.current.y))
        structLayer.batchDraw()
      }

      // Circle drag preview
      if (waterStartRef.current && circlePreviewRef.current) {
        const pos = stage.getRelativePointerPosition()
        const r = Math.hypot(pos.x - waterStartRef.current.x, pos.y - waterStartRef.current.y)
        circlePreviewRef.current.radius(Math.max(r, 1))
        structLayer.batchDraw()
      }
    }

    // ── Mouse down: pan (select mode) | rect drag | circle drag ──
    const onMouseDown = (e) => {
      if (e.target !== stage) return
      const s = sRef.current
      const free = isFreeMode(s.currentMode, s.bedSubTool, s.fenceSubTool, s.fenceType, s.buildingSubTool, s.waterSubTool, s.pathSubTool)

      // Select mode — hand off to canvas pan handler
      if (s.currentMode === 'select' || free) {
        if (s.currentMode === 'select') stage.fire('pan:start')
        return
      }

      const isRectMode =
        (s.currentMode === 'building' && (s.buildingSubTool === 'building' || s.buildingSubTool === 'deck-square')) ||
        (s.currentMode === 'beds'     && s.bedSubTool === 'square') ||
        (s.currentMode === 'water'    && s.waterSubTool === 'pool-sq') ||
        (s.currentMode === 'fences'   && s.fenceSubTool === 'square')
      const isCircleMode = s.currentMode === 'water' && s.waterSubTool === 'pool-circle'

      if (isRectMode) {
        const pos = stage.getRelativePointerPosition()
        drawStartRef.current = pos
        let fillC = '#8B6340', cornerR = 0
        if (s.currentMode === 'building' && s.buildingSubTool === 'building') { fillC = '#90A4AE'; cornerR = 3 }
        else if (s.currentMode === 'building' && s.buildingSubTool === 'deck-square') fillC = DECKING_COLOURS[0]
        else if (s.currentMode === 'water'    && s.waterSubTool === 'pool-sq')        fillC = '#64B5F6'
        else if (s.currentMode === 'fences'   && s.fenceSubTool === 'square')         fillC = HEDGE_COLOURS[0]
        previewRectRef.current = new Konva.Rect({
          x: pos.x, y: pos.y, width: 0, height: 0,
          fill: fillC + 'AA', stroke: '#3A2A10', strokeWidth: 2,
          cornerRadius: cornerR, listening: false, strokeScaleEnabled: false,
        })
        structLayer.add(previewRectRef.current)
      } else if (isCircleMode) {
        waterStartRef.current = stage.getRelativePointerPosition()
        circlePreviewRef.current = new Konva.Circle({
          x: waterStartRef.current.x, y: waterStartRef.current.y,
          radius: 1, fill: '#64B5F6AA', stroke: '#1976D2', strokeWidth: 2,
          listening: false, strokeScaleEnabled: false,
        })
        structLayer.add(circlePreviewRef.current)
      }
    }

    // ── Mouse up: finalise rect / circle ──
    const onMouseUp = () => {
      const s = sRef.current

      // Finalise circle
      if (waterStartRef.current && circlePreviewRef.current) {
        const pos = stage.getRelativePointerPosition()
        const r = Math.hypot(pos.x - waterStartRef.current.x, pos.y - waterStartRef.current.y)
        circlePreviewRef.current.destroy(); circlePreviewRef.current = null
        const cx = waterStartRef.current.x, cy = waterStartRef.current.y
        waterStartRef.current = null
        if (r >= 5) {
          addCircleStruct({
            cx, cy, radius: r,
            structIdCtr: s.structIdCtr, structDataRef: s.structDataRef,
            snapCell: snapCellRef.current, showGrid: s.showGrid,
            structLayer, onSelect: onStructSelect, onModeChange, onEnterEdit,
          })
        }
        return
      }

      // Finalise rect
      if (!drawStartRef.current || !previewRectRef.current) { drawStartRef.current = null; return }
      const pos = stage.getRelativePointerPosition()
      const x = Math.min(drawStartRef.current.x, pos.x)
      const y = Math.min(drawStartRef.current.y, pos.y)
      const w = Math.abs(pos.x - drawStartRef.current.x)
      const h = Math.abs(pos.y - drawStartRef.current.y)
      previewRectRef.current.destroy(); previewRectRef.current = null; drawStartRef.current = null
      if (w < 8 || h < 8) { structLayer.batchDraw(); return }

      let type = 'bed-square'
      if (s.currentMode === 'building' && s.buildingSubTool === 'deck-square') type = 'deck'
      else if (s.currentMode === 'building') type = 'building'
      else if (s.currentMode === 'water'    && s.waterSubTool === 'pool-sq')   type = 'pool-sq'
      else if (s.currentMode === 'fences'   && s.fenceSubTool === 'square')    type = 'hedge-sq'

      const rectId = addRectStruct({
        type, x, y, w, h,
        structIdCtr: s.structIdCtr, structDataRef: s.structDataRef,
        groupIdCtr: s.groupIdCtr,
        snapCell: snapCellRef.current, showGrid: s.showGrid,
        structLayer, onSelect: onStructSelect, onModeChange, onEnterEdit,
      })
      if (rectId && onPushUndo) {
        onPushUndo(() => {
          const sh = structLayer.findOne('#' + rectId)
          if (sh) { sh.destroy(); delete s.structDataRef.current[rectId]; structLayer.batchDraw() }
        })
      }
    }

    // ── Click: freeform point placement + fountain ──
    const onClick = (e) => {
      const s = sRef.current

      // Add-point mode: insert point on nearest segment, rebuild handles
      if (s.editingShapeId && s.addingPt) {
        const pos = stage.getRelativePointerPosition()
        const shape = structLayer.findOne('#' + s.editingShapeId)
        if (shape && shape instanceof Konva.Line) {
          // inline insertPointNearestSegment to avoid circular dep
          const flat = shape.points()
          const n = flat.length / 2
          let bestIdx = 0, bestDist = Infinity
          for (let i = 0; i < n - 1; i++) {
            const ax = flat[i*2], ay = flat[i*2+1], bx = flat[(i+1)*2], by = flat[(i+1)*2+1]
            const dx = bx-ax, dy = by-ay, len2 = dx*dx+dy*dy
            const t = len2 ? Math.max(0,Math.min(1,((pos.x-ax)*dx+(pos.y-ay)*dy)/len2)) : 0
            const d = Math.hypot(pos.x-(ax+t*dx), pos.y-(ay+t*dy))
            if (d < bestDist) { bestDist = d; bestIdx = i }
          }
          if (shape.closed()) {
            const ax = flat[(n-1)*2], ay = flat[(n-1)*2+1]
            const d = Math.hypot(pos.x-ax, pos.y-ay)
            if (d < bestDist) bestIdx = n - 1
          }
          shape.points([...flat.slice(0,(bestIdx+1)*2), pos.x, pos.y, ...flat.slice((bestIdx+1)*2)])
          structLayer.batchDraw()
          // Signal GardenEditor to rebuild handles and turn off addingPt
          if (onAddPointDone) onAddPointDone(s.editingShapeId)
        }
        return
      }

      if (e.target !== stage) return

      // Fountain — click to place
      if (s.currentMode === 'water' && s.waterSubTool === 'fountain') {
        const pos = stage.getRelativePointerPosition()
        const sx = s.showGrid && snapCellRef.current ? Math.round(pos.x / snapCellRef.current) * snapCellRef.current : pos.x
        const sy = s.showGrid && snapCellRef.current ? Math.round(pos.y / snapCellRef.current) * snapCellRef.current : pos.y
        const circId = addCircleStruct({
          cx: sx, cy: sy, radius: 30,
          structIdCtr: s.structIdCtr, structDataRef: s.structDataRef,
          snapCell: snapCellRef.current, showGrid: s.showGrid,
          structLayer, onSelect: onStructSelect, onModeChange, onEnterEdit,
        })
        if (circId && onPushUndo) {
          onPushUndo(() => {
            const sh = structLayer.findOne('#' + circId)
            if (sh) { sh.destroy(); delete s.structDataRef.current[circId]; structLayer.batchDraw() }
          })
        }
        return
      }

      const free = isFreeMode(s.currentMode, s.bedSubTool, s.fenceSubTool, s.fenceType, s.buildingSubTool, s.waterSubTool, s.pathSubTool)
      if (!free) return
      const pos = stage.getRelativePointerPosition()
      handleFreeClick(pos)
    }

    // ── Double-click: close freeform ──
    const onDblClick = (e) => {
      const s = sRef.current
      const free = isFreeMode(s.currentMode, s.bedSubTool, s.fenceSubTool, s.fenceType, s.buildingSubTool, s.waterSubTool, s.pathSubTool)
      if (free && freePtsRef.current.length >= 2) { doClose(); return }
    }

    // ── Keyboard: Enter to close, Escape to cancel ──
    const onKeyDown = (e) => {
      const tag = document.activeElement?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return
      const s = sRef.current
      const free = isFreeMode(s.currentMode, s.bedSubTool, s.fenceSubTool, s.fenceType, s.buildingSubTool, s.waterSubTool, s.pathSubTool)
      if (e.key === 'Enter' && free && freePtsRef.current.length >= 2) {
        e.preventDefault(); doClose()
      }
      if (e.key === 'Escape') {
        cancelFree(uiLayer)
        if (onModeChange) onModeChange('select')
      }
    }

    // ── Dblclick: enter edit mode on any struct shape ──
    const onStageDblClick = (e) => {
      const s = sRef.current
      const free = isFreeMode(s.currentMode, s.bedSubTool, s.fenceSubTool, s.fenceType, s.buildingSubTool, s.waterSubTool, s.pathSubTool)
      if (free && freePtsRef.current.length >= 2) { doClose(); return }
      if (e.target !== stage && !free && !s.editingShapeId) {
        const id = e.target.id?.() || e.target.parent?.id?.()
        if (id && s.structDataRef.current[id] && onEnterEdit) onEnterEdit(id)
      }
    }

    stage.on('mousemove', onMouseMove)
    stage.on('mousedown', onMouseDown)
    stage.on('mouseup',   onMouseUp)
    stage.on('click',     onClick)
    stage.on('dblclick',  onDblClick)
    stage.on('dblclick dbltap', onStageDblClick)
    window.addEventListener('keydown', onKeyDown)

    return () => {
      stage.off('mousemove', onMouseMove)
      stage.off('mousedown', onMouseDown)
      stage.off('mouseup',   onMouseUp)
      stage.off('click',     onClick)
      stage.off('dblclick',  onDblClick)
      stage.off('dblclick dbltap', onStageDblClick)
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [stage, layers]) // re-register only if stage or layers change

  return { cancelFree: () => cancelFree(layers?.uiLayer) }
}
