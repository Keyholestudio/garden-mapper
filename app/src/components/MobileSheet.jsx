// MobileSheet.jsx — Mobile bottom sheet
// Contains: ↑↓ toggle, plant search + 2-col grid, tool menu, edit panel
// Season is now controlled by a tap-to-cycle button in LogoBar (top right)

import { useState, useMemo } from 'react'
import Konva from 'konva'
import { PLANT_CATALOG } from '../hooks/usePlantCatalog'
import { ToolMenu } from './toolMenuData.jsx'
import {
  BED_COLOURS, BUILDING_COLOURS, FENCE_COLOURS, HEDGE_COLOURS,
  PATH_COLOURS, WATER_COLOURS, DECKING_COLOURS, ELEC_COLOURS, PLUMB_COLOURS,
  UNIT_PX,
} from '../hooks/useGardenState'
import './MobileSheet.css'

const TYPE_NAMES = {
  bed: 'Garden Bed', 'bed-square': 'Garden Bed', building: 'Building',
  path: 'Path', hedge: 'Hedge', 'hedge-sq': 'Hedge', fence: 'Fence', gate: 'Gate',
  pond: 'Pond', 'water-fountain': 'Fountain', 'pool-sq': 'Pool', 'pool-circle': 'Pool',
  deck: 'Deck', 'underground-electrical': 'Electrical', 'underground-plumbing': 'Plumbing',
}
const TYPE_COLOURS = {
  bed: BED_COLOURS, 'bed-square': BED_COLOURS, building: BUILDING_COLOURS,
  path: PATH_COLOURS, hedge: HEDGE_COLOURS, 'hedge-sq': HEDGE_COLOURS,
  fence: FENCE_COLOURS, gate: FENCE_COLOURS,
  pond: WATER_COLOURS, 'water-fountain': WATER_COLOURS, 'pool-sq': WATER_COLOURS, 'pool-circle': WATER_COLOURS,
  deck: DECKING_COLOURS,
  'underground-electrical': ELEC_COLOURS, 'underground-plumbing': PLUMB_COLOURS,
}

