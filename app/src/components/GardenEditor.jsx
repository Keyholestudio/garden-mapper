// GardenEditor.jsx — Top-level layout shell
// Phase 3: draw tools wired (beds, fences, paths, building, water)

import { useRef, useState, useEffect } from 'react'
import { useGardenState } from '../hooks/useGardenState'
import { useDrawTools }   from '../hooks/useDrawTools'
import { PLANT_CATALOG }  from '../hooks/usePlantCatalog'
import { addPlant }       from '../utils/plantUtils'
import LogoBar     from './LogoBar'
import Toolbar     from './Toolbar'
import PlantTray   from './PlantTray'
import GardenCanvas from './GardenCanvas'
import RightPanel  from './RightPanel'
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
    Promise.all(
      PLANT_CATALOG.map(p => new Promise(res => {
        const img = new Image()
        img.onload  = () => { result[p.key] = img; res() }
        img.onerror = () => res()
        img.src = p.src
      }))
    ).then(() => setLoadedImages({ ...result }))
  }, [])

  // ── Draw tools hook ──
  useDrawTools({
    stage:      stageReady ? stageRef.current : null,
    layers:     stageReady ? layersRef.current : null,
    propBoundsRef: state.propBoundsRef,
    state,
    onStructSelect: (id, shape, evt) => {
      if (!evt || !(evt.evt?.ctrlKey || evt.evt?.metaKey || evt.evt?.shiftKey)) {
        state.setSelectedPlant(null)
        state.setSelectedStruct({ id, shape, ...state.structDataRef.current[id] })
      }
    },
    onModeChange: state.setCurrentMode,
  })

  // ── Pending plant ──
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
      plantDataRef: state.plantDataRef,
      plantIdCtr:   state.plantIdCtr,
      showGrid:     state.showGrid,
      snapCell:     8,
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
        currentSeason={state.currentSeason} onSeasonChange={state.setCurrentSeason}
        showGrid={state.showGrid} onToggleGrid={() => state.setShowGrid(v => !v)}
      />

      <Toolbar
        currentMode={state.currentMode}       onModeChange={state.setCurrentMode}
        bedSubTool={state.bedSubTool}         onBedSubTool={state.setBedSubTool}
        fenceSubTool={state.fenceSubTool}     onFenceSubTool={state.setFenceSubTool}
        fenceType={state.fenceType}           onFenceType={state.setFenceType}
        pathSubTool={state.pathSubTool}       onPathSubTool={state.setPathSubTool}
        buildingSubTool={state.buildingSubTool} onBuildingSubTool={state.setBuildingSubTool}
        waterSubTool={state.waterSubTool}     onWaterSubTool={state.setWaterSubTool}
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
          {/* Draw hint overlay */}
          <div id="draw-hint" className="draw-hint" style={{ display: 'none' }} />
        </div>
        <RightPanel
          selectedPlant={state.selectedPlant}
          selectedStruct={state.selectedStruct}
          multiSelection={state.multiSelection}
        />
      </div>
    </div>
  )
}
