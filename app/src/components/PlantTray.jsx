// PlantTray.jsx — Left sidebar: plant catalog, search, click-to-place, drag-to-place

import { useState, useMemo } from 'react'
import { PLANT_CATALOG } from '../hooks/usePlantCatalog'
import './PlantTray.css'

export default function PlantTray({
  loadedImages, onPlantClick, onPlantDragStart, onPlantDragEnd,
  // Recently used (from useRecentPlants hook in GardenEditor)
  recents, onAddRecent, onRemoveRecent, onClearRecents, recentsHidden, onSetRecentsHidden,
}) {
  const [query, setQuery] = useState('')

  const filtered = useMemo(() => {
    if (!query.trim()) return PLANT_CATALOG
    const q = query.toLowerCase()
    return PLANT_CATALOG.filter(p =>
      p.label.toLowerCase().includes(q) || p.family.toLowerCase().includes(q)
    )
  }, [query])

  const handleClick = (entry) => {
    const img = loadedImages?.[entry.key]
    if (!img || typeof img === 'string') return
    const enriched = { ...entry, _img: img }
    onAddRecent?.(entry)
    if (onPlantClick) onPlantClick(enriched)
  }

  const handleDragStart = (entry, e) => {
    const img = loadedImages?.[entry.key]
    if (!img || typeof img === 'string') return
    const enriched = { ...entry, _img: img }
    e.dataTransfer.setData('text/plain', entry.key)
    e.dataTransfer.effectAllowed = 'copy'
    try {
      const GHOST = 48
      const offscreen = document.createElement('canvas')
      offscreen.width  = GHOST
      offscreen.height = GHOST
      const ctx = offscreen.getContext('2d')
      ctx.globalAlpha = 0.85
      ctx.drawImage(img, 0, 0, GHOST, GHOST)
      offscreen.style.cssText = 'position:fixed;top:-200px;left:-200px;'
      document.body.appendChild(offscreen)
      e.dataTransfer.setDragImage(offscreen, GHOST / 2, GHOST / 2)
      requestAnimationFrame(() => document.body.removeChild(offscreen))
    } catch (_) {}
    onAddRecent?.(entry)
    if (onPlantDragStart) onPlantDragStart(enriched)
  }

  const showRecents = recents?.length > 0 && !query && !recentsHidden

  return (
    <div className="plant-tray">
      <input
        className="tray-search"
        type="search"
        placeholder="Search plants..."
        value={query}
        onChange={e => setQuery(e.target.value)}
      />
      <div className="tray-scroll" id="tray-scroll">

        {/* ── Recently Used section ── */}
        {recents?.length > 0 && !query && (
          <div className="tray-recents-wrap">
            <div className="tray-section-header">
              <span className="tray-section-label">Recently Used</span>
              <div className="tray-section-actions">
                <button
                  className="tray-recents-toggle"
                  onClick={() => onSetRecentsHidden?.(!recentsHidden)}
                  title={recentsHidden ? 'Show recently used' : 'Hide recently used'}
                >
                  {recentsHidden ? 'Show' : 'Hide'}
                </button>
                {!recentsHidden && (
                  <button
                    className="tray-recents-clear"
                    onClick={() => onClearRecents?.()}
                    title="Clear all recently used"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>

            {showRecents && (
              <>
                {recents.map(entry => (
                  <TrayItem
                    key={entry.key + '_r'}
                    entry={entry}
                    loadedImages={loadedImages}
                    onClick={handleClick}
                    onDragStart={handleDragStart}
                    onRemove={() => onRemoveRecent?.(entry.key)}
                    showRemove
                  />
                ))}
                <div className="tray-divider" />
              </>
            )}
          </div>
        )}

        {/* ── No results ── */}
        {filtered.length === 0 && query.trim() && (
          <div className="tray-no-results">
            <div>No results for "{query}"</div>
            <a
              className="tray-submit-plant"
              href="https://docs.google.com/forms/d/e/1FAIpQLScJ5k2ZNqP3SSWe9MwjJQCyIV5TqNDZyUk0Qnch8UjkAQfL8A/viewform"
              target="_blank"
              rel="noopener noreferrer"
            >Need a plant? Submit it! ↗</a>
          </div>
        )}

        {/* ── Full catalog ── */}
        {filtered.map(e => (
          <TrayItem key={e.key} entry={e} loadedImages={loadedImages}
            onClick={handleClick} onDragStart={handleDragStart} />
        ))}
      </div>
    </div>
  )
}

function TrayItem({ entry, loadedImages, onClick, onDragStart, onRemove, showRemove }) {
  const img = loadedImages?.[entry.key]
  const loaded = img && typeof img === 'object'

  return (
    <div
      className={`tray-item${loaded ? '' : ' tray-item-loading'}${showRemove ? ' tray-item-removable' : ''}`}
      draggable={loaded}
      onClick={() => loaded && onClick(entry)}
      onDragStart={loaded ? (e) => onDragStart(entry, e) : undefined}
      title={`${entry.label} — ${entry.family}`}
    >
      {loaded
        ? <img src={entry.src} alt={entry.label} draggable={false} />
        : <div className="tray-img-placeholder" />
      }
      <span>{entry.label}</span>
      {showRemove && (
        <button
          className="tray-item-remove"
          onClick={e => { e.stopPropagation(); onRemove?.() }}
          title="Remove from recent"
        >×</button>
      )}
    </div>
  )
}
