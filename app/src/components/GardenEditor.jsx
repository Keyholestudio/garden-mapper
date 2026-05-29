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
import LogoBar        from './LogoBar'
import BottomBar      from './BottomBar'
import PlantTray      from './PlantTray'
import GardenCanvas  from './GardenCanvas'
import RightPanel    from './RightPanel'
import SetupOverlay  from './SetupOverlay'
import GardenSwitcher from './GardenSwitcher'
import './GardenEditor.css'

export default function GardenEditor() {
  const state = useGardenState()
  const stageRef    = useRef(null)
  const layersRef   = useRef({})
  const showGridRef = useRef(state.showGrid) // always-current ref for snap in dragmove closures
  const [stageReady, setStageReady] = useState(false)

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

  // ── Auto-load last saved garden on startup (v8: initKonva always runs after startGarden) ──
  // Once stage is ready AND images are loaded, load garden[0] from localStorage if it exists.
  // This replaces the setup overlay for returning users.
  useEffect(() => {
    if (!stageReady || Object.keys(loadedImages).length === 0) return
    const gardens = readGardens()
    if (gardens.length === 0) return // first run: show setup overlay
    // Load the last used garden (index 0 by default; could store lastIndex in LS later)
    const ok = loadGarden({
      idx: 0,
      stage: stageRef.current,
      layers: layersRef.current,
      state,
      loadedImages,
      showGridRef,
      onSelectPlant: (id, group) => {
        state.setSelectedPlant({ id, group, ...state.plantDataRef.current[id] })
        state.setSelectedStruct(null)
      },
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
      currentGardenIndexRef.current = 0
      setCurrentGardenIndex(0)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stageReady, Object.keys(loadedImages).length])

  // Keep showGridRef current
  useEffect(() => { showGridRef.current = state.showGrid }, [state.showGrid])

  // ── Clear selection ──
  const clearSelection = () => {
    state.setSelectedPlant(null)
    state.setSelectedStruct(null)
    state.setMultiSelection([])
    state.setEditingShapeId(null)
  }

  // ── Selection hook ──
  const { enterEdit, exitEdit, deleteSelected } = useSelection({
    stage:  stageReady ? stageRef.current : null,
    layers: stageReady ? layersRef.current : null,
    state,
    onSelectPlant:    (id, group) => { state.setSelectedPlant({ id, group, ...state.plantDataRef.current[id] }); state.setSelectedStruct(null) },
    onSelectStruct:   (id, shape) => { state.setSelectedStruct({ id, shape, ...state.structDataRef.current[id] }); state.setSelectedPlant(null) },
    onClearSelection: clearSelection,
    onEditMode:       state.setEditingShapeId,
    onExitEditMode:   () => state.setEditingShapeId(null),
  })

  // ── Draw tools hook ──
  useDrawTools({
    stage:  stageReady ? stageRef.current : null,
    layers: stageReady ? layersRef.current : null,
    propBoundsRef: state.propBoundsRef,
    state,
    onStructSelect: (id, shape, evt) => {
      const ne = evt?.evt || evt
      if (ne && (ne.ctrlKey || ne.metaKey || ne.shiftKey)) return
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
    if (!entry) return
    pendingPlantRef.current = null
    const { plantLayer } = layersRef.current
    if (!plantLayer || !stageRef.current) return
    addPlant({
      entry, x: worldPos.x, y: worldPos.y,
      stage: stageRef.current, plantLayer,
      plantDataRef: state.plantDataRef, plantIdCtr: state.plantIdCtr,
      showGridRef,
      onSelect: (id, group) => {
        state.setSelectedPlant({ id, group, ...state.plantDataRef.current[id] })
        state.setSelectedStruct(null)
      },
    })
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
      if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
        const sel = state.selectedPlant
        if (!sel) return
        const img = sel.group.findOne('Image')?.image()
        state.setClipboard({ kind: 'plant', entry: { ...state.plantDataRef.current[sel.id], _img: img } })
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'v') {
        const cb = state.clipboard
        if (!cb || cb.kind !== 'plant' || !cb.entry._img) return
        const { plantLayer } = layersRef.current
        if (!plantLayer) return
        addPlant({
          entry: cb.entry,
          x: (state.propBoundsRef.current?.x || 100) + 80,
          y: (state.propBoundsRef.current?.y || 100) + 80,
          stage: stageRef.current, plantLayer,
          plantDataRef: state.plantDataRef, plantIdCtr: state.plantIdCtr,
          showGridRef,
          onSelect: (id, group) => {
            state.setSelectedPlant({ id, group, ...state.plantDataRef.current[id] })
            state.setSelectedStruct(null)
          },
        })
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
    const members = sel.shape.getChildren().filter(c => c instanceof Konva.Rect).map(r => ({
      x: r.x()+sel.shape.x(), y: r.y()+sel.shape.y(),
      w: r.width(), h: r.height(),
      colour: r.fill().replace('CC',''),
      type: state.structDataRef.current[sel.id]?.type,
    }))
    sel.shape.destroy(); delete state.structDataRef.current[sel.id]
    members.forEach(m => {
      const id = 'struct_' + state.structIdCtr.current++
      state.structDataRef.current[id] = { type: m.type, colour: m.colour, label: m.type }
      const rect = new Konva.Rect({ id, x:m.x, y:m.y, width:m.w, height:m.h,
        fill: m.colour+'CC', stroke:'#3A2A10', strokeWidth:2, draggable:true, strokeScaleEnabled:false })
      rect.on('click tap', () => state.setSelectedStruct({ id, shape:rect, ...state.structDataRef.current[id] }))
      layersRef.current.structLayer?.add(rect)
    })
    layersRef.current.structLayer?.batchDraw(); clearSelection()
  }

  const handleRemoveLastPt = () => {
    const id = state.editingShapeId; if (!id) return
    const shape = layersRef.current.structLayer?.findOne('#' + id)
    if (!shape || !(shape instanceof Konva.Line)) return
    const pts = shape.points()
    if (pts.length <= 6) return
    shape.points(pts.slice(0,-2)); layersRef.current.structLayer.batchDraw()
  }

  const handleClearAll = () => {
    if (!window.confirm('Clear all objects?')) return
    layersRef.current.structLayer?.getChildren()
      .filter(c => c.id() !== '__propBounds' && c.id() !== '__propLabel')
      .forEach(c => c.destroy())
    layersRef.current.plantLayer?.destroyChildren()
    layersRef.current.structLayer?.batchDraw()
    layersRef.current.plantLayer?.batchDraw()
    clearSelection()
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
      onSelectPlant: (id, group) => {
        state.setSelectedPlant({ id, group, ...state.plantDataRef.current[id] })
        state.setSelectedStruct(null)
      },
      onSelectStruct: (id, shape, e) => {
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
      />

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
            state.setClipboard({ kind:'plant', entry:{ ...state.plantDataRef.current[sel.id], _img: sel.group.findOne('Image')?.image() } })
          }}
          onColourChange={handleColourChange}
          onPathWidthChange={handlePathWidthChange}
          onEnterEdit={enterEdit}
          onExitEdit={exitEdit}
          onDimRectApply={handleDimRectApply}
          onDimCircleApply={handleDimCircleApply}
          onRemoveLastPt={handleRemoveLastPt}
          onLayerMove={handleLayerMove}
          onTransparentStruct={handleTransparentStruct}
          onDisconnect={handleDisconnect}
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
