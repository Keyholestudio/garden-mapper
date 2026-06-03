// toolMenuData.js — Shared tool menu data + ToolMenu component
// Used by both RightPanel (desktop/tablet) and MobileSheet (mobile)

import { useState } from 'react'

export const TOP_TOOLS = [
  { id: 'beds',     label: 'Beds',      emoji: '🌿' },
  { id: 'building', label: 'Buildings', emoji: '🏠' },
  { id: 'fences',   label: 'Fences',    emoji: '🪵' },
  { id: 'paths',    label: 'Paths',     emoji: '〰' },
  { id: 'water',    label: 'Water',     emoji: '💧' },
  { id: 'select',   label: 'Select',    emoji: '✋' },
]

export const BED_SUBS = [
  { id: 'curved',   label: 'Curved',   hint: 'Click points · Enter to close' },
  { id: 'straight', label: 'Straight', hint: 'Click points · angular edges'  },
  { id: 'square',   label: 'Square',   hint: 'Tap + drag rectangle'          },
]

export const FENCE_ITEMS = [
  { id: 'fence', label: 'Fence', hint: 'Open freeform line' },
  { id: 'gate',  label: 'Gate',  hint: 'Place a gate section' },
  {
    id: '__hedges', label: 'Hedges', emoji: '🌳', group: true,
    children: [
      { id: 'curved',   label: 'Curved Hedge',   hint: 'Click points · Enter to close' },
      { id: 'square',   label: 'Square Hedge',   hint: 'Tap + drag hedge rect' },
      { id: 'straight', label: 'Straight Hedge', hint: 'Angular hedge line' },
    ],
  },
]

export const PATH_SUBS = [
  { id: 'freeform', label: 'Freeform', hint: 'Click points · Enter to finish' },
]

export const BUILD_ITEMS = [
  { id: 'building', label: 'Building', hint: 'Tap + drag footprint' },
  {
    id: '__decks', label: 'Decks', emoji: '🪵', group: true,
    children: [
      { id: 'deck-curved',   label: 'Curved Deck',   hint: 'Click points · Enter to close' },
      { id: 'deck-straight', label: 'Straight Deck', hint: 'Angular deck line' },
      { id: 'deck-square',   label: 'Square Deck',   hint: 'Tap + drag deck rect' },
    ],
  },
  { id: 'underground-electrical', label: '⚡ Electrical', hint: 'Freeform underground run' },
]

export const WATER_ITEMS = [
  { id: 'fountain',             label: 'Fountain',   hint: 'Tap to place a fountain' },
  { id: 'underground-plumbing', label: '🔵 Plumbing', hint: 'Freeform underground plumbing run' },
  {
    id: '__pools', label: 'Pools', emoji: '🏊', group: true,
    children: [
      { id: 'pool-circle', label: 'Circular Pool', hint: 'Tap to place circular pool' },
      { id: 'pool-sq',     label: 'Square Pool',   hint: 'Tap + drag rectangular pool' },
    ],
  },
  { id: 'pond', label: 'Pond', hint: 'Freeform pond outline' },
]

export const ITEMS_MAP = {
  beds: BED_SUBS, fences: FENCE_ITEMS, paths: PATH_SUBS,
  building: BUILD_ITEMS, water: WATER_ITEMS,
}

// Helpers
export function getActiveSub(currentMode, bedSubTool, fenceSubTool, fenceType, pathSubTool, buildingSubTool, waterSubTool) {
  if (currentMode === 'beds')     return bedSubTool
  if (currentMode === 'fences')   return fenceType === 'fence' ? 'fence' : fenceType === 'gate' ? 'gate' : fenceSubTool
  if (currentMode === 'paths')    return pathSubTool
  if (currentMode === 'building') return buildingSubTool
  if (currentMode === 'water')    return waterSubTool
  return null
}

export function handleSubChange(id, currentMode, { onBedSubTool, onFenceType, onFenceSubTool, onPathSubTool, onBuildingSubTool, onWaterSubTool }) {
  if (currentMode === 'beds')     { onBedSubTool(id); return }
  if (currentMode === 'fences')   {
    if (id === 'fence') { onFenceType('fence'); return }
    if (id === 'gate')  { onFenceType('gate');  return }
    onFenceType('hedge'); onFenceSubTool(id); return
  }
  if (currentMode === 'paths')    { onPathSubTool(id); return }
  if (currentMode === 'building') { onBuildingSubTool(id); return }
  if (currentMode === 'water')    { onWaterSubTool(id); return }
}

