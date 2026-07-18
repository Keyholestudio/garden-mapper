// packs/index.js — Pack registry
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
  // Ferns
  {
    id: 'ferns-woodland',
    label: 'Woodland Ferns',
    eager: false,
    loader: () => import('./pack-ferns-woodland.js'),
    families: ['Fern / Groundcover'],
  },
];

// Families served by lazy packs — used to exclude them from core tray render
export const LAZY_FAMILIES = new Set(
  PACK_REGISTRY
    .filter(p => !p.eager)
    .flatMap(p => p.families)
);
