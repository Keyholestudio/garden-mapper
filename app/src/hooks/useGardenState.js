// useGardenState.js — Central state for the garden editor
// Mirrors the flat state variables from v8 prototype, lifted into React

import { useState, useRef } from 'react'

// Constants (ported directly from v8)
export const SEASONS = ['spring', 'summer', 'fall', 'winter']
export const SEASON_NAMES = ['🌸 Spring', '☀️ Summer', '🍂 Fall', '❄️ Winter']
export const UNIT_PX = 32
export const CELL_IN = 3
export const CELL_PX = 8
export const SIZE_MAP = { XS: 24, S: 40, M: 64, L: 96, XL: 128, XXL: 160 } // XXL: trees, gazebos, tables

export const BED_COLOURS     = ['#8B6340','#6D4C1F','#C8A96A','#9E9E9E','#BDBDBD','#78909C',
  '#TX:soil-brown','#TX:soil-dark-brown','#TX:soil-red-mulch','#TX:soil-cedar-mulch','#TX:soil-hay']
export const BUILDING_COLOURS= ['#90A4AE','#BCAAA4','#78909C','#A1887F',
  '#TX:roof-cedar-shingles','#TX:roof-asphalt','#TX:roof-terracotta']
export const FENCE_COLOURS   = ['#795548','#6D4C41','#4E342E','#BCAAA4','#90A4AE']
export const HEDGE_COLOURS   = ['#388E3C','#2E7D32','#1B5E20','#558B2F']
export const PATH_COLOURS    = ['#D7CCC8','#BCAAA4','#9E9E9E','#5D4037',
  '#TX:path-stepping-round','#TX:path-stepping-square','#TX:path-flagstone']
export const WATER_COLOURS   = ['#64B5F6','#42A5F5','#1E88E5','#90CAF9','#B3E5FC']
export const DECKING_COLOURS = ['#C8A96A','#A0785A','#8B6340','#D4A96A','#6D4C41',
  '#TX:deck-medium-brown','#TX:deck-dark-brown','#TX:deck-cedar']

