// MobileSheet.jsx — Mobile bottom sheet
// Contains: ↑↓ toggle, plant search + 2-col grid, tool menu
// Season is now controlled by a tap-to-cycle button in LogoBar (top right)

import { useState, useMemo } from 'react'
import { PLANT_CATALOG } from '../hooks/usePlantCatalog'
import { ToolMenu } from './toolMenuData.jsx'
import './MobileSheet.css'

export default function MobileSheet({
  loadedImages, onPlantClick,
  currentMode, onModeChange,
  bedSubTool, fenceSubTool, fenceType, pathSubTool, buildingSubTool, waterSubTool,
  onBedSubTool, onFenceSubTool, onFenceType, onPathSubTool, onBuildingSubTool, onWaterSubTool,
  showGrid, onToggleGrid, onResetView, onClearAll,
}) {
  const [expanded, setExpanded] = useState(true)
  const [query, setQuery] = useState('')
  const [searchFocused, setSearchFocused] = useState(false)

  const filtered = useMemo(() => {
    if (!query.trim()) return PLANT_CATALOG
    const q = query.toLowerCase()
    return PLANT_CATALOG.filter(p =>
      p.label.toLowerCase().includes(q) || p.family.toLowerCase().includes(q)
    )
  }, [query])

  return (
    <div className={`mobile-sheet${expanded ? ' expanded' : ' collapsed'}`}>

      {/* ── Toggle handle ── */}
      <div className="mobile-sheet-handle" onPointerDown={e => e.stopPropagation()}>
        <button
          className="mobile-sheet-toggle"
          onClick={() => setExpanded(v => !v)}
          aria-label={expanded ? 'Collapse menu' : 'Expand menu'}
        >
          {expanded ? '↓' : '↑'}
        </button>
      </div>

      {/* ── Sheet body ── */}
      {expanded && (
        <div className="mobile-sheet-body" onPointerDown={e => e.stopPropagation()}>

          {/* Plant search */}
          <input
            className="mobile-plant-search"
            type="search"
            placeholder="Search plants..."
            value={query}
            onChange={e => setQuery(e.target.value)}
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setSearchFocused(false)}
          />

          {/* Plant grid — expands to full height when search is focused */}
          <div className={`mobile-plant-grid${searchFocused ? ' search-active' : ''}`}>
            {filtered.length === 0 && (
              <div className="mobile-no-results">No results</div>
            )}
            {filtered.map(entry => {
              const img = loadedImages?.[entry.key]
              const loaded = img && typeof img !== 'string'
              return (
                <div
                  key={entry.key}
                  className={`mobile-plant-item${loaded ? '' : ' mobile-plant-loading'}`}
                  onClick={() => loaded && onPlantClick?.({ ...entry, _img: img })}
                  title={entry.label}
                >
                  {loaded
                    ? <img src={entry.src} alt={entry.label} draggable={false} />
                    : <div className="mobile-plant-placeholder" />}
                  <span>{entry.label}</span>
                </div>
              )
            })}
          </div>

          {/* Tool menu — hidden while search keyboard is open */}
          {!searchFocused && (
            <>
              <div className="mobile-sheet-divider" />
              <div className="mobile-tool-section">
                <ToolMenu
                  currentMode={currentMode}         onModeChange={onModeChange}
                  bedSubTool={bedSubTool}           onBedSubTool={onBedSubTool}
                  fenceSubTool={fenceSubTool}       onFenceSubTool={onFenceSubTool}
                  fenceType={fenceType}             onFenceType={onFenceType}
                  pathSubTool={pathSubTool}         onPathSubTool={onPathSubTool}
                  buildingSubTool={buildingSubTool} onBuildingSubTool={onBuildingSubTool}
                  waterSubTool={waterSubTool}       onWaterSubTool={onWaterSubTool}
                  showGrid={showGrid}               onToggleGrid={onToggleGrid}
                  onResetView={onResetView}         onClearAll={onClearAll}
                  extraClass="mobile-tool-menu"
                />
              </div>
            </>
          )}

        </div>
      )}
    </div>
  )
}