// ── Shared ToolMenu component ─────────────────────────────────────────────────
// Used by RightPanel (desktop/tablet) and MobileSheet (mobile) 
// extraClass: optional CSS class added to the root panel-content div
export function ToolMenu({
  currentMode, onModeChange,
  bedSubTool, fenceSubTool, fenceType, pathSubTool, buildingSubTool, waterSubTool,
  onBedSubTool, onFenceSubTool, onFenceType, onPathSubTool, onBuildingSubTool, onWaterSubTool,
  showGrid, onToggleGrid, onResetView, onClearAll,
  extraClass = '',
}) {
  const [openGroup, setOpenGroup] = useState(null)
  const activeSub = getActiveSub(currentMode, bedSubTool, fenceSubTool, fenceType, pathSubTool, buildingSubTool, waterSubTool)
  const items = ITEMS_MAP[currentMode] || []

  const doSubChange = (id) => handleSubChange(id, currentMode, {
    onBedSubTool, onFenceType, onFenceSubTool, onPathSubTool, onBuildingSubTool, onWaterSubTool,
  })

  const groupHasActive = (g) =>
    g.children.some(c => c.id === activeSub ||
      (currentMode === 'fences' && fenceType === 'hedge' && c.id === fenceSubTool))

  const renderItem = (s) => (
    <button key={s.id}
      className={`tool-menu-btn${activeSub === s.id ? ' active' : ''}`}
      onClick={() => doSubChange(s.id)} title={s.hint}
    >
      <span className="tool-menu-label">{s.label}</span>
    </button>
  )

  const renderGroup = (g) => {
    const isOpen    = openGroup === g.id || groupHasActive(g)
    const hasActive = groupHasActive(g)
    return (
      <div key={g.id} className="tool-menu-group">
        <button
          className={`tool-menu-btn group-header${hasActive ? ' active' : ''}`}
          onClick={() => setOpenGroup(isOpen ? null : g.id)}
        >
          {g.emoji && <span className="tool-menu-emoji">{g.emoji}</span>}
          <span className="tool-menu-label">{g.label}</span>
          <span className="tool-menu-chevron">{isOpen ? '▾' : '▸'}</span>
        </button>
        {isOpen && (
          <div className="tool-menu-group-children">
            {g.children.map(c => renderItem(c))}
          </div>
        )}
      </div>
    )
  }

  // Sub-menu level
  if (currentMode && items.length > 0) {
    return (
      <div className={`panel-content tool-menu ${extraClass}`}>
        <button className="tool-menu-back" onClick={() => { onModeChange('select'); setOpenGroup(null) }}>
          ← Back
        </button>
        <div className="panel-h2" style={{ marginTop: 2, flexShrink: 0 }}>
          {TOP_TOOLS.find(t => t.id === currentMode)?.emoji}{' '}
          {TOP_TOOLS.find(t => t.id === currentMode)?.label}
        </div>
        <div className="panel-sep" style={{ flexShrink: 0 }} />
        <div className="tool-menu-items tool-menu-items--sub">
          {items.map(item => item.group ? renderGroup(item) : renderItem(item))}
        </div>
      </div>
    )
  }

  // Top-level tool list
  return (
    <div className={`panel-content tool-menu ${extraClass}`}>
      <div className="panel-h2" style={{ marginBottom: 2, flexShrink: 0 }}>Tools</div>
      <div className="tool-menu-items">
        {TOP_TOOLS.map(t => (
          <button key={t.id}
            className={`tool-menu-btn${currentMode === t.id ? ' active' : ''}`}
            onClick={() => { onModeChange(t.id); setOpenGroup(null) }}
          >
            <span className="tool-menu-emoji">{t.emoji}</span>
            <span className="tool-menu-label">{t.label}</span>
          </button>
        ))}
      </div>
      <div className="panel-sep menu-sep" />
      <div className="tool-menu-items">
        <button className={`tool-menu-btn utility${showGrid ? ' active' : ''}`} onClick={onToggleGrid}>
          <span className="tool-menu-emoji">⊞</span>
          <span className="tool-menu-label">Grid {showGrid ? 'On' : 'Off'}</span>
        </button>
        <button className="tool-menu-btn utility" onClick={onResetView}>
          <span className="tool-menu-emoji">⊙</span>
          <span className="tool-menu-label">Reset View</span>
        </button>
        <button className="tool-menu-btn utility danger" onClick={onClearAll}>
          <span className="tool-menu-emoji">🗑</span>
          <span className="tool-menu-label">Clear All</span>
        </button>
      </div>
    </div>
  )
}
