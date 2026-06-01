// RightPanel.jsx — Context-sensitive right panel
// Phase 4: full properties for plants, structs, edit mode, multi-select
// Phase 7 (June 1): toolbar integrated into idle panel state
// Phase 7 (June 1 1B): Decks/Hedges/Pools as expandable sub-groups

import { useState } from 'react'
import Konva from 'konva'
import {
  BED_COLOURS, BUILDING_COLOURS, FENCE_COLOURS, HEDGE_COLOURS,
  PATH_COLOURS, WATER_COLOURS, DECKING_COLOURS, ELEC_COLOURS, PLUMB_COLOURS,
  UNIT_PX,
} from '../hooks/useGardenState'
import './RightPanel.css'

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

// ── Tool menu definition ──────────────────────────────────────────────────────
const TOP_TOOLS = [
  { id: 'beds',     label: 'Beds',      emoji: '🌿' },
  { id: 'building', label: 'Buildings', emoji: '🏠' },
  { id: 'fences',   label: 'Fences',    emoji: '🪵' },
  { id: 'paths',    label: 'Paths',     emoji: '〰' },
  { id: 'water',    label: 'Water',     emoji: '💧' },
  { id: 'select',   label: 'Select',    emoji: '✋' },
]
const UTILITY_TOOLS = [
  { id: 'grid',  label: 'Grid',  emoji: '⊞', utility: true },
  { id: 'reset', label: 'Reset', emoji: '⊙', utility: true },
  { id: 'clear', label: 'Clear', emoji: '🗑', utility: true, danger: true },
]

const BED_SUBS = [
  { id: 'curved',   label: 'Curved',   hint: 'Click points · Enter to close' },
  { id: 'straight', label: 'Straight', hint: 'Click points · angular edges'  },
  { id: 'square',   label: 'Square',   hint: 'Click + drag rectangle'         },
]

// Fences: flat items + a Hedges group
const FENCE_ITEMS = [
  { id: 'fence', label: 'Fence', hint: 'Open freeform line' },
  { id: 'gate',  label: 'Gate',  hint: 'Place a gate section' },
  {
    id: '__hedges', label: 'Hedges', emoji: '🌳', group: true,
    children: [
      { id: 'curved',   label: 'Curved Hedge',   hint: 'Click points · Enter to close' },
      { id: 'square',   label: 'Square Hedge',   hint: 'Click + drag hedge rect' },
      { id: 'straight', label: 'Straight Hedge', hint: 'Angular hedge line' },
    ],
  },
]

const PATH_SUBS = [
  { id: 'freeform', label: 'Freeform', hint: 'Click points · Enter to finish' },
]

// Buildings: flat items + a Decks group
const BUILD_ITEMS = [
  { id: 'building', label: 'Building', hint: 'Click + drag footprint' },
  {
    id: '__decks', label: 'Decks', emoji: '🪵', group: true,
    children: [
      { id: 'deck-curved',   label: 'Curved Deck',   hint: 'Click points · Enter to close' },
      { id: 'deck-straight', label: 'Straight Deck', hint: 'Angular deck line' },
      { id: 'deck-square',   label: 'Square Deck',   hint: 'Click + drag deck rect' },
    ],
  },
  { id: 'underground-electrical', label: '⚡ Electrical', hint: 'Freeform underground run' },
  { id: 'underground-plumbing',   label: '🔵 Plumbing',   hint: 'Freeform underground run' },
]

// Water: flat items + a Pools group
const WATER_ITEMS = [
  { id: 'fountain', label: 'Fountain', hint: 'Place a fountain' },
  { id: 'pond',     label: 'Pond',     hint: 'Freeform pond outline' },
  {
    id: '__pools', label: 'Pools', emoji: '🏊', group: true,
    children: [
      { id: 'pool-circle', label: 'Circular Pool', hint: 'Click to place circular pool' },
      { id: 'pool-sq',     label: 'Square Pool',   hint: 'Click + drag rectangular pool' },
    ],
  },
]

