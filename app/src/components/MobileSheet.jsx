// MobileSheet.jsx — Mobile bottom sheet
// Contains: ↑↓ toggle, plant search + 2-col grid, tool menu (same as desktop right panel)
// Default: expanded (menu mode). Toggle collapses to just the handle bar.

import { useState, useMemo, useLayoutEffect, useRef } from 'react'
import { PLANT_CATALOG } from '../hooks/usePlantCatalog'
import { ToolMenu } from './toolMenuData.jsx'
import './MobileSheet.css'

const SEASONS = ['🌸 Spring', '☀️ Summer', '🍂 Fall', '❄️ Winter']

export default function MobileSheet({
  // Plant tray
  loadedImages, onPlantClick,
  // Season slider
  currentSeason, onSeasonChange,
  // Tool menu
  currentMode, onModeChange,
  bedSubTool, fenceSubTool, fenceType, pathSubTool, buildingSubTool, waterSubTool,
  onBedSubTool, onFenceSubTool, onFenceType, onPathSubTool, onBuildingSubTool, onWaterSubTool,
  showGrid, onToggleGrid, onResetView, onClearAll,
}) {
  const [expanded, setExpanded] = useState(true)  // default: menu mode
  const [query, setQuery] = useState('')
  const [searchFocused, setSearchFocused] = useState(false)

  const filtered = useMemo(() => {
    if (!query.trim()) return PLANT_CATALOG
    const q = query.toLowerCase()
    return PLANT_CATALOG.filter(p =>
      p.label.toLowerCase().includes(q) || p.family.toLowerCase().includes(q)
    )
  }, [query])

  // Season slider label positioning
  const wrapRef = useRef(null)
  const lblRefs = [useRef(null), useRef(null), useRef(null), useRef(null)]
  const positionLabels = () => {
    const wrap = wrapRef.current
    if (!wrap) return
    const thumbW = 20
    const usable = wrap.offsetWidth - thumbW
    lblRefs.forEach((ref, i) => {
      if (!ref.current) return
      ref.current.style.left = (thumbW / 2 + (i / 3) * usable) + 'px'
    })
  }
  useLayoutEffect(() => { positionLabels() })

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

      {/* ── Sheet body (only visible when expanded) ── */}
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

          {/* Plant grid — 2 columns, scrollable; expands when tools are hidden */}
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

          {/* Divider + tools hidden when keyboard is open (searchFocused) */}
          {!searchFocused && <div className="mobile-sheet-divider" />}

          {/* Tool menu — hidden while search keyboard is open */}
          {!searchFocused && <div className="mobile-tool-section">
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
          </div>}

          {/* Season slider — also hidden when keyboard open */}
          {!searchFocused && <>
          <div className="mobile-sheet-divider" />
          <div className="mobile-season-wrap" ref={wrapRef}>
            <input
              type="range" min={0} max={3} step={1}
              value={currentSeason}
              onChange={e => onSeasonChange(Number(e.target.value))}
              className="season-slider"
            />
            <div className="season-labels">
              {SEASONS.map((s, i) => (
                <span key={i} ref={lblRefs[i]}
                  className={`season-lbl${currentSeason === i ? ' active' : ''}`}
                >{s}</span>
              ))}
            </div>
          </div>
          </>}

        </div>
      )}
    </div>
  )
}
