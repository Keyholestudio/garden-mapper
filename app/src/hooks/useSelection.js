// useSelection.js — Selection, transformer, edit mode, delete, copy/paste
import { useEffect, useRef } from 'react'
import Konva from 'konva'
import { isFreeMode } from '../utils/drawUtils'
import { addStonesToGroup } from '../utils/rockBorderUtils'

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
    const structLocked = sel && state.structDataRef?.current[sel.id]?.locked
    const isRockBorder = sel && state.structDataRef?.current[sel.id]?.type === 'rock-border'
    if (sel && !structLocked && !isRockBorder && (sel.shape instanceof Konva.Rect || sel.shape instanceof Konva.Group)) {
      tr.keepRatio(false)
      tr.enabledAnchors(['top-left','top-center','top-right','middle-left','middle-right','bottom-left','bottom-center','bottom-right'])
      tr.nodes([sel.shape])
    } else if (sel && !structLocked && sel.shape instanceof Konva.Circle) {
      tr.keepRatio(true)
      tr.enabledAnchors(['top-left','top-right','bottom-left','bottom-right'])
      tr.nodes([sel.shape])
    } else {
      tr.nodes([])
    }
    layers.uiLayer?.batchDraw()
  }, [state.selectedStruct, layers])

  // ── Plant transformer ─────────────────────────────────────
  useEffect(() => {
    if (!layers?.tr) return
    const plantLocked = state.selectedPlant && state.plantDataRef?.current[state.selectedPlant.id]?.locked
    if (state.selectedPlant && !plantLocked) {
      layers.tr.keepRatio(true)
      // Corners only — no edge anchors (prevents stretching/squishing)
      layers.tr.enabledAnchors(['top-left', 'top-right', 'bottom-left', 'bottom-right'])
      // No-flip guard: reject any resize that would invert or shrink below minimum
      layers.tr.boundBoxFunc((oldBox, newBox) => {
        if (newBox.width < 5 || newBox.height < 5) return oldBox
        // Prevent flip: reject if width or height sign would change (negative = mirrored)
        if (newBox.width <= 0 || newBox.height <= 0) return oldBox
        return newBox
      })
      layers.tr.nodes([state.selectedPlant.group])
    } else if (!state.selectedStruct) {
      layers.tr.boundBoxFunc(null)  // clear for structs
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
        // Keep draggable:true on mobile so tap fires reliably;
        // dragmove is ignored via removingPtRef check inside makeHandle
      }
      uiLayer.add(h)
      editHandlesRef.current.push(h)
    })
    shape.off('dragmove.edithandles')
    // For rock border: the draggable parent is the Group, not the Line
    // Wire handle-position sync to whichever node actually moves
    const dragTarget = (shape instanceof Konva.Line && shape.parent instanceof Konva.Group)
      ? shape.parent : shape
    dragTarget.off('dragmove.edithandles')
    dragTarget.on('dragmove.edithandles', () => {
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
      editId: id,  // used by rock border dragend to shift handles when border is moved
    })
    h.on('dragmove', () => {
      if (removingPtRef.current) return  // don't drag when in remove mode
      // h.x/y are world coords; convert to local (shape-relative) for Line shapes
      // Group is always at (0,0) so lx/ly = 0 for rock border hit lines
      const cur = getShapeLocalPts(shape)
      const lx  = shape instanceof Konva.Line ? shape.x() + (shape.parent instanceof Konva.Group ? shape.parent.x() : 0) : 0
      const ly  = shape instanceof Konva.Line ? shape.y() + (shape.parent instanceof Konva.Group ? shape.parent.y() : 0) : 0
      cur[ptIdx] = { x: h.x() - lx, y: h.y() - ly }
      setShapePts(shape, cur)
      // Rock border: immediately refresh stones so they follow the moved point
      if (shape instanceof Konva.Line && shape.parent instanceof Konva.Group) {
        const grp = shape.parent
        const d   = sRef.current.structDataRef?.current[id]
        addStonesToGroup(grp, shape.points(), shape.tension(), d?.rockVariant, id, Konva)
      }
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
      // Rock border: refresh stones after point removal
      if (shape.parent instanceof Konva.Group) {
        const d = sRef.current.structDataRef?.current[id]
        addStonesToGroup(shape.parent, newFlat, shape.tension(), d?.rockVariant, id, Konva)
      }
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
    // Locked shapes cannot be edited
    if (sRef.current.structDataRef?.current[id]?.locked) return
    if (onExitEditMode) onExitEditMode() // clear any prior edit

    // Rock border: edit the inner hit line, refresh stones after each handle move
    if (sRef.current.structDataRef?.current[id]?.type === 'rock-border' && shape instanceof Konva.Group) {
      const hitLine = shape.getChildren(c => c instanceof Konva.Line)[0]
      if (!hitLine) return

      // Disable Group drag while editing points and remove the dragmove.edithandles
      // listener — handles ARE the point positions, no re-sync needed during edit
      shape.draggable(false)
      shape.off('dragmove.edithandles')
      // Disable listening on hitLine and stones during edit so touches can't
      // accidentally move the group — only handle drags should work in edit mode
      hitLine.listening(false)
      shape.getChildren(c => c instanceof Konva.Image).forEach(s => s.listening(false))
      buildEditHandles(id, hitLine)
      // Stone refresh is handled inside makeHandle's dragmove for rock borders
      if (onEditMode) onEditMode(id)
      return
    }

    buildEditHandles(id, shape)
    if (onEditMode) onEditMode(id)
  }

  function exitEdit() {
    const id = sRef.current.editingShapeId
    if (id && layers?.structLayer) {
      const sh = layers.structLayer.findOne('#' + id)
      if (sh) {
        sh.off('dragmove.edithandles')
        // Rock border Group: clean up listener + re-enable drag + restore hitLine listening
        if (sh instanceof Konva.Group) {
          sh.off('dragmove.edithandles')
          if (!sRef.current.structDataRef?.current[id]?.locked) sh.draggable(true)
          // Restore listening on hitLine and stones
          const hl = sh.getChildren(c => c instanceof Konva.Line)[0]
          if (hl) hl.listening(true)
          sh.getChildren(c => c instanceof Konva.Image).forEach(s => s.listening(true))
        }
        // Rock border: clean Group listener when editing inner line
        if (sh instanceof Konva.Line && sh.parent instanceof Konva.Group) {
          sh.parent.off('dragmove.edithandles')
          if (!sRef.current.structDataRef?.current[id]?.locked) sh.parent.draggable(true)
        }
      }
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
  if (shape instanceof Konva.Line) {
    // Add shape offset + any parent Group offset (rock border hit line lives inside a Group)
    const ox = shape.x() + (shape.parent instanceof Konva.Group ? shape.parent.x() : 0)
    const oy = shape.y() + (shape.parent instanceof Konva.Group ? shape.parent.y() : 0)
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
