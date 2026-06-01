// useSelection.js — Selection, transformer, edit mode, delete, copy/paste
import { useEffect, useRef } from 'react'
import Konva from 'konva'
import { isFreeMode } from '../utils/drawUtils'

export function useSelection({
  stage, layers, state,
  onSelectPlant, onSelectStruct, onClearSelection,
  onEditMode, onExitEditMode,
}) {
  const sRef = useRef(state)
  useEffect(() => { sRef.current = state }, [state])

  const editHandlesRef  = useRef([])
  const addingPtRef     = useRef(state.addingPt ?? false)
  const removingPtRef   = useRef(state.removingPt ?? false)
  useEffect(() => { addingPtRef.current   = state.addingPt   ?? false }, [state.addingPt])
  useEffect(() => { removingPtRef.current = state.removingPt ?? false }, [state.removingPt])

  // ── Transformer: attach to selected rect ──────────────────
  useEffect(() => {
    if (!layers?.tr) return
    const { tr, structLayer } = layers
    const sel = state.selectedStruct
    if (sel && (sel.shape instanceof Konva.Rect || sel.shape instanceof Konva.Group)) {
      tr.keepRatio(false)
      tr.nodes([sel.shape])
    } else if (sel && sel.shape instanceof Konva.Circle) {
      tr.keepRatio(true)  // keep circular — equal width/height
      tr.nodes([sel.shape])
    } else {
      tr.nodes([])
    }
    layers.uiLayer?.batchDraw()
  }, [state.selectedStruct, layers])

  // ── Plant transformer ─────────────────────────────────────
  useEffect(() => {
    if (!layers?.tr) return
    if (state.selectedPlant) {
      layers.tr.keepRatio(true)
      layers.tr.nodes([state.selectedPlant.group])
    } else if (!state.selectedStruct) {
      layers.tr.nodes([])
    }
    layers.uiLayer?.batchDraw()
  }, [state.selectedPlant, layers])

  // ── Edit mode: draggable point handles ────────────────────
  function buildEditHandles(id, shape) {
    exitHandles()
    if (!stage || !layers) return
    const { uiLayer, structLayer } = layers
    const pts = getShapeWorldPts(shape)
    const removing = removingPtRef.current
    pts.forEach((_, i) => {
      const h = makeHandle(id, shape, i, uiLayer, structLayer)
      if (removing) {
        h.fill('#c62828')   // red = remove mode
        h.draggable(false)
      }
      uiLayer.add(h)
      editHandlesRef.current.push(h)
    })
    shape.off('dragmove.edithandles')
    shape.on('dragmove.edithandles', () => {
      const pts2 = getShapeWorldPts(shape)
      editHandlesRef.current.forEach((h, i) => {
        if (pts2[i]) { h.x(pts2[i].x); h.y(pts2[i].y) }
      })
      uiLayer.batchDraw()
    })
    uiLayer.batchDraw()
  }

  function makeHandle(id, shape, ptIdx, uiLayer, structLayer) {
    const pts = getShapeWorldPts(shape)
    const p   = pts[ptIdx]
    const h   = new Konva.Circle({
      x: p.x, y: p.y,
      radius: 7 / stage.scaleX(),
      fill: '#558B2F', stroke: '#fff', strokeWidth: 2 / stage.scaleX(),
      draggable: true,
    })
    h.on('dragmove', () => {
      if (removingPtRef.current) return  // don't drag when in remove mode
      // h.x/y are world coords; convert to local (shape-relative) for Line shapes
      const cur = getShapeLocalPts(shape)
      const lx  = shape instanceof Konva.Line ? shape.x() : 0
      const ly  = shape instanceof Konva.Line ? shape.y() : 0
      cur[ptIdx] = { x: h.x() - lx, y: h.y() - ly }
      setShapePts(shape, cur)
      structLayer.batchDraw()
    })
    h.on('click tap', () => {
      if (!removingPtRef.current) return
      // Remove this point — guard minimum
      if (!(shape instanceof Konva.Line)) return
      const flat = shape.points()
      const minPts = shape.closed() ? 3 : 2
      if (flat.length / 2 <= minPts) return  // won't remove below minimum
      const newFlat = [...flat.slice(0, ptIdx * 2), ...flat.slice(ptIdx * 2 + 2)]
      shape.points(newFlat)
      structLayer.batchDraw()
      buildEditHandles(id, shape)  // rebuild with updated points
      sRef.current.setRemovingPt?.(false)
    })
    return h
  }

  function exitHandles() {
    editHandlesRef.current.forEach(h => h.destroy())
    editHandlesRef.current = []
  }

  // ── Expose enter/exit edit mode ───────────────────────────
  function enterEdit(id) {
    if (!layers?.structLayer) return
    const shape = layers.structLayer.findOne('#' + id)
    if (!shape) return
    // Rect and Circle shapes have no editable points — block edit mode entirely
    if (shape instanceof Konva.Rect || shape instanceof Konva.Circle) return
    if (onExitEditMode) onExitEditMode() // clear any prior edit
    buildEditHandles(id, shape)
    if (onEditMode) onEditMode(id)
  }

  function exitEdit() {
    const id = sRef.current.editingShapeId
    if (id && layers?.structLayer) {
      const sh = layers.structLayer.findOne('#' + id)
      if (sh) sh.off('dragmove.edithandles')
    }
    exitHandles()
    addingPtRef.current = false
    if (layers?.uiLayer) layers.uiLayer.batchDraw()
    if (onExitEditMode) onExitEditMode()
  }

  // ── Delete selected ───────────────────────────────────────
  function deleteSelected() {
    const s = sRef.current
    if (s.selectedPlant) {
      s.selectedPlant.group.destroy()
      delete s.plantDataRef.current[s.selectedPlant.id]
      layers?.plantLayer?.batchDraw()
      onClearSelection()
    } else if (s.selectedStruct) {
      s.selectedStruct.shape.destroy()
      delete s.structDataRef.current[s.selectedStruct.id]
      layers?.structLayer?.batchDraw()
      onClearSelection()
    } else if (s.multiSelection?.length > 0) {
      s.multiSelection.forEach(({ kind, id, shape }) => {
        shape.destroy()
        if (kind === 'plant') delete s.plantDataRef.current[id]
        else delete s.structDataRef.current[id]
      })
      layers?.plantLayer?.batchDraw()
      layers?.structLayer?.batchDraw()
      onClearSelection()
    }
  }

  // ── Delete key handler ────────────────────────────────────
  useEffect(() => {
    const onKey = (e) => {
      const tag = document.activeElement?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return
      if (e.key === 'Delete' || e.key === 'Backspace') deleteSelected()
      if (e.key === 'Escape') {
        if (sRef.current.editingShapeId) exitEdit()
        else onClearSelection()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [stage, layers])

  return { enterEdit, exitEdit, deleteSelected, addingPtRef, buildEditHandles }
}

// ── Shape point helpers (shared with edit mode) ───────────

// Returns points in local (shape-relative) coords — used for writing back to shape
export function getShapeLocalPts(shape) {
  if (shape instanceof Konva.Rect) {
    const x=shape.x(), y=shape.y(), w=shape.width(), h=shape.height()
    return [{ x, y }, { x: x+w, y }, { x: x+w, y: y+h }, { x, y: y+h }]
  }
  if (shape instanceof Konva.Circle) return [{ x: shape.x(), y: shape.y() }]
  if (shape instanceof Konva.Group)  return [{ x: shape.x(), y: shape.y() }]
  const flat = shape.points?.() || []
  const pts  = []
  for (let i = 0; i < flat.length; i += 2) pts.push({ x: flat[i], y: flat[i+1] })
  return pts
}

// Returns points in world (stage) coords — used for placing handles
export function getShapeWorldPts(shape) {
  const local = getShapeLocalPts(shape)
  // Konva.Line stores points relative to shape.x/y — offset to world coords
  if (shape instanceof Konva.Line) {
    const ox = shape.x(), oy = shape.y()
    return local.map(p => ({ x: p.x + ox, y: p.y + oy }))
  }
  return local  // Rect/Circle/Group already use world coords
}

export function getShapePts(shape) {
  if (shape instanceof Konva.Rect) {
    const x=shape.x(), y=shape.y(), w=shape.width(), h=shape.height()
    return [{ x, y }, { x: x+w, y }, { x: x+w, y: y+h }, { x, y: y+h }]
  }
  if (shape instanceof Konva.Circle) return [{ x: shape.x(), y: shape.y() }]
  if (shape instanceof Konva.Group)  return [{ x: shape.x(), y: shape.y() }]
  const flat = shape.points?.() || []
  const pts  = []
  for (let i = 0; i < flat.length; i += 2) pts.push({ x: flat[i], y: flat[i+1] })
  return pts
}

export function setShapePts(shape, pts) {
  if (shape instanceof Konva.Rect) {
    const xs = pts.map(p => p.x), ys = pts.map(p => p.y)
    const nx = Math.min(...xs), ny = Math.min(...ys)
    shape.x(nx); shape.y(ny)
    shape.width(Math.max(...xs) - nx); shape.height(Math.max(...ys) - ny)
    return
  }
  if (shape instanceof Konva.Line) shape.points(pts.flatMap(p => [p.x, p.y]))
  if (shape instanceof Konva.Circle && pts[0]) { shape.x(pts[0].x); shape.y(pts[0].y) }
}

export function insertPointNearestSegment(shape, pos) {
  const flat = shape.points()
  const n    = flat.length / 2
  let bestIdx = 0, bestDist = Infinity
  const ptSeg = (p, a, b) => {
    const dx = b.x-a.x, dy = b.y-a.y, len2 = dx*dx+dy*dy
    if (!len2) return Math.hypot(p.x-a.x, p.y-a.y)
    const t = Math.max(0, Math.min(1, ((p.x-a.x)*dx + (p.y-a.y)*dy) / len2))
    return Math.hypot(p.x-(a.x+t*dx), p.y-(a.y+t*dy))
  }
  for (let i = 0; i < n-1; i++) {
    const d = ptSeg(pos, {x:flat[i*2],y:flat[i*2+1]}, {x:flat[(i+1)*2],y:flat[(i+1)*2+1]})
    if (d < bestDist) { bestDist = d; bestIdx = i }
  }
  if (shape.closed()) {
    const d = ptSeg(pos, {x:flat[(n-1)*2],y:flat[(n-1)*2+1]}, {x:flat[0],y:flat[1]})
    if (d < bestDist) bestIdx = n - 1
  }
  shape.points([...flat.slice(0,(bestIdx+1)*2), pos.x, pos.y, ...flat.slice((bestIdx+1)*2)])
}
