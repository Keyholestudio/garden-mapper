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
    eager: true,               // load at boot — images show immediately in tray
    loader: () => import('./pack-cacti-succulents.js'),
    families: ['Cactus', 'Succulent'],
  },
  {
    id: 'tropical',
    label: 'Tropical & Palms',
    eager: true,               // load at boot — images show immediately in tray
    loader: () => import('./pack-tropical.js'),
    families: ['Palm Tree', 'Tropical'],
  },
];

// Families served by lazy packs — used to exclude them from core tray render
export const LAZY_FAMILIES = new Set(
  PACK_REGISTRY
    .filter(p => !p.eager)
    .flatMap(p => p.families)
);