export default function MobileSheet({
  loadedImages, onPlantClick,
  // Selection state
  selectedPlant, selectedStruct,
  plantDataRef, structDataRef,
  layers, gardenUnit,
  // Handlers
  onDeletePlant, onDeleteStruct,
  onTransparentPlant,
  onColourChange, onPathWidthChange,
  onDimRectApply, onDimCircleApply,
  onLayerMove,
  onTransparentStruct,
  onSeasonsChange,
  onClearSelection,
  // Tool menu
  currentMode, onModeChange,
  bedSubTool, fenceSubTool, fenceType, pathSubTool, buildingSubTool, waterSubTool,
  onBedSubTool, onFenceSubTool, onFenceType, onPathSubTool, onBuildingSubTool, onWaterSubTool,
  showGrid, onToggleGrid, onResetView, onClearAll,
}) {
  const pxPerUnit = UNIT_PX * (gardenUnit === 'm' ? 3.281 : 1)
  const [expanded, setExpanded] = useState(true)
  const [query, setQuery] = useState('')
  const [searchFocused, setSearchFocused] = useState(false)

  // Determine if we're in edit panel mode
  const isEditing = !!(selectedPlant || selectedStruct)

  const filtered = useMemo(() => {
    if (!query.trim()) return PLANT_CATALOG
    const q = query.toLowerCase()
    return PLANT_CATALOG.filter(p =>
      p.label.toLowerCase().includes(q) || p.family.toLowerCase().includes(q)
    )
  }, [query])

  // ── Edit panel (plant or struct selected) ───────────────
  if (isEditing) {
    const sheetContent = selectedPlant
      ? renderPlantPanel()
      : renderStructPanel()

    return (
      <div className="mobile-sheet mobile-sheet--edit" onPointerDown={e => e.stopPropagation()}>
        <div className="mobile-sheet-handle">
          <button className="mobile-sheet-toggle" onClick={() => setExpanded(v => !v)}
            aria-label={expanded ? 'Collapse' : 'Expand'}>
            {expanded ? '↓' : '↑'}
          </button>
        </div>
        {expanded && (
          <div className="mobile-sheet-body mobile-edit-body">
            {sheetContent}
          </div>
        )}
      </div>
    )
  }

  // ── Normal mode (tool menu + plant picker) ────────────────
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

  // ── Plant edit panel renderer ─────────────────────────────
  function renderPlantPanel() {
    const d = plantDataRef?.current[selectedPlant.id] || {}
    return (
      <>
        <button className="mobile-edit-back" onClick={() => onClearSelection?.()}>← Back</button>
        <div className="mobile-edit-title">{d.label || 'Plant'}</div>
        {d.family && <div className="mobile-edit-subtitle">{d.family}</div>}
        <div className="mobile-edit-sep" />

        <div className="mobile-edit-label">VISIBLE IN SEASONS</div>
        <div className="mobile-season-checks">
          {['spring','summer','fall','winter'].map(s => (
            <label key={s} className="mobile-season-check">
              <input type="checkbox"
                defaultChecked={d.seasons?.includes(s)}
                onChange={e => {
                  if (e.target.checked) d.seasons = [...(d.seasons||[]), s]
                  else d.seasons = (d.seasons||[]).filter(x => x !== s)
                  onSeasonsChange?.()
                }}
              />
              <span>{s.charAt(0).toUpperCase()+s.slice(1)}</span>
            </label>
          ))}
        </div>

        <div className="mobile-edit-sep" />

        <div className="mobile-edit-row">
          <button className="mobile-edit-btn" onClick={() => onLayerMove?.('plant','up')}>▲ Forward</button>
          <button className="mobile-edit-btn" onClick={() => onLayerMove?.('plant','down')}>▼ Back</button>
        </div>
        <button className="mobile-edit-btn full" onClick={onTransparentPlant}>
          👁 {d.transparent ? 'Restore Opacity' : 'Make Transparent'}
        </button>

        <div className="mobile-edit-sep" />
        <button className="mobile-edit-btn danger full" onClick={onDeletePlant}>🗑 Delete</button>
      </>
    )
  }

  // ── Struct edit panel renderer ────────────────────────────
  function renderStructPanel() {
    const d       = structDataRef?.current[selectedStruct.id] || {}
    const shape   = selectedStruct.shape
    const isRect  = shape instanceof Konva.Rect
    const isCircle= shape instanceof Konva.Circle
    const colours = TYPE_COLOURS[d.type] || BED_COLOURS
    const isPath  = d.type === 'path'
    const isUG    = d.type?.startsWith('underground')
    const rectTypes = ['bed-sq','bed-square','building','deck','deck-sq','pool-sq','hedge-sq']
    const isRectType    = isRect && rectTypes.includes(d.type)
    const showDimRect   = isRectType
    const showDimCircle = isCircle && ['water-fountain','pool-circle','fountain','pond'].includes(d.type)

    return (
      <>
        <button className="mobile-edit-back" onClick={() => onClearSelection?.()}>← Back</button>
        <div className="mobile-edit-title">{TYPE_NAMES[d.type] || d.type || 'Object'}</div>

        <input
          className="mobile-edit-name-input"
          type="text"
          defaultValue={d.label || ''}
          placeholder={TYPE_NAMES[d.type] || 'Label...'}
          key={selectedStruct.id}
          onChange={e => { if (d) d.label = e.target.value }}
        />

        <div className="mobile-edit-label">COLOUR</div>
        <div className="mobile-colour-row">
          {colours.map(c => (
            <div
              key={c}
              className={`mobile-colour-swatch${d.colour === c ? ' selected' : ''}`}
              style={{ background: c }}
              onClick={() => onColourChange?.(c)}
            />
          ))}
        </div>

        {(isPath || isUG || d.type === 'gate') && (
          <>
            <div className="mobile-edit-label">LINE WIDTH</div>
            <input type="range" min={isUG?2:4} max={isUG?20:60}
              className="mobile-edit-slider"
              defaultValue={d.pathWidth || (isUG ? 4 : 18)}
              onChange={e => onPathWidthChange?.(+e.target.value)}
            />
          </>
        )}

        {showDimRect && (
          <>
            <div className="mobile-edit-label">DIMENSIONS ({gardenUnit})</div>
            <div className="mobile-edit-dims">
              <input id="mdim-rect-w" type="number" className="mobile-edit-dim-input"
                placeholder="W" defaultValue={Math.round(shape.width() / pxPerUnit * 10)/10} />
              <span>×</span>
              <input id="mdim-rect-h" type="number" className="mobile-edit-dim-input"
                placeholder="H" defaultValue={Math.round(shape.height() / pxPerUnit * 10)/10} />
            </div>
            <button className="mobile-edit-btn full" onClick={() => {
              const w = parseFloat(document.getElementById('mdim-rect-w')?.value)
              const h = parseFloat(document.getElementById('mdim-rect-h')?.value)
              if (w > 0 && h > 0) onDimRectApply?.(w, h)
            }}>Apply Dimensions</button>
          </>
        )}

        {showDimCircle && (
          <>
            <div className="mobile-edit-label">DIAMETER ({gardenUnit})</div>
            <input id="mdim-circle-d" type="number" className="mobile-edit-dim-input"
              placeholder="Ø" defaultValue={Math.round(shape.radius() * 2 / pxPerUnit * 10)/10} />
            <button className="mobile-edit-btn full" onClick={() => {
              const dv = parseFloat(document.getElementById('mdim-circle-d')?.value)
              if (dv > 0) onDimCircleApply?.(dv)
            }}>Apply Diameter</button>
          </>
        )}

        <div className="mobile-edit-sep" />

        <div className="mobile-edit-row">
          <button className="mobile-edit-btn" onClick={() => onLayerMove?.('struct','up')}>▲ Forward</button>
          <button className="mobile-edit-btn" onClick={() => onLayerMove?.('struct','down')}>▼ Back</button>
        </div>
        <button className="mobile-edit-btn full" onClick={onTransparentStruct}>
          👁 {d.transparent ? 'Restore' : 'Make Transparent'}
        </button>

        <div className="mobile-edit-sep" />
        <button className="mobile-edit-btn danger full" onClick={onDeleteStruct}>🗑 Delete</button>
      </>
    )
  }
}
