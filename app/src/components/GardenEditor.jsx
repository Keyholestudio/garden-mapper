// GardenEditor.jsx — Top-level layout shell
// Phase 5: save/load localStorage, garden switcher
// Phase 7: responsive breakpoints

import { useRef, useState, useEffect } from 'react'
import Konva from 'konva'
import { useGardenState, TEXTURE_MAP }  from '../hooks/useGardenState'
import { useDrawTools }    from '../hooks/useDrawTools'
import { useSelection }    from '../hooks/useSelection'
import { PLANT_CATALOG }   from '../hooks/usePlantCatalog'
import { addPlant }        from '../utils/plantUtils'
import { insertPointNearestSegment } from '../hooks/useSelection'
import { saveGarden, loadGarden, createNewGarden, readGardens, readLastGardenIndex, writeLastGardenIndex } from '../hooks/useSaveLoad'
import { seedDreamGarden, fetchDreamGardenUpdate } from '../hooks/useDreamGarden'
import { addRectStruct, isFreeMode, applyColourOrTexture, tryMergeRects } from '../utils/drawUtils'
import { useBreakpoint } from '../hooks/useBreakpoint'
import { useRecentPlants } from '../hooks/useRecentPlants'
import LogoBar        from './LogoBar'
import BottomBar      from './BottomBar'
import PlantTray      from './PlantTray'
import GardenCanvas  from './GardenCanvas'
import RightPanel    from './RightPanel'
import SetupOverlay  from './SetupOverlay'
import GardenSwitcher from './GardenSwitcher'
import PromoBanner from './PromoBanner'
import ExportModal from './ExportModal'
import MobileSheet from './MobileSheet'
import './GardenEditor.css'