// Texture map: colour token -> texture file path + display label
export const TEXTURE_MAP = {
  '#TX:soil-brown':          { src: '/textures/soil-brown.jpg',          label: 'Brown Soil' },
  '#TX:soil-dark-brown':     { src: '/textures/soil-dark-brown.jpg',     label: 'Dark Soil' },
  '#TX:soil-red-mulch':      { src: '/textures/soil-red-mulch.jpg',      label: 'Red Mulch' },
  '#TX:soil-cedar-mulch':    { src: '/textures/soil-cedar-mulch.jpg',    label: 'Cedar Mulch' },
  '#TX:soil-hay':            { src: '/textures/soil-hay.jpg',            label: 'Hay' },
  '#TX:roof-cedar-shingles': { src: '/textures/roof-cedar-shingles.jpg', label: 'Cedar Shingles' },
  '#TX:roof-asphalt':        { src: '/textures/roof-asphalt.jpg',        label: 'Asphalt Shingles' },
  '#TX:roof-terracotta':     { src: '/textures/roof-terracotta.jpg',     label: 'Terracotta Tiles' },
  '#TX:path-stepping-round': { src: '/textures/path-stepping-round.jpg', label: 'Round Stepping Stones' },
  '#TX:path-stepping-square':{ src: '/textures/path-stepping-square.jpg',label: 'Square Pavers' },
  '#TX:path-flagstone':      { src: '/textures/path-flagstone.jpg',      label: 'Flagstone' },
  '#TX:deck-medium-brown':   { src: '/textures/deck-medium-brown.jpg',   label: 'Medium Brown Planks' },
  '#TX:deck-dark-brown':     { src: '/textures/deck-dark-brown.jpg',     label: 'Dark Brown Planks' },
  '#TX:deck-cedar':          { src: '/textures/deck-cedar.jpg',          label: 'Cedar Planks' },
}
export const PLANT_VARIANTS = {
  'tree-deciduous_maple': [
    { label: 'Green',      name: 'Maple Tree',      colour: '#4CAF50', src: '/stickers/tree-deciduous_maple_XXL_CA-US-FR-GB-AU.png' },
    { label: 'Dark Green', name: 'Maple Tree',      colour: '#2E7D32', src: '/stickers/tree-deciduous_maple_XXL_dark-green.png' },
    { label: 'Silver',     name: 'Silver Maple',    colour: '#78909C', src: '/stickers/tree-deciduous_maple_XXL_silver-green.png' },
    { label: 'Purple',     name: 'Royal Red Maple', colour: '#6A1B9A', src: '/stickers/tree-deciduous_maple_XXL_purple-leaf.png' },
    { label: 'Japanese',   name: 'Japanese Maple',  colour: '#C0392B', src: '/stickers/tree-deciduous_japanese-maple_XXL_CA-US-FR-GB-AU.png' },
  ],
  'shrub-flowering_azalea': [
    { label: 'White', name: 'White Azalea', colour: '#F8F8F0', src: '/stickers/shrub-flowering_azalea_M_white_CA-US-FR-GB-AU.png' },
    { label: 'Pink',  name: 'Pink Azalea',  colour: '#F5A8C8', src: '/stickers/shrub-flowering_azalea_M_pink_CA-US-FR-GB-AU.png' },
    { label: 'Red',   name: 'Red Azalea',   colour: '#D42B2B', src: '/stickers/shrub-flowering_azalea_M_red_CA-US-FR-GB-AU.png' },
  ],
  'flower-spike_hollyhock': [
    { label: 'Pink',  name: 'Pink Hollyhock',  colour: '#F5A8C8', src: '/stickers/flower-spike_hollyhock_XL_pink_CA-US-FR-GB-AU.png' },
    { label: 'Red',   name: 'Red Hollyhock',   colour: '#D42B2B', src: '/stickers/flower-spike_hollyhock_XL_red_CA-US-FR-GB-AU.png' },
    { label: 'White', name: 'White Hollyhock', colour: '#F8F8F0', src: '/stickers/flower-spike_hollyhock_XL_white_CA-US-FR-GB-AU.png' },
  ],
  'flower-rose_peony': [
    { label: 'White', name: 'White Peony', colour: '#F8F8F0', src: '/stickers/flower-rose_peony_M_white_CA-US-FR-GB-AU.png' },
    { label: 'Pink',  name: 'Pink Peony',  colour: '#F5A8C8', src: '/stickers/flower-rose_peony_M_pink_CA-US-FR-GB-AU.png' },
    { label: 'Coral', name: 'Coral Peony', colour: '#E8603A', src: '/stickers/flower-rose_peony_M_coral_CA-US-FR-GB-AU.png' },
  ],
  'flower-rose_rose': [
    { label: 'White', name: 'White Rose', colour: '#F8F8F0', src: '/stickers/flower-rose_rose_M_white_CA-US-FR-GB-AU.png' },
    { label: 'Pink',  name: 'Pink Rose',  colour: '#F5A8C8', src: '/stickers/flower-rose_rose_M_pink_CA-US-FR-GB-AU.png' },
    { label: 'Red',   name: 'Red Rose',   colour: '#D42B2B', src: '/stickers/flower-rose_rose_M_red_CA-US-FR-GB-AU.png' },
  ],
  'flower-rose_climbing-rose': [
    { label: 'White', name: 'White Climbing Rose', colour: '#F8F8F0', src: '/stickers/flower-rose_climbing-rose_M_white_CA-US-FR-GB-AU.png' },
    { label: 'Pink',  name: 'Pink Climbing Rose',  colour: '#F5A8C8', src: '/stickers/flower-rose_climbing-rose_M_pink_CA-US-FR-GB-AU.png' },
    { label: 'Red',   name: 'Red Climbing Rose',   colour: '#D42B2B', src: '/stickers/flower-rose_climbing-rose_M_red_CA-US-FR-GB-AU.png' },
  ],
  'herb-small_basil': [
    { label: 'Green',   name: 'Sweet Basil',    colour: '#5AB83A', src: '/stickers/herb-small_basil_S_CA-US-FR-GB-AU.png' },
    { label: 'Thai',    name: 'Thai Basil',     colour: '#2A5A1A', src: '/stickers/herb-small_basil_S_thai_CA-US-FR-GB-AU.png' },
    { label: 'Purple',  name: 'Purple Basil',   colour: '#6A1A3A', src: '/stickers/herb-small_basil_S_purple_CA-US-FR-GB-AU.png' },
    { label: 'Greek',   name: 'Greek Basil',    colour: '#4A7C2F', src: '/stickers/herb-small_basil_S_greek_CA-US-FR-GB-AU.png' },
    { label: 'Opal',    name: 'Opal Basil',     colour: '#5A1A6A', src: '/stickers/herb-small_basil_S_opal_CA-US-FR-GB-AU.png' },
  ],
  'flower-daisy_dahlia': [
    { label: 'Purple', name: 'Purple Dahlia', colour: '#7B35C8', src: '/stickers/flower-daisy_dahlia_M_purple_CA-US-FR-GB-AU.png' },
    { label: 'Red',    name: 'Red Dahlia',    colour: '#D42B2B', src: '/stickers/flower-daisy_dahlia_M_red_CA-US-FR-GB-AU.png' },
    { label: 'Yellow', name: 'Yellow Dahlia', colour: '#FFD700', src: '/stickers/flower-daisy_dahlia_M_yellow_CA-US-FR-GB-AU.png' },
  ],
  'flower-daisy_geranium': [
    { label: 'Red Zonal',   name: 'Red Zonal Geranium',   colour: '#D42B2B', src: '/stickers/flower-daisy_geranium_S_red-zonal_CA-US-FR-GB-AU.png' },
    { label: 'Pink Ivy',   name: 'Pink Ivy Geranium',    colour: '#F5A8C8', src: '/stickers/flower-daisy_geranium_S_pink-ivy_CA-US-FR-GB-AU.png' },
    { label: 'Pink Angel', name: 'Angel Geranium',       colour: '#F5C8D8', src: '/stickers/flower-daisy_geranium_S_pink-angel_CA-US-FR-GB-AU.png' },
    { label: 'Scented',    name: 'Scented Geranium',     colour: '#7A9A60', src: '/stickers/flower-daisy_geranium_S_scented_CA-US-FR-GB-AU.png' },
    { label: 'Fancy Leaf', name: 'Fancy Leaf Geranium',  colour: '#D4A820', src: '/stickers/flower-daisy_geranium_S_fancy-leaf_CA-US-FR-GB-AU.png' },
  ],
  'flower-daisy_marigold': [
    { label: 'Orange',  name: 'Orange Marigold',  colour: '#FF8C00', src: '/stickers/flower-daisy_marigold_S_orange_CA-US-FR-GB-AU.png' },
    { label: 'Yellow',  name: 'Yellow Marigold',  colour: '#FFD700', src: '/stickers/flower-daisy_marigold_S_yellow_CA-US-FR-GB-AU.png' },
    { label: 'Cream',   name: 'Cream Marigold',   colour: '#F5F0D8', src: '/stickers/flower-daisy_marigold_S_cream_CA-US-FR-GB-AU.png' },
    { label: 'French',  name: 'French Marigold',  colour: '#FF6B00', src: '/stickers/flower-daisy_marigold_S_french_CA-US-FR-GB-AU.png' },
  ],
  'flower-cluster_hydrangea': [
    { label: 'Arborescens', name: 'Hydrangea Arborescens', colour: '#F0EEE0', src: '/stickers/flower-cluster_hydrangea_M_arborescens_CA-US-FR-GB-AU.png' },
    { label: 'Nikko Blue',  name: 'Nikko Blue Hydrangea', colour: '#5B8DD9', src: '/stickers/flower-cluster_hydrangea_M_nikko-blue_CA-US-FR-GB-AU.png' },
    { label: 'Blue Deckle', name: 'Blue Deckle Hydrangea', colour: '#7AAAD8', src: '/stickers/flower-cluster_hydrangea_M_blue-deckle_CA-US-FR-GB-AU.png' },
    { label: 'Eldorado',    name: 'Eldorado Hydrangea',   colour: '#A8D840', src: '/stickers/flower-cluster_hydrangea_M_eldorado_CA-US-FR-GB-AU.png' },
    { label: 'Unique',      name: 'Unique Hydrangea',     colour: '#F5D8D8', src: '/stickers/flower-cluster_hydrangea_M_unique_CA-US-FR-GB-AU.png' },
    { label: 'Miss Saori',  name: 'Miss Saori Hydrangea', colour: '#C82860', src: '/stickers/flower-cluster_hydrangea_M_miss-saori_CA-US-FR-GB-AU.png' },
  ],
  'bulb-spring_tulip': [
    { label: 'Red',        name: 'Red Tulip',         colour: '#D42B2B', src: '/stickers/bulb-spring_tulip_S_red_CA-US-FR-GB-AU.png' },
    { label: 'Pink',       name: 'Pink Impression',   colour: '#F5A8C8', src: '/stickers/bulb-spring_tulip_S_pink_CA-US-FR-GB-AU.png' },
    { label: 'Orange',     name: 'Orange Tulip',      colour: '#FF6B1A', src: '/stickers/bulb-spring_tulip_S_orange_CA-US-FR-GB-AU.png' },
    { label: 'Yellow',     name: 'Yellow Tulip',      colour: '#FFD700', src: '/stickers/bulb-spring_tulip_S_yellow_CA-US-FR-GB-AU.png' },
    { label: 'Fosteriana', name: 'Emperor Tulip',     colour: '#F5F0E0', src: '/stickers/bulb-spring_tulip_S_fosteriana_CA-US-FR-GB-AU.png' },
    { label: 'Fringed',    name: 'Fringed Tulip',     colour: '#7B35C8', src: '/stickers/bulb-spring_tulip_S_fringed_CA-US-FR-GB-AU.png' },
  ],
  'vegetable-leafy_lettuce': [
    { label: 'Green',       name: 'Lettuce',                colour: '#66BB6A', src: '/stickers/vegetable-leafy_lettuce_M_CA-US-FR-GB-AU.png' },
    { label: 'Light Green', name: 'Butterhead Lettuce',     colour: '#A5D6A7', src: '/stickers/vegetable-leafy_lettuce_M_light-green.png' },
    { label: 'Dark Green',  name: 'Romaine Lettuce',        colour: '#2E7D32', src: '/stickers/vegetable-leafy_lettuce_M_dark-green.png' },
    { label: 'Red-Green',   name: 'Lollo Rossa Lettuce',    colour: '#E57373', src: '/stickers/vegetable-leafy_lettuce_M_red-green.png' },
    { label: 'Burgundy',    name: 'Red Romaine Lettuce',    colour: '#880E4F', src: '/stickers/vegetable-leafy_lettuce_M_burgundy.png' },
    { label: 'Bronze',      name: 'Bronze Lettuce',         colour: '#A1887F', src: '/stickers/vegetable-leafy_lettuce_M_bronze.png' },
  ],
}

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
  const [decorSubTool, setDecorSubTool]       = useState(null)
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
  const [canUndo, setCanUndo] = useState(false)
  const pushUndo = (fn) => {
    undoStack.current.push(fn)
    if (undoStack.current.length > 20) undoStack.current.shift()
    setCanUndo(true)
  }
  const undo = () => {
    const fn = undoStack.current.pop()
    if (fn) fn()
    setCanUndo(undoStack.current.length > 0)
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
    decorSubTool, setDecorSubTool,
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
    canUndo,
    pushUndo,
    undo,

    // Free draw
    freePtsRef,
    freeDotsRef,
    freePreviewRef,
  }
}