// ── Idle Tool Menu ────────────────────────────────────────────────────────────
function ToolMenu({
  currentMode, onModeChange,
  bedSubTool, fenceSubTool, fenceType, pathSubTool, buildingSubTool, waterSubTool,
  onBedSubTool, onFenceSubTool, onFenceType, onPathSubTool, onBuildingSubTool, onWaterSubTool,
  showGrid, onToggleGrid, onResetView, onClearAll,
}) {
  // Which group accordion is open within the current sub-menu
  const [openGroup, setOpenGroup] = useState(null)

  const activeSub =
    currentMode === 'beds'     ? bedSubTool :
    currentMode === 'fences'   ? (fenceType === 'fence' ? 'fence' : fenceType === 'gate' ? 'gate' : fenceSubTool) :
    currentMode === 'paths'    ? pathSubTool :
    currentMode === 'building' ? buildingSubTool :
    currentMode === 'water'    ? waterSubTool : null

  const handleSubChange = (id) => {
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

  // Items list per mode (may contain group objects)
  const items =
    currentMode === 'beds'     ? BED_SUBS :
    currentMode === 'fences'   ? FENCE_ITEMS :
    currentMode === 'paths'    ? PATH_SUBS :
    currentMode === 'building' ? BUILD_ITEMS :
    currentMode === 'water'    ? WATER_ITEMS : []

  // Helper: is any child of a group the current active sub?
  const groupHasActive = (group) =>
    group.children.some(c => c.id === activeSub ||
      (currentMode === 'fences' && fenceType === 'hedge' && c.id === fenceSubTool))

  // Render a flat item button
  const renderItem = (s) => (
    <button
      key={s.id}
      className={`tool-menu-btn${activeSub === s.id ? ' active' : ''}`}
      onClick={() => handleSubChange(s.id)}
      title={s.hint}
    >
      <span className="tool-menu-label">{s.label}</span>
      {activeSub === s.id && <span className="tool-menu-hint">{s.hint}</span>}
    </button>
  )

  // Render an expandable group
  const renderGroup = (g) => {
    const isOpen   = openGroup === g.id || groupHasActive(g)
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

  // If a tool with items is active, show sub-menu level
  if (currentMode && items.length > 0) {
    return (
      <div className="panel-content">
        <button className="tool-menu-back" onClick={() => { onModeChange('select'); setOpenGroup(null) }}>
          ← Back
        </button>
        <div className="panel-h2" style={{ marginTop: 2 }}>
          {TOP_TOOLS.find(t => t.id === currentMode)?.emoji}{' '}
          {TOP_TOOLS.find(t => t.id === currentMode)?.label}
        </div>
        <div className="panel-sep" />
        {items.map(item => item.group ? renderGroup(item) : renderItem(item))}
      </div>
    )
  }

  // Default: top-level tool list
  return (
    <div className="panel-content">
      <div className="panel-h2" style={{ marginBottom: 2 }}>Tools</div>
      <div className="panel-sep" />
      {TOP_TOOLS.map(t => (
        <button
          key={t.id}
          className={`tool-menu-btn${currentMode === t.id ? ' active' : ''}`}
          onClick={() => { onModeChange(t.id); setOpenGroup(null) }}
        >
          <span className="tool-menu-emoji">{t.emoji}</span>
          <span className="tool-menu-label">{t.label}</span>
        </button>
      ))}
      <div className="panel-sep" style={{ marginTop: 4 }} />
      {UTILITY_TOOLS.map(t => {
        if (t.id === 'grid') return (
          <button
            key="grid"
            className={`tool-menu-btn utility${showGrid ? ' active' : ''}`}
            onClick={onToggleGrid}
          >
            <span className="tool-menu-emoji">{t.emoji}</span>
            <span className="tool-menu-label">Grid {showGrid ? 'On' : 'Off'}</span>
          </button>
        )
        if (t.id === 'reset') return (
          <button key="reset" className="tool-menu-btn utility" onClick={onResetView}>
            <span className="tool-menu-emoji">{t.emoji}</span>
            <span className="tool-menu-label">Reset View</span>
          </button>
        )
        if (t.id === 'clear') return (
          <button key="clear" className="tool-menu-btn utility danger" onClick={onClearAll}>
            <span className="tool-menu-emoji">{t.emoji}</span>
            <span className="tool-menu-label">Clear All</span>
          </button>
        )
        return null
      })}
    </div>
  )
}

// ── Main RightPanel export ────────────────────────────────────────────────────
export default function RightPanel({
  selectedPlant, selectedStruct, multiSelection, editingShapeId,
  plantDataRef, structDataRef,
  layers, gardenUnit,
  onDeletePlant, onDeleteStruct, onDeleteMulti,
  onTransparentPlant, onCopyPlant,
  onColourChange, onPathWidthChange,
  onEnterEdit, onExitEdit,
  onDimRectApply, onDimCircleApply,
  onLayerMove,
  onTransparentStruct, onDisconnect,
  onSeasonsChange,
  addingPt, onToggleAddPt,
  removingPt, onToggleRemovePt,
  // Tool menu props
  currentMode, onModeChange,
  bedSubTool, fenceSubTool, fenceType, pathSubTool, buildingSubTool, waterSubTool,
  onBedSubTool, onFenceSubTool, onFenceType, onPathSubTool, onBuildingSubTool, onWaterSubTool,
  showGrid, onToggleGrid, onResetView, onClearAll,
}) {
  const pxPerUnit = UNIT_PX * (gardenUnit === 'm' ? 3.281 : 1)

  // ── Edit mode panel ───────────────────────────────────────
  if (editingShapeId) {
    const d = structDataRef?.current[editingShapeId]
    const editShape = layers?.structLayer?.findOne('#' + editingShapeId)
    const isLine = editShape instanceof Konva.Line
    return (
      <div className="right-panel" onPointerDown={e => e.stopPropagation()}>
        <div className="panel-content">
          <div className="panel-h2">✏️ {d?.label || 'Shape'}</div>
          <div className="panel-sub" style={{fontSize:10,opacity:.65,textAlign:'left'}}>
            {isLine ? 'Drag handles to move points. Click near a segment to insert.' : 'Drag corner handles to reshape.'}
          </div>
          <div className="panel-sep" />
          {isLine && (
            <button
              className={`btn-panel${addingPt ? ' active' : ''}`}
              onClick={() => onToggleAddPt?.()}
            >
              + Add Point{addingPt ? ' — click near segment' : ''}
            </button>
          )}
          {isLine && (
            <button
              className={`btn-panel${removingPt ? ' active' : ''}`}
              onClick={() => onToggleRemovePt?.()}
            >
              − Remove Point{removingPt ? ' — click a handle' : ''}
            </button>
          )}
          <div className="panel-sep" />
          <button className="btn-panel active" onClick={() => onExitEdit?.()}>✓ Done Editing</button>
        </div>
      </div>
    )
  }

  // ── Multi-select panel ────────────────────────────────────
  if (multiSelection?.length > 1) {
    return (
      <div className="right-panel" onPointerDown={e => e.stopPropagation()}>
        <div className="panel-content">
          <div className="panel-h2">Multiple Selected</div>
          <div className="panel-sub">{multiSelection.length} objects</div>
          <div className="panel-sep" />
          <button className="btn-panel danger" onClick={onDeleteMulti}>🗑 Delete All</button>
        </div>
      </div>
    )
  }

  // ── Plant panel ───────────────────────────────────────────
  if (selectedPlant) {
    const d = plantDataRef?.current[selectedPlant.id] || {}
    return (
      <div className="right-panel" onPointerDown={e => e.stopPropagation()}>
        <div className="panel-content">
          <div className="panel-h2">{d.label || 'Plant'}</div>
          <div className="panel-sub">{d.family || ''}</div>
          <div className="panel-sep" />
          <button className="btn-panel" onClick={onTransparentPlant}>
            👁 {d.transparent ? 'Restore Opacity' : 'Make Transparent'}
          </button>
          <button className="btn-panel" onClick={onCopyPlant}>⧉ Copy</button>
          <div style={{ display: 'flex', gap: 4 }}>
            <button className="btn-panel" style={{ flex: 1 }} onClick={() => onLayerMove?.('plant', 'up')}>▲ Forward</button>
            <button className="btn-panel" style={{ flex: 1 }} onClick={() => onLayerMove?.('plant', 'down')}>▼ Back</button>
          </div>
          <div className="panel-sep" />
          <div className="panel-title">VISIBLE IN SEASONS</div>
          <div className="season-checks">
            {['spring','summer','fall','winter'].map(s => (
              <label key={s}>
                <input type="checkbox"
                  defaultChecked={d.seasons?.includes(s)}
                  onChange={e => {
                    if (e.target.checked) d.seasons = [...(d.seasons||[]), s]
                    else d.seasons = (d.seasons||[]).filter(x => x !== s)
                    onSeasonsChange?.()
                  }}
                /> {s.charAt(0).toUpperCase()+s.slice(1)}
              </label>
            ))}
          </div>
          <div className="panel-sep" />
          <button className="btn-panel danger" onClick={onDeletePlant}>🗑 Remove Plant</button>
        </div>
      </div>
    )
  }

  // ── Struct panel ──────────────────────────────────────────
  if (selectedStruct) {
    const d       = structDataRef?.current[selectedStruct.id] || {}
    const shape   = selectedStruct.shape
    const isRect  = shape instanceof Konva.Rect
    const isCircle= shape instanceof Konva.Circle
    const isGroup = shape instanceof Konva.Group
    const colours = TYPE_COLOURS[d.type] || BED_COLOURS
    const isPath  = d.type === 'path'
    const isUG    = d.type?.startsWith('underground')
    const rectTypes = ['bed-sq', 'bed-square', 'building', 'deck', 'deck-sq', 'pool-sq', 'hedge-sq']
    const isRectType    = isRect   && rectTypes.includes(d.type)
    const showDimRect   = isRectType
    const showDimCircle = isCircle && ['water-fountain','pool-circle','fountain','pond'].includes(d.type)

    return (
      <div className="right-panel" onPointerDown={e => e.stopPropagation()}>
        <div className="panel-content">
          <div className="panel-h2">{TYPE_NAMES[d.type] || d.type || 'Object'}</div>
          <input
            className="struct-label-input"
            type="text"
            defaultValue={d.label || ''}
            placeholder="Label..."
            key={selectedStruct.id}
            onChange={e => { if (d) d.label = e.target.value }}
          />

          <div className="panel-title">COLOUR</div>
          <div className="colour-row">
            {colours.map(c => (
              <div
                key={c}
                className={`colour-swatch${d.colour === c ? ' selected' : ''}`}
                style={{ background: c }}
                title={c}
                onClick={() => onColourChange?.(c)}
              />
            ))}
          </div>

          {(isPath || isUG || d.type === 'gate') && (
            <>
              <div className="panel-title">LINE WIDTH</div>
              <div className="slider-wrap">
                <input type="range" min={isUG?2:4} max={isUG?20:60}
                  defaultValue={d.pathWidth || (isUG ? 4 : 18)}
                  onChange={e => onPathWidthChange?.(+e.target.value)}
                />
              </div>
            </>
          )}

          {showDimRect && (
            <>
              <div className="panel-title">DIMENSIONS ({gardenUnit})</div>
              <div style={{ display:'flex', gap:4, alignItems:'center' }}>
                <input id="dim-rect-w" type="number" className="dim-input"
                  placeholder="W" defaultValue={Math.round(shape.width() / pxPerUnit * 10)/10} />
                <span>×</span>
                <input id="dim-rect-h" type="number" className="dim-input"
                  placeholder="H" defaultValue={Math.round(shape.height() / pxPerUnit * 10)/10} />
              </div>
              <button className="btn-panel" onClick={() => {
                const w = parseFloat(document.getElementById('dim-rect-w')?.value)
                const h = parseFloat(document.getElementById('dim-rect-h')?.value)
                if (w > 0 && h > 0) onDimRectApply?.(w, h)
              }}>Apply Dimensions</button>
            </>
          )}

          {showDimCircle && (
            <>
              <div className="panel-title">DIAMETER ({gardenUnit})</div>
              <input id="dim-circle-d" type="number" className="dim-input"
                placeholder="Ø" defaultValue={Math.round(shape.radius() * 2 / pxPerUnit * 10)/10} />
              <button className="btn-panel" onClick={() => {
                const d = parseFloat(document.getElementById('dim-circle-d')?.value)
                if (d > 0) onDimCircleApply?.(d)
              }}>Apply Diameter</button>
            </>
          )}

          <div className="panel-sep" />

          <div style={{ display:'flex', gap:4 }}>
            <button className="btn-panel" style={{flex:1}} onClick={() => onLayerMove?.('struct','up')}>▲ Forward</button>
            <button className="btn-panel" style={{flex:1}} onClick={() => onLayerMove?.('struct','down')}>▼ Back</button>
          </div>

          <button className="btn-panel" onClick={onTransparentStruct}>
            👁 {d.transparent ? 'Restore' : 'Make Transparent'}
          </button>

          {!isCircle && !isGroup && !isRectType && (
            <button className="btn-panel" onClick={() => onEnterEdit?.(selectedStruct.id)}>✏️ Edit Shape</button>
          )}
          {isGroup && (
            <button className="btn-panel" onClick={onDisconnect}>⇥ Disconnect</button>
          )}

          <div className="panel-sep" />
          <button className="btn-panel danger" onClick={onDeleteStruct}>🗑 Delete</button>
        </div>
      </div>
    )
  }

  // ── Idle: tool menu ───────────────────────────────────────
  return (
    <div className="right-panel" onPointerDown={e => e.stopPropagation()}>
      <ToolMenu
        currentMode={currentMode}
        onModeChange={onModeChange}
        bedSubTool={bedSubTool}
        fenceSubTool={fenceSubTool}
        fenceType={fenceType}
        pathSubTool={pathSubTool}
        buildingSubTool={buildingSubTool}
        waterSubTool={waterSubTool}
        onBedSubTool={onBedSubTool}
        onFenceSubTool={onFenceSubTool}
        onFenceType={onFenceType}
        onPathSubTool={onPathSubTool}
        onBuildingSubTool={onBuildingSubTool}
        onWaterSubTool={onWaterSubTool}
        showGrid={showGrid}
        onToggleGrid={onToggleGrid}
        onResetView={onResetView}
        onClearAll={onClearAll}
      />
    </div>
  )
}
