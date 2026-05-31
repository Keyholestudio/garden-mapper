// GardenEditor.jsx — Top-level layout shell
// Phase 5: save/load localStorage, garden switcher

import { useRef, useState, useEffect } from 'react'
import Konva from 'konva'
import { useGardenState }  from '../hooks/useGardenState'
import { useDrawTools }    from '../hooks/useDrawTools'
import { useSelection }    from '../hooks/useSelection'
import { PLANT_CATALOG }   from '../hooks/usePlantCatalog'
import { addPlant }        from '../utils/plantUtils'
import { insertPointNearestSegment } from '../hooks/useSelection'
import { saveGarden, loadGarden, createNewGarden, readGardens } from '../hooks/useSaveLoad'
import { addRectStruct } from '../utils/drawUtils'
import LogoBar        from './LogoBar'
import BottomBar      from './BottomBar'
import PlantTray      from './PlantTray'
import GardenCanvas  from './GardenCanvas'
import RightPanel    from './RightPanel'
import SetupOverlay  from './SetupOverlay'
import GardenSwitcher from './GardenSwitcher'
import PromoBanner from './PromoBanner'
import './GardenEditor.css'

export default function GardenEditor() {
  const state = useGardenState()
  const stageRef    = useRef(null)
  const layersRef   = useRef({})
  const showGridRef = useRef(state.showGrid) // always-current ref for snap in dragmove closures
  const [stageReady, setStageReady] = useState(false)
  const [scaleLabel, setScaleLabel] = useState('1 cell = 3 in')

  // Phase 5: save/load state
  const [currentGardenIndex, setCurrentGardenIndex] = useState(0)
  const [switcherOpen, setSwitcherOpen] = useState(false)
  const [saveFlash, setSaveFlash] = useState(false)
  // Ref so save always reads the latest index without stale closures
  const currentGardenIndexRef = useRef(0)

  // ── Image loading ──
  const [loadedImages, setLoadedImages] = useState({})
  useEffect(() => {
    const result = {}
    Promise.all(PLANT_CATALOG.map(p => new Promise(res => {
      const img = new Image()
      img.onload  = () => { result[p.key] = img; res() }
      img.onerror = () => res()
      img.src = p.src
    }))).then(() => setLoadedImages({ ...result }))
  }, [])

  // Keep showGridRef current
  useEffect(() => { showGridRef.current = state.showGrid }, [state.showGrid])

  // ── Season visibility — mirrors v8 updatePlantVisibility() ──
  // Runs whenever season changes. Fades plants not visible in the current season.
  useEffect(() => {
    const { plantLayer } = layersRef.current
    if (!plantLayer || !stageReady) return
    const SEASON_NAMES = ['spring', 'summer', 'fall', 'winter']
    const sN = SEASON_NAMES[state.currentSeason]
    plantLayer.find('Group').forEach(g => {
      const d = state.plantDataRef.current[g.id()]
      if (!d) return
      if (d.transparent) { g.opacity(0.35); return }
      g.opacity(d.seasons?.includes(sN) ? 1 : 0.1)
    })
    plantLayer.batchDraw()
  }, [state.currentSeason, stageReady])

  // ── Multi-select yellow highlight ──
  // Redraws highlight rects on uiLayer whenever multiSelection changes
  const multiHighlightRef = useRef([])
  useEffect(() => {
    const { uiLayer } = layersRef.current
    if (!uiLayer) return
    // Clear old highlights
    multiHighlightRef.current.forEach(r => r.destroy())
    multiHighlightRef.current = []
    if (state.multiSelection?.length > 0) {
      const stage = stageRef.current
      state.multiSelection.forEach(({ shape }) => {
        if (!shape || !stage) return
        // getClientRect() returns coords relative to the canvas container (not screen)
        // Mirrors v8 drawMultiHighlight exactly
        const box = shape.getClientRect()
        const sc  = stage.scaleX()
        const ox  = stage.x(), oy = stage.y()
        const pad = 6
        const wx  = (box.x - ox) / sc - pad / sc
        const wy  = (box.y - oy) / sc - pad / sc
        const ww  = box.width  / sc + (pad * 2) / sc
        const wh  = box.height / sc + (pad * 2) / sc
        const r = new Konva.Rect({
          x: wx, y: wy, width: ww, height: wh,
          stroke: '#FFD600', strokeWidth: 2,
          strokeScaleEnabled: false,
          dash: [8, 4], fill: 'rgba(255,214,0,0.10)',
          listening: false,
        })
        uiLayer.add(r)
        multiHighlightRef.current.push(r)
      })
    }
    uiLayer.batchDraw()
  }, [state.multiSelection, stageReady])

  // ── Clear selection ──
  const clearSelection = () => {
    state.setSelectedPlant(null)
    state.setSelectedStruct(null)
    state.setMultiSelection([])   // triggers highlight useEffect which destroys rects
    state.setEditingShapeId(null)
    state.setAddingPt(false)
  }

  // ── Plant selection handler (shared) — handles Ctrl+click multi-select ──
  const handlePlantSelect = (id, group, evt) => {
    const ne = evt?.evt || evt
    if (ne && (ne.ctrlKey || ne.metaKey || ne.shiftKey)) {
      state.setSelectedPlant(null)
      state.setSelectedStruct(null)
      state.setEditingShapeId(null)
      state.setMultiSelection(prev => {
        const already = prev.findIndex(x => x.id === id)
        if (already >= 0) return prev.filter(x => x.id !== id)
        return [...prev, { kind: 'plant', id, shape: group }]
      })
      return
    }
    state.setMultiSelection([])
    state.setSelectedPlant({ id, group, ...state.plantDataRef.current[id] })
    state.setSelectedStruct(null)
  }

  // ── Selection hook ──
  const { enterEdit, exitEdit, deleteSelected } = useSelection({
    stage:  stageReady ? stageRef.current : null,
    layers: stageReady ? layersRef.current : null,
    state,
    onSelectPlant:    handlePlantSelect,
    onSelectStruct:   (id, shape) => { state.setSelectedStruct({ id, shape, ...state.structDataRef.current[id] }); state.setSelectedPlant(null) },
    onClearSelection: clearSelection,
    onEditMode:       state.setEditingShapeId,
    onExitEditMode:   () => { state.setEditingShapeId(null); state.setAddingPt(false) },
  })

  // ── Draw tools hook ──
  useDrawTools({
    stage:  stageReady ? stageRef.current : null,
    layers: stageReady ? layersRef.current : null,
    propBoundsRef: state.propBoundsRef,
    state,
    onPushUndo: state.pushUndo,
    onEnterEdit: (id) => { enterEdit(id) },
    onAddPointDone: (id) => {
      // Rebuild edit handles after point insertion, turn off addingPt
      enterEdit(id)
      state.setAddingPt(false)
    },
    onStructSelect: (id, shape, evt) => {
      const ne = evt?.evt || evt
      if (ne && (ne.ctrlKey || ne.metaKey || ne.shiftKey)) {
        // Multi-select: add/remove from multiSelection
        state.setSelectedPlant(null)
        state.setSelectedStruct(null)
        state.setEditingShapeId(null)
        state.setMultiSelection(prev => {
          const already = prev.findIndex(x => x.id === id)
          if (already >= 0) return prev.filter(x => x.id !== id)
          return [...prev, { kind: 'struct', id, shape }]
        })
        return
      }
      state.setMultiSelection([])
      state.setSelectedStruct({ id, shape, ...state.structDataRef.current[id] })
      state.setSelectedPlant(null)
      state.setEditingShapeId(null)
    },
    onModeChange: state.setCurrentMode,
  })

  // ── Plant placement ──
  const pendingPlantRef = useRef(null)
  const handlePlantClick = (enrichedEntry) => {
    pendingPlantRef.current = enrichedEntry
    state.setCurrentMode('select')
  }
  const handleCanvasClick = (worldPos) => {
    const entry = pendingPlantRef.current
    if (!entry) { clearSelection(); return }
    pendingPlantRef.current = null
    const { plantLayer } = layersRef.current
    if (!plantLayer || !stageRef.current) return
    const newId = addPlant({
      entry, x: worldPos.x, y: worldPos.y,
      stage: stageRef.current, plantLayer,
      plantDataRef: state.plantDataRef, plantIdCtr: state.plantIdCtr,
      showGridRef,
      onSelect: handlePlantSelect,
    })
    // Push undo: remove the placed plant
    if (newId) {
      state.pushUndo(() => {
        const g = layersRef.current.plantLayer?.findOne('#' + newId)
        if (g) { g.destroy(); delete state.plantDataRef.current[newId]; layersRef.current.plantLayer?.batchDraw() }
      })
    }
  }

  // Compute scale label — mirrors v8 updateScaleDisplay()
  const updateScaleLabel = (stage, gardenUnit) => {
    const CELL_PX = 8, CELL_IN = 3
    const sc = stage.scaleX()
    const maxCellPx = stage.width() / 4
    let mult = 1
    while (CELL_PX * sc * mult < 16 && CELL_PX * sc * mult < maxCellPx) mult *= 2
    if (mult < 2) mult = 2
    const ri = CELL_IN * mult
    const unit = gardenUnit || state.gardenUnit
    let lbl
    if (unit === 'ft') {
      lbl = ri >= 12 ? `1 cell = ${Math.round(ri / 12 * 10) / 10} ft` : `1 cell = ${ri} in`
    } else {
      lbl = ri >= 39.37 ? `1 cell = ${Math.round(ri / 39.37 * 10) / 10} m` : `1 cell = ${Math.round(ri * 2.54)} cm`
    }
    setScaleLabel(lbl)
  }

  const handleStageReady = (stage, layers) => {
    stageRef.current  = stage
    layersRef.current = layers
    setStageReady(true)
  }

  // ── Copy / Paste ──
  useEffect(() => {
    const onKey = (e) => {
      const tag = document.activeElement?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault()
        state.undo()
        layersRef.current.structLayer?.batchDraw()
        layersRef.current.plantLayer?.batchDraw()
        return
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
        const sel = state.selectedPlant
        if (!sel) return
        const d = state.plantDataRef.current[sel.id]
        const img = loadedImages[d?.key] || sel.group.findOne('Image')?.image()
        state.setClipboard({
          kind: 'plant',
          entry: { ...d, _img: img,
            scaleX: sel.group.scaleX(),
            scaleY: sel.group.scaleY(),
          },
          srcX: sel.group.x(),
          srcY: sel.group.y(),
        })
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'v') {
        const cb = state.clipboard
        if (!cb || cb.kind !== 'plant' || !cb.entry._img) return
        const { plantLayer } = layersRef.current
        if (!plantLayer) return
        const sizeMap = { XS: 24, S: 40, M: 64, L: 96 }
        const size = sizeMap[cb.entry.size] || 64
        // srcX/srcY are group top-left. addPlant expects center coords.
        // Paste one plant-width to the right, same vertical position.
        const srcX = cb.srcX ?? 100
        const srcY = cb.srcY ?? 100
        const newId = addPlant({
          entry: cb.entry,
          x: srcX + size + 8 + size / 2,  // top-left of paste + half-size = center
          y: srcY + size / 2,              // same row, center y
          stage: stageRef.current, plantLayer,
          plantDataRef: state.plantDataRef, plantIdCtr: state.plantIdCtr,
          showGridRef,
          onSelect: handlePlantSelect,
        })
        // Apply stored scale + move to top
        if (newId) {
          const group = plantLayer.findOne('#' + newId)
          if (group) {
            if (cb.entry.scaleX) group.scaleX(cb.entry.scaleX)
            if (cb.entry.scaleY) group.scaleY(cb.entry.scaleY)
            group.moveToTop()
            // Advance srcX so next Ctrl+V steps one more plant to the right
            state.setClipboard({ ...cb, srcX: srcX + size + 8 })
          }
          plantLayer.batchDraw()
          // Push undo: remove pasted plant
          state.pushUndo(() => {
            const g = layersRef.current.plantLayer?.findOne('#' + newId)
            if (g) { g.destroy(); delete state.plantDataRef.current[newId]; layersRef.current.plantLayer?.batchDraw() }
          })
        }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [state.clipboard, state.selectedPlant])

  // ── Right panel handlers ──
  const handleColourChange = (colour) => {
    const sel = state.selectedStruct
    if (!sel) return
    const d = state.structDataRef.current[sel.id]
    d.colour = colour
    const shape = sel.shape
    const noFill = ['path','fence','gate','underground-electrical','underground-plumbing'].includes(d.type)
    if (shape instanceof Konva.Rect)        { shape.fill(colour + 'CC') }
    else if (shape instanceof Konva.Circle) { shape.fill(colour + 'CC'); shape.stroke(colour) }
    else { shape.fill(noFill ? 'transparent' : colour + 'CC'); if (noFill) shape.stroke(colour) }
    layersRef.current.structLayer?.batchDraw()
    state.setSelectedStruct({ ...sel, colour })
  }

  const handlePathWidthChange = (w) => {
    const sel = state.selectedStruct; if (!sel) return
    state.structDataRef.current[sel.id].pathWidth = w
    sel.shape.strokeWidth(w)
    layersRef.current.structLayer?.batchDraw()
  }

  const handleDimRectApply = (w, h) => {
    const sel = state.selectedStruct
    if (!sel || !(sel.shape instanceof Konva.Rect)) return
    const px = 32 * (state.gardenUnit === 'm' ? 3.281 : 1)
    sel.shape.width(w * px); sel.shape.height(h * px)
    sel.shape.scaleX(1); sel.shape.scaleY(1)
    layersRef.current.structLayer?.batchDraw()
  }

  const handleDimCircleApply = (d) => {
    const sel = state.selectedStruct
    if (!sel || !(sel.shape instanceof Konva.Circle)) return
    sel.shape.radius((d / 2) * 32 * (state.gardenUnit === 'm' ? 3.281 : 1))
    layersRef.current.structLayer?.batchDraw()
  }

  const handleLayerMove = (kind, dir) => {
    if (kind === 'plant' && state.selectedPlant) {
      dir === 'up' ? state.selectedPlant.group.moveUp() : state.selectedPlant.group.moveDown()
      layersRef.current.plantLayer?.batchDraw()
    } else if (kind === 'struct' && state.selectedStruct) {
      dir === 'up' ? state.selectedStruct.shape.moveUp() : state.selectedStruct.shape.moveDown()
      layersRef.current.structLayer?.batchDraw()
    }
  }

  const handleTransparentPlant = () => {
    const sel = state.selectedPlant; if (!sel) return
    const d = state.plantDataRef.current[sel.id]
    d.transparent = !d.transparent
    d.transparent ? (sel.group.opacity(0.35), sel.group.moveToBottom()) : (sel.group.opacity(1), sel.group.moveToTop())
    layersRef.current.plantLayer?.batchDraw()
    state.setSelectedPlant({ ...sel })
  }

  const handleTransparentStruct = () => {
    const sel = state.selectedStruct; if (!sel) return
    const d = state.structDataRef.current[sel.id]
    d.transparent = !d.transparent
    d.transparent ? (sel.shape.opacity(0.35), sel.shape.moveToBottom()) : (sel.shape.opacity(1), sel.shape.moveToTop())
    layersRef.current.structLayer?.batchDraw()
    state.setSelectedStruct({ ...sel })
  }

  const handleDisconnect = () => {
    const sel = state.selectedStruct
    if (!sel || !(sel.shape instanceof Konva.Group)) return
    // Collect member rects before destroying
    const members = sel.shape.getChildren().filter(c => c instanceof Konva.Rect).map(r => ({
      x: r.x() + sel.shape.x(), y: r.y() + sel.shape.y(),
      w: r.width(), h: r.height(),
      colour: r.fill().replace('CC', ''),
      type: state.structDataRef.current[sel.id]?.type,
    }))
    sel.shape.destroy()
    delete state.structDataRef.current[sel.id]
    clearSelection()
    // Re-create each as a standalone rect with full dragend/merge wiring
    const { structLayer } = layersRef.current
    members.forEach(m => {
      addRectStruct({
        type: m.type, x: m.x, y: m.y, w: m.w, h: m.h, colour: m.colour,
        structIdCtr: state.structIdCtr, structDataRef: state.structDataRef,
        groupIdCtr: state.groupIdCtr,
        snapCell: null, showGrid: false,
        structLayer,
        onSelect: (id, shape) => {
          state.setSelectedStruct({ id, shape, ...state.structDataRef.current[id] })
          state.setSelectedPlant(null)
        },
        onModeChange: null,
      })
    })
    structLayer?.batchDraw()
  }

  const handleRemoveLastPt = () => {
    const id = state.editingShapeId; if (!id) return
    const shape = layersRef.current.structLayer?.findOne('#' + id)
    if (!shape || !(shape instanceof Konva.Line)) return
    const pts = shape.points()
    if (pts.length <= 6) return
    shape.points(pts.slice(0,-2)); layersRef.current.structLayer.batchDraw()
  }

  const [showClearConfirm, setShowClearConfirm] = useState(false)

  const handleClearAll = () => setShowClearConfirm(true)

  const doClearAll = () => {
    layersRef.current.structLayer?.getChildren()
      .filter(c => c.id() !== '__propBounds' && c.id() !== '__propLabel')
      .forEach(c => c.destroy())
    Object.keys(state.structDataRef.current).forEach(k => delete state.structDataRef.current[k])
    layersRef.current.plantLayer?.destroyChildren()
    Object.keys(state.plantDataRef.current).forEach(k => delete state.plantDataRef.current[k])
    layersRef.current.structLayer?.batchDraw()
    layersRef.current.plantLayer?.batchDraw()
    clearSelection()
    setShowClearConfirm(false)
  }

  const handleResetView = () => {
    const stage = stageRef.current
    const propBounds = state.propBoundsRef.current
    if (!stage || !propBounds) return
    const W = stage.width(), H = stage.height(), pad = 20
    const scale = Math.min((W-pad*2)/propBounds.w, (H-pad*2)/propBounds.h, 2)
    stage.scale({ x: scale, y: scale })
    stage.x(W/2 - (propBounds.x + propBounds.w/2) * scale)
    stage.y(H/2 - (propBounds.y + propBounds.h/2) * scale)
    stage.batchDraw()
  }

  // ── Auto-load on startup: runs after all handlers are defined so closures are valid ──
  // Mirrors v8: on first load, reads LS and restores last garden. Skips setup for returning users.
  const loadedImagesCount = Object.keys(loadedImages).length
  useEffect(() => {
    if (!stageReady || loadedImagesCount === 0) return
    const gardens = readGardens()
    if (gardens.length === 0) return  // first run — show setup overlay
    loadGarden({
      idx: 0,
      stage: stageRef.current,
      layers: layersRef.current,
      state,
      loadedImages,
      showGridRef,
      onSelectPlant: handlePlantSelect,
      onSelectStruct: (id, shape) => {
        state.setSelectedStruct({ id, shape, ...state.structDataRef.current[id] })
        state.setSelectedPlant(null)
      },
      onClearSelection: clearSelection,
      setGardenName: state.setGardenName,
      setGardenW:    state.setGardenW,
      setGardenH:    state.setGardenH,
      setGardenUnit: state.setGardenUnit,
      setIsSetup:    state.setIsSetup,
      onZoomToFit:   handleResetView,
    })
    currentGardenIndexRef.current = 0
    setCurrentGardenIndex(0)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stageReady, loadedImagesCount])

  // ── Phase 5: Save ──
  // Plain function (not useCallback) — closes over refs so always reads latest values
  const handleSave = () => {
    if (!stageRef.current) return
    saveGarden({
      stage: stageRef.current,
      layers: layersRef.current,
      state,
      currentGardenIndex: currentGardenIndexRef.current,
    })
    setSaveFlash(true)
    setTimeout(() => setSaveFlash(false), 500)
  }

  // ── Phase 5: Load ──
  const handleLoad = (idx) => {
    if (!stageRef.current) return
    const ok = loadGarden({
      idx,
      stage: stageRef.current,
      layers: layersRef.current,
      state,
      loadedImages,
      showGridRef,
      onSelectPlant: handlePlantSelect,
      onSelectStruct: (id, shape) => {
        state.setSelectedStruct({ id, shape, ...state.structDataRef.current[id] })
        state.setSelectedPlant(null)
      },
      onClearSelection: clearSelection,
      setGardenName: state.setGardenName,
      setGardenW:    state.setGardenW,
      setGardenH:    state.setGardenH,
      setGardenUnit: state.setGardenUnit,
      setIsSetup:    state.setIsSetup,
      onZoomToFit:   handleResetView,
    })
    if (ok) {
      currentGardenIndexRef.current = idx
      setCurrentGardenIndex(idx)
    }
  }

  // ── Phase 5: New garden (mirrors v8 newGarden exactly) ──
  const handleNewGarden = () => {
    if (!stageRef.current) return
    const result = createNewGarden({
      currentGardenIndex: currentGardenIndexRef.current,
      stage: stageRef.current,
      layers: layersRef.current,
      state,
    })
    if (result.limitReached) return

    // Clear the canvas (mirrors v8: initKonva creates a fresh canvas)
    const { structLayer, plantLayer, uiLayer } = layersRef.current
    plantLayer?.destroyChildren()
    structLayer?.destroyChildren()
    if (uiLayer) { uiLayer.find('Circle,Line').forEach(n => n.destroy()); layersRef.current.tr?.nodes([]) }
    Object.keys(state.plantDataRef.current).forEach(k => delete state.plantDataRef.current[k])
    Object.keys(state.structDataRef.current).forEach(k => delete state.structDataRef.current[k])
    structLayer?.batchDraw(); plantLayer?.batchDraw()
    clearSelection()

    // Show setup overlay (same as v8 showing setup-overlay)
    state.setGardenName('New Garden')
    state.setGardenW(60)
    state.setGardenH(40)
    state.setGardenUnit('ft')
    state.setIsSetup(false)
    currentGardenIndexRef.current = result.newIndex
    setCurrentGardenIndex(result.newIndex)
    setSwitcherOpen(false)
  }

  return (
    <div className="editor-layout">
      <PromoBanner />
      {!state.isSetup && (
        <SetupOverlay
          gardenName={state.gardenName} gardenW={state.gardenW}
          gardenH={state.gardenH}      gardenUnit={state.gardenUnit}
          onSetGardenName={state.setGardenName} onSetGardenW={state.setGardenW}
          onSetGardenH={state.setGardenH}       onSetGardenUnit={state.setGardenUnit}
          onStart={(name, w, h, unit) => {
            // Mirrors v8 startGarden() → initKonva(): reinit boundary for new dimensions
            const stage = stageRef.current
            const { structLayer } = layersRef.current
            if (stage && structLayer) {
              // Replace boundary rect + label
              structLayer.findOne('#__propBounds')?.destroy()
              structLayer.findOne('#__propLabel')?.destroy()
              const UNIT_PX = 32
              const pw = w * UNIT_PX * (unit === 'm' ? 3.281 : 1)
              const ph = h * UNIT_PX * (unit === 'm' ? 3.281 : 1)
              const ox = Math.max(16, (stage.width() - pw) / 2)
              const oy = Math.max(16, (stage.height() - ph) / 2)
              state.propBoundsRef.current = { x: ox, y: oy, w: pw, h: ph }
              structLayer.add(new Konva.Rect({
                id: '__propBounds', x: ox, y: oy, width: pw, height: ph,
                stroke: '#558B2F', strokeWidth: 2, dash: [10, 5],
                fill: 'transparent', listening: false, strokeScaleEnabled: false,
              }))
              structLayer.add(new Konva.Text({
                id: '__propLabel', x: ox + 6, y: oy + 5,
                text: `${name}  ${w}x${h} ${unit}`,
                fontSize: 11, fontStyle: 'bold', fill: '#558B2F', opacity: 0.65, listening: false,
              }))
              structLayer.batchDraw()
              handleResetView()
            }
            state.setIsSetup(true)
          }}
        />
      )}

      <LogoBar
        gardenName={state.gardenName} gardenW={state.gardenW}
        gardenH={state.gardenH}       gardenUnit={state.gardenUnit}
        currentSeason={state.currentSeason}
        onSave={handleSave}
        onOpenSwitcher={() => setSwitcherOpen(true)}
        saveFlash={saveFlash}
        scaleLabel={scaleLabel}
      />

      {/* Clear All confirm modal */}
      {showClearConfirm && (
        <div style={{
          position:'fixed',inset:0,background:'rgba(0,0,0,0.45)',
          zIndex:9000,display:'flex',alignItems:'center',justifyContent:'center'
        }} onClick={() => setShowClearConfirm(false)}>
          <div style={{
            background:'#fff',borderRadius:14,padding:'28px 32px',
            boxShadow:'0 4px 24px rgba(0,0,0,0.2)',textAlign:'center',maxWidth:300
          }} onClick={e => e.stopPropagation()}>
            <div style={{fontSize:15,fontWeight:700,color:'#2A3D1A',marginBottom:8}}>Clear all objects?</div>
            <div style={{fontSize:12,color:'#666',marginBottom:20}}>This cannot be undone.</div>
            <div style={{display:'flex',gap:10,justifyContent:'center'}}>
              <button onClick={() => setShowClearConfirm(false)}
                style={{padding:'8px 20px',borderRadius:8,border:'1.5px solid #ccc',background:'#f5f5f5',fontWeight:700,cursor:'pointer'}}>
                Cancel
              </button>
              <button onClick={doClearAll}
                style={{padding:'8px 20px',borderRadius:8,border:'none',background:'#c62828',color:'#fff',fontWeight:700,cursor:'pointer'}}>
                Clear All
              </button>
            </div>
          </div>
        </div>
      )}

      <GardenSwitcher
        open={switcherOpen}
        currentIndex={currentGardenIndex}
        onLoad={handleLoad}
        onNew={handleNewGarden}
        onClose={() => setSwitcherOpen(false)}
      />

      <div className="editor-body">
        <PlantTray loadedImages={loadedImages} onPlantClick={handlePlantClick} />
        <div className="canvas-wrap">
          <GardenCanvas
            gardenName={state.gardenName} gardenW={state.gardenW}
            gardenH={state.gardenH}       gardenUnit={state.gardenUnit}
            currentSeason={state.currentSeason} showGrid={state.showGrid}
            propBoundsRef={state.propBoundsRef}
            pendingPlantRef={pendingPlantRef}
            onStageReady={handleStageReady}
            onCanvasClick={handleCanvasClick}
            onScaleChange={(stage) => updateScaleLabel(stage, state.gardenUnit)}
          />
          <div id="draw-hint" className="draw-hint" style={{ display: 'none' }} />
        </div>
        <RightPanel
          selectedPlant={state.selectedPlant}
          selectedStruct={state.selectedStruct}
          multiSelection={state.multiSelection}
          editingShapeId={state.editingShapeId}
          plantDataRef={state.plantDataRef}
          structDataRef={state.structDataRef}
          layers={layersRef.current}
          gardenUnit={state.gardenUnit}
          onDeletePlant={() => { state.selectedPlant?.group.destroy(); delete state.plantDataRef.current[state.selectedPlant?.id]; layersRef.current.plantLayer?.batchDraw(); clearSelection() }}
          onDeleteStruct={() => { state.selectedStruct?.shape.destroy(); delete state.structDataRef.current[state.selectedStruct?.id]; layersRef.current.structLayer?.batchDraw(); clearSelection() }}
          onDeleteMulti={deleteSelected}
          onTransparentPlant={handleTransparentPlant}
          onCopyPlant={() => {
            const sel = state.selectedPlant; if (!sel) return
            const d = state.plantDataRef.current[sel.id]
            const img = loadedImages[d?.key] || sel.group.findOne('Image')?.image()
            if (!img) return
            const scaleX = sel.group.scaleX()
            const scaleY = sel.group.scaleY()
            const srcX   = sel.group.x()
            const srcY   = sel.group.y()
            const sizeMap = { XS: 24, S: 40, M: 64, L: 96 }
            const size = sizeMap[d?.size] || 64
            const entry = { ...d, _img: img, scaleX, scaleY }
            // Copy + immediately paste to the right (touch-friendly: one tap)
            const { plantLayer } = layersRef.current
            if (!plantLayer) return
            const newId = addPlant({
              entry,
              x: srcX + size + 8 + size / 2,
              y: srcY + size / 2,
              stage: stageRef.current, plantLayer,
              plantDataRef: state.plantDataRef, plantIdCtr: state.plantIdCtr,
              showGridRef,
              onSelect: handlePlantSelect,
            })
            if (newId) {
              const group = plantLayer.findOne('#' + newId)
              if (group) {
                group.scaleX(scaleX); group.scaleY(scaleY)
                group.moveToTop()
              }
              plantLayer.batchDraw()
              state.pushUndo(() => {
                const g = layersRef.current.plantLayer?.findOne('#' + newId)
                if (g) { g.destroy(); delete state.plantDataRef.current[newId]; layersRef.current.plantLayer?.batchDraw() }
              })
            }
            // Advance srcX so next tap steps one more plant to the right
            state.setClipboard({ kind: 'plant', entry, srcX: srcX + size + 8, srcY })
          }}
          onColourChange={handleColourChange}
          onPathWidthChange={handlePathWidthChange}
          onEnterEdit={enterEdit}
          onExitEdit={exitEdit}
          addingPt={state.addingPt}
          onToggleAddPt={() => state.setAddingPt(v => !v)}
          onDimRectApply={handleDimRectApply}
          onDimCircleApply={handleDimCircleApply}
          onRemoveLastPt={handleRemoveLastPt}
          onLayerMove={handleLayerMove}
          onTransparentStruct={handleTransparentStruct}
          onDisconnect={handleDisconnect}
          onSeasonsChange={() => {
            const { plantLayer } = layersRef.current
            if (!plantLayer) return
            const SEASON_NAMES = ['spring','summer','fall','winter']
            const sN = SEASON_NAMES[state.currentSeason]
            plantLayer.find('Group').forEach(g => {
              const d = state.plantDataRef.current[g.id()]
              if (!d) return
              if (d.transparent) { g.opacity(0.35); return }
              g.opacity(d.seasons?.includes(sN) ? 1 : 0.1)
            })
            plantLayer.batchDraw()
          }}
        />
      </div>

      <BottomBar
        currentMode={state.currentMode}         onModeChange={state.setCurrentMode}
        bedSubTool={state.bedSubTool}           onBedSubTool={state.setBedSubTool}
        fenceSubTool={state.fenceSubTool}       onFenceSubTool={state.setFenceSubTool}
        fenceType={state.fenceType}             onFenceType={state.setFenceType}
        pathSubTool={state.pathSubTool}         onPathSubTool={state.setPathSubTool}
        buildingSubTool={state.buildingSubTool} onBuildingSubTool={state.setBuildingSubTool}
        waterSubTool={state.waterSubTool}       onWaterSubTool={state.setWaterSubTool}
        currentSeason={state.currentSeason}     onSeasonChange={state.setCurrentSeason}
        showGrid={state.showGrid}               onToggleGrid={() => state.setShowGrid(v => !v)}
        onResetView={handleResetView}
        onClearAll={handleClearAll}
      />
    </div>
  )
}
