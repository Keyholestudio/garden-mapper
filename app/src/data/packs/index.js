// packs/index.js - Pack registry
// Each pack is loaded on demand when its category is first opened.
// 'core' is always pre-loaded at boot (backward compat).
//
// To add a new pack:
// 1. Create pack-<name>.js in this folder
// 2. Add an entry here with the families it covers
// 3. Add to PLANT_CATALOG_TRAY filter in usePlantCatalog.js if needed

export const PACK_REGISTRY = [
  {
    id: 'core',
    label: 'Core',
    eager: true,               // loaded at boot, always available
    loader: () => import('./pack-core.js'),
    families: [],              // all families not claimed by other packs
  },
  {
    id: 'cacti-succulents',
    label: 'Cacti & Succulents',
    eager: false,
    loader: () => import('./pack-cacti-succulents.js'),
    families: ['Cactus', 'Succulent'],
  },
  {
    id: 'tropical',
    label: 'Tropical & Palms',
    eager: false,
    loader: () => import('./pack-tropical.js'),
    families: ['Palm Tree', 'Tropical'],
  },
  {
    id: 'fruit-pome',
    label: 'Pome Fruit',
    eager: false,
    loader: () => import('./pack-fruit-pome.js'),
    families: ['Pome Fruit'],
  },
  // Vegetables
  {
    id: 'vegetables-leafy',
    label: 'Leafy Vegetables',
    eager: false,
    loader: () => import('./pack-vegetables-leafy.js'),
    families: ['Leafy Vegetable'],
  },
  {
    id: 'vegetables-root',
    label: 'Root Vegetables',
    eager: false,
    loader: () => import('./pack-vegetables-root.js'),
    families: ['Root Vegetable'],
  },
  {
    id: 'vegetables-bulb',
    label: 'Bulb Vegetables',
    eager: false,
    loader: () => import('./pack-vegetables-bulb.js'),
    families: ['Bulb Vegetable'],
  },
  {
    id: 'vegetables-stem',
    label: 'Stem Vegetables',
    eager: false,
    loader: () => import('./pack-vegetables-stem.js'),
    families: ['Stem Vegetable'],
  },
  {
    id: 'vegetables-fruiting',
    label: 'Fruiting Vegetables',
    eager: false,
    loader: () => import('./pack-vegetables-fruiting.js'),
    families: ['Fruiting Vegetable'],
  },
  {
    id: 'vegetables-legumes',
    label: 'Legumes',
    eager: false,
    loader: () => import('./pack-vegetables-legumes.js'),
    families: ['Legume'],
  },
  {
    id: 'vegetables-brassica',
    label: 'Brassica Vegetables',
    eager: false,
    loader: () => import('./pack-vegetables-brassica.js'),
    families: ['Brassica'],
  },
  {
    id: 'vegetables-asian-greens',
    label: 'Asian Greens',
    eager: false,
    loader: () => import('./pack-vegetables-asian-greens.js'),
    families: ['Asian Green'],
  },
  {
    id: 'vegetables-perennial',
    label: 'Perennial Vegetables',
    eager: false,
    loader: () => import('./pack-vegetables-perennial.js'),
    families: ['Perennial Vegetable'],
  },
  // Fruit
  {
    id: 'fruit-stone',
    label: 'Stone Fruit',
    eager: false,
    loader: () => import('./pack-fruit-stone.js'),
    families: ['Stone Fruit'],
  },
  {
    id: 'fruit-citrus',
    label: 'Citrus Fruit',
    eager: false,
    loader: () => import('./pack-fruit-citrus.js'),
    families: ['Citrus Fruit'],
  },
  {
    id: 'fruit-berry',
    label: 'Berry Fruit',
    eager: false,
    loader: () => import('./pack-fruit-berry.js'),
    families: ['Berry Fruit'],
  },
  {
    id: 'fruit-vine',
    label: 'Vine Fruit',
    eager: false,
    loader: () => import('./pack-fruit-vine.js'),
    families: ['Vine Fruit'],
  },
  {
    id: 'fruit-tropical',
    label: 'Tropical Fruit',
    eager: false,
    loader: () => import('./pack-fruit-tropical.js'),
    families: ['Tropical Fruit'],
  },
  {
    id: 'fruit-melons',
    label: 'Melons',
    eager: false,
    loader: () => import('./pack-fruit-melons.js'),
    families: ['Melon'],
  },
  {
    id: 'fruit-nuts',
    label: 'Nuts',
    eager: false,
    loader: () => import('./pack-fruit-nuts.js'),
    families: ['Nut'],
  },
  // Herbs
  {
    id: 'herbs-culinary',
    label: 'Culinary Herbs',
    eager: false,
    loader: () => import('./pack-herbs-culinary.js'),
    families: ['Herb'],
  },
  {
    id: 'herbs-medicinal',
    label: 'Medicinal Herbs',
    eager: false,
    loader: () => import('./pack-herbs-medicinal.js'),
    families: ['Medicinal Herb'],
  },
  // Flowers
  {
    id: 'flowers-perennials',
    label: 'Perennial Flowers',
    eager: false,
    loader: () => import('./pack-flowers-perennials.js'),
    families: ['Perennial'],
  },
  // Ferns
  {
    id: 'ferns-woodland',
    label: 'Woodland Ferns',
    eager: false,
    loader: () => import('./pack-ferns-woodland.js'),
    families: ['Fern / Groundcover'],
  },
  // Trees
  {
    id: 'trees-deciduous',
    label: 'Deciduous Trees',
    eager: false,
    loader: () => import('./pack-trees-deciduous.js'),
    families: ['Deciduous Tree'],
  },
  {
    id: 'trees-evergreen',
    label: 'Evergreen Trees',
    eager: false,
    loader: () => import('./pack-trees-evergreen.js'),
    families: ['Evergreen Tree'],
  },
  {
    id: 'trees-coniferous',
    label: 'Coniferous Trees',
    eager: false,
    loader: () => import('./pack-trees-coniferous.js'),
    families: ['Coniferous Tree'],
  },
  // Climbers
  {
    id: 'climbers-flowering',
    label: 'Flowering Climbers',
    eager: false,
    loader: () => import('./pack-climbers-flowering.js'),
    families: ['Flowering Climber'],
  },
  {
    id: 'climbers-evergreen',
    label: 'Evergreen Climbers',
    eager: false,
    loader: () => import('./pack-climbers-evergreen.js'),
    families: ['Evergreen Climber'],
  },
  {
    id: 'climbers-deciduous',
    label: 'Deciduous Climbers',
    eager: false,
    loader: () => import('./pack-climbers-deciduous.js'),
    families: ['Deciduous Climber'],
  },
  // Shrubs
  {
    id: 'shrubs-deciduous',
    label: 'Deciduous Shrubs',
    eager: false,
    loader: () => import('./pack-shrubs-deciduous.js'),
    families: ['Deciduous Shrub'],
  },
  {
    id: 'shrubs-evergreen',
    label: 'Evergreen Shrubs',
    eager: false,
    loader: () => import('./pack-shrubs-evergreen.js'),
    families: ['Evergreen Shrub'],
  },
  {
    id: 'shrubs-flowering',
    label: 'Flowering Shrubs',
    eager: false,
    loader: () => import('./pack-shrubs-flowering.js'),
    families: ['Flowering Shrub'],
  },
  {
    id: 'shrubs-coniferous',
    label: 'Coniferous Shrubs',
    eager: false,
    loader: () => import('./pack-shrubs-coniferous.js'),
    families: ['Coniferous Shrub'],
  },
  // Aquatics, Architectural, Bulbs (Spring), Decor
  {
    id: 'aquatics',
    label: 'Aquatic Plants',
    eager: false,
    loader: () => import('./pack-aquatics.js'),
    families: ['Aquatic'],
  },
  {
    id: 'architectural',
    label: 'Architectural Plants',
    eager: false,
    loader: () => import('./pack-architectural.js'),
    families: ['Architectural'],
  },
  {
    id: 'bulbs-spring',
    label: 'Spring Bulbs',
    eager: false,
    loader: () => import('./pack-bulbs-spring.js'),
    families: ['Spring Bulb'],
  },
  {
    id: 'decor',
    label: 'Garden Decor',
    eager: false,
    loader: () => import('./pack-decor.js'),
    families: ['Decor', 'Water Feature'],
  },
  // Grasses, Groundcovers, Bulbs
  {
    id: 'grasses-ornamental',
    label: 'Ornamental Grasses',
    eager: false,
    loader: () => import('./pack-grasses-ornamental.js'),
    families: ['Ornamental Grass'],
  },
  {
    id: 'groundcovers',
    label: 'Groundcovers',
    eager: false,
    loader: () => import('./pack-groundcovers.js'),
    families: ['Groundcover'],
  },
  {
    id: 'bulbs-summer',
    label: 'Summer Bulbs',
    eager: false,
    loader: () => import('./pack-bulbs-summer.js'),
    families: ['Summer Bulb'],
  },
];

