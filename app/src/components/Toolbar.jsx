// Toolbar.jsx — Mode + sub-tool selector bar (sits below LogoBar)
// Phase 3: beds, fences, paths, building, water + sub-tools

import './Toolbar.css'

const MODES = [
  { id: 'select',   label: '↖ Select'   },
  { id: 'beds',     label: '🟫 Beds'    },
  { id: 'fences',   label: '🌿 Fences'  },
  { id: 'paths',    label: '⬜ Paths'   },
  { id: 'building', label: '🏠 Build'   },
  { id: 'water',    label: '💧 Water'   },
]

const BED_TOOLS    = [{ id:'curved', label:'Curved' }, { id:'straight', label:'Straight' }, { id:'square', label:'Square' }]
const FENCE_TOOLS  = [{ id:'curved', label:'Hedge Curved' }, { id:'straight', label:'Hedge Straight' }, { id:'square', label:'Hedge Square' }]
const FENCE_TYPES  = [{ id:'fence', label:'Open Fence' }]
const PATH_TOOLS   = [{ id:'freeform', label:'Freeform' }, { id:'gate', label:'Gate' }]
const BUILD_TOOLS  = [
  { id:'building',     label:'Building' },
  { id:'deck-curved',  label:'Deck Curved' },
  { id:'deck-straight',label:'Deck Straight' },
  { id:'deck-square',  label:'Deck Square' },
  { id:'underground',  label:'⚡ Underground' },
]
const WATER_TOOLS  = [{ id:'pond', label:'Pond' }, { id:'fountain', label:'Fountain' }, { id:'pool-sq', label:'Pool Rect' }, { id:'pool-circle', label:'Pool Circle' }]

export default function Toolbar({
  currentMode, onModeChange,
  bedSubTool,     onBedSubTool,
  fenceSubTool,   onFenceSubTool,
  fenceType,      onFenceType,
  pathSubTool,    onPathSubTool,
  buildingSubTool,onBuildingSubTool,
  waterSubTool,   onWaterSubTool,
}) {
  const subTools =
    currentMode === 'beds'     ? BED_TOOLS :
    currentMode === 'fences'   ? [...FENCE_TOOLS, ...FENCE_TYPES] :
    currentMode === 'paths'    ? PATH_TOOLS :
    currentMode === 'building' ? BUILD_TOOLS :
    currentMode === 'water'    ? WATER_TOOLS : []

  const activeSub =
    currentMode === 'beds'     ? bedSubTool :
    currentMode === 'fences'   ? (fenceType === 'fence' ? 'fence' : fenceSubTool) :
    currentMode === 'paths'    ? pathSubTool :
    currentMode === 'building' ? buildingSubTool :
    currentMode === 'water'    ? waterSubTool : null

  const onSubChange = (id) => {
    if (currentMode === 'beds')     onBedSubTool(id)
    else if (currentMode === 'fences') {
      if (id === 'fence') onFenceType('fence')
      else { onFenceType('hedge'); onFenceSubTool(id) }
    }
    else if (currentMode === 'paths')    onPathSubTool(id)
    else if (currentMode === 'building') onBuildingSubTool(id)
    else if (currentMode === 'water')    onWaterSubTool(id)
  }

  return (
    <div className="toolbar">
      <div className="toolbar-modes">
        {MODES.map(m => (
          <button
            key={m.id}
            className={`tb-btn${currentMode === m.id ? ' active' : ''}`}
            onClick={() => onModeChange(m.id)}
          >{m.label}</button>
        ))}
      </div>
      {subTools.length > 0 && (
        <div className="toolbar-subtools">
          {subTools.map(s => (
            <button
              key={s.id}
              className={`tb-sub${activeSub === s.id ? ' active' : ''}`}
              onClick={() => onSubChange(s.id)}
            >{s.label}</button>
          ))}
        </div>
      )}
    </div>
  )
}
