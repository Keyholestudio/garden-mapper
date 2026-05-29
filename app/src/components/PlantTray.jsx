// PlantTray.jsx — Left sidebar: plant/tool selection
// Phase 1: stub with correct structure — Phase 2 will port catalog + tools

import './PlantTray.css'

export default function PlantTray({ currentMode, onModeChange }) {
  return (
    <div className="plant-tray">
      <input className="tray-search" type="search" placeholder="Search plants..." />
      <div className="tray-scroll">
        <p className="tray-placeholder">Plant tray — Phase 2</p>
      </div>
    </div>
  )
}
