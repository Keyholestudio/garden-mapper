// LogoBar.jsx — Top bar: logo image + garden name/dims + season badge + save/switcher buttons
import './LogoBar.css'

const SEASON_NAMES  = ['🌸 Spring', '☀️ Summer', '🍂 Fall', '❄️ Winter']
const SEASON_BADGE_CLASS = ['spring', 'summer', 'fall', 'winter']

export default function LogoBar({
  gardenName, gardenW, gardenH, gardenUnit, currentSeason,
  onSave, onOpenSwitcher, saveFlash,
}) {
  return (
    <div className="logo-bar">
      <div className="logo-left">
        <button
          className={`btn-save-garden${saveFlash ? ' flash' : ''}`}
          onClick={onSave}
          title="Save garden"
        >
          💾 Save
        </button>
        <button
          className="btn-switcher"
          onClick={onOpenSwitcher}
          title="Switch gardens"
        >
          🌿 Gardens
        </button>
      </div>
      <div className="logo-center">
        <img src="/stickers/Logo.png" alt="Garden Mapper" className="logo-img" />
      </div>
      <div className="logo-right">
        <span className={`season-badge season-${SEASON_BADGE_CLASS[currentSeason]}`}>
          {SEASON_NAMES[currentSeason]}
        </span>
        <div className="garden-info">
          <span className="garden-name">{gardenName}</span>
          <span className="garden-dims">{gardenW}×{gardenH} {gardenUnit}</span>
        </div>
      </div>
    </div>
  )
}
