// LogoBar.jsx — matches v8 #logo-bar exactly
// Left: scale display + season badge
// Center: logo (flex:1, centered)
// Right: garden name/dims + Save + Gardens + YouTube + Profile circle

import './LogoBar.css'

const SEASON_NAMES       = ['🌸 Spring', '☀️ Summer', '🍂 Fall', '❄️ Winter']
const SEASON_BADGE_CLASS = ['spring', 'summer', 'fall', 'winter']

// Cell size display — matches v8 scale-display logic
const CELL_IN = 3  // 3 inches per cell at base zoom

export default function LogoBar({
  gardenName, gardenW, gardenH, gardenUnit,
  currentSeason, onSeasonChange,
  onSave, onOpenSwitcher, onExport, saveFlash,
  scaleLabel,
  isMobile,
  onOpenSwitcherMobile,
}) {
  // Mobile: logo + season cycle button (top-right)
  if (isMobile) {
    const cycleSeason = () => onSeasonChange?.((currentSeason + 1) % 4)
    return (
      <div className="logo-bar logo-bar-mobile">
        {/* Season cycle — top left */}
        <button
          className={`season-cycle-btn season-cycle-${['spring','summer','fall','winter'][currentSeason]}`}
          onClick={cycleSeason}
          title={`Season: ${SEASON_NAMES[currentSeason]} — tap to advance`}
        >
          {SEASON_NAMES[currentSeason]}
        </button>
        <div className="logo-center logo-center-mobile">
          <img src="/stickers/Logo.png" alt="Garden Mapper" className="logo-img logo-img-mobile" />
        </div>
        {/* Right group: Save + Profile */}
        <div className="logo-mobile-right">
          <button
            className={`logo-mobile-save${saveFlash ? ' flash' : ''}`}
            onClick={onSave}
            title="Save garden"
          >💾</button>
          <button className="logo-profile-btn logo-profile-mobile" title="Profile">👤</button>
        </div>
      </div>
    )
  }

  return (
    <div className="logo-bar">

      {/* LEFT — scale display + season badge (matches v8 #logo-left) */}
      <div className="logo-left">
        <div className="scale-display">{scaleLabel || '1 cell = 3 in'}</div>
        <div className={`season-badge season-${SEASON_BADGE_CLASS[currentSeason]}`}>
          {SEASON_NAMES[currentSeason]}
        </div>
      </div>

      {/* CENTER — logo (matches v8 #logo-center) */}
      <div className="logo-center">
        <img src="/stickers/Logo.png" alt="Garden Mapper" className="logo-img" />
      </div>

      {/* RIGHT — garden info + buttons (matches v8 #logo-right) */}
      <div className="logo-right">
        <div className="garden-info">
          <span className="garden-name">{gardenName}</span>
          <span className="garden-dims">{gardenW}×{gardenH} {gardenUnit}</span>
        </div>

        <button
          className={`logo-btn${saveFlash ? ' flash' : ''}`}
          onClick={onSave}
          title="Save garden"
        >
          💾 Save
        </button>

        <button
          className="logo-btn"
          onClick={onOpenSwitcher}
          title="Switch gardens"
        >
          🌿 Gardens
        </button>

        <button
          className="logo-btn"
          onClick={onExport}
          title="Export garden plan as PDF"
        >
          🖨 Export
        </button>

        {/* YouTube button (matches v8 #logo-yt-btn) */}
        <a className="logo-yt-btn" href="#" title="YouTube">
          <svg width="22" height="16" viewBox="0 0 22 16" fill="none">
            <rect width="22" height="16" rx="4" fill="#11502A"/>
            <polygon points="9,4 9,12 16,8" fill="white"/>
          </svg>
        </a>

        {/* Profile circle (matches v8 #logo-profile-btn) */}
        <button className="logo-profile-btn" title="Profile">👤</button>
      </div>

    </div>
  )
}
