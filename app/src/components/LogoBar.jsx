// LogoBar.jsx — Top bar: logo image + garden name/dims + season badge
import './LogoBar.css'

const SEASON_NAMES  = ['🌸 Spring', '☀️ Summer', '🍂 Fall', '❄️ Winter']
const SEASON_BADGE_CLASS = ['spring', 'summer', 'fall', 'winter']

export default function LogoBar({ gardenName, gardenW, gardenH, gardenUnit, currentSeason }) {
  return (
    <div className="logo-bar">
      <div className="logo-left" />
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
