// LogoBar.jsx — Top bar with logo, season slider, garden name/dims
// Stub — port from v8 prototype

export default function LogoBar({ season, onSeasonChange }) {
  const seasons = ['Spring', 'Summer', 'Fall', 'Winter']

  return (
    <div className="logo-bar">
      <div className="logo-left">
        <span className="logo-text">🌿 Garden Mapper</span>
      </div>
      <div className="logo-center">
        <input
          type="range"
          min={0} max={3} step={1}
          value={season}
          onChange={e => onSeasonChange(Number(e.target.value))}
        />
        <div className="season-label">{seasons[season]}</div>
      </div>
      <div className="logo-right">
        <span className="garden-name">My Garden</span>
      </div>
    </div>
  )
}
