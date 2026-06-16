// LogoBar.jsx — matches v8 #logo-bar exactly
// Left: scale display + season badge
// Center: logo (flex:1, centered)
// Right: garden name/dims + Save + Gardens + YouTube + Profile circle

import { useState } from 'react'
import { createPortal } from 'react-dom'
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
  user,
  onSignIn,
  onSignOut,
}) {
  // Hooks must always be called at the top level — never inside conditionals
  const [menuOpen, setMenuOpen] = useState(false)
  const closeMenu = () => setMenuOpen(false)

  // Mobile: logo + season cycle button (left) + save + profile menu (right)
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

          <button
            className={`logo-profile-btn logo-profile-mobile${menuOpen ? ' active' : ''}`}
            onClick={() => setMenuOpen(v => !v)}
            title="Menu"
          >👤</button>
        </div>

        {/* Profile dropdown menu — portalled to document.body so it escapes all stacking contexts */}
        {menuOpen && createPortal(
          <>
            {/* Backdrop — tap outside to close */}
            <div className="profile-menu-backdrop" onClick={closeMenu} />

            <div className="profile-menu">
              {/* User info header */}
              <div className="profile-menu-header">
                <div className="profile-menu-avatar">{user ? '👋' : '👤'}</div>
                <div className="profile-menu-info">
                  <div className="profile-menu-garden">{gardenName || 'My Garden'}</div>
                  {user
                    ? <div className="profile-menu-dims" style={{color:'#11502A',fontWeight:600}}>✓ Signed in</div>
                    : <div className="profile-menu-dims">{gardenW}×{gardenH} {gardenUnit}</div>
                  }
                </div>
              </div>

              <div className="profile-menu-divider" />

              {/* Garden actions */}
              <button className="profile-menu-item" onClick={() => { onOpenSwitcher?.(); closeMenu() }}>
                <span className="profile-menu-icon">🌿</span>
                <span>Gardens</span>
                <span className="profile-menu-hint">Switch or create</span>
              </button>

              <button className="profile-menu-item" onClick={() => { onExport?.(); closeMenu() }}>
                <span className="profile-menu-icon">🖨</span>
                <span>Export PDF</span>
                <span className="profile-menu-hint">Print your plan</span>
              </button>

              <div className="profile-menu-divider" />

              {/* Plants */}
              <a
                className="profile-menu-item"
                href="https://docs.google.com/forms/d/e/1FAIpQLScJ5k2ZNqP3SSWe9MwjJQCyIV5TqNDZyUk0Qnch8UjkAQfL8A/viewform"
                target="_blank"
                rel="noopener noreferrer"
                onClick={closeMenu}
              >
                <span className="profile-menu-icon">🌱</span>
                <span>Submit a Plant</span>
                <span className="profile-menu-hint">Request a new sticker</span>
              </a>

              <div className="profile-menu-divider" />

              {/* Account */}
              {user ? (
                <>
                  <div className="profile-menu-user">
                    <span className="profile-menu-icon">👤</span>
                    <span className="profile-menu-email">{user.email || 'Signed in'}</span>
                  </div>
                  <button className="profile-menu-item" onClick={() => { onSignOut?.(); closeMenu(); }}>
                    <span className="profile-menu-icon">🚪</span>
                    <span>Sign Out</span>
                  </button>
                </>
              ) : (
                <button className="profile-menu-item profile-menu-item--signin" onClick={() => { onSignIn?.(); closeMenu(); }}>
                  <span className="profile-menu-icon">🔑</span>
                  <span>Sign in with Google</span>
                  <span className="profile-menu-hint">Save to cloud</span>
                </button>
              )}
              <button className="profile-menu-item profile-menu-item--soon" disabled>
                <span className="profile-menu-icon">💳</span>
                <span>Subscription</span>
                <span className="profile-menu-badge">Soon</span>
              </button>

              <div className="profile-menu-divider" />

              {/* Website */}
              <a
                className="profile-menu-item"
                href="https://robs-lab.ca"
                target="_blank"
                rel="noopener noreferrer"
                onClick={closeMenu}
              >
                <span className="profile-menu-icon">🌐</span>
                <span>Our Website</span>
                <span className="profile-menu-hint">robs-lab.ca</span>
              </a>
            </div>
          </>
        , document.body)}
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
