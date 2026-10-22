// RightPanel.jsx — Context-sensitive right panel
// Phase 4: full properties for plants, structs, edit mode, multi-select
// Phase 7 (June 1): toolbar integrated into idle panel state
// Phase 7 (June 1 1B): ToolMenu extracted to toolMenuData.js (shared with MobileSheet)

import Konva from 'konva'
import { ToolMenu } from './toolMenuData.jsx'
import {
  BED_COLOURS, BUILDING_COLOURS, FENCE_COLOURS, HEDGE_COLOURS,
  PATH_COLOURS, WATER_COLOURS, DECKING_COLOURS, ELEC_COLOURS, PLUMB_COLOURS,
  UNIT_PX, TEXTURE_MAP, PLANT_VARIANTS, GATE_VARIANTS, PICKET_VARIANTS, DECOR_VARIANTS,
} from '../hooks/useGardenState'
import { ROCK_BORDER_DEFAULT_SPACING, ROCK_BORDER_SPACING_MIN, ROCK_BORDER_SPACING_MAX } from '../utils/rockBorderUtils'
import './RightPanel.css'

const TYPE_NAMES = {
  bed: 'Garden Bed', 'bed-square': 'Garden Bed', building: 'Building',
  path: 'Path', hedge: 'Hedge', 'hedge-sq': 'Hedge', fence: 'Fence', gate: 'Gate',
  pond: 'Pond', 'water-fountain': 'Fountain', 'pool-sq': 'Pool', 'pool-circle': 'Pool',
  deck: 'Deck', 'underground-electrical': 'Electrical', 'underground-plumbing': 'Plumbing',
  'rock-border': 'Rock Border',
  'picket-fence': 'Fences',
}
const TYPE_COLOURS = {
  bed: BED_COLOURS, 'bed-square': BED_COLOURS, building: BUILDING_COLOURS,
  path: PATH_COLOURS, hedge: HEDGE_COLOURS, 'hedge-sq': HEDGE_COLOURS,
  fence: FENCE_COLOURS, gate: FENCE_COLOURS,
  pond: WATER_COLOURS, 'water-fountain': WATER_COLOURS, 'pool-sq': WATER_COLOURS, 'pool-circle': WATER_COLOURS,
  deck: DECKING_COLOURS,
  'underground-electrical': ELEC_COLOURS, 'underground-plumbing': PLUMB_COLOURS,
}

// ToolMenu is imported from toolMenuData.js

