// usePlantCatalog.js — Full plant catalog (ported from v8 PLANT_CATALOG)
// src paths are relative to the public/ folder (Vite serves them as static assets)

export const PLANT_CATALOG = [
  // ── Generated stickers (transparent PNG) ──
  { key:'flower-cluster_allium',          label:'Allium',              family:'Ornamental Bulb',  src:'/stickers/flower-cluster_allium_M_CA-US-FR-GB-AU.png',          size:'M' },
  { key:'flower-cluster_hydrangea',       label:'Hydrangea',           family:'Shrub',             src:'/stickers/flower-cluster_hydrangea_L_CA-US-FR-GB-AU.png',       size:'L' },
  { key:'flower-daisy_black-eyed-susan',  label:'Black-eyed Susan',    family:'Perennial',         src:'/stickers/flower-daisy_black-eyed-susan_M_CA-US.png',           size:'M' },
  { key:'flower-daisy_cosmos',            label:'Cosmos',              family:'Annual Flower',     src:'/stickers/flower-daisy_cosmos_M_CA-US-FR-GB-AU.png',            size:'M' },
  { key:'flower-daisy_echinacea',         label:'Echinacea',           family:'Perennial',         src:'/stickers/flower-daisy_echinacea_M_CA-US-FR-GB.png',            size:'M' },
  { key:'flower-daisy_petunia',           label:'Petunia',             family:'Annual Flower',     src:'/stickers/flower-daisy_petunia_S_CA-US-FR-GB-AU.png',           size:'S' },
  { key:'flower-daisy_zinnia',            label:'Zinnia',              family:'Annual Flower',     src:'/stickers/flower-daisy_zinnia_S_CA-US-FR-AU.png',               size:'S' },
  { key:'flower-rose_peony',              label:'Peony',               family:'Perennial',         src:'/stickers/flower-rose_peony_M_CA-US-FR-GB.png',                 size:'M' },
  { key:'flower-rose_rose',               label:'Rose',                family:'Shrub / Rose',      src:'/stickers/flower-rose_rose_M_CA-US-FR-GB-AU.png',               size:'M' },
  { key:'flower-spike_delphinium',        label:'Delphinium',          family:'Perennial',         src:'/stickers/flower-spike_delphinium_L_CA-US-FR-GB.png',           size:'L' },
  { key:'flower-spike_lupin',             label:'Lupin',               family:'Perennial',         src:'/stickers/flower-spike_lupin_L_CA-US-FR-GB-AU.png',             size:'L' },
  { key:'flower-spike_salvia',            label:'Salvia',              family:'Perennial / Annual',src:'/stickers/flower-spike_salvia_M_CA-US-FR-GB-AU.png',            size:'M' },
  { key:'flower-spike_snapdragon',        label:'Snapdragon',          family:'Annual Flower',     src:'/stickers/flower-spike_snapdragon_M_CA-US-FR-GB.png',           size:'M' },
  { key:'herb-small_basil',               label:'Basil',               family:'Herb',              src:'/stickers/herb-small_basil_S_CA-US-FR-GB-AU.png',               size:'S' },
  { key:'herb-small_chives',              label:'Chives',              family:'Herb',              src:'/stickers/herb-small_chives_S_CA-US-FR-GB-AU.png',              size:'S' },
  { key:'herb-small_mint',                label:'Mint',                family:'Herb',              src:'/stickers/herb-small_mint_S_CA-US-FR-GB-AU.png',                size:'S' },
  { key:'herb-small_parsley',             label:'Parsley',             family:'Herb',              src:'/stickers/herb-small_parsley_S_CA-US-FR-GB-AU.png',             size:'S' },
  { key:'herb-small_rosemary',            label:'Rosemary',            family:'Herb',              src:'/stickers/herb-small_rosemary_M_US-FR-GB-AU.png',               size:'M' },
  { key:'herb-small_sage',                label:'Sage',                family:'Herb',              src:'/stickers/herb-small_sage_S_CA-US-FR-GB-AU.png',                size:'S' },
  { key:'shrub-flowering_azalea',         label:'Azalea',              family:'Shrub',             src:'/stickers/shrub-flowering_azalea_L_CA-US-FR-GB-AU.png',         size:'L' },
  { key:'shrub-flowering_lilac',          label:'Lilac',               family:'Shrub',             src:'/stickers/shrub-flowering_lilac_L_CA-US-FR-GB.png',             size:'L' },
  { key:'shrub-round_boxwood',            label:'Boxwood',             family:'Shrub',             src:'/stickers/shrub-round_boxwood_L_CA-US-FR-GB-AU.png',            size:'L' },
  { key:'tree-conifer_blue-spruce',       label:'Blue Spruce',         family:'Conifer Tree',      src:'/stickers/tree-conifer_blue-spruce_XL_CA-US-FR-GB.png',         size:'XL' },
  { key:'tree-deciduous_japanese-maple',  label:'Japanese Maple',      family:'Deciduous Tree',    src:'/stickers/tree-deciduous_japanese-maple_XL_CA-US-FR-GB-AU.png', size:'XL' },
  { key:'tree-deciduous_silver-birch',    label:'Silver Birch',        family:'Deciduous Tree',    src:'/stickers/tree-deciduous_silver-birch_XL_CA-US-FR-GB.png',      size:'XL' },
  { key:'tree-fruit_cherry-tree',         label:'Cherry Tree',         family:'Fruit Tree',        src:'/stickers/tree-fruit_cherry-tree_XL_CA-US-FR-GB-AU.png',        size:'XL' },
  { key:'tree-fruit_lemon-tree',          label:'Lemon Tree',          family:'Fruit Tree',        src:'/stickers/tree-fruit_lemon-tree_XL_US-FR-AU.png',               size:'XL' },
  { key:'tree-fruit_plum-tree',           label:'Plum Tree',           family:'Fruit Tree',        src:'/stickers/tree-fruit_plum-tree_XL_CA-US-FR-GB-AU.png',          size:'XL' },
  { key:'vegetable-leafy_zucchini',       label:'Zucchini',            family:'Vegetable',         src:'/stickers/vegetable-leafy_zucchini_M_CA-US-FR-GB-AU.png',       size:'M' },
  { key:'vegetable-root_beet',            label:'Beet',                family:'Root Vegetable',    src:'/stickers/vegetable-root_beet_S_CA-US-FR-GB-AU.png',            size:'S' },
  { key:'vegetable-tall_cherry-tomato',   label:'Cherry Tomato',       family:'Vegetable',         src:'/stickers/vegetable-tall_cherry-tomato_M_CA-US-FR-GB-AU.png',   size:'M' },
  { key:'vegetable-tall_sunflower',       label:'Sunflower',           family:'Annual Flower',     src:'/stickers/vegetable-tall_sunflower_XL_CA-US-FR-GB-AU.png',      size:'XL' },
  { key:'vegetable-tall_tomato',          label:'Tomato',              family:'Vegetable',         src:'/stickers/vegetable-tall_tomato_M_CA-US-FR-GB-AU.png',          size:'M' },
  // ── SVG fallbacks ──
  { key:'tree-svg',                       label:'Apple Tree',          family:'Fruit Tree',        src:'/stickers/tree.svg',                                            size:'L' },
  { key:'rose-bush-svg',                  label:'Rose Bush',           family:'Shrub / Rose',      src:'/stickers/rose-bush.svg',                                       size:'M' },
  { key:'lilac-bush-svg',                 label:'Lavender',            family:'Herb / Perennial',  src:'/stickers/lilac-bush.svg',                                      size:'M' },
]

// Group catalog by family for tray sections
export function groupCatalog(catalog) {
  const groups = {}
  catalog.forEach(entry => {
    const f = entry.family || 'Other'
    if (!groups[f]) groups[f] = []
    groups[f].push(entry)
  })
  return groups
}
