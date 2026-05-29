// GardenEditor.jsx — Top-level layout shell
// Phase 2: image loading + plant placement wired up

import { useRef, useState, useEffect } from 'react'
import { useGardenState } from '../hooks/useGardenState'
import { PLANT_CATALOG } from '../hooks/usePlantCatalog'
import { addPlant } from '../utils/plantUtils'
import LogoBar from './LogoBar'
import PlantTray from './PlantTray'
import GardenCanvas from './GardenCanvas'
import RightPanel from './RightPanel'
import SetupOverlay from './SetupOverlay'
import './GardenEditor.css'

export default function GardenEditor() {
  const state = useGardenState()
  const stageRef   = useRef(null)
  const layersRef  = useRef({})

  // ── Image loading ──
  const [loadedImages, setLoadedImages] = useState({})
  const [imagesReady, setImagesReady]   = useState(false)

  useEffect(() => {
    const srcs = {}
    PLANT_CATALOG.forEach(p => { srcs[p.key] = p.src })
    const result = {}
    Promise.all(
      Object.entries(srcs).map(([k, src]) =>
        new Promise(res => {
          const img = new Image()
          img.onload  = () => { result[k] = img; res() }
          img.onerror = () => res()
          img.src = src
        })
      )
    ).then(() => {
      setLoadedImages(result)
      setImagesReady(true)
    })
  }, [])

  // ── Pending plant to place (set by tray click, consumed by canvas click) ──
  const pendingPlantRef = useRef(null)

  const handlePlantClick = (enrichedEntry) => {
    pendingPlantRef.current = enrichedEntry
    // Switch to select mode so canvas click fires
    state.setCurrentMode('select')
  }

  const handleCanvasClick = (worldPos) => {
    const entry = pendingPlantRef.current
    if (!entry) return
    pendingPlantRef.current = null

    const { plantLayer } = layersRef.current
    if (!plantLayer || !stageRef.current) return

    addPlant({
      entry,
      x: worldPos.x,
      y: worldPos.y,
      stage: stageRef.current,
      plantLayer,
      plantDataRef: state.plantDataRef,
      plantIdCtr: state.plantIdCtr,
      showGrid: state.showGrid,
      snapCell: 8,
      onSelect: (id, group) => {
        state.setSelectedPlant({ id, group, ...state.plantDataRef.current[id] })
        state.setSelectedStruct(null)
      },
    })
  }

  const handleStageReady = (stage, layers) => {
    stageRef.current  = stage
    layersRef.current = layers
  }

  return (
    <div className="editor-layout">
      {!state.isSetup && (
        <SetupOverlay
          gardenName={state.gardenName}
          gardenW={state.gardenW}
          gardenH={state.gardenH}
          gardenUnit={state.gardenUnit}
          onSetGardenName={state.setGardenName}
          onSetGardenW={state.setGardenW}
          onSetGardenH={state.setGardenH}
          onSetGardenUnit={state.setGardenUnit}
          onStart={() => state.setIsSetup(true)}
        />
      )}

      <LogoBar
        gardenName={state.gardenName}
        gardenW={state.gardenW}
        gardenH={state.gardenH}
        gardenUnit={state.gardenUnit}
        currentSeason={state.currentSeason}
        onSeasonChange={state.setCurrentSeason}
        showGrid={state.showGrid}
        onToggleGrid={() => state.setShowGrid(v => !v)}
      />

      <div className="editor-body">
        <PlantTray
          loadedImages={loadedImages}
          onPlantClick={handlePlantClick}
        />
        <GardenCanvas
          gardenName={state.gardenName}
          gardenW={state.gardenW}
          gardenH={state.gardenH}
          gardenUnit={state.gardenUnit}
          currentSeason={state.currentSeason}
          showGrid={state.showGrid}
          propBoundsRef={state.propBoundsRef}
          pendingPlantRef={pendingPlantRef}
          onStageReady={handleStageReady}
          onCanvasClick={handleCanvasClick}
        />
        <RightPanel
          selectedPlant={state.selectedPlant}
          selectedStruct={state.selectedStruct}
          multiSelection={state.multiSelection}
        />
      </div>
    </div>
  )
}
