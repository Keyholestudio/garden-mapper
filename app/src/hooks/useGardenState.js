// useGardenState.js — Central state for the garden editor
// Mirrors the flat state variables from v8 prototype, lifted into React

import { useState, useRef } from 'react'

// Constants (ported directly from v8)
export const SEASONS = ['spring', 'summer', 'fall', 'winter']
export const SEASON_NAMES = ['🌸 Spring', '☀️ Summer', '🍂 Fall', '❄️ Winter']
export const UNIT_PX = 32
export const CELL_IN = 3
export const CELL_PX = 8
export const SIZE_MAP = { XS: 24, S: 40, M: 64, L: 96 }

export const BED_COLOURS     = ['#8B6340','#6D4C1F','#C8A96A','#9E9E9E','#BDBDBD','#78909C']
export const BUILDING_COLOURS= ['#90A4AE','#BCAAA4','#78909C','#A1887F']
export const FENCE_COLOURS   = ['#795548','#6D4C41','#4E342E','#BCAAA4','#90A4AE']
export const HEDGE_COLOURS   = ['#388E3C','#2E7D32','#1B5E20','#558B2F']
export const PATH_COLOURS    = ['#D7CCC8','#BCAAA4','#9E9E9E','#5D4037']
export const WATER_COLOURS   = ['#64B5F6','#42A5F5','#1E88E5','#90CAF9','#B3E5FC']
export const DECKING_COLOURS = ['#C8A96A','#A0785A','#8B6340','#D4A96A','#6D4C41']
export const ELEC_COLOURS    = ['#111111','#E53935','#FDD835']
export const PLUMB_COLOURS   = ['#757575','#1976D2','#6D4C41']

export const GATE_STYLES = {
  wood:    { stroke: '#8B4513', strokeWidth: 8,  dash: [],      label: 'Wood Gate' },
  metal:   { stroke: '#37474F', strokeWidth: 5,  dash: [6, 4],  label: 'Metal Gate' },
  stone:   { stroke: '#8D6E63', strokeWidth: 10, dash: [10, 5], label: 'Stone Gate' },
  plastic: { stroke: '#CFD8DC', strokeWidth: 7,  dash: [],      label: 'Plastic Gate' },
}

export function useGardenState() {
  // Garden setup
  const [gardenName, setGardenName]   = useState('My Garden')
  const [gardenUnit, setGardenUnit]   = useState('ft')
  const [gardenW, setGardenW]         = useState(60)
  const [gardenH, setGardenH]         = useState(40)
  // Skip setup overlay on startup if a saved garden already exists in localStorage
  const hasSavedGarden = (() => { try { const d = JSON.parse(localStorage.getItem('gardenData') || '[]'); return Array.isArray(d) && d.some(g => g && typeof g === 'object') } catch { return false } })()
  const [isSetup, setIsSetup]         = useState(hasSavedGarden) // true = skip overlay for returning users

  // Canvas / view
  const [showGrid, setShowGrid]       = useState(false)
  const [currentSeason, setCurrentSeason] = useState(0)
  const propBoundsRef                 = useRef(null) // {x,y,w,h} — set after Konva init

  // Tool state
  const [currentMode, setCurrentMode]         = useState('select')
  const [bedSubTool, setBedSubTool]           = useState(null)  // null = no default; user picks
  const [fenceSubTool, setFenceSubTool]       = useState(null)
  const [fenceType, setFenceType]             = useState(null)
  const [pathSubTool, setPathSubTool]         = useState(null)
  const [gateType, setGateType]               = useState('wood')
  const [buildingSubTool, setBuildingSubTool] = useState(null)
  const [waterSubTool, setWaterSubTool]       = useState(null)
  const [undergroundType, setUndergroundType] = useState('electrical')
  const [undergroundColour, setUndergroundColour] = useState('#111111')
  const [undergroundWidth, setUndergroundWidth]   = useState(4)
  const [undergroundOpaque, setUndergroundOpaque] = useState(false)
  const [defaultPathWidth, setDefaultPathWidth]   = useState(18)

  // Selection
  const [selectedPlant, setSelectedPlant]   = useState(null)
  const [selectedStruct, setSelectedStruct] = useState(null)
  const [multiSelection, setMultiSelection] = useState([]) // [{kind, id, shape}]
  const [clipboard, setClipboard]           = useState(null)

  // Edit mode
  const [editingShapeId, setEditingShapeId] = useState(null)
  const [addingPt, setAddingPt] = useState(false)
  const [removingPt, setRemovingPt] = useState(false)

  // Object registries (mutable refs — Konva manages these, React doesn't need to re-render)
  const plantDataRef  = useRef({})  // id → {entry, group, seasons, notes, transparent}
  const structDataRef = useRef({})  // id → {type, shape, ...}

  // Counters (refs — no re-render needed)
  const plantIdCtr  = useRef(0)
  const structIdCtr = useRef(0)
  const groupIdCtr  = useRef(0)

  // Undo stack
  const undoStack = useRef([])
  const pushUndo = (fn) => {
    undoStack.current.push(fn)
    if (undoStack.current.length > 20) undoStack.current.shift()
  }
  const undo = () => {
    const fn = undoStack.current.pop()
    if (fn) fn()
  }

  // Free draw state (refs — updated every mouse move, no re-render)
  const freePtsRef     = useRef([])
  const freeDotsRef    = useRef([])
  const freePreviewRef = useRef(null)

  return {
    // Garden setup
    gardenName, setGardenName,
    gardenUnit, setGardenUnit,
    gardenW, setGardenW,
    gardenH, setGardenH,
    isSetup, setIsSetup,
    propBoundsRef,

    // View
    showGrid, setShowGrid,
    currentSeason, setCurrentSeason,

    // Tools
    currentMode, setCurrentMode,
    bedSubTool, setBedSubTool,
    fenceSubTool, setFenceSubTool,
    fenceType, setFenceType,
    pathSubTool, setPathSubTool,
    gateType, setGateType,
    buildingSubTool, setBuildingSubTool,
    waterSubTool, setWaterSubTool,
    undergroundType, setUndergroundType,
    undergroundColour, setUndergroundColour,
    undergroundWidth, setUndergroundWidth,
    undergroundOpaque, setUndergroundOpaque,
    defaultPathWidth, setDefaultPathWidth,

    // Selection
    selectedPlant, setSelectedPlant,
    selectedStruct, setSelectedStruct,
    multiSelection, setMultiSelection,
    clipboard, setClipboard,

    // Edit mode
    editingShapeId, setEditingShapeId,
    addingPt, setAddingPt,
    removingPt, setRemovingPt,

    // Registries
    plantDataRef,
    structDataRef,

    // Counters
    plantIdCtr,
    structIdCtr,
    groupIdCtr,

    // Undo
    pushUndo,
    undo,

    // Free draw
    freePtsRef,
    freeDotsRef,
    freePreviewRef,
  }
}
