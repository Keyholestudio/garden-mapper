// PlantTray.jsx — Left sidebar: plant catalog, search, click-to-place, drag-to-place

import { useState, useMemo, useRef } from 'react'
import { PLANT_CATALOG } from '../hooks/usePlantCatalog'
import './PlantTray.css'

export default function PlantTray({ loadedImages, onPlantClick, onPlantDragStart, onPlantDragEnd }) {
  const [query, setQuery]   = useState('')
  const [recents, setRecents] = useState([])

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
    setRecents(prev => {
      const next = prev.filter(r => r.key !== entry.key)
      return [enriched, ...next].slice(0, 5)
    })
    if (onPlantClick) onPlantClick(enriched)
  }

  const handleDragStart = (entry, e) => {
    const img = loadedImages?.[entry.key]
    if (!img || typeof img === 'string') return
    const enriched = { ...entry, _img: img }
    e.dataTransfer.setData('text/plain', entry.key)
    e.dataTransfer.effectAllowed = 'copy'
    // Draw a small 48×48 ghost onto an offscreen canvas so the drag image
    // is compact and doesn't blow up to the raw sticker dimensions.
    try {
      const GHOST = 48
      const offscreen = document.createElement('canvas')
      offscreen.width  = GHOST
      offscreen.height = GHOST
      const ctx = offscreen.getContext('2d')
      ctx.globalAlpha = 0.85
      ctx.drawImage(img, 0, 0, GHOST, GHOST)
      // Position offscreen element so Chrome doesn't complain
      offscreen.style.cssText = 'position:fixed;top:-200px;left:-200px;'
      document.body.appendChild(offscreen)
      e.dataTransfer.setDragImage(offscreen, GHOST / 2, GHOST / 2)
      // Clean up after the drag starts
      requestAnimationFrame(() => document.body.removeChild(offscreen))
    } catch (_) {
      // Fallback: no custom ghost (browser default)
    }
    if (onPlantDragStart) onPlantDragStart(enriched)
  }

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
        {recents.length > 0 && !query && (
          <>
            <div className="tray-section-label">Recently Used</div>
            {recents.map(e => (
              <TrayItem key={e.key + '_r'} entry={e} loadedImages={loadedImages}
                onClick={handleClick} onDragStart={handleDragStart} />
            ))}
            <div className="tray-divider" />
          </>
        )}
        {filtered.length === 0 && <div className="tray-no-results">No results</div>}
        {filtered.map(e => (
          <TrayItem key={e.key} entry={e} loadedImages={loadedImages}
            onClick={handleClick} onDragStart={handleDragStart} />
        ))}
      </div>
    </div>
  )
}

function TrayItem({ entry, loadedImages, onClick, onDragStart }) {
  const img = loadedImages?.[entry.key]
  const loaded = img && typeof img !== 'string'

  return (
    <div
      className={`tray-item${loaded ? '' : ' tray-item-loading'}`}
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
    </div>
  )
}
