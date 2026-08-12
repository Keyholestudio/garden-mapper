// useDrawTools.js — Wires all draw-mode stage events to Konva
// Called once after stage is ready; registers/unregisters event handlers reactively

import { useEffect, useRef } from 'react'
import Konva from 'konva'
import {
  isFreeMode, snapToBoundary, closeFreeShape,
  addRectStruct, addCircleStruct, getBoundaryClosure, getShapeStyle,
} from '../utils/drawUtils'
import { PATH_COLOURS, WATER_COLOURS, HEDGE_COLOURS, DECKING_COLOURS } from './useGardenState'
import { addStonesToGroup } from '../utils/rockBorderUtils'

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
  const lastFreeClickRef = useRef(0) // timestamp of last freeform point — debounce double-tap

  // ── Hint bar (floating hint over canvas) ──────────────────
  function updateHint(pts, currentMode, buildingSubTool, pathSubTool) {
    const n = pts.length
    const isPath = currentMode === 'paths'
    const isUnderground = (currentMode === 'building' && buildingSubTool === 'underground') || (currentMode === 'water' && s?.waterSubTool === 'underground-plumbing')
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
    lastFreeClickRef.current = 0  // reset debounce so next shape can start immediately
    hideHint()
    if (uiLayer) uiLayer.batchDraw()
  }

  // ── Handle freeform click ─────────────────────────────────
  function handleFreeClick(pos, uiLayerArg) {
    // Debounce: ignore taps within 350ms of the previous point (prevents accidental double-tap on mobile)
    const now = Date.now()
    if (now - lastFreeClickRef.current < 350) return
    lastFreeClickRef.current = now

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
    const isOpenLine = s.currentMode === 'paths' || s.fenceType === 'fence' || s.fenceType === 'rock-border'
    if (freePts.length >= 3 && !isOpenLine) {
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

    // ── Minimum point guards (#33) ──
    const pts = freePtsRef.current
    const isPath = s.currentMode === 'paths'
    const isUG   = (s.currentMode === 'building' && (s.buildingSubTool === 'underground-electrical' || s.buildingSubTool === 'underground-plumbing')) ||
                   (s.currentMode === 'water' && s.waterSubTool === 'underground-plumbing')
    const isFenceOrGate = s.currentMode === 'fences' && (s.fenceType === 'fence' || s.fenceType === 'gate' || s.fenceType === 'rock-border')
    const minPts = (isPath || isUG || isFenceOrGate) ? 2 : 3
    if (pts.length < minPts) {
      // Not enough points — show hint but don't close
      updateHint(pts, s.currentMode, s.buildingSubTool, s.pathSubTool)
      return
    }

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

    // Reset add/remove-point mode so handles don't appear red after shape creation (#33)
    s.setAddingPt?.(false)
    s.setRemovingPt?.(false)

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
        const isFences     = s.currentMode === 'fences'
        const isRockBorder = s.currentMode === 'fences' && s.fenceType === 'rock-border'
        const isPath   = s.currentMode === 'paths'
        const isGate   = s.currentMode === 'paths' && s.pathSubTool === 'gate'
        const isWater  = s.currentMode === 'water'
        const isBldg   = s.currentMode === 'building'
        const strokeC  = isRockBorder ? '#9E9E9E' : isFences ? '#4CAF50' : isPath ? '#D7CCC8' : isWater ? '#1976D2' : isBldg ? DECKING_COLOURS[0] : '#558B2F'
        const previewTension =
          (s.currentMode === 'beds'     && s.bedSubTool === 'straight') ||
          (s.currentMode === 'fences'   && s.fenceSubTool === 'straight') ||
          (s.currentMode === 'fences'   && s.fenceType === 'fence') ||
          (s.currentMode === 'fences'   && s.fenceSubTool === 'rock-border-straight') ||
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
      const s = sRef.current

      // Pan mode — always pan regardless of what's under the cursor
      if (s.panMode) {
        stage.fire('pan:start')
        return
      }

      if (e.target !== stage) return
      const free = isFreeMode(s.currentMode, s.bedSubTool, s.fenceSubTool, s.fenceType, s.buildingSubTool, s.waterSubTool, s.pathSubTool)

      // Select mode — hand off to canvas pan handler
      if (s.currentMode === 'select' || free) {
        if (s.currentMode === 'select') stage.fire('pan:start')
        return
      }

      const isRectMode =
        (s.currentMode === 'building' && s.buildingSubTool && (s.buildingSubTool === 'building' || s.buildingSubTool === 'deck-square')) ||
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
        let shape = structLayer.findOne('#' + s.editingShapeId)
        // Rock border: editingShapeId points to the Group — resolve to inner hit line
        const isRockBorderGroup = shape instanceof Konva.Group && s.structDataRef?.current[s.editingShapeId]?.type === 'rock-border'
        const rockGroup = isRockBorderGroup ? shape : null
        if (isRockBorderGroup) shape = shape.getChildren(c => c instanceof Konva.Line)[0]
        if (shape && shape instanceof Konva.Line) {
          // pointToSegmentDist — mirrors v8 exactly
          const ptSeg = (p, a, b) => {
            const dx = b.x-a.x, dy = b.y-a.y, len2 = dx*dx+dy*dy
            if (!len2) return Math.hypot(p.x-a.x, p.y-a.y)
            const t = Math.max(0, Math.min(1, ((p.x-a.x)*dx + (p.y-a.y)*dy) / len2))
            return Math.hypot(p.x-(a.x+t*dx), p.y-(a.y+t*dy))
          }
          // For rock border: click pos is in world space, line points are in group-local space
          const localPos = rockGroup
            ? { x: pos.x - rockGroup.x(), y: pos.y - rockGroup.y() }
            : pos
          const flat = shape.points()
          const n = flat.length / 2
          let bestIdx = 0, bestDist = Infinity
          for (let i = 0; i < n - 1; i++) {
            const d = ptSeg(localPos,
              { x: flat[i*2],     y: flat[i*2+1]     },
              { x: flat[(i+1)*2], y: flat[(i+1)*2+1] })
            if (d < bestDist) { bestDist = d; bestIdx = i }
          }
          if (shape.closed()) {
            const d = ptSeg(localPos,
              { x: flat[(n-1)*2], y: flat[(n-1)*2+1] },
              { x: flat[0],       y: flat[1]          })
            if (d < bestDist) { bestDist = d; bestIdx = n - 1 }
          }
          shape.points([...flat.slice(0,(bestIdx+1)*2), localPos.x, localPos.y, ...flat.slice((bestIdx+1)*2)])
          // Rock border: refresh stones after point insertion
          if (rockGroup) {
            const d = s.structDataRef?.current[s.editingShapeId]
            addStonesToGroup(rockGroup, shape.points(), shape.tension(), d?.rockVariant, s.editingShapeId, Konva)
          }
          structLayer.batchDraw()
          if (onAddPointDone) onAddPointDone(s.editingShapeId)
        }
        return
      }

      // Freeform in progress: place point regardless of what was clicked (plant/struct beneath is irrelevant)
      const freeActive = isFreeMode(s.currentMode, s.bedSubTool, s.fenceSubTool, s.fenceType, s.buildingSubTool, s.waterSubTool, s.pathSubTool)
      if (freeActive) {
        const pos = stage.getRelativePointerPosition()
        handleFreeClick(pos)
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
        // Skip rect/circle types — they have no editable points
        const noEdit = e.target instanceof Konva.Rect || e.target instanceof Konva.Circle
        if (id && s.structDataRef.current[id] && onEnterEdit && !noEdit) onEnterEdit(id)
      }
    }

    // ── Touch: press-drag for square rect/circle draw modes ──────────────
    // Mirrors mousedown/mousemove/mouseup but uses Konva touch events.
    // Only fires in rect/circle draw modes — pinch/pan is handled in GardenCanvas.
    let touchDrawActive = false
    let touchStartPos   = null

    const isSquareDrawMode = (s) =>
      (s.currentMode === 'building' && s.buildingSubTool && (s.buildingSubTool === 'building' || s.buildingSubTool === 'deck-square')) ||
      (s.currentMode === 'beds'     && s.bedSubTool === 'square') ||
      (s.currentMode === 'water'    && s.waterSubTool === 'pool-sq') ||
      (s.currentMode === 'fences'   && s.fenceSubTool === 'square')

    const isCircleDrawMode = (s) => s.currentMode === 'water' && s.waterSubTool === 'pool-circle'

    const onTouchStartDraw = (e) => {
      const s = sRef.current
      if (e.evt.touches.length !== 1) return  // only single-finger draw
      if (!isSquareDrawMode(s) && !isCircleDrawMode(s)) return
      e.evt.preventDefault()
      touchDrawActive = true
      touchStartPos = stage.getRelativePointerPosition()
      // Reuse mousedown logic by firing it synthetically
      onMouseDown({ target: stage, evt: e.evt })
    }

    const onTouchMoveDraw = (e) => {
      if (!touchDrawActive) return
      e.evt.preventDefault()
      onMouseMove()
    }

    const onTouchEndDraw = (e) => {
      if (!touchDrawActive) return
      touchDrawActive = false
      const s = sRef.current

      // If drag was tiny (< 12px screen) → treat as tap-to-place default size
      const endPos = stage.getRelativePointerPosition()
      const scale  = stage.scaleX()
      const screenDist = endPos
        ? Math.hypot((endPos.x - (touchStartPos?.x || 0)) * scale,
                     (endPos.y - (touchStartPos?.y || 0)) * scale)
        : 0

      if (screenDist < 12 && touchStartPos) {
        // Cancel the preview that mousedown started
        if (previewRectRef.current) { previewRectRef.current.destroy(); previewRectRef.current = null }
        if (circlePreviewRef.current) { circlePreviewRef.current.destroy(); circlePreviewRef.current = null }
        drawStartRef.current = null
        waterStartRef.current = null

        // Place a default-size shape at tap point
        const pos = touchStartPos
        const snap = snapCellRef.current
        const sx = (s.showGrid && snap) ? Math.round(pos.x / snap) * snap : pos.x
        const sy = (s.showGrid && snap) ? Math.round(pos.y / snap) * snap : pos.y

        // Default size: 15ft × 15ft (or 5m × 5m)
        const pxPerFt = 32
        const pxPerM  = 32 * 3.281
        const defaultPx = s.gardenUnit === 'm' ? 5 * pxPerM : 15 * pxPerFt

        if (isCircleDrawMode(s)) {
          const circId = addCircleStruct({
            cx: sx, cy: sy, radius: defaultPx / 2,
            structIdCtr: s.structIdCtr, structDataRef: s.structDataRef,
            snapCell: snap, showGrid: s.showGrid,
            structLayer, onSelect: onStructSelect, onModeChange, onEnterEdit,
          })
          if (circId && onPushUndo) {
            onPushUndo(() => {
              const sh = structLayer.findOne('#' + circId)
              if (sh) { sh.destroy(); delete s.structDataRef.current[circId]; structLayer.batchDraw() }
            })
          }
        } else {
          let type = 'bed-square'
          if (s.currentMode === 'building' && s.buildingSubTool === 'deck-square') type = 'deck'
          else if (s.currentMode === 'building') type = 'building'
          else if (s.currentMode === 'water'  && s.waterSubTool === 'pool-sq')  type = 'pool-sq'
          else if (s.currentMode === 'fences' && s.fenceSubTool === 'square')   type = 'hedge-sq'

          const rectId = addRectStruct({
            type,
            x: sx - defaultPx / 2, y: sy - defaultPx / 2,
            w: defaultPx, h: defaultPx,
            structIdCtr: s.structIdCtr, structDataRef: s.structDataRef,
            groupIdCtr: s.groupIdCtr,
            snapCell: snap, showGrid: s.showGrid,
            structLayer, onSelect: onStructSelect, onModeChange, onEnterEdit,
          })
          if (rectId && onPushUndo) {
            onPushUndo(() => {
              const sh = structLayer.findOne('#' + rectId)
              if (sh) { sh.destroy(); delete s.structDataRef.current[rectId]; structLayer.batchDraw() }
            })
          }
        }
        structLayer.batchDraw()
      } else {
        // Real drag — finalise via normal mouseup logic
        onMouseUp()
      }
      touchStartPos = null
    }

    stage.on('mousemove', onMouseMove)
    stage.on('mousedown', onMouseDown)
    stage.on('mouseup',   onMouseUp)
    stage.on('click tap', onClick)   // tap = mobile touch; both needed for add-point mode
    stage.on('dblclick',  onDblClick)
    stage.on('dblclick dbltap', onStageDblClick)
    stage.on('touchstart', onTouchStartDraw)
    stage.on('touchmove',  onTouchMoveDraw)
    stage.on('touchend',   onTouchEndDraw)
    window.addEventListener('keydown', onKeyDown)

    return () => {
      stage.off('mousemove', onMouseMove)
      stage.off('mousedown', onMouseDown)
      stage.off('mouseup',   onMouseUp)
      stage.off('click tap', onClick)
      stage.off('dblclick',  onDblClick)
      stage.off('dblclick dbltap', onStageDblClick)
      stage.off('touchstart', onTouchStartDraw)
      stage.off('touchmove',  onTouchMoveDraw)
      stage.off('touchend',   onTouchEndDraw)
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [stage, layers]) // re-register only if stage or layers change

  return { cancelFree: () => cancelFree(layers?.uiLayer) }
}
