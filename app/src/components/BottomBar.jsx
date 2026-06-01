// BottomBar.jsx — Bottom floating card: season slider only
// Tools have moved to RightPanel. Mobile: also shows plant search + grid.
import { useEffect, useRef, useState, useMemo } from 'react'
import { PLANT_CATALOG } from '../hooks/usePlantCatalog'
import './BottomBar.css'

const SEASONS = ['🌸 Spring', '☀️ Summer', '🍂 Fall', '❄️ Winter']

export default function BottomBar({
  currentSeason, onSeasonChange,
  isMobile, loadedImages, onPlantClick,
}) {
  const [mobileQuery, setMobileQuery] = useState('')
  const mobileFiltered = useMemo(() => {
    if (!mobileQuery.trim()) return PLANT_CATALOG
    const q = mobileQuery.toLowerCase()
    return PLANT_CATALOG.filter(p =>
      p.label.toLowerCase().includes(q) || p.family.toLowerCase().includes(q)
    )
  }, [mobileQuery])
  const wrapRef = useRef(null)
  const lblRefs = [useRef(null), useRef(null), useRef(null), useRef(null)]

  // Position labels under each thumb stop — mirrors v8 positionSeasonLabels()
  const positionLabels = () => {
    const wrap = wrapRef.current
    if (!wrap) return
    const thumbW = 20
    const trackW = wrap.offsetWidth
    const usable = trackW - thumbW
    lblRefs.forEach((ref, i) => {
      if (!ref.current) return
      const px = thumbW / 2 + (i / 3) * usable
      ref.current.style.left = px + 'px'
    })
  }

  useEffect(() => {
    positionLabels()
    const ro = new ResizeObserver(positionLabels)
    if (wrapRef.current) ro.observe(wrapRef.current)
    window.addEventListener('resize', positionLabels)
    return () => { ro.disconnect(); window.removeEventListener('resize', positionLabels) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="bottom-wrap">
      <div className="bottom-card">

        {/* ── Mobile: search + plant grid ── */}
        {isMobile && (
          <>
            <input
              className="mobile-plant-search"
              type="search"
              placeholder="Search plants..."
              value={mobileQuery}
              onChange={e => setMobileQuery(e.target.value)}
            />
            <div className="mobile-plant-grid">
              {mobileFiltered.map(entry => {
                const img = loadedImages?.[entry.key]
                const loaded = img && typeof img !== 'string'
                return (
                  <div
                    key={entry.key}
                    className={`mobile-plant-item${loaded ? '' : ' mobile-plant-loading'}`}
                    onClick={() => loaded && onPlantClick && onPlantClick({ ...entry, _img: img })}
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
          </>
        )}

        {/* ── Season slider ── */}
        <div className="season-slider-area">
          <div className="season-slider-wrap" ref={wrapRef}>
            <input
              type="range" min={0} max={3} step={1}
              value={currentSeason}
              onChange={e => onSeasonChange(Number(e.target.value))}
              className="season-slider"
            />
            <div className="season-labels">
              {SEASONS.map((s, i) => (
                <span
                  key={i}
                  ref={lblRefs[i]}
                  className={`season-lbl${currentSeason === i ? ' active' : ''}`}
                >{s}</span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
