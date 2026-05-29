// SetupOverlay.jsx — Garden setup modal (name, dimensions, unit)
// Ported from v8 #setup-overlay

import './SetupOverlay.css'

export default function SetupOverlay({
  gardenName, gardenW, gardenH, gardenUnit,
  onSetGardenName, onSetGardenW, onSetGardenH, onSetGardenUnit,
  onStart,
}) {
  return (
    <div className="setup-overlay">
      <div className="setup-card">
        <div className="setup-logo">🌿 Garden Mapper</div>
        <h2>Set Up Your Garden</h2>
        <p className="setup-sub">Enter your property details to get started.</p>

        <div className="setup-field">
          <label>Garden Name</label>
          <input
            type="text"
            value={gardenName}
            placeholder="My Garden"
            onChange={e => onSetGardenName(e.target.value)}
          />
        </div>

        <div className="setup-field">
          <label>
            Dimensions&nbsp;
            <span className="setup-unit-label">
              (width × depth in {gardenUnit})
            </span>
          </label>
          <div className="setup-dims">
            <input
              type="number" min="1" max="1000"
              value={gardenW}
              onChange={e => onSetGardenW(parseFloat(e.target.value) || 60)}
            />
            <span>×</span>
            <input
              type="number" min="1" max="1000"
              value={gardenH}
              onChange={e => onSetGardenH(parseFloat(e.target.value) || 40)}
            />
          </div>
        </div>

        <div className="setup-field">
          <label>Unit</label>
          <div className="setup-units">
            <button
              className={gardenUnit === 'ft' ? 'active' : ''}
              onClick={() => onSetGardenUnit('ft')}
            >ft</button>
            <button
              className={gardenUnit === 'm' ? 'active' : ''}
              onClick={() => onSetGardenUnit('m')}
            >m</button>
          </div>
        </div>

        <button className="setup-start" onClick={onStart}>
          Start Planning →
        </button>
      </div>
    </div>
  )
}