// Families served by lazy packs - used to exclude them from core tray render
export const LAZY_FAMILIES = new Set(
  PACK_REGISTRY
    .filter(p => !p.eager)
    .flatMap(p => p.families)
);

// Static imports of all pack entries - used for tray rendering (avoids dynamic import issues on mobile)
import { entries as _cacti }         from './pack-cacti-succulents.js'
import { entries as _tropical }      from './pack-tropical.js'
import { entries as _fruitPome }     from './pack-fruit-pome.js'
import { entries as _vegLeafy }      from './pack-vegetables-leafy.js'
import { entries as _vegRoot }       from './pack-vegetables-root.js'
import { entries as _vegBulb }       from './pack-vegetables-bulb.js'
import { entries as _vegStem }       from './pack-vegetables-stem.js'
import { entries as _vegFruiting }   from './pack-vegetables-fruiting.js'
import { entries as _vegLegumes }    from './pack-vegetables-legumes.js'
import { entries as _vegBrassica }   from './pack-vegetables-brassica.js'
import { entries as _vegAsian }      from './pack-vegetables-asian-greens.js'
import { entries as _vegPerennial }  from './pack-vegetables-perennial.js'
import { entries as _fruitStone }    from './pack-fruit-stone.js'
import { entries as _fruitCitrus }   from './pack-fruit-citrus.js'
import { entries as _fruitBerry }    from './pack-fruit-berry.js'
import { entries as _fruitVine }     from './pack-fruit-vine.js'
import { entries as _fruitTropical } from './pack-fruit-tropical.js'
import { entries as _fruitMelons }   from './pack-fruit-melons.js'
import { entries as _fruitNuts }     from './pack-fruit-nuts.js'
import { entries as _herbsCulinary } from './pack-herbs-culinary.js'
import { entries as _herbsMedicinal }from './pack-herbs-medicinal.js'
import { entries as _flowers }       from './pack-flowers-perennials.js'
import { entries as _ferns }         from './pack-ferns-woodland.js'
import { entries as _treesDecid }    from './pack-trees-deciduous.js'
import { entries as _treesEverg }    from './pack-trees-evergreen.js'
import { entries as _treesConif }    from './pack-trees-coniferous.js'
import { entries as _climbFlower }   from './pack-climbers-flowering.js'
import { entries as _climbEverg }    from './pack-climbers-evergreen.js'
import { entries as _climbDecid }    from './pack-climbers-deciduous.js'
import { entries as _shrubsDecid }   from './pack-shrubs-deciduous.js'
import { entries as _shrubsEverg }   from './pack-shrubs-evergreen.js'
import { entries as _shrubsFlower }  from './pack-shrubs-flowering.js'
import { entries as _shrubsConif }   from './pack-shrubs-coniferous.js'
import { entries as _aquatics }      from './pack-aquatics.js'
import { entries as _architectural } from './pack-architectural.js'
import { entries as _bulbsSpring }   from './pack-bulbs-spring.js'
import { entries as _decor }         from './pack-decor.js'
import { entries as _grasses }       from './pack-grasses-ornamental.js'
import { entries as _groundcovers }  from './pack-groundcovers.js'
import { entries as _bulbsSummer }   from './pack-bulbs-summer.js'

export const ALL_PACK_ENTRIES = [
  ..._cacti, ..._tropical, ..._fruitPome, ..._vegLeafy, ..._vegRoot, ..._vegBulb,
  ..._vegStem, ..._vegFruiting, ..._vegLegumes, ..._vegBrassica, ..._vegAsian, ..._vegPerennial,
  ..._fruitStone, ..._fruitCitrus, ..._fruitBerry, ..._fruitVine, ..._fruitTropical,
  ..._fruitMelons, ..._fruitNuts, ..._herbsCulinary, ..._herbsMedicinal, ..._flowers,
  ..._ferns, ..._treesDecid, ..._treesEverg, ..._treesConif, ..._climbFlower,
  ..._climbEverg, ..._climbDecid, ..._shrubsDecid, ..._shrubsEverg, ..._shrubsFlower,
  ..._shrubsConif, ..._aquatics, ..._architectural, ..._bulbsSpring, ..._decor,
  ..._grasses, ..._groundcovers, ..._bulbsSummer,
];
