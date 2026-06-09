// MobileSheet.jsx — Mobile bottom sheet
// Contains: ↑↓ toggle, plant search + 2-col grid, tool menu, edit panel
// Season is now controlled by a tap-to-cycle button in LogoBar (top right)

import { useState, useMemo } from 'react'
import Konva from 'konva'
import { PLANT_CATALOG_TRAY as PLANT_CATALOG } from '../hooks/usePlantCatalog'
import { ToolMenu } from './toolMenuData.jsx'
import {
  BED_COLOURS, BUILDING_COLOURS, FENCE_COLOURS, HEDGE_COLOURS,
  PATH_COLOURS, WATER_COLOURS, DECKING_COLOURS, ELEC_COLOURS, PLUMB_COLOURS,
  UNIT_PX, TEXTURE_MAP,
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
  // Recently used plants
  recents, onAddRecent, onRemoveRecent, onClearRecents, recentsHidden, onSetRecentsHidden,
  // Selection state
  selectedPlant, selectedStruct,
  plantDataRef, structDataRef,
  layers, gardenUnit,
  // Handlers
  onDeletePlant, onDeleteStruct,
  onTransparentPlant,
  onCopyPlant,
  onLockPlant,
  onLockStruct,
  onCopyStruct,
  onColourChange, onPathWidthChange,
  onDimRectApply, onDimCircleApply,
  onLayerMove,
  onTransparentStruct,
  onDisconnect,
  onSeasonsChange,
  onClearSelection,
  onUndo,
  // Edit points
  editingShapeId,
  onEnterEdit,
  onExitEdit,
  addingPt, onToggleAddPt,
  removingPt, onToggleRemovePt,
  // Tool menu
  currentMode, onModeChange,
  bedSubTool, fenceSubTool, fenceType, pathSubTool, buildingSubTool, waterSubTool, decorSubTool,
  onBedSubTool, onFenceSubTool, onFenceType, onPathSubTool, onBuildingSubTool, onWaterSubTool, onDecorSubTool,
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

  // ── Edit-points panel (line shape in point-edit mode) ────
  if (editingShapeId) {
    const d = structDataRef?.current[editingShapeId]
    const editShape = layers?.structLayer?.findOne('#' + editingShapeId)
    const isLine = editShape instanceof Konva.Line
    return (
      <div className="mobile-sheet mobile-sheet--edit" onPointerDown={e => e.stopPropagation()}>
        <div className="mobile-sheet-handle mobile-sheet-handle--edit">
          <button className="mobile-edit-back-inline" onClick={() => onExitEdit?.()}>← Back</button>
          <button className="mobile-sheet-toggle" onClick={() => setExpanded(v => !v)}
            aria-label={expanded ? 'Collapse' : 'Expand'}>
            {expanded ? '↓' : '↑'}
          </button>
          <button className="mobile-edit-undo-inline" onClick={() => onUndo?.()}>↩ Undo</button>
        </div>
        {expanded && (
          <div className="mobile-sheet-body mobile-edit-body">
            <div className="mobile-edit-title">✏️ {d?.label || 'Shape'}</div>
            <div className="mobile-edit-subtitle" style={{fontSize:10,opacity:.65}}>
              {isLine ? 'Drag handles to move points. Click near a segment to insert.' : 'Drag corner handles to reshape.'}
            </div>
            <div className="mobile-edit-sep" />
            {isLine && (
              <button
                className={`mobile-edit-btn full${addingPt ? ' active' : ''}`}
                onClick={() => onToggleAddPt?.()}
              >
                + Add Point{addingPt ? ' — tap near segment' : ''}
              </button>
            )}
            {isLine && (
              <button
                className={`mobile-edit-btn full${removingPt ? ' active' : ''}`}
                onClick={() => onToggleRemovePt?.()}
              >
                − Remove Point{removingPt ? ' — tap a handle' : ''}
              </button>
            )}
            <div className="mobile-edit-sep" />
            <button className="mobile-edit-btn full active" onClick={() => onExitEdit?.()}>✓ Done Editing</button>
          </div>
        )}
      </div>
    )
  }

  // ── Edit panel (plant or struct selected) ───────────────
  if (isEditing) {
    const sheetContent = selectedPlant
      ? renderPlantPanel()
      : renderStructPanel()

    return (
      <div className="mobile-sheet mobile-sheet--edit" onPointerDown={e => e.stopPropagation()}>
        <div className="mobile-sheet-handle mobile-sheet-handle--edit">
          <button className="mobile-edit-back-inline" onClick={() => onClearSelection?.()}>← Back</button>
          <button className="mobile-sheet-toggle" onClick={() => setExpanded(v => !v)}
            aria-label={expanded ? 'Collapse' : 'Expand'}>
            {expanded ? '↓' : '↑'}
          </button>
          <button className="mobile-edit-undo-inline" onClick={() => onUndo?.()}>↩ Undo</button>
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

          {/* Recently used — horizontal scroll strip, hidden when searching */}
          {recents?.length > 0 && !query && (
            <div className="mobile-recents-section">
              <div className="mobile-recents-header">
                <span className="mobile-recents-label">Recently Used</span>
                <div className="mobile-recents-actions">
                  <button
                    className="mobile-recents-toggle"
                    onClick={() => onSetRecentsHidden?.(!recentsHidden)}
                  >{recentsHidden ? 'Show' : 'Hide'}</button>
                  {!recentsHidden && (
                    <button className="mobile-recents-clear" onClick={() => onClearRecents?.()}>Clear</button>
                  )}
                </div>
              </div>
              {!recentsHidden && (
                <div className="mobile-recents-row">
                  {recents.map(entry => {
                    const img = loadedImages?.[entry.key]
                    const loaded = img && typeof img === 'object'
                    return (
                      <div key={entry.key + '_r'} className="mobile-recent-item">
                        <div
                          className={`mobile-recent-thumb${loaded ? '' : ' loading'}`}
                          onClick={() => loaded && onPlantClick?.({ ...entry, _img: img })}
                          title={entry.label}
                        >
                          {loaded
                            ? <img src={entry.src} alt={entry.label} draggable={false} />
                            : <div className="mobile-plant-placeholder" />}
                        </div>
                        <button
                          className="mobile-recent-remove"
                          onClick={() => onRemoveRecent?.(entry.key)}
                          title="Remove"
                        >×</button>
                        <span className="mobile-recent-label">{entry.label}</span>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {/* Plant grid — expands to full height when search is focused */}
          <div className={`mobile-plant-grid${searchFocused ? ' search-active' : ''}`}>
            {filtered.length === 0 && query.trim() && (
              <div className="mobile-no-results mobile-no-results--submit">
                <span>No results for "{query}"</span>
                <a
                  href="https://docs.google.com/forms/d/e/1FAIpQLScJ5k2ZNqP3SSWe9MwjJQCyIV5TqNDZyUk0Qnch8UjkAQfL8A/viewform"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mobile-submit-plant"
                >Need a plant? Submit it! ↗</a>
              </div>
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
                  decorSubTool={decorSubTool}       onDecorSubTool={onDecorSubTool}
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
    const isDecor = ['Decor', 'Water Feature'].includes(d.family)
    return (
      <>
        <div className="mobile-edit-title">{d.label || 'Plant'}</div>
        {d.family && <div className="mobile-edit-subtitle">{d.family}</div>}
        <div className="mobile-edit-sep" />

        <div className="mobile-edit-row">
          <button className="mobile-edit-btn" onClick={onCopyPlant}>⧮ Copy</button>
          <button
            className={`mobile-edit-btn${d.locked ? ' mobile-edit-btn--locked' : ''}`}
            onClick={onLockPlant}
          >{d.locked ? '🔒 Locked' : '🔓 Unlocked'}</button>
        </div>
        <div className="mobile-edit-row">
          <button className="mobile-edit-btn" onClick={() => onLayerMove?.('plant','up')}>▲ Forward</button>
          <button className="mobile-edit-btn" onClick={() => onLayerMove?.('plant','down')}>▼ Back</button>
        </div>
        <button className="mobile-edit-btn full" onClick={onTransparentPlant}>
          👁 {d.transparent ? 'Restore Opacity' : 'Make Transparent'}
        </button>

        {!isDecor && (
          <>
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
          </>
        )}

        <div className="mobile-edit-sep" />
        <button className="mobile-edit-btn danger full" onClick={onDeletePlant}>
          🗑 {isDecor ? 'Delete' : 'Remove Plant'}
        </button>

        {!isDecor && (
          <>
            <div className="mobile-edit-sep" />
            <div className="mobile-edit-label">NOTES</div>
            <textarea
              className="plant-notes-input plant-notes-mobile"
              placeholder="Add notes about this plant..."
              defaultValue={d.notes || ''}
              onChange={e => {
                d.notes = e.target.value
                onSeasonsChange?.()
              }}
              rows={2}
            />
          </>
        )}
      </>
    )
  }

  // ── Struct edit panel renderer ────────────────────────────
  function renderStructPanel() {
    const d       = structDataRef?.current[selectedStruct.id] || {}
    const shape   = selectedStruct.shape
    const isRect  = shape instanceof Konva.Rect
    const isCircle= shape instanceof Konva.Circle
    const isLine  = shape instanceof Konva.Line
    const isGroup = shape instanceof Konva.Group
    const colours = TYPE_COLOURS[d.type] || BED_COLOURS
    const isPath  = d.type === 'path'
    const isUG    = d.type?.startsWith('underground')
    const isBed   = ['bed', 'bed-square', 'bed-sq'].includes(d.type)
    const rectTypes = ['bed-sq','bed-square','building','deck','deck-sq','pool-sq','hedge-sq']
    const isRectType    = isRect && rectTypes.includes(d.type)
    const showDimRect   = isRectType
    const showDimCircle = isCircle && ['water-fountain','pool-circle','fountain','pond'].includes(d.type)

    return (
      <>
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
          {colours.map(c => {
            const isTx = c.startsWith('#TX:')
            const txInfo = isTx ? TEXTURE_MAP[c] : null
            return isTx ? (
              <div
                key={c}
                className={`mobile-colour-swatch texture-swatch${d.colour === c ? ' selected' : ''}`}
                title={txInfo?.label || c}
                onClick={() => onColourChange?.(c)}
                style={{ backgroundImage: txInfo ? `url(${txInfo.src})` : 'none', backgroundSize: 'cover' }}
              />
            ) : (
              <div
                key={c}
                className={`mobile-colour-swatch${d.colour === c ? ' selected' : ''}`}
                style={{ background: c }}
                onClick={() => onColourChange?.(c)}
              />
            )
          })}
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

        {isLine && (
          <>
            <div className="mobile-edit-sep" />
            <button className="mobile-edit-btn full" onClick={() => onEnterEdit?.(selectedStruct.id)}>✏️ Edit Points</button>
          </>
        )}

        {isGroup && (
          <>
            <div className="mobile-edit-sep" />
            <button className="mobile-edit-btn full" onClick={onDisconnect}>↥ Disconnect</button>
          </>
        )}

        <div className="mobile-edit-sep" />

        <div className="mobile-edit-row">
          <button className="mobile-edit-btn" onClick={onCopyStruct}>⧮ Copy</button>
          <button
            className={`mobile-edit-btn${d.locked ? ' mobile-edit-btn--locked' : ''}`}
            onClick={onLockStruct}
          >{d.locked ? '🔒 Locked' : '🔓 Unlocked'}</button>
        </div>
        <div className="mobile-edit-row">
          <button className="mobile-edit-btn" onClick={() => onLayerMove?.('struct','up')}>▲ Forward</button>
          <button className="mobile-edit-btn" onClick={() => onLayerMove?.('struct','down')}>▼ Back</button>
        </div>
        <button className="mobile-edit-btn full" onClick={onTransparentStruct}>
          👁 {d.transparent ? 'Restore' : 'Make Transparent'}
        </button>

        <div className="mobile-edit-sep" />
        <button className="mobile-edit-btn danger full" onClick={onDeleteStruct}>🗑 Delete</button>

        {(isBed || isUG) && (
          <>
            <div className="mobile-edit-sep" />
            <div className="mobile-edit-label">NOTES</div>
            <textarea
              className="plant-notes-input plant-notes-mobile"
              placeholder={isBed ? 'Add notes about this bed...' : d.type === 'underground-electrical' ? 'Add notes about this electrical...' : 'Add notes about this plumbing...'}
              defaultValue={d.notes || ''}
              onChange={e => {
                d.notes = e.target.value
                onSeasonsChange?.()
              }}
              rows={2}
            />
          </>
        )}
      </>
    )
  }
}
