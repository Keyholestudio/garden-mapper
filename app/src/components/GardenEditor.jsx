// GardenEditor.jsx — Top-level layout shell
// Wires useGardenState hook to all child components

import { useRef } from 'react'
import { useGardenState } from '../hooks/useGardenState'
import LogoBar from './LogoBar'
import PlantTray from './PlantTray'
import GardenCanvas from './GardenCanvas'
import RightPanel from './RightPanel'
import SetupOverlay from './SetupOverlay'
import './GardenEditor.css'

export default function GardenEditor() {
  const state = useGardenState()
  const stageRef  = useRef(null)
  const layersRef = useRef({})

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
          currentMode={state.currentMode}
          onModeChange={state.setCurrentMode}
        />
        <GardenCanvas
          gardenName={state.gardenName}
          gardenW={state.gardenW}
          gardenH={state.gardenH}
          gardenUnit={state.gardenUnit}
          currentSeason={state.currentSeason}
          showGrid={state.showGrid}
          propBoundsRef={state.propBoundsRef}
          onStageReady={handleStageReady}
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