export default function GardenEditor() {
  const state = useGardenState()
  const { isMobile, isTablet, isDesktop, breakpoint } = useBreakpoint()
  const { recents, addRecent, removeRecent, clearRecents, hidden: recentsHidden, setHidden: setRecentsHidden } = useRecentPlants()
  const stageRef    = useRef(null)
  const layersRef   = useRef({})
  const showGridRef = useRef(state.showGrid) // always-current ref for snap in dragmove closures
  const [stageReady, setStageReady] = useState(false)
  const [scaleLabel, setScaleLabel] = useState('1 cell = 3 in')

  // Phase 5: save/load state
  const [currentGardenIndex, setCurrentGardenIndex] = useState(0)
  const [switcherOpen, setSwitcherOpen] = useState(false)
  const [exportOpen, setExportOpen] = useState(false)
  const [saveFlash, setSaveFlash] = useState(false)
  // Ref so save always reads the latest index without stale closures
  const currentGardenIndexRef = useRef(0)
  // Auto-save: debounced timer ref — fires 1.5s after last placement/change
  const autoSaveTimerRef = useRef(null)

  // ── Image loading ──
  const [loadedImages, setLoadedImages] = useState({})
  useEffect(() => {
    const result = {}
    Promise.all(PLANT_CATALOG.map(p => new Promise(res => {
      const img = new Image()
      img.onload  = () => { result[p.key] = img; res() }
      img.onerror = () => res()
      img.src = p.src
    }))).then(() => setLoadedImages({ ...result }))
  }, [])

  // Keep showGridRef current
  useEffect(() => { showGridRef.current = state.showGrid }, [state.showGrid])

  // ── Block browser zoom (Ctrl+wheel, Ctrl+/-, Ctrl+0) on desktop ───────────────
  // Canvas has its own zoom — browser zoom breaks the fixed layout.
  useEffect(() => {
    const onWheel = (e) => {
      if (e.ctrlKey || e.metaKey) e.preventDefault()
    }
    const onKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && ['+', '-', '=', '_', '0'].includes(e.key)) {
        e.preventDefault()
      }
    }
    // passive: false required so preventDefault() works on wheel
    window.addEventListener('wheel', onWheel, { passive: false })
    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('wheel', onWheel)
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [])

  // ── Season visibility — mirrors v8 updatePlantVisibility() ──
  // Runs whenever season changes. Fades plants not visible in the current season.
  useEffect(() => {
    const { plantLayer } = layersRef.current
    if (!plantLayer || !stageReady) return
    const SEASON_NAMES = ['spring', 'summer', 'fall', 'winter']
    const sN = SEASON_NAMES[state.currentSeason]
    plantLayer.find('Group').forEach(g => {
      const d = state.plantDataRef.current[g.id()]
      if (!d) return
      if (d.transparent) { g.opacity(0.35); return }
      g.opacity(d.seasons?.includes(sN) ? 1 : 0.1)
    })
    plantLayer.batchDraw()
  }, [state.currentSeason, stageReady])

  // ── Multi-select yellow highlight ──
  // Redraws highlight rects on uiLayer whenever multiSelection changes
  const multiHighlightRef = useRef([])
  useEffect(() => {
    const { uiLayer } = layersRef.current
    if (!uiLayer) return
    // Clear old highlights
    multiHighlightRef.current.forEach(r => r.destroy())
    multiHighlightRef.current = []
    if (state.multiSelection?.length > 0) {
      const stage = stageRef.current
      state.multiSelection.forEach(({ shape }) => {
        if (!shape || !stage) return
        // getClientRect() returns coords relative to the canvas container (not screen)
        // Mirrors v8 drawMultiHighlight exactly
        const box = shape.getClientRect()
        const sc  = stage.scaleX()
        const ox  = stage.x(), oy = stage.y()
        const pad = 6
        const wx  = (box.x - ox) / sc - pad / sc
        const wy  = (box.y - oy) / sc - pad / sc
        const ww  = box.width  / sc + (pad * 2) / sc
        const wh  = box.height / sc + (pad * 2) / sc
        const r = new Konva.Rect({
          x: wx, y: wy, width: ww, height: wh,
          stroke: '#FFD600', strokeWidth: 2,
          strokeScaleEnabled: false,
          dash: [8, 4], fill: 'rgba(255,214,0,0.10)',
          listening: false,
        })
        uiLayer.add(r)
        multiHighlightRef.current.push(r)
      })
    }
    uiLayer.batchDraw()
  }, [state.multiSelection, stageReady])

  // ── Clear selection ──
  const clearSelection = () => {
    state.setSelectedPlant(null)
    state.setSelectedStruct(null)
    state.setMultiSelection([])   // triggers highlight useEffect which destroys rects
    state.setEditingShapeId(null)
    state.setAddingPt(false)
    state.setRemovingPt(false)
  }

  // ── Plant selection handler (shared) — handles Ctrl+click multi-select ──
  // Returns true if any draw/place tool is currently active (not idle select)
  const isDrawToolActive = () =>
    state.currentMode !== 'select' || pendingPlantRef.current !== null

  // Returns true specifically when freeform drawing is active (bed, path, fence, hedge, etc.)
  // In this case, clicks on plants/structs should be silently swallowed — draw tool handles them.
  const isFreeToolActive = () =>
    isFreeMode(state.currentMode, state.bedSubTool, state.fenceSubTool, state.fenceType,
               state.buildingSubTool, state.waterSubTool, state.pathSubTool)

  const handlePlantSelect = (id, group, evt) => {
    // Freeform drawing active: swallow click silently — useDrawTools onClick places the point
    if (isFreeToolActive()) return
    // Other draw tool active (tap-to-place rect/circle, pending plant): redirect to canvas handler
    if (isDrawToolActive()) {
      if (stageRef.current) handleCanvasClick(stageRef.current.getRelativePointerPosition())
      return
    }
    const ne = evt?.evt || evt
    if (ne && (ne.ctrlKey || ne.metaKey || ne.shiftKey)) {
      state.setSelectedPlant(null)
      state.setSelectedStruct(null)
      state.setEditingShapeId(null)
      state.setMultiSelection(prev => {
        const already = prev.findIndex(x => x.id === id)
        if (already >= 0) return prev.filter(x => x.id !== id)
        return [...prev, { kind: 'plant', id, shape: group }]
      })
      return
    }
    state.setMultiSelection([])
    state.setSelectedPlant({ id, group, ...state.plantDataRef.current[id] })
    state.setSelectedStruct(null)
  }

  // ── Selection hook ──
  const { enterEdit, exitEdit, deleteSelected, buildEditHandles } = useSelection({
    stage:  stageReady ? stageRef.current : null,
    layers: stageReady ? layersRef.current : null,
    state,
    onSelectPlant:    handlePlantSelect,
    onSelectStruct:   (id, shape) => {
      if (isFreeToolActive()) return
      if (isDrawToolActive()) {
        if (stageRef.current) handleCanvasClick(stageRef.current.getRelativePointerPosition())
        return
      }
      state.setSelectedStruct({ id, shape, ...state.structDataRef.current[id] }); state.setSelectedPlant(null)
    },
    onClearSelection: clearSelection,
    onEditMode:       state.setEditingShapeId,
    onExitEditMode:   () => { state.setEditingShapeId(null); state.setAddingPt(false); state.setRemovingPt(false) },
  })

  // ── Draw tools hook ──
  useDrawTools({
    stage:  stageReady ? stageRef.current : null,
    layers: stageReady ? layersRef.current : null,
    propBoundsRef: state.propBoundsRef,
    state,
    onPushUndo: state.pushUndo,
    onEnterEdit: (id) => { enterEdit(id) },
    onAddPointDone: (id) => {
      // Rebuild edit handles after point insertion, turn off addingPt
      enterEdit(id)
      state.setAddingPt(false)
    },
    onStructSelect: (id, shape, evt) => {
      if (isFreeToolActive()) return
      if (isDrawToolActive()) {
        if (stageRef.current) handleCanvasClick(stageRef.current.getRelativePointerPosition())
        return
      }
      const ne = evt?.evt || evt
      if (ne && (ne.ctrlKey || ne.metaKey || ne.shiftKey)) {
        // Multi-select: add/remove from multiSelection
        state.setSelectedPlant(null)
        state.setSelectedStruct(null)
        state.setEditingShapeId(null)
        state.setMultiSelection(prev => {
          const already = prev.findIndex(x => x.id === id)
          if (already >= 0) return prev.filter(x => x.id !== id)
          return [...prev, { kind: 'struct', id, shape }]
        })
        return
      }
      state.setMultiSelection([])
      state.setSelectedStruct({ id, shape, ...state.structDataRef.current[id] })
      state.setSelectedPlant(null)
      state.setEditingShapeId(null)
      suppressNextClearRef.current = true  // prevent synthesized click from clearing selection
    },
    onModeChange: (mode) => {
      state.setCurrentMode(mode)
      // Reset all sub-tools to null when returning to select so no tool is pre-selected next visit
      if (mode === 'select') {
        state.setBedSubTool(null)
        state.setFenceSubTool(null)
        state.setFenceType(null)
        state.setPathSubTool(null)
        state.setBuildingSubTool(null)
        state.setWaterSubTool(null)
        state.setDecorSubTool(null)
        triggerAutoSave()  // struct/shape just placed
      }
    },
  })

  // ── Decor placement ──
  // Decor items are oversized stickers placed via the same click-to-place flow as plants.
  // DECOR_CATALOG entries match the plant entry shape so addPlant() can be reused.
  const DECOR_CATALOG = {
    'decor-rock-small':   { key: 'decor_rock-small_M_CA-US-FR-GB-AU',   label: 'Small Stone',     family: 'Decor', size: 'M',  src: '/stickers/decor_rock-small_M_CA-US-FR-GB-AU.png'   },
    'decor-rock-medium':  { key: 'decor_rock-medium_L_CA-US-FR-GB-AU',  label: 'Medium Stone',    family: 'Decor', size: 'L',  src: '/stickers/decor_rock-medium_L_CA-US-FR-GB-AU.png'  },
    'decor-rock-large':   { key: 'decor_rock-large_XL_CA-US-FR-GB-AU',  label: 'Large Stone',     family: 'Decor', size: 'XL', src: '/stickers/decor_rock-large_XL_CA-US-FR-GB-AU.png'  },
    'decor-gazebo-square':{ key: 'decor_gazebo-square_XL_CA-US-FR-GB-AU', label: 'Square Gazebo',  family: 'Decor', size: 'XL', src: '/stickers/decor_gazebo-square_XL_CA-US-FR-GB-AU.png' },
    'decor-gazebo-oct':   { key: 'decor_gazebo-oct_XL_CA-US-FR-GB-AU',   label: 'Octagon Gazebo', family: 'Decor', size: 'XL', src: '/stickers/decor_gazebo-oct_XL_CA-US-FR-GB-AU.png'   },
    'decor-gazebo-large': { key: 'decor_gazebo-large_XL_CA-US-FR-GB-AU',  label: 'Large Gazebo',   family: 'Decor', size: 'XL', src: '/stickers/decor_gazebo-large_XL_CA-US-FR-GB-AU.png'  },
    'decor-lounge-modern':{ key: 'decor_lounge-modern_XL_CA-US-FR-GB-AU', label: 'Plastic Loungers', family: 'Decor', size: 'XL', src: '/stickers/decor_lounge-modern_XL_CA-US-FR-GB-AU.png' },
    'decor-lounge-wood':  { key: 'decor_lounge-wood_XL_CA-US-FR-GB-AU',  label: 'Wood Loungers',    family: 'Decor', size: 'XL', src: '/stickers/decor_lounge-wood_XL_CA-US-FR-GB-AU.png'  },
    'decor-table-pine':    { key: 'decor_table-pine_XXL_CA-US-FR-GB-AU',    label: 'Pine Table',     family: 'Decor', size: 'XXL', src: '/stickers/decor_table-pine_XXL_CA-US-FR-GB-AU.png'    },
    'decor-table-stained':  { key: 'decor_table-stained_XXL_CA-US-FR-GB-AU',  label: 'Stained Table',  family: 'Decor', size: 'XXL', src: '/stickers/decor_table-stained_XXL_CA-US-FR-GB-AU.png'  },
    'decor-table-enameled': { key: 'decor_table-enameled_XXL_CA-US-FR-GB-AU', label: 'Enameled Table', family: 'Decor', size: 'XXL', src: '/stickers/decor_table-enameled_XXL_CA-US-FR-GB-AU.png' },
    'decor-table-bronzed':  { key: 'decor_table-bronzed_XXL_CA-US-FR-GB-AU',  label: 'Bronzed Table',  family: 'Decor', size: 'XXL', src: '/stickers/decor_table-bronzed_XXL_CA-US-FR-GB-AU.png'  },
    'decor-umbrella':     { key: 'decor_umbrella_L_CA-US-FR-GB-AU',     label: 'Beach Umbrella',  family: 'Decor', size: 'L',  src: '/stickers/decor_umbrella_L_CA-US-FR-GB-AU.png'     },
    'decor-pot-red-round':        { key: 'decor_pot-red-round_S_CA-US-FR-GB-AU',        label: 'Red Round Pot',        family: 'Decor', size: 'S',  src: '/stickers/decor_pot-red-round_S_CA-US-FR-GB-AU.png'        },
    'decor-pot-terracotta-round':  { key: 'decor_pot-terracotta-round_M_CA-US-FR-GB-AU',  label: 'Terracotta Round Pot', family: 'Decor', size: 'M',  src: '/stickers/decor_pot-terracotta-round_M_CA-US-FR-GB-AU.png'  },
    'decor-pot-blue':              { key: 'decor_pot-blue_S_CA-US-FR-GB-AU',              label: 'Blue Pot',             family: 'Decor', size: 'S',  src: '/stickers/decor_pot-blue_S_CA-US-FR-GB-AU.png'              },
    'decor-pot-terracotta':        { key: 'decor_pot-terracotta_S_CA-US-FR-GB-AU',        label: 'Terracotta Pot',       family: 'Decor', size: 'S',  src: '/stickers/decor_pot-terracotta_S_CA-US-FR-GB-AU.png'        },
    'decor-pot-green-round':       { key: 'decor_pot-green-round_M_CA-US-FR-GB-AU',       label: 'Green Round Pot',      family: 'Decor', size: 'M',  src: '/stickers/decor_pot-green-round_M_CA-US-FR-GB-AU.png'       },
    'decor-stairs-wood':  { key: 'decor_stairs-wood_M_CA-US-FR-GB-AU',  label: 'Wood Stairs',     family: 'Decor', size: 'M',  src: '/stickers/decor_stairs-wood_M_CA-US-FR-GB-AU.png'  },
    'decor-stairs-stone': { key: 'decor_stairs-stone_M_CA-US-FR-GB-AU', label: 'Stone Stairs',    family: 'Decor', size: 'M',  src: '/stickers/decor_stairs-stone_M_CA-US-FR-GB-AU.png' },
    'decor-stairs-brick': { key: 'decor_stairs-brick_M_CA-US-FR-GB-AU', label: 'Brick Stairs',    family: 'Decor', size: 'M',  src: '/stickers/decor_stairs-brick_M_CA-US-FR-GB-AU.png' },
    'decor-stairs-cement':{ key: 'decor_stairs-cement_M_CA-US-FR-GB-AU',label: 'Cement Stairs',   family: 'Decor', size: 'M',  src: '/stickers/decor_stairs-cement_M_CA-US-FR-GB-AU.png'},
    'decor-arch-wood':    { key: 'decor_arch-wood_XL_CA-US-FR-GB-AU',    label: 'Wood Arch',       family: 'Decor', size: 'XL', src: '/stickers/decor_arch-wood_XL_CA-US-FR-GB-AU.png'    },
    'decor-arch-metal':   { key: 'decor_arch-metal_XL_CA-US-FR-GB-AU',   label: 'Metal Arch',      family: 'Decor', size: 'XL', src: '/stickers/decor_arch-metal_XL_CA-US-FR-GB-AU.png'   },
    // Fountains — merged from FOUNTAIN_CATALOG (same placement flow as decor stickers)
    'fountain-sm': { key: 'water-feature_fountain-sm_S_CA-US-FR-GB-AU', label: 'Small Fountain',  family: 'Water Feature', size: 'S', src: '/stickers/water-feature_fountain-sm_S_CA-US-FR-GB-AU.png' },
    'fountain-md': { key: 'water-feature_fountain-md_M_CA-US-FR-GB-AU', label: 'Medium Fountain', family: 'Water Feature', size: 'M', src: '/stickers/water-feature_fountain-md_M_CA-US-FR-GB-AU.png' },
    'fountain-lg': { key: 'water-feature_fountain-lg_L_CA-US-FR-GB-AU', label: 'Large Fountain',  family: 'Water Feature', size: 'L', src: '/stickers/water-feature_fountain-lg_L_CA-US-FR-GB-AU.png' },
  }

  // When a decor sub-tool is clicked, load the image and queue it for placement (same as plant click-to-place)
  useEffect(() => {
    const id = state.decorSubTool
    if (!id || state.currentMode !== 'decor') return
    const entry = DECOR_CATALOG[id]
    if (!entry) return
    // Clear decorSubTool immediately so re-entering decor mode later doesn't re-fire this effect
    state.setDecorSubTool(null)
    const img = new Image()
    img.onload = () => {
      pendingPlantRef.current = { ...entry, _img: img }
      state.setCurrentMode('select')
    }
    img.onerror = () => console.warn('Decor sticker not found:', entry.src)
    img.src = entry.src
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.decorSubTool, state.currentMode])

  // ── Plant placement ──
  const pendingPlantRef  = useRef(null)
  const draggingPlantRef = useRef(null)  // tracks plant being HTML5 drag-dropped
  const suppressNextClearRef = useRef(false) // set after struct placed via tap, prevents synthesized click from clearing selection

  const handlePlantClick = (enrichedEntry) => {
    pendingPlantRef.current = enrichedEntry
    state.setCurrentMode('select')
  }

  const handlePlantDragStart = (enrichedEntry) => {
    draggingPlantRef.current = enrichedEntry
    // Cancel any pending click-to-place so drag doesn't also trigger a placement
    pendingPlantRef.current = null
  }

  const handleCanvasDrop = (worldPos) => {
    const entry = draggingPlantRef.current
    draggingPlantRef.current = null
    if (!entry) return
    const { plantLayer } = layersRef.current
    if (!plantLayer || !stageRef.current) return
    addRecent(entry)  // record drag-drop as recent
    const newId = addPlant({
      entry, x: worldPos.x, y: worldPos.y,
      stage: stageRef.current, plantLayer,
      plantDataRef: state.plantDataRef, plantIdCtr: state.plantIdCtr,
      showGridRef,
      onSelect: handlePlantSelect,
    })
    if (newId) {
      state.pushUndo(() => {
        const g = layersRef.current.plantLayer?.findOne('#' + newId)
        if (g) { g.destroy(); delete state.plantDataRef.current[newId]; layersRef.current.plantLayer?.batchDraw() }
      })
      triggerAutoSave()
    }
  }
  const handleCanvasClick = (worldPos) => {
    const entry = pendingPlantRef.current
    if (!entry) {
      // After a touch-place of a struct, the browser fires a synthetic click on the stage.
      // Suppress the clearSelection for that one click so the struct edit panel stays open.
      if (suppressNextClearRef.current) { suppressNextClearRef.current = false; return }
      clearSelection(); return
    }
    pendingPlantRef.current = null
    const { plantLayer } = layersRef.current
    if (!plantLayer || !stageRef.current) return
    const newId = addPlant({
      entry, x: worldPos.x, y: worldPos.y,
      stage: stageRef.current, plantLayer,
      plantDataRef: state.plantDataRef, plantIdCtr: state.plantIdCtr,
      showGridRef,
      onSelect: handlePlantSelect,
    })
    // Push undo: remove the placed plant
    if (newId) {
      state.pushUndo(() => {
        const g = layersRef.current.plantLayer?.findOne('#' + newId)
        if (g) { g.destroy(); delete state.plantDataRef.current[newId]; layersRef.current.plantLayer?.batchDraw() }
      })
      triggerAutoSave()
    }
  }

  // Compute scale label — mirrors v8 updateScaleDisplay()
  const updateScaleLabel = (stage, gardenUnit) => {
    const CELL_PX = 8, CELL_IN = 3
    const sc = stage.scaleX()
    const maxCellPx = stage.width() / 4
    let mult = 1
    while (CELL_PX * sc * mult < 16 && CELL_PX * sc * mult < maxCellPx) mult *= 2
    if (mult < 2) mult = 2
    const ri = CELL_IN * mult
    const unit = gardenUnit || state.gardenUnit
    let lbl
    if (unit === 'ft') {
      lbl = ri >= 12 ? `1 cell = ${Math.round(ri / 12 * 10) / 10} ft` : `1 cell = ${ri} in`
    } else {
      lbl = ri >= 39.37 ? `1 cell = ${Math.round(ri / 39.37 * 10) / 10} m` : `1 cell = ${Math.round(ri * 2.54)} cm`
    }
    setScaleLabel(lbl)
  }

  // Shared pinch flag — set by GardenCanvas touch handlers, read by transformer
  const isPinchingRef = useRef(false)

  const handleStageReady = (stage, layers) => {
    stageRef.current  = stage
    layersRef.current = layers
    // Block transformer from starting a resize/scale during pinch-to-zoom.
    // Check the raw touch event directly — if 2+ fingers are present when
    // transformstart fires, it's a pinch not a deliberate resize, so abort it.
    if (layers.tr) {
      layers.tr.on('transformstart', (e) => {
        if (e.evt?.touches?.length >= 2) {
          layers.tr.stopTransform()
        }
      })
    }
    // Auto-save on any drag or resize completing — catches all shapes without per-shape wiring
    stage.on('dragend', () => triggerAutoSave())
    stage.on('transformend', () => triggerAutoSave())
    setStageReady(true)
  }

  // ── Undo helper ──
  // Runs the undo action then checks if the currently selected object still exists.
  // If it was the undone object, clears selection so the edit panel closes (#35).
  const handleUndo = () => {
    const selPlantId  = state.selectedPlant?.id
    const selStructId = state.selectedStruct?.id
    state.undo()
    layersRef.current.structLayer?.batchDraw()
    layersRef.current.plantLayer?.batchDraw()
    // If the selected object was just undone (destroyed), clear selection
    if (selPlantId && !layersRef.current.plantLayer?.findOne('#' + selPlantId)) clearSelection()
    if (selStructId && !layersRef.current.structLayer?.findOne('#' + selStructId)) clearSelection()
    triggerAutoSave()
  }

  // ── Copy / Paste ──
  useEffect(() => {
    const onKey = (e) => {
      const tag = document.activeElement?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault()
        handleUndo()
        return
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
        const sel = state.selectedPlant
        if (!sel) return
        const d = state.plantDataRef.current[sel.id]
        const img = loadedImages[d?.key] || sel.group.findOne('Image')?.image()
        state.setClipboard({
          kind: 'plant',
          entry: { ...d, _img: img,
            scaleX: sel.group.scaleX(),
            scaleY: sel.group.scaleY(),
          },
          srcX: sel.group.x(),
          srcY: sel.group.y(),
        })
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'v') {
        const cb = state.clipboard
        if (!cb || cb.kind !== 'plant' || !cb.entry._img) return
        const { plantLayer } = layersRef.current
        if (!plantLayer) return
        const sizeMap = { XS: 24, S: 40, M: 64, L: 96, XL: 128, XXL: 160 }
        const size = sizeMap[cb.entry.size] || 64
        // srcX/srcY are group top-left. addPlant expects center coords.
        // Paste one plant-width to the right, same vertical position.
        const srcX = cb.srcX ?? 100
        const srcY = cb.srcY ?? 100
        const newId = addPlant({
          entry: cb.entry,
          x: srcX + size + 8 + size / 2,  // top-left of paste + half-size = center
          y: srcY + size / 2,              // same row, center y
          stage: stageRef.current, plantLayer,
          plantDataRef: state.plantDataRef, plantIdCtr: state.plantIdCtr,
          showGridRef,
          onSelect: handlePlantSelect,
        })
        // Apply stored scale + move to top
        if (newId) {
          const group = plantLayer.findOne('#' + newId)
          if (group) {
            if (cb.entry.scaleX) group.scaleX(cb.entry.scaleX)
            if (cb.entry.scaleY) group.scaleY(cb.entry.scaleY)
            group.moveToTop()
            // Advance srcX so next Ctrl+V steps one more plant to the right
            state.setClipboard({ ...cb, srcX: srcX + size + 8 })
          }
          plantLayer.batchDraw()
          // Push undo: remove pasted plant
          state.pushUndo(() => {
            const g = layersRef.current.plantLayer?.findOne('#' + newId)
            if (g) { g.destroy(); delete state.plantDataRef.current[newId]; layersRef.current.plantLayer?.batchDraw() }
          })
          triggerAutoSave()
        }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [state.clipboard, state.selectedPlant])

  // ── Right panel handlers ──
  const handleColourChange = (colour) => {
    const sel = state.selectedStruct
    if (!sel) return
    const d = state.structDataRef.current[sel.id]
    d.colour = colour
    const shape = sel.shape
    const noFill = ['path','fence','gate','underground-electrical','underground-plumbing'].includes(d.type)
    const isTexture = colour?.startsWith('#TX:')
    if (isTexture) {
      // Texture fill — works on any shape type
      applyColourOrTexture(shape, colour, layersRef.current.structLayer, TEXTURE_MAP)
    } else if (shape instanceof Konva.Rect)        { shape.fillPriority('color'); shape.fillPatternImage(null); shape.fill(colour + 'CC') }
    else if (shape instanceof Konva.Circle) { shape.fillPriority('color'); shape.fillPatternImage(null); shape.fill(colour + 'CC'); shape.stroke(colour) }
    else { shape.fillPriority('color'); shape.fillPatternImage(null); shape.fill(noFill ? 'transparent' : colour + 'CC'); if (noFill) shape.stroke(colour) }
    layersRef.current.structLayer?.batchDraw()
    state.setSelectedStruct({ ...sel, colour })
    triggerAutoSave()
  }

  const handlePathWidthChange = (w) => {
    const sel = state.selectedStruct; if (!sel) return
    state.structDataRef.current[sel.id].pathWidth = w
    sel.shape.strokeWidth(w)
    layersRef.current.structLayer?.batchDraw()
    triggerAutoSave()
  }

  const handleDimRectApply = (w, h) => {
    const sel = state.selectedStruct
    if (!sel || !(sel.shape instanceof Konva.Rect)) return
    const px = 32 * (state.gardenUnit === 'm' ? 3.281 : 1)
    sel.shape.width(w * px); sel.shape.height(h * px)
    sel.shape.scaleX(1); sel.shape.scaleY(1)
    layersRef.current.structLayer?.batchDraw()
    triggerAutoSave()
  }

  const handleDimCircleApply = (d) => {
    const sel = state.selectedStruct
    if (!sel || !(sel.shape instanceof Konva.Circle)) return
    sel.shape.radius((d / 2) * 32 * (state.gardenUnit === 'm' ? 3.281 : 1))
    layersRef.current.structLayer?.batchDraw()
    triggerAutoSave()
  }

  const handleLayerMove = (kind, dir) => {
    if (kind === 'plant' && state.selectedPlant) {
      dir === 'up' ? state.selectedPlant.group.moveUp() : state.selectedPlant.group.moveDown()
      layersRef.current.plantLayer?.batchDraw()
    } else if (kind === 'struct' && state.selectedStruct) {
      dir === 'up' ? state.selectedStruct.shape.moveUp() : state.selectedStruct.shape.moveDown()
      layersRef.current.structLayer?.batchDraw()
    }
    triggerAutoSave()
  }

  const handleTransparentPlant = () => {
    const sel = state.selectedPlant; if (!sel) return
    const d = state.plantDataRef.current[sel.id]
    d.transparent = !d.transparent
    d.transparent ? (sel.group.opacity(0.35), sel.group.moveToBottom()) : (sel.group.opacity(1), sel.group.moveToTop())
    layersRef.current.plantLayer?.batchDraw()
    state.setSelectedPlant({ ...sel })
    triggerAutoSave()
  }

  const handleTransparentStruct = () => {
    const sel = state.selectedStruct; if (!sel) return
    const d = state.structDataRef.current[sel.id]
    d.transparent = !d.transparent
    const isUG = d.type?.startsWith('underground')
    if (d.transparent) {
      sel.shape.opacity(isUG ? 0.5 : 0.35)
      if (!isUG) sel.shape.moveToBottom()
    } else {
      sel.shape.opacity(1)
      if (!isUG) sel.shape.moveToTop()
    }
    layersRef.current.structLayer?.batchDraw()
    state.setSelectedStruct({ ...sel })
    triggerAutoSave()
  }

  const handleCopyStruct = () => {
    const sel = state.selectedStruct; if (!sel) return
    const d = state.structDataRef.current[sel.id]; if (!d) return
    const { structLayer } = layersRef.current; if (!structLayer) return
    const OFFSET = 24 // px offset so copy appears beside original
    const newId = 'struct_' + (++state.plantIdCtr.current)
    const shape = sel.shape
    let newShape
    if (shape instanceof Konva.Rect) {
      newShape = new Konva.Rect({
        id: newId,
        x: shape.x() + OFFSET, y: shape.y() + OFFSET,
        width: shape.width(), height: shape.height(),
        fill: shape.fill(), stroke: shape.stroke(), strokeWidth: shape.strokeWidth(),
        opacity: shape.opacity(), draggable: true,
        cornerRadius: shape.cornerRadius(),
        fillPatternImage: shape.fillPatternImage() || undefined,
        fillPatternRepeat: shape.fillPatternRepeat() || undefined,
        fillPatternScale: shape.fillPatternScale() || undefined,
      })
    } else if (shape instanceof Konva.Circle) {
      newShape = new Konva.Circle({
        id: newId,
        x: shape.x() + OFFSET, y: shape.y() + OFFSET,
        radius: shape.radius(),
        fill: shape.fill(), stroke: shape.stroke(), strokeWidth: shape.strokeWidth(),
        opacity: shape.opacity(), draggable: true,
      })
    } else if (shape instanceof Konva.Line) {
      const pts = shape.points()
      // Offset all points
      const newPts = pts.map((v, i) => v + OFFSET)
      newShape = new Konva.Line({
        id: newId,
        x: shape.x(), y: shape.y(),
        points: newPts,
        fill: shape.fill(), stroke: shape.stroke(), strokeWidth: shape.strokeWidth(),
        closed: shape.closed(), opacity: shape.opacity(), draggable: true,
        tension: shape.tension(),
        fillPatternImage: shape.fillPatternImage() || undefined,
        fillPatternRepeat: shape.fillPatternRepeat() || undefined,
        fillPatternScale: shape.fillPatternScale() || undefined,
      })
    } else {
      return // Groups (connected buildings) — not supported for copy
    }
    // Copy data
    state.structDataRef.current[newId] = { ...d, label: d.label ? d.label + ' (copy)' : '' }
    // Wire up select handler
    newShape.on('click tap', (e) => {
      if (isFreeToolActive() || isDrawToolActive()) return
      state.setMultiSelection([])
      state.setSelectedPlant(null)
      state.setSelectedStruct({ id: newId, shape: newShape, ...state.structDataRef.current[newId] })
    })
    newShape.on('dragend', () => {
      if (shape instanceof Konva.Rect) {
        tryMergeRects(newId, newShape, {
          structDataRef: state.structDataRef,
          structIdCtr: state.structIdCtr,
          groupIdCtr: state.groupIdCtr,
          structLayer,
          snapCell: state.snapCell,
          showGrid: state.showGrid,
          onSelect: (id, sh) => state.setSelectedStruct({ id, shape: sh, ...state.structDataRef.current[id] }),
        })
      }
      triggerAutoSave()
    })
    structLayer.add(newShape)
    newShape.moveToTop()
    structLayer.batchDraw()
    // Select the new copy
    state.setSelectedStruct({ id: newId, shape: newShape, ...state.structDataRef.current[newId] })
    // Push undo
    state.pushUndo(() => {
      newShape.destroy()
      delete state.structDataRef.current[newId]
      structLayer.batchDraw()
    })
    triggerAutoSave()
  }

  const handleLockPlant = () => {
    const sel = state.selectedPlant; if (!sel) return
    const d = state.plantDataRef.current[sel.id]
    d.locked = !d.locked
    sel.group.draggable(!d.locked)
    if (d.locked) {
      // Detach transformer so handles disappear
      layersRef.current.tr?.nodes([])
      layersRef.current.uiLayer?.batchDraw()
    }
    layersRef.current.plantLayer?.batchDraw()
    state.setSelectedPlant({ ...sel })
    triggerAutoSave()
  }

  const handleLockStruct = () => {
    const sel = state.selectedStruct; if (!sel) return
    const d = state.structDataRef.current[sel.id]
    d.locked = !d.locked
    sel.shape.draggable(!d.locked)
    if (d.locked) {
      // Detach transformer and exit any active edit mode
      layersRef.current.tr?.nodes([])
      layersRef.current.uiLayer?.batchDraw()
      if (state.editingShapeId === sel.id) exitEdit()
    }
    layersRef.current.structLayer?.batchDraw()
    state.setSelectedStruct({ ...sel })
    triggerAutoSave()
  }

  const handleDisconnect = () => {
    const sel = state.selectedStruct
    if (!sel || !(sel.shape instanceof Konva.Group)) return
    // Collect member rects before destroying
    const members = sel.shape.getChildren().filter(c => c instanceof Konva.Rect).map(r => ({
      x: r.x() + sel.shape.x(), y: r.y() + sel.shape.y(),
      w: r.width(), h: r.height(),
      colour: r.fill().replace('CC', ''),
      type: state.structDataRef.current[sel.id]?.type,
    }))
    sel.shape.destroy()
    delete state.structDataRef.current[sel.id]
    clearSelection()
    // Re-create each as a standalone rect with full dragend/merge wiring
    const { structLayer } = layersRef.current
    members.forEach(m => {
      addRectStruct({
        type: m.type, x: m.x, y: m.y, w: m.w, h: m.h, colour: m.colour,
        structIdCtr: state.structIdCtr, structDataRef: state.structDataRef,
        groupIdCtr: state.groupIdCtr,
        snapCell: null, showGrid: false,
        structLayer,
        onSelect: (id, shape) => {
          state.setSelectedStruct({ id, shape, ...state.structDataRef.current[id] })
          state.setSelectedPlant(null)
        },
        onModeChange: null,
      })
    })
    structLayer?.batchDraw()
    triggerAutoSave()
  }

  const handleRemoveLastPt = () => {
    const id = state.editingShapeId; if (!id) return
    const shape = layersRef.current.structLayer?.findOne('#' + id)
    if (!shape || !(shape instanceof Konva.Line)) return
    const pts = shape.points()
    if (pts.length <= 6) return
    shape.points(pts.slice(0,-2)); layersRef.current.structLayer.batchDraw()
  }

  const [showClearConfirm, setShowClearConfirm] = useState(false)

  const handleClearAll = () => setShowClearConfirm(true)

  const doClearAll = () => {
    layersRef.current.structLayer?.getChildren()
      .filter(c => c.id() !== '__propBounds' && c.id() !== '__propLabel')
      .forEach(c => c.destroy())
    Object.keys(state.structDataRef.current).forEach(k => delete state.structDataRef.current[k])
    layersRef.current.plantLayer?.destroyChildren()
    Object.keys(state.plantDataRef.current).forEach(k => delete state.plantDataRef.current[k])
    layersRef.current.structLayer?.batchDraw()
    layersRef.current.plantLayer?.batchDraw()
    clearSelection()
    setShowClearConfirm(false)
  }

  const handleResetView = () => {
    const stage = stageRef.current
    const propBounds = state.propBoundsRef.current
    if (!stage || !propBounds) return
    const W = stage.width(), H = stage.height(), pad = 20
    let scale
    if (isMobile) {
      // Mobile: fit to height so the full garden fills the screen top-to-bottom
      scale = Math.min((H - pad * 2) / propBounds.h, 2)
    } else {
      // Desktop/tablet: fit the smaller dimension (original behaviour)
      scale = Math.min((W - pad * 2) / propBounds.w, (H - pad * 2) / propBounds.h, 2)
    }
    stage.scale({ x: scale, y: scale })
    stage.x(W/2 - (propBounds.x + propBounds.w/2) * scale)
    stage.y(H/2 - (propBounds.y + propBounds.h/2) * scale)
    stage.batchDraw()
  }

  // ── Auto-load on startup: runs after all handlers are defined so closures are valid ──
  // Mirrors v8: on first load, reads LS and restores last garden. Skips setup for returning users.
  const loadedImagesCount = Object.keys(loadedImages).length
  useEffect(() => {
    if (!stageReady || loadedImagesCount === 0) return
    seedDreamGarden()  // no-op if already seeded; seeds [dreamGarden, blankGarden] on first run
    const gardens = readGardens()
    if (gardens.length === 0) return  // still empty after seed — show setup overlay (shouldn't happen)
    fetchDreamGardenUpdate()  // silent background fetch — updates dream garden if newer version available
    const lastIdx = Math.min(readLastGardenIndex(), gardens.length - 1)
    loadGarden({
      idx: lastIdx,
      stage: stageRef.current,
      layers: layersRef.current,
      state,
      loadedImages,
      showGridRef,
      onSelectPlant: handlePlantSelect,
      onSelectStruct: (id, shape) => {
        if (isFreeToolActive()) return
        if (isDrawToolActive()) {
          if (stageRef.current) handleCanvasClick(stageRef.current.getRelativePointerPosition())
          return
        }
        state.setSelectedStruct({ id, shape, ...state.structDataRef.current[id] })
        state.setSelectedPlant(null)
      },
      onClearSelection: clearSelection,
      setGardenName: state.setGardenName,
      setGardenW:    state.setGardenW,
      setGardenH:    state.setGardenH,
      setGardenUnit: state.setGardenUnit,
      setIsSetup:    state.setIsSetup,
      onZoomToFit:   handleResetView,
    })
    currentGardenIndexRef.current = lastIdx
    setCurrentGardenIndex(lastIdx)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stageReady, loadedImagesCount])

  // ── Phase 5: Save ──
  // Plain function (not useCallback) — closes over refs so always reads latest values
  const handleSave = () => {
    if (!stageRef.current) return
    saveGarden({
      stage: stageRef.current,
      layers: layersRef.current,
      state,
      currentGardenIndex: currentGardenIndexRef.current,
    })
    setSaveFlash(true)
    setTimeout(() => setSaveFlash(false), 500)
  }

  // Auto-save: debounced 1.5s after any placement or structural change.
  // Reuses handleSave so the flash indicator fires too.
  const triggerAutoSave = () => {
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current)
    autoSaveTimerRef.current = setTimeout(() => {
      handleSave()
      autoSaveTimerRef.current = null
    }, 1500)
  }

  // ── Phase 5: Load ──
  const handleLoad = (idx, snapshot = null) => {
    if (!stageRef.current) return
    const ok = loadGarden({
      idx,
      snapshot,
      stage: stageRef.current,
      layers: layersRef.current,
      state,
      loadedImages,
      showGridRef,
      onSelectPlant: handlePlantSelect,
      onSelectStruct: (id, shape) => {
        if (isFreeToolActive()) return
        if (isDrawToolActive()) {
          if (stageRef.current) handleCanvasClick(stageRef.current.getRelativePointerPosition())
          return
        }
        state.setSelectedStruct({ id, shape, ...state.structDataRef.current[id] })
        state.setSelectedPlant(null)
      },
      onClearSelection: clearSelection,
      setGardenName: state.setGardenName,
      setGardenW:    state.setGardenW,
      setGardenH:    state.setGardenH,
      setGardenUnit: state.setGardenUnit,
      setIsSetup:    state.setIsSetup,
      onZoomToFit:   handleResetView,
    })
    if (ok) {
      currentGardenIndexRef.current = idx
      setCurrentGardenIndex(idx)
      writeLastGardenIndex(idx)
    }
  }

  // ── Phase 5: New garden (mirrors v8 newGarden exactly) ──
  const handleNewGarden = () => {
    if (!stageRef.current) return
    const result = createNewGarden({
      currentGardenIndex: currentGardenIndexRef.current,
      stage: stageRef.current,
      layers: layersRef.current,
      state,
    })
    if (result.limitReached) return

    // Clear the canvas (mirrors v8: initKonva creates a fresh canvas)
    const { structLayer, plantLayer, uiLayer } = layersRef.current
    plantLayer?.destroyChildren()
    structLayer?.destroyChildren()
    if (uiLayer) { uiLayer.find('Circle,Line').forEach(n => n.destroy()); layersRef.current.tr?.nodes([]) }
    Object.keys(state.plantDataRef.current).forEach(k => delete state.plantDataRef.current[k])
    Object.keys(state.structDataRef.current).forEach(k => delete state.structDataRef.current[k])
    structLayer?.batchDraw(); plantLayer?.batchDraw()
    clearSelection()

    // Show setup overlay (same as v8 showing setup-overlay)
    state.setGardenName('New Garden')
    state.setGardenW(60)
    state.setGardenH(40)
    state.setGardenUnit('ft')
    state.setIsSetup(false)
    currentGardenIndexRef.current = result.newIndex
    setCurrentGardenIndex(result.newIndex)
    setSwitcherOpen(false)
  }

  return (
    <div className={`editor-layout bp-${breakpoint}`}>
      <PromoBanner />
      {!state.isSetup && (
        <SetupOverlay
          gardenName={state.gardenName} gardenW={state.gardenW}
          gardenH={state.gardenH}      gardenUnit={state.gardenUnit}
          onSetGardenName={state.setGardenName} onSetGardenW={state.setGardenW}
          onSetGardenH={state.setGardenH}       onSetGardenUnit={state.setGardenUnit}
          onStart={(name, w, h, unit) => {
            // Mirrors v8 startGarden() → initKonva(): reinit boundary for new dimensions
            const stage = stageRef.current
            const { structLayer } = layersRef.current
            if (stage && structLayer) {
              // Replace boundary rect + label
              structLayer.findOne('#__propBounds')?.destroy()
              structLayer.findOne('#__propLabel')?.destroy()
              const UNIT_PX = 32
              const pw = w * UNIT_PX * (unit === 'm' ? 3.281 : 1)
              const ph = h * UNIT_PX * (unit === 'm' ? 3.281 : 1)
              const ox = Math.max(16, (stage.width() - pw) / 2)
              const oy = Math.max(16, (stage.height() - ph) / 2)
              state.propBoundsRef.current = { x: ox, y: oy, w: pw, h: ph }
              const LAWN_TEXTURES = { spring: '/textures/lawn-spring.jpg', summer: '/textures/lawn-summer.jpg', fall: '/textures/lawn-fall-early.jpg', winter: '/textures/lawn-winter.jpg' }
              const LAWN_OPACITY  = { spring: 1.0, summer: 1.0, fall: 0.7, winter: 1.0 }
              const SEASON_NAMES  = ['spring','summer','fall','winter']
              const boundsRect = new Konva.Rect({
                id: '__propBounds', x: ox, y: oy, width: pw, height: ph,
                stroke: '#558B2F', strokeWidth: 2, dash: [10, 5],
                fill: 'transparent', listening: false, strokeScaleEnabled: false,
              })
              structLayer.add(boundsRect)
              structLayer.add(new Konva.Text({
                id: '__propLabel', x: ox + 6, y: oy + 5,
                text: `${name}  ${w}x${h} ${unit}`,
                fontSize: 11, fontStyle: 'bold', fill: '#558B2F', opacity: 0.65, listening: false,
              }))
              structLayer.batchDraw()
              // Apply lawn texture
              const sName = SEASON_NAMES[state.currentSeason] || 'spring'
              const texImg = new window.Image()
              texImg.onload = () => { boundsRect.fillPriority('pattern'); boundsRect.fillPatternImage(texImg); boundsRect.fillPatternRepeat('repeat'); boundsRect.opacity(LAWN_OPACITY[sName] ?? 1.0); structLayer.batchDraw() }
              texImg.src = LAWN_TEXTURES[sName]
              handleResetView()
            }
            state.setIsSetup(true)
          }}
        />
      )}

      <LogoBar
        gardenName={state.gardenName} gardenW={state.gardenW}
        gardenH={state.gardenH}       gardenUnit={state.gardenUnit}
        currentSeason={state.currentSeason}
        onSeasonChange={state.setCurrentSeason}
        onSave={handleSave}
        onOpenSwitcher={() => setSwitcherOpen(true)}
        onExport={() => setExportOpen(true)}
        saveFlash={saveFlash}
        scaleLabel={scaleLabel}
        isMobile={isMobile}
      />

      {/* Clear All confirm modal */}
      {showClearConfirm && (
        <div style={{
          position:'fixed',inset:0,background:'rgba(0,0,0,0.45)',
          zIndex:9000,display:'flex',alignItems:'center',justifyContent:'center'
        }} onClick={() => setShowClearConfirm(false)}>
          <div style={{
            background:'#fff',borderRadius:14,padding:'28px 32px',
            boxShadow:'0 4px 24px rgba(0,0,0,0.2)',textAlign:'center',maxWidth:300
          }} onClick={e => e.stopPropagation()}>
            <div style={{fontSize:15,fontWeight:700,color:'#2A3D1A',marginBottom:8}}>Clear all objects?</div>
            <div style={{fontSize:12,color:'#666',marginBottom:20}}>This cannot be undone.</div>
            <div style={{display:'flex',gap:10,justifyContent:'center'}}>
              <button onClick={() => setShowClearConfirm(false)}
                style={{padding:'8px 20px',borderRadius:8,border:'1.5px solid #ccc',background:'#f5f5f5',fontWeight:700,cursor:'pointer'}}>
                Cancel
              </button>
              <button onClick={doClearAll}
                style={{padding:'8px 20px',borderRadius:8,border:'none',background:'#c62828',color:'#fff',fontWeight:700,cursor:'pointer'}}>
                Clear All
              </button>
            </div>
          </div>
        </div>
      )}

      <ExportModal
        open={exportOpen}
        onClose={() => setExportOpen(false)}
        stage={stageRef.current}
        plantLayer={layersRef.current.plantLayer}
        plantDataRef={state.plantDataRef}
        propBoundsRef={state.propBoundsRef}
        gardenName={state.gardenName}
      />

      <GardenSwitcher
        open={switcherOpen}
        currentIndex={currentGardenIndex}
        onLoad={handleLoad}
        onNew={handleNewGarden}
        onClose={() => setSwitcherOpen(false)}
      />

      <div className="editor-body">
        {/* Plant tray — desktop/tablet only */}
        {!isMobile && (
          <PlantTray
            loadedImages={loadedImages}
            onPlantClick={handlePlantClick}
            onPlantDragStart={handlePlantDragStart}
            recents={recents}
            onAddRecent={addRecent}
            onRemoveRecent={removeRecent}
            onClearRecents={clearRecents}
            recentsHidden={recentsHidden}
            onSetRecentsHidden={setRecentsHidden}
          />
        )}
        <div className="canvas-wrap">
          <GardenCanvas
            gardenName={state.gardenName} gardenW={state.gardenW}
            gardenH={state.gardenH}       gardenUnit={state.gardenUnit}
            currentSeason={state.currentSeason} showGrid={state.showGrid}
            propBoundsRef={state.propBoundsRef}
            pendingPlantRef={pendingPlantRef}
            onStageReady={handleStageReady}
            onCanvasClick={handleCanvasClick}
            onScaleChange={(stage) => updateScaleLabel(stage, state.gardenUnit)}
            editingShapeId={state.editingShapeId}
            onDrop={handleCanvasDrop}
            isMobile={isMobile}
            isPinchingRef={isPinchingRef}
            onPinchEnd={() => {
              // Re-apply locked state after pinch ends (draggable was blanket-reset to true)
              const { plantLayer, structLayer } = layersRef.current
              plantLayer?.find('Group').forEach(n => {
                const d = state.plantDataRef.current[n.id()]
                if (d?.locked) n.draggable(false)
              })
              structLayer?.find('Line,Rect,Circle,Path').forEach(n => {
                const d = state.structDataRef.current[n.id()]
                if (d?.locked) n.draggable(false)
              })
            }}
          />
          <div id="draw-hint" className="draw-hint" style={{ display: 'none' }} />
          {/* Mobile sheet: floats over canvas, anchored to canvas-wrap bottom */}
          {isMobile && (
            <MobileSheet
              loadedImages={loadedImages}
              onPlantClick={(entry) => { addRecent(entry); handlePlantClick(entry) }}
              // Selection
              selectedPlant={state.selectedPlant}
              selectedStruct={state.selectedStruct}
              plantDataRef={state.plantDataRef}
              structDataRef={state.structDataRef}
              layers={layersRef.current}
              gardenUnit={state.gardenUnit}
              // Edit handlers
              onDeletePlant={() => { state.selectedPlant?.group.destroy(); delete state.plantDataRef.current[state.selectedPlant?.id]; layersRef.current.plantLayer?.batchDraw(); clearSelection(); triggerAutoSave() }}
              onDeleteStruct={() => { state.selectedStruct?.shape.destroy(); delete state.structDataRef.current[state.selectedStruct?.id]; layersRef.current.structLayer?.batchDraw(); clearSelection(); triggerAutoSave() }}
              onTransparentPlant={handleTransparentPlant}
              onLockPlant={handleLockPlant}
              onLockStruct={handleLockStruct}
              onCopyPlant={() => {
                const sel = state.selectedPlant; if (!sel) return
                const d = state.plantDataRef.current[sel.id]
                const img = loadedImages[d?.key] || sel.group.findOne('Image')?.image()
                if (!img) return
                const scaleX = sel.group.scaleX(); const scaleY = sel.group.scaleY()
                const srcX = sel.group.x(); const srcY = sel.group.y()
                const sizeMap = { XS: 24, S: 40, M: 64, L: 96, XL: 128, XXL: 160 }
                const size = sizeMap[d?.size] || 64
                const entry = { ...d, _img: img, scaleX, scaleY }
                const { plantLayer } = layersRef.current
                if (!plantLayer) return
                const newId = addPlant({ entry, x: srcX + size + 8 + size / 2, y: srcY + size / 2, stage: stageRef.current, plantLayer, plantDataRef: state.plantDataRef, plantIdCtr: state.plantIdCtr, showGridRef, onSelect: handlePlantSelect })
                if (newId) {
                  const group = plantLayer.findOne('#' + newId)
                  if (group) { group.scaleX(scaleX); group.scaleY(scaleY); group.moveToTop() }
                  plantLayer.batchDraw()
                  state.pushUndo(() => { const g = layersRef.current.plantLayer?.findOne('#' + newId); if (g) { g.destroy(); delete state.plantDataRef.current[newId]; layersRef.current.plantLayer?.batchDraw() } })
                  triggerAutoSave()
                }
              }}
              onUndo={handleUndo}
              onColourChange={handleColourChange}
              onPathWidthChange={handlePathWidthChange}
              onDimRectApply={handleDimRectApply}
              onDimCircleApply={handleDimCircleApply}
              onLayerMove={handleLayerMove}
              onTransparentStruct={handleTransparentStruct}
              onCopyStruct={handleCopyStruct}
              onDisconnect={handleDisconnect}
              onSeasonsChange={() => {
                const { plantLayer } = layersRef.current
                if (!plantLayer) return
                const SEASON_NAMES = ['spring','summer','fall','winter']
                const sN = SEASON_NAMES[state.currentSeason]
                plantLayer.find('Group').forEach(g => {
                  const d = state.plantDataRef.current[g.id()]
                  if (!d) return
                  if (d.transparent) { g.opacity(0.35); return }
                  g.opacity(d.seasons?.includes(sN) ? 1 : 0.1)
                })
                plantLayer.batchDraw()
                triggerAutoSave()
              }}
              onClearSelection={clearSelection}
              // Edit points
              editingShapeId={state.editingShapeId}
              onEnterEdit={enterEdit}
              onExitEdit={exitEdit}
              addingPt={state.addingPt}
              onToggleAddPt={() => {
                const next = !state.addingPt
                state.setAddingPt(next)
                if (next) state.setRemovingPt(false)
                if (state.editingShapeId) {
                  const sh = layersRef.current.structLayer?.findOne('#' + state.editingShapeId)
                  if (sh) buildEditHandles(state.editingShapeId, sh)
                }
              }}
              removingPt={state.removingPt}
              onToggleRemovePt={() => {
                const next = !state.removingPt
                state.setRemovingPt(next)
                if (next) state.setAddingPt(false)
                if (state.editingShapeId) {
                  const sh = layersRef.current.structLayer?.findOne('#' + state.editingShapeId)
                  if (sh) buildEditHandles(state.editingShapeId, sh)
                }
              }}
              // Recently used plants
              recents={recents}
              onAddRecent={addRecent}
              onRemoveRecent={removeRecent}
              onClearRecents={clearRecents}
              recentsHidden={recentsHidden}
              onSetRecentsHidden={setRecentsHidden}
              // Tool menu
              currentMode={state.currentMode}   onModeChange={state.setCurrentMode}
              bedSubTool={state.bedSubTool}     onBedSubTool={state.setBedSubTool}
              fenceSubTool={state.fenceSubTool} onFenceSubTool={state.setFenceSubTool}
              fenceType={state.fenceType}       onFenceType={state.setFenceType}
              pathSubTool={state.pathSubTool}   onPathSubTool={state.setPathSubTool}
              buildingSubTool={state.buildingSubTool} onBuildingSubTool={state.setBuildingSubTool}
              waterSubTool={state.waterSubTool} onWaterSubTool={state.setWaterSubTool}
              decorSubTool={state.decorSubTool} onDecorSubTool={state.setDecorSubTool}
              showGrid={state.showGrid}         onToggleGrid={() => state.setShowGrid(v => !v)}
              onResetView={handleResetView}     onClearAll={handleClearAll}
            />
          )}
        </div>
        {/* Right panel — desktop/tablet only */}
        {!isMobile && <RightPanel
          selectedPlant={state.selectedPlant}
          selectedStruct={state.selectedStruct}
          multiSelection={state.multiSelection}
          editingShapeId={state.editingShapeId}
          plantDataRef={state.plantDataRef}
          structDataRef={state.structDataRef}
          layers={layersRef.current}
          gardenUnit={state.gardenUnit}
          currentMode={state.currentMode}         onModeChange={state.setCurrentMode}
          bedSubTool={state.bedSubTool}           onBedSubTool={state.setBedSubTool}
          fenceSubTool={state.fenceSubTool}       onFenceSubTool={state.setFenceSubTool}
          fenceType={state.fenceType}             onFenceType={state.setFenceType}
          pathSubTool={state.pathSubTool}         onPathSubTool={state.setPathSubTool}
          buildingSubTool={state.buildingSubTool} onBuildingSubTool={state.setBuildingSubTool}
          waterSubTool={state.waterSubTool}       onWaterSubTool={state.setWaterSubTool}
          decorSubTool={state.decorSubTool}       onDecorSubTool={state.setDecorSubTool}
          showGrid={state.showGrid}               onToggleGrid={() => state.setShowGrid(v => !v)}
          onResetView={handleResetView}
          onClearAll={handleClearAll}
          onDeletePlant={() => { state.selectedPlant?.group.destroy(); delete state.plantDataRef.current[state.selectedPlant?.id]; layersRef.current.plantLayer?.batchDraw(); clearSelection(); triggerAutoSave() }}
          onDeleteStruct={() => { state.selectedStruct?.shape.destroy(); delete state.structDataRef.current[state.selectedStruct?.id]; layersRef.current.structLayer?.batchDraw(); clearSelection(); triggerAutoSave() }}
          onDeleteMulti={deleteSelected}
          onTransparentPlant={handleTransparentPlant}
          onLockPlant={handleLockPlant}
          onLockStruct={handleLockStruct}
          onCopyPlant={() => {
            const sel = state.selectedPlant; if (!sel) return
            const d = state.plantDataRef.current[sel.id]
            const img = loadedImages[d?.key] || sel.group.findOne('Image')?.image()
            if (!img) return
            const scaleX = sel.group.scaleX()
            const scaleY = sel.group.scaleY()
            const srcX   = sel.group.x()
            const srcY   = sel.group.y()
            const sizeMap = { XS: 24, S: 40, M: 64, L: 96, XL: 128, XXL: 160 }
            const size = sizeMap[d?.size] || 64
            const entry = { ...d, _img: img, scaleX, scaleY }
            // Copy + immediately paste to the right (touch-friendly: one tap)
            const { plantLayer } = layersRef.current
            if (!plantLayer) return
            const newId = addPlant({
              entry,
              x: srcX + size + 8 + size / 2,
              y: srcY + size / 2,
              stage: stageRef.current, plantLayer,
              plantDataRef: state.plantDataRef, plantIdCtr: state.plantIdCtr,
              showGridRef,
              onSelect: handlePlantSelect,
            })
            if (newId) {
              const group = plantLayer.findOne('#' + newId)
              if (group) {
                group.scaleX(scaleX); group.scaleY(scaleY)
                group.moveToTop()
              }
              plantLayer.batchDraw()
              state.pushUndo(() => {
                const g = layersRef.current.plantLayer?.findOne('#' + newId)
                if (g) { g.destroy(); delete state.plantDataRef.current[newId]; layersRef.current.plantLayer?.batchDraw() }
              })
              triggerAutoSave()
            }
            // Advance srcX so next tap steps one more plant to the right
            state.setClipboard({ kind: 'plant', entry, srcX: srcX + size + 8, srcY })
          }}
          onColourChange={handleColourChange}
          onPathWidthChange={handlePathWidthChange}
          onEnterEdit={enterEdit}
          onExitEdit={exitEdit}
          addingPt={state.addingPt}
          onToggleAddPt={() => {
            const next = !state.addingPt
            state.setAddingPt(next)
            if (next) state.setRemovingPt(false)  // mutually exclusive
            if (state.editingShapeId) {
              const sh = layersRef.current.structLayer?.findOne('#' + state.editingShapeId)
              if (sh) buildEditHandles(state.editingShapeId, sh)
            }
          }}
          removingPt={state.removingPt}
          onToggleRemovePt={() => {
            const next = !state.removingPt
            state.setRemovingPt(next)
            if (next) state.setAddingPt(false)  // mutually exclusive
            if (state.editingShapeId) {
              const sh = layersRef.current.structLayer?.findOne('#' + state.editingShapeId)
              if (sh) buildEditHandles(state.editingShapeId, sh)
            }
          }}
          onDimRectApply={handleDimRectApply}
          onDimCircleApply={handleDimCircleApply}
          onLayerMove={handleLayerMove}
          onTransparentStruct={handleTransparentStruct}
          onCopyStruct={handleCopyStruct}
          onDisconnect={handleDisconnect}
          onSeasonsChange={() => {
            const { plantLayer } = layersRef.current
            if (!plantLayer) return
            const SEASON_NAMES = ['spring','summer','fall','winter']
            const sN = SEASON_NAMES[state.currentSeason]
            plantLayer.find('Group').forEach(g => {
              const d = state.plantDataRef.current[g.id()]
              if (!d) return
              if (d.transparent) { g.opacity(0.35); return }
              g.opacity(d.seasons?.includes(sN) ? 1 : 0.1)
            })
            plantLayer.batchDraw()
            triggerAutoSave()
          }}
          onClearSelection={clearSelection}
          onUndo={handleUndo}
        />}
      </div>

      {/* Season slider (desktop/tablet only — mobile uses MobileSheet) */}
      {!isMobile && (
        <BottomBar
          currentSeason={state.currentSeason} onSeasonChange={state.setCurrentSeason}
          isMobile={false}
        />
      )}
    </div>
  )
}
