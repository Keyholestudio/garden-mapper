// GardenEditor.jsx — Top-level layout shell
// Phase 4 fixes: BottomBar layout, logo, pan/draw conflict fixed, snap, fountain, plumbing, copy/paste

import { useRef, useState, useEffect } from 'react'
import Konva from 'konva'
import { useGardenState }  from '../hooks/useGardenState'
import { useDrawTools }    from '../hooks/useDrawTools'
import { useSelection }    from '../hooks/useSelection'
import { PLANT_CATALOG }   from '../hooks/usePlantCatalog'
import { addPlant }        from '../utils/plantUtils'
import { insertPointNearestSegment } from '../hooks/useSelection'
import LogoBar      from './LogoBar'
import BottomBar    from './BottomBar'
import PlantTray    from './PlantTray'
import GardenCanvas from './GardenCanvas'
import RightPanel   from './RightPanel'
import SetupOverlay from './SetupOverlay'
import './GardenEditor.css'

export default function GardenEditor() {
  const state = useGardenState()
  const stageRef  = useRef(null)
  const layersRef = useRef({})
  const [stageReady, setStageReady] = useState(false)

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
      showGrid: state.showGrid, snapCell: state.showGrid ? 16 : 0,
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
          showGrid: state.showGrid, snapCell: state.showGrid ? 16 : 0,
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
    const W = stage.width(), H = stage.height(), pad = 80
    const scale = Math.min((W-pad*2)/propBounds.w, (H-pad*2)/propBounds.h, 2)
    stage.scale({ x: scale, y: scale })
    stage.x(W/2 - (propBounds.x + propBounds.w/2) * scale)
    stage.y(H/2 - (propBounds.y + propBounds.h/2) * scale)
    stage.batchDraw()
  }

  return (
    <div className="editor-layout">
      {!state.isSetup && (
        <SetupOverlay
          gardenName={state.gardenName} gardenW={state.gardenW}
          gardenH={state.gardenH}      gardenUnit={state.gardenUnit}
          onSetGardenName={state.setGardenName} onSetGardenW={state.setGardenW}
          onSetGardenH={state.setGardenH}       onSetGardenUnit={state.setGardenUnit}
          onStart={() => state.setIsSetup(true)}
        />
      )}

      <LogoBar
        gardenName={state.gardenName} gardenW={state.gardenW}
        gardenH={state.gardenH}       gardenUnit={state.gardenUnit}
        currentSeason={state.currentSeason}
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
