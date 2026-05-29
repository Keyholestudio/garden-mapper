// SetupOverlay.jsx — Garden setup modal, styled to match v8 exactly
import { useState } from 'react'
import './SetupOverlay.css'

export default function SetupOverlay({
  gardenName, gardenW, gardenH, gardenUnit,
  onSetGardenName, onSetGardenW, onSetGardenH, onSetGardenUnit,
  onStart,
}) {
  // Local string state for dimension inputs — avoids controlled-input flicker on delete
  const [wStr, setWStr] = useState(String(gardenW))
  const [hStr, setHStr] = useState(String(gardenH))

  const handleStart = () => {
    const w = parseFloat(wStr) || 60
    const h = parseFloat(hStr) || 40
    onSetGardenW(w)
    onSetGardenH(h)
    onStart()
  }

  return (
    <div className="setup-overlay">
      <div className="setup-modal">
        <h2>🌿 Your Garden Map</h2>
        <p>Enter your property dimensions to calibrate the grid.</p>

        <div className="field-row">
          <label>Garden Name</label>
          <input
            type="text"
            value={gardenName}
            placeholder="My Garden"
            onChange={e => onSetGardenName(e.target.value)}
          />
        </div>

        <div className="field-row">
          <label>Units</label>
          <div className="unit-row">
            <button
              className={`unit-btn${gardenUnit === 'ft' ? ' active' : ''}`}
              onClick={() => onSetGardenUnit('ft')}
            >Feet</button>
            <button
              className={`unit-btn${gardenUnit === 'm' ? ' active' : ''}`}
              onClick={() => onSetGardenUnit('m')}
            >Metres</button>
          </div>
        </div>

        <div className="field-row">
          <label>Size <span className="field-hint">(width × depth in {gardenUnit === 'ft' ? 'ft' : 'm'})</span></label>
          <div className="dims-row">
            <input
              type="number" min="5" max="500"
              value={wStr}
              onChange={e => setWStr(e.target.value)}
              onBlur={() => { const v = parseFloat(wStr); if (v >= 5) onSetGardenW(v); else setWStr('60') }}
            />
            <span>×</span>
            <input
              type="number" min="5" max="500"
              value={hStr}
              onChange={e => setHStr(e.target.value)}
              onBlur={() => { const v = parseFloat(hStr); if (v >= 5) onSetGardenH(v); else setHStr('40') }}
            />
          </div>
        </div>

        <button className="btn-start" onClick={handleStart}>
          Create Garden →
        </button>
      </div>
    </div>
  )
}
