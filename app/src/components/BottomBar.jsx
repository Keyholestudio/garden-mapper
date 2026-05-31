// BottomBar.jsx — Bottom floating card: toolbar + season slider (matches v8 layout)
// Mobile: full bottom sheet with plant tray embedded
import { useEffect, useRef, useState, useMemo } from 'react'
import { PLANT_CATALOG } from '../hooks/usePlantCatalog'
import './BottomBar.css'

const SEASONS = ['🌸 Spring', '☀️ Summer', '🍂 Fall', '❄️ Winter']

const MODES = [
  { id: 'select',   label: '✋ Select'   },
  { id: 'beds',     label: '🌿 Beds'    },
  { id: 'fences',   label: '🪵 Fences'  },
  { id: 'paths',    label: '〰 Paths'   },
  { id: 'building', label: '🏠 Build'   },
  { id: 'water',    label: '💧 Water'   },
]

const BED_SUBS    = [{ id:'curved', label:'Curved' }, { id:'straight', label:'Straight' }, { id:'square', label:'Square' }]
const FENCE_SUBS  = [{ id:'curved', label:'Hedge Curved' }, { id:'straight', label:'Hedge Straight' }, { id:'square', label:'Hedge Square' }, { id:'fence', label:'Open Fence' }]
const PATH_SUBS   = [{ id:'freeform', label:'Freeform' }, { id:'gate', label:'Gate' }]
const BUILD_SUBS  = [
  { id:'building',      label:'Building'      },
  { id:'deck-curved',   label:'Deck Curved'   },
  { id:'deck-straight', label:'Deck Straight' },
  { id:'deck-square',   label:'Deck Square'   },
  { id:'underground-electrical', label:'⚡ Electrical' },
  { id:'underground-plumbing',   label:'💧 Plumbing'   },
]
const WATER_SUBS  = [
  { id:'pond',        label:'Pond'        },
  { id:'fountain',    label:'Fountain'    },
  { id:'pool-sq',     label:'Pool Rect'   },
  { id:'pool-circle', label:'Pool Circle' },
]

export default function BottomBar({
  currentMode, onModeChange,
  bedSubTool, onBedSubTool,
  fenceSubTool, fenceType, onFenceSubTool, onFenceType,
  pathSubTool, onPathSubTool,
  buildingSubTool, onBuildingSubTool,
  waterSubTool, onWaterSubTool,
  currentSeason, onSeasonChange,
  showGrid, onToggleGrid,
  onResetView, onClearAll,
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
  const subTools =
    currentMode === 'beds'     ? BED_SUBS :
    currentMode === 'fences'   ? FENCE_SUBS :
    currentMode === 'paths'    ? PATH_SUBS :
    currentMode === 'building' ? BUILD_SUBS :
    currentMode === 'water'    ? WATER_SUBS : []

  const activeSub =
    currentMode === 'beds'     ? bedSubTool :
    currentMode === 'fences'   ? (fenceType === 'fence' ? 'fence' : fenceSubTool) :
    currentMode === 'paths'    ? pathSubTool :
    currentMode === 'building' ? buildingSubTool :
    currentMode === 'water'    ? waterSubTool : null

  const onSubChange = (id) => {
    if (currentMode === 'beds')     { onBedSubTool(id); return }
    if (currentMode === 'fences')   {
      if (id === 'fence') { onFenceType('fence'); return }
      onFenceType('hedge'); onFenceSubTool(id); return
    }
    if (currentMode === 'paths')    { onPathSubTool(id); return }
    if (currentMode === 'building') {
      // underground sub-tools set buildingSubTool to the full string
      onBuildingSubTool(id); return
    }
    if (currentMode === 'water')    { onWaterSubTool(id); return }
  }

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

        {/* ── Toolbar row ── */}
        <div className="toolbar-row">
          {MODES.map(m => (
            <button
              key={m.id}
              className={`tool-btn${currentMode === m.id ? ' active' : ''}`}
              onClick={() => onModeChange(m.id)}
            >{m.label}</button>
          ))}
          <div className="tool-sep" />
          <button className={`tool-btn${showGrid ? ' active' : ''}`} onClick={onToggleGrid}>⊞ Grid</button>
          <button className="tool-btn" onClick={onResetView}>⊙ Reset</button>
          <button className="tool-btn danger" onClick={onClearAll}>🗑 Clear</button>
        </div>

        {/* ── Sub-tools row ── */}
        {subTools.length > 0 && (
          <div className="subtool-row">
            {subTools.map(s => (
              <button
                key={s.id}
                className={`subtool-btn${activeSub === s.id ? ' active' : ''}`}
                onClick={() => onSubChange(s.id)}
              >{s.label}</button>
            ))}
          </div>
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
