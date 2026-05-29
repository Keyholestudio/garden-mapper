// GardenEditor.jsx — Top-level layout shell
// Mirrors the v8 prototype layout: LogoBar + Tray (left) + Canvas (center) + RightPanel
// Components are stubbed — ready to be filled in from prototype logic

import { useState } from 'react'
import LogoBar from './LogoBar'
import PlantTray from './PlantTray'
import GardenCanvas from './GardenCanvas'
import RightPanel from './RightPanel'
import './GardenEditor.css'

export default function GardenEditor() {
  const [selectedTool, setSelectedTool] = useState(null)
  const [selectedObject, setSelectedObject] = useState(null)
  const [season, setSeason] = useState(0) // 0=Spring, 1=Summer, 2=Fall, 3=Winter

  return (
    <div className="editor-layout">
      <LogoBar season={season} onSeasonChange={setSeason} />
      <div className="editor-body">
        <PlantTray selectedTool={selectedTool} onToolSelect={setSelectedTool} />
        <GardenCanvas
          selectedTool={selectedTool}
          season={season}
          onObjectSelect={setSelectedObject}
        />
        <RightPanel selectedObject={selectedObject} />
      </div>
    </div>
  )
}
