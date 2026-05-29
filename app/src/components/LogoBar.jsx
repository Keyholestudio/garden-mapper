// LogoBar.jsx — Top bar: logo, season slider, garden name, grid toggle
// Phase 1: season switching + grid toggle wired

import './LogoBar.css'

const SEASON_NAMES  = ['🌸 Spring', '☀️ Summer', '🍂 Fall', '❄️ Winter']
const SEASON_BADGES = ['spring', 'summer', 'fall', 'winter']

export default function LogoBar({
  gardenName, gardenW, gardenH, gardenUnit,
  currentSeason, onSeasonChange,
  showGrid, onToggleGrid,
}) {
  return (
    <div className="logo-bar">
      {/* Left — scale/grid */}
      <div className="logo-left">
        <button
          className={`logo-btn${showGrid ? ' active' : ''}`}
          onClick={onToggleGrid}
          title="Toggle grid"
        >⊞ Grid</button>
      </div>

      {/* Center — logo */}
      <div className="logo-center">
        <span className="logo-text">🌿 Garden Mapper</span>
      </div>

      {/* Right — season + garden info */}
      <div className="logo-right">
        <div className="season-slider-wrap">
          <input
            type="range" min={0} max={3} step={1}
            value={currentSeason}
            onChange={e => onSeasonChange(Number(e.target.value))}
          />
          <span className={`season-badge season-${SEASON_BADGES[currentSeason]}`}>
            {SEASON_NAMES[currentSeason]}
          </span>
        </div>
        <div className="garden-info">
          <span className="garden-name">{gardenName}</span>
          <span className="garden-dims">{gardenW}×{gardenH} {gardenUnit}</span>
        </div>
      </div>
    </div>
  )
}