// ── Main RightPanel export ────────────────────────────────────────────────────
export default function RightPanel({
  selectedPlant, selectedStruct, multiSelection, editingShapeId,
  plantDataRef, structDataRef,
  layers, gardenUnit,
  onDeletePlant, onDeleteStruct, onDeleteMulti,
  onMultiSeasonChange, onMultiMove,
  onTransparentPlant, onCopyPlant,
  onLockPlant, onLockStruct,
  onCopyStruct,
  onColourChange, onRockVariantChange, onRockSpacingChange, onPathWidthChange,
  onEnterEdit, onExitEdit,
  onDimRectApply, onDimCircleApply,
  onLayerMove,
  onTransparentStruct, onDisconnect,
  onSeasonsChange,
  selectedSeasons,
  onSeasonToggle,
  onClearSelection,
  onUndo,
  canUndo,
  onPlantVariantChange,
  addingPt, onToggleAddPt,
  removingPt, onToggleRemovePt,
  // Tool menu props
  currentMode, onModeChange,
  bedSubTool, fenceSubTool, fenceType, pathSubTool, buildingSubTool, waterSubTool, decorSubTool,
  onBedSubTool, onFenceSubTool, onFenceType, onPathSubTool, onBuildingSubTool, onWaterSubTool, onDecorSubTool,
  showGrid, onToggleGrid, onResetView, onClearAll,
  panMode, onTogglePan,
}) {
  const pxPerUnit = UNIT_PX * (gardenUnit === 'm' ? 3.281 : 1)

  // ── Edit mode panel ───────────────────────────────────────
  if (editingShapeId) {
    const d = structDataRef?.current[editingShapeId]
    const editShape = layers?.structLayer?.findOne('#' + editingShapeId)
    const isLine = editShape instanceof Konva.Line
      || (editShape instanceof Konva.Group && d?.type === 'rock-border')
    return (
      <div className="right-panel" onPointerDown={e => e.stopPropagation()}>
        <div className="panel-content">
          <div className="panel-back-row">
            <button className="panel-back-btn" onClick={() => onExitEdit?.()}>← Back</button>
            <button className="panel-undo-btn" style={{visibility: canUndo ? 'visible' : 'hidden'}} onClick={() => onUndo?.()}>↩</button>
          </div>
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
  if (multiSelection?.length > 0) {
    const SEASONS = ['spring', 'summer', 'fall', 'winter']
    const SEASON_ICONS = { spring: '🌼', summer: '☀️', fall: '🍂', winter: '❄️' }
    const allPlants = multiSelection.every(item => {
      const d = plantDataRef?.current?.[item.id]
      return d && !['Decor', 'Water Feature'].includes(d.family)
    })
    const mixedSeasonState = allPlants ? SEASONS.reduce((acc, s) => {
      const hasCount = multiSelection.filter(item => {
        const d = plantDataRef?.current?.[item.id]
        return d?.seasons?.includes(s)
      }).length
      acc[s] = hasCount === multiSelection.length ? true : hasCount === 0 ? false : 'mixed'
      return acc
    }, {}) : null
    return (
      <div className="right-panel" onPointerDown={e => e.stopPropagation()}>
        <div className="panel-content">
          <div className="panel-back-row">
            <button className="panel-back-btn" onClick={() => onClearSelection?.()}>← Done</button>
            <button className="panel-undo-btn" style={{visibility: canUndo ? 'visible' : 'hidden'}} onClick={() => onUndo?.()}>↩</button>
          </div>
          <div className="panel-h2">📌 Multi-Select</div>
          <div className="panel-sub">{multiSelection.length} selected • Shift+click or double-click to add</div>
          <div className="panel-sep" />
          <div className="panel-title">MOVE</div>
          <div style={{display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:4, marginBottom:8}}>
            <div />
            <button className="btn-panel" style={{padding:'4px'}} onClick={() => onMultiMove?.(0, -8)}>▲</button>
            <div />
            <button className="btn-panel" style={{padding:'4px'}} onClick={() => onMultiMove?.(-8, 0)}>◀</button>
            <div style={{display:'flex',alignItems:'center',justifyContent:'center',fontSize:9,opacity:.5}}>8px</div>
            <button className="btn-panel" style={{padding:'4px'}} onClick={() => onMultiMove?.(8, 0)}>▶</button>
            <div />
            <button className="btn-panel" style={{padding:'4px'}} onClick={() => onMultiMove?.(0, 8)}>▼</button>
            <div />
          </div>
          {allPlants && mixedSeasonState && (
            <>
              <div className="panel-sep" />
              <div className="panel-title">SEASONS</div>
              <div style={{display:'flex', gap:4, flexWrap:'wrap', marginBottom:8}}>
                {SEASONS.map(s => {
                  const st = mixedSeasonState[s]
                  return (
                    <button
                      key={s}
                      className={`btn-panel${st === true ? ' active' : ''}`}
                      style={{flex:1, fontSize:11, position:'relative', minWidth:48}}
                      onClick={() => onMultiSeasonChange?.(s, st !== true)}
                    >
                      {SEASON_ICONS[s]} {s.slice(0,3)}
                      {st === 'mixed' && <span style={{position:'absolute',top:1,right:3,fontSize:8,color:'#FFD600'}}>~</span>}
                    </button>
                  )
                })}
              </div>
            </>
          )}
          <div className="panel-sep" />
          <button className="btn-panel danger" onClick={onDeleteMulti}>🗑 Delete All ({multiSelection.length})</button>
        </div>
      </div>
    )
  }

  // ── Plant / Decor panel ──────────────────────────────────
  if (selectedPlant) {
    const d = plantDataRef?.current[selectedPlant.id] || {}
    const isDecor = ['Decor', 'Water Feature'].includes(d.family)
    const isGate = d.family === 'Gate'
    const gateVariants = isGate ? (GATE_VARIANTS[d.key] || null) : null

    // ── Decor variant panel (Fountains, Rocks, etc.) ─────
    const decorGroup = DECOR_VARIANTS[d.decorGroup]
    if (decorGroup) {
      const activeVariant = decorGroup.find(v => v.src === (d.variantSrc || decorGroup[0].src)) || decorGroup[0]
      return (
        <div className="right-panel" onPointerDown={e => e.stopPropagation()}>
          <div className="panel-content">
            <div className="panel-back-row">
              <button className="panel-back-btn" onClick={() => onClearSelection?.()}>← Back</button>
              <button className="panel-undo-btn" style={{visibility: canUndo ? 'visible' : 'hidden'}} onClick={() => onUndo?.()}>↩</button>
            </div>
            <div className="panel-h2">{d.label || 'Decor'}</div>
            <div className="panel-sub">{activeVariant.subtitle}</div>
            <div className="panel-title" style={{marginTop:8}}>SIZE</div>
            <div className="colour-swatch-row">
              {decorGroup.map(v => (
                <div
                  key={v.label}
                  className={`colour-swatch${v.src === (d.variantSrc || decorGroup[0].src) ? ' selected' : ''}`}
                  style={{ background: v.colour }}
                  title={v.subtitle}
                  onClick={() => onPlantVariantChange?.(v.src, v.size)}
                />
              ))}
            </div>
            <div className="panel-sep" />
            <div style={{ display: 'flex', gap: 4 }}>
              <button className="btn-panel" style={{ flex: 1 }} onClick={onCopyPlant}>⧉ Copy</button>
              <button
                className={`btn-panel${d.locked ? ' btn-panel--locked' : ''}`}
                style={{ flex: 1 }}
                onClick={onLockPlant}
              >{d.locked ? '🔒 Locked' : '🔓 Unlocked'}</button>
            </div>
            <div style={{ display: 'flex', gap: 4 }}>
              <button className="btn-panel" style={{ flex: 1 }} onClick={() => onLayerMove?.('plant', 'up')}>▲ Forward</button>
              <button className="btn-panel" style={{ flex: 1 }} onClick={() => onLayerMove?.('plant', 'down')}>▼ Back</button>
            </div>
            <button className="btn-panel" onClick={onTransparentPlant}>
              👁 {d.transparent ? 'Restore Opacity' : 'Make Transparent'}
            </button>
            <button className="btn-panel danger" onClick={onDeletePlant}>🗑 Delete</button>
          </div>
        </div>
      )
    }

    // ── Gate hybrid panel ─────────────────────────────────
    if (isGate) {
      return (
        <div className="right-panel" onPointerDown={e => e.stopPropagation()}>
          <div className="panel-content">
            <div className="panel-back-row">
              <button className="panel-back-btn" onClick={() => onClearSelection?.()}>← Back</button>
              <button className="panel-undo-btn" style={{visibility: canUndo ? 'visible' : 'hidden'}} onClick={() => onUndo?.()}>↩</button>
            </div>
            <div className="panel-h2">Gates</div>
            <div className="panel-sub">Decor</div>
            {gateVariants && (
              <>
                <div className="panel-title" style={{marginTop:8}}>COLOUR</div>
                <div className="colour-swatch-row">
                  {gateVariants.map(v => (
                    <div
                      key={v.label}
                      className={`colour-swatch${(d.variantSrc || null) === v.src ? ' selected' : ''}`}
                      style={{ background: v.colour }}
                      title={v.label}
                      onClick={() => onPlantVariantChange?.(v.src)}
                    />
                  ))}
                </div>
              </>
            )}
            <div className="panel-sep" />
            <div style={{ display: 'flex', gap: 4 }}>
              <button className="btn-panel" style={{ flex: 1 }} onClick={onCopyPlant}>⧉ Copy</button>
              <button
                className={`btn-panel${d.locked ? ' btn-panel--locked' : ''}`}
                style={{ flex: 1 }}
                onClick={onLockPlant}
              >{d.locked ? '🔒 Locked' : '🔓 Unlocked'}</button>
            </div>
            <div style={{ display: 'flex', gap: 4 }}>
              <button className="btn-panel" style={{ flex: 1 }} onClick={() => onLayerMove?.('plant', 'up')}>▲ Forward</button>
              <button className="btn-panel" style={{ flex: 1 }} onClick={() => onLayerMove?.('plant', 'down')}>▼ Back</button>
            </div>
            <button className="btn-panel" onClick={onTransparentPlant}>
              👁 {d.transparent ? 'Restore Opacity' : 'Make Transparent'}
            </button>
            <button className="btn-panel danger" onClick={onDeletePlant}>🗑 Delete</button>
          </div>
        </div>
      )
    }

    return (
      <div key={selectedPlant.id} className="right-panel" onPointerDown={e => e.stopPropagation()}>
        <div className="panel-content">
          <div className="panel-back-row">
            <button className="panel-back-btn" onClick={() => onClearSelection?.()}>← Back</button>
            <button className="panel-undo-btn" style={{visibility: canUndo ? 'visible' : 'hidden'}} onClick={() => onUndo?.()}>↩</button>
          </div>
          <div className="panel-h2">{d.label || 'Plant'}</div>
          <div className="panel-sub">{PLANT_VARIANTS[d.key]?.find(v => v.src === (d.variantSrc || null))?.name || PLANT_VARIANTS[d.key]?.[0]?.name || d.family || ''}</div>
          {PLANT_VARIANTS[d.key] && (
            <>
              <div className="panel-title" style={{marginTop:8}}>COLOUR</div>
              <div className="colour-swatch-row">
                {PLANT_VARIANTS[d.key].map(v => (
                  <div
                    key={v.label}
                    className={`colour-swatch${(d.variantSrc || null) === v.src ? ' selected' : ''}`}
                    style={{ background: v.colour }}
                    title={v.label}
                    onClick={() => onPlantVariantChange?.(v.src)}
                  />
                ))}
              </div>
            </>
          )}
          <div className="panel-sep" />
          <div style={{ display: 'flex', gap: 4 }}>
            <button className="btn-panel" style={{ flex: 1 }} onClick={onCopyPlant}>⧉ Copy</button>
            <button
              className={`btn-panel${d.locked ? ' btn-panel--locked' : ''}`}
              style={{ flex: 1 }}
              onClick={onLockPlant}
            >{d.locked ? '🔒 Locked' : '🔓 Unlocked'}</button>
          </div>
          <div style={{ display: 'flex', gap: 4 }}>
            <button className="btn-panel" style={{ flex: 1 }} onClick={() => onLayerMove?.('plant', 'up')}>▲ Forward</button>
            <button className="btn-panel" style={{ flex: 1 }} onClick={() => onLayerMove?.('plant', 'down')}>▼ Back</button>
          </div>
          <button className="btn-panel" onClick={onTransparentPlant}>
            👁 {d.transparent ? 'Restore Opacity' : 'Make Transparent'}
          </button>
          <button className="btn-panel danger" onClick={onDeletePlant}>
            🗑 {isDecor ? 'Delete' : 'Remove Plant'}
          </button>
          {!isDecor && (
            <>
              <div className="panel-sep" />
              <div className="panel-title">VISIBLE IN SEASONS</div>
              <div className="season-checks">
                {['spring','summer','fall','winter'].map(s => (
                  <label key={s}>
                    <input type="checkbox"
                      checked={selectedSeasons ? selectedSeasons.includes(s) : (d.seasons?.includes(s) ?? true)}
                      onChange={e => onSeasonToggle?.(s, e.target.checked)}
                    /> {s.charAt(0).toUpperCase()+s.slice(1)}
                  </label>
                ))}
              </div>
            </>
          )}

          {!isDecor && (
            <>
              <div className="panel-sep" />
              <div className="panel-title">NOTES</div>
              <textarea
                className="plant-notes-input"
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
        </div>
      </div>
    )
  }

  // ── Struct panel ──────────────────────────────────────────
  if (selectedStruct) {
    const d       = structDataRef?.current[selectedStruct.id] || {}
    const shape   = selectedStruct.shape

    // ── Rock border panel ──────────────────────────────────────────────────
    if (d.type === 'rock-border') {
      const ROCK_VARIANTS = [
        { id: 'grey-river',       label: 'Grey River Stone',  src: '/stickers/decor_rock-white_L_CA-US-FR-GB-AU.png' },
        { id: 'river-stone',      label: 'River Stone',       src: '/stickers/decor_rock-small_M_CA-US-FR-GB-AU.png' },
        { id: 'brown-rock',       label: 'Brown Rock',        src: '/stickers/decor_rock-medium_L_CA-US-FR-GB-AU.png' },
        { id: 'grey-rock',        label: 'Grey Rock',         src: '/stickers/decor_rock-large_XL_CA-US-FR-GB-AU.png' },
        { id: 'stepping-stone',   label: 'Stepping Stone',    src: '/stickers/decor_rock-brown_L_CA-US-FR-GB-AU.png' },
        { id: 'stepping-stone-2', label: 'Stepping Stone II', src: '/stickers/decor_rock-flat_L_CA-US-FR-GB-AU.png' },
        { id: 'mixed-natural',    label: 'Mixed Natural',    mixed: 'natural' },
        { id: 'mixed-sandstone',  label: 'Mixed Sandstone',  mixed: 'sandstone' },
      ]
      const activeVariant = d.rockVariant || 'grey-river'
      const activeSpacing = d.rockSpacing ?? ROCK_BORDER_DEFAULT_SPACING
      return (
        <div className="right-panel" onPointerDown={e => e.stopPropagation()}>
          <div className="panel-content">
            <div className="panel-back-row">
              <button className="panel-back-btn" onClick={() => onClearSelection?.()}>← Back</button>
              <button className="panel-undo-btn" style={{visibility: canUndo ? 'visible' : 'hidden'}} onClick={() => onUndo?.()}>↩</button>
            </div>
            <div className="panel-h2">Rock Border</div>
            <div className="panel-title">STONE TYPE</div>
            <div className="colour-row" style={{ flexWrap: 'wrap', gap: 6 }}>
              {ROCK_VARIANTS.map(v => (
                <div
                  key={v.id}
                  className={`colour-swatch${activeVariant === v.id ? ' selected' : ''}`}
                  style={{ background: 'none', padding: 0, width: 36, height: 36, overflow: 'hidden', borderRadius: 6 }}
                  title={v.label}
                  onClick={() => onRockVariantChange?.(v.id)}
                >
                  {v.mixed === 'natural' ? (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', width: '100%', height: '100%', borderRadius: 6, overflow: 'hidden' }}>
                      <img src='/stickers/decor_rock-small_M_CA-US-FR-GB-AU.png'  alt='' style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      <img src='/stickers/decor_rock-medium_L_CA-US-FR-GB-AU.png' alt='' style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      <img src='/stickers/decor_rock-large_XL_CA-US-FR-GB-AU.png' alt='' style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      <img src='/stickers/decor_rock-white_L_CA-US-FR-GB-AU.png'  alt='' style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    </div>
                  ) : v.mixed === 'sandstone' ? (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', width: '100%', height: '100%', borderRadius: 6, overflow: 'hidden' }}>
                      <img src='/stickers/decor_rock-brown_L_CA-US-FR-GB-AU.png' alt='' style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      <img src='/stickers/decor_rock-flat_L_CA-US-FR-GB-AU.png'  alt='' style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      <img src='/stickers/decor_rock-flat_L_CA-US-FR-GB-AU.png'  alt='' style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      <img src='/stickers/decor_rock-brown_L_CA-US-FR-GB-AU.png' alt='' style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    </div>
                  ) : (
                    <img src={v.src} alt={v.label} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', borderRadius: 6 }} />
                  )}
                </div>
              ))}
            </div>
            <div className="panel-title" style={{ marginTop: 10 }}>SPACING</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <button className="btn-panel" style={{ flex: 1, fontSize: 13, padding: '4px 0' }}
                onClick={() => onRockSpacingChange?.(Math.max(ROCK_BORDER_SPACING_MIN, parseFloat((activeSpacing - 0.1).toFixed(2))))}
              >&#9664;</button>
              <button className="btn-panel" style={{ flex: 1, fontSize: 10, padding: '4px 0' }}
                onClick={() => onRockSpacingChange?.(ROCK_BORDER_DEFAULT_SPACING)}
              >&#8635;</button>
              <button className="btn-panel" style={{ flex: 1, fontSize: 13, padding: '4px 0' }}
                onClick={() => onRockSpacingChange?.(Math.min(ROCK_BORDER_SPACING_MAX, parseFloat((activeSpacing + 0.1).toFixed(2))))}
              >&#9654;</button>
            </div>
            <button className="btn-panel" onClick={() => onEnterEdit?.(selectedStruct.id)}>✏️ Edit Shape</button>

            <div className="panel-sep" />

            <div style={{ display:'flex', gap:4 }}>
              <button className="btn-panel" style={{flex:1}} onClick={onCopyStruct}>⧉ Copy</button>
              <button
                className={`btn-panel${d.locked ? ' btn-panel--locked' : ''}`}
                style={{flex:1}}
                onClick={onLockStruct}
              >{d.locked ? '🔒 Locked' : '🔓 Unlocked'}</button>
            </div>

            <div style={{ display:'flex', gap:4 }}>
              <button className="btn-panel" style={{flex:1}} onClick={() => onLayerMove?.('struct','up')}>▲ Forward</button>
              <button className="btn-panel" style={{flex:1}} onClick={() => onLayerMove?.('struct','down')}>▼ Back</button>
            </div>

            <button className="btn-panel" onClick={onTransparentStruct}>
              👁 {d.transparent ? 'Restore Opacity' : 'Make Transparent'}
            </button>

            <div className="panel-sep" />
            <button className="btn-panel danger" onClick={() => onDeleteStruct?.()}>🗑 Delete Border</button>
          </div>
        </div>
      )
    }

    // ── Picket fence panel ──────────────────────────────────────────────
    if (d.type === 'picket-fence') {
      return (
        <div className="right-panel" onPointerDown={e => e.stopPropagation()}>
          <div className="panel-content">
            <div className="panel-back-row">
              <button className="panel-back-btn" onClick={() => onClearSelection?.()}>← Back</button>
              <button className="panel-undo-btn" style={{visibility: canUndo ? 'visible' : 'hidden'}} onClick={() => onUndo?.()}>↩</button>
            </div>
            <div className="panel-h2">Fences</div>
            <div className="panel-sub">Picket Fence</div>
            <div className="panel-title" style={{marginTop:8}}>COLOUR</div>
            <div className="colour-swatch-row">
              {PICKET_VARIANTS.map(v => (
                <div
                  key={v.id}
                  className={`colour-swatch${(d.picketVariant || 'white') === v.id ? ' selected' : ''}`}
                  style={{ background: v.colour, border: v.id === 'white' ? '1px solid #ccc' : undefined }}
                  title={v.label}
                  onClick={() => onRockVariantChange?.(v.id)}
                />
              ))}
            </div>
            <button className="btn-panel" onClick={() => onEnterEdit?.(selectedStruct.id)}>✏️ Edit Shape</button>
            <div className="panel-sep" />
            <div style={{ display:'flex', gap:4 }}>
              <button className="btn-panel" style={{flex:1}} onClick={onCopyStruct}>⧉ Copy</button>
              <button
                className={`btn-panel${d.locked ? ' btn-panel--locked' : ''}`}
                style={{flex:1}}
                onClick={onLockStruct}
              >{d.locked ? '🔒 Locked' : '🔓 Unlocked'}</button>
            </div>
            <div style={{ display:'flex', gap:4 }}>
              <button className="btn-panel" style={{flex:1}} onClick={() => onLayerMove?.('struct','up')}>▲ Forward</button>
              <button className="btn-panel" style={{flex:1}} onClick={() => onLayerMove?.('struct','down')}>▼ Back</button>
            </div>
            <button className="btn-panel" onClick={onTransparentStruct}>
              👁 {d.transparent ? 'Restore Opacity' : 'Make Transparent'}
            </button>
            <div className="panel-sep" />
            <button className="btn-panel danger" onClick={() => onDeleteStruct?.()}>🗑 Delete</button>
          </div>
        </div>
      )
    }

    const isRect  = shape instanceof Konva.Rect
    const isCircle= shape instanceof Konva.Circle
    const isGroup = shape instanceof Konva.Group
    const colours = TYPE_COLOURS[d.type] || BED_COLOURS
    const isPath  = d.type === 'path'
    const isUG    = d.type?.startsWith('underground')
    const isBed   = ['bed', 'bed-square', 'bed-sq'].includes(d.type)
    const rectTypes = ['bed-sq', 'bed-square', 'building', 'deck', 'deck-sq', 'pool-sq', 'hedge-sq']
    const isRectType    = isRect   && rectTypes.includes(d.type)
    const showDimRect   = isRectType
    const showDimCircle = isCircle && ['water-fountain','pool-circle','fountain','pond'].includes(d.type)

    return (
      <div className="right-panel" onPointerDown={e => e.stopPropagation()}>
        <div className="panel-content">
          <div className="panel-back-row">
            <button className="panel-back-btn" onClick={() => onClearSelection?.()}>← Back</button>
            <button className="panel-undo-btn" style={{visibility: canUndo ? 'visible' : 'hidden'}} onClick={() => onUndo?.()}>↩</button>
          </div>
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
            {colours.map(c => {
              const isTx = c.startsWith('#TX:')
              const txInfo = isTx ? TEXTURE_MAP[c] : null
              return isTx ? (
                <div
                  key={c}
                  className={`colour-swatch texture-swatch${d.colour === c ? ' selected' : ''}`}
                  title={txInfo?.label || c}
                  onClick={() => onColourChange?.(c)}
                  style={{ backgroundImage: txInfo ? `url(${txInfo.src})` : 'none', backgroundSize: 'cover' }}
                />
              ) : (
                <div
                  key={c}
                  className={`colour-swatch${d.colour === c ? ' selected' : ''}`}
                  style={{ background: c }}
                  title={c}
                  onClick={() => onColourChange?.(c)}
                />
              )
            })}
          </div>

          {(isPath || isUG || d.type === 'gate') && (
            <>
              <div className="panel-title">LINE WIDTH</div>
              <div className="slider-wrap">
                <input type="range" min={isUG?2:16} max={isUG?20:140}
                  defaultValue={d.pathWidth || (isUG ? 4 : 36)}
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

          {!isCircle && !isGroup && !isRectType && !d.locked && (
            <button className="btn-panel" onClick={() => onEnterEdit?.(selectedStruct.id)}>✏️ Edit Shape</button>
          )}
          {isGroup && !isPath && (
            <button className="btn-panel" onClick={onDisconnect}>⇥ Disconnect</button>
          )}

          <div className="panel-sep" />

          <div style={{ display:'flex', gap:4 }}>
            <button className="btn-panel" style={{flex:1, opacity: isGroup ? 0.4 : 1, cursor: isGroup ? 'not-allowed' : 'pointer'}} onClick={!isGroup ? onCopyStruct : undefined} title={isGroup ? 'Cannot copy connected objects' : ''}>⧉ Copy</button>
            <button
              className={`btn-panel${d.locked ? ' btn-panel--locked' : ''}`}
              style={{flex:1}}
              onClick={onLockStruct}
            >{d.locked ? '🔒 Locked' : '🔓 Unlocked'}</button>
          </div>

          <div style={{ display:'flex', gap:4 }}>
            <button className="btn-panel" style={{flex:1}} onClick={() => onLayerMove?.('struct','up')}>▲ Forward</button>
            <button className="btn-panel" style={{flex:1}} onClick={() => onLayerMove?.('struct','down')}>▼ Back</button>
          </div>

          <button className="btn-panel" onClick={onTransparentStruct}>
            👁 {d.transparent ? 'Restore' : 'Make Transparent'}
          </button>
          <button className="btn-panel danger" onClick={onDeleteStruct}>🗑 Delete</button>

          {(isBed || isUG) && (
            <>
              <div className="panel-sep" />
              <div className="panel-title">NOTES</div>
              <textarea
                className="plant-notes-input"
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
        decorSubTool={decorSubTool}
        onBedSubTool={onBedSubTool}
        onFenceSubTool={onFenceSubTool}
        onFenceType={onFenceType}
        onPathSubTool={onPathSubTool}
        onBuildingSubTool={onBuildingSubTool}
        onWaterSubTool={onWaterSubTool}
        onDecorSubTool={onDecorSubTool}
        showGrid={showGrid}
        onToggleGrid={onToggleGrid}
        panMode={panMode}
        onTogglePan={onTogglePan}
        onResetView={onResetView}
        onClearAll={onClearAll}
        onUndo={onUndo}
        canUndo={canUndo}
      />
    </div>
  )
}
