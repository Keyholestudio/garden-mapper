// usePlantCatalog.js — Full plant catalog (140 stickers, updated 2026-06-04)
// src paths are relative to the public/ folder (Vite serves them as static assets)
// Last updated: 2026-06-04 — Item #36: 27 new flowers + veg added

export const PLANT_CATALOG = [

  // ── Item #36 additions (2026-06-04) ─────────────────────────────────────────
  // #32/#35 fix + missing veg (2026-06-04)
  { key:'vegetable-tall_beans',             label:'Bush Beans',          family:'Vegetable',            src:'/stickers/vegetable-tall_beans_S_CA-US-FR-GB-AU.png',               size:'S'  },
  { key:'vegetable-leafy_brussels-sprouts', label:'Brussels Sprouts',    family:'Vegetable',            src:'/stickers/vegetable-leafy_brussels-sprouts_M_CA-US-FR-GB-AU.png',   size:'M'  },
  { key:'vegetable-tall_celery',            label:'Celery',              family:'Vegetable',            src:'/stickers/vegetable-tall_celery_M_CA-US-FR-GB-AU.png',              size:'M'  },
  { key:'vegetable-tall_edamame',           label:'Edamame',             family:'Vegetable',            src:'/stickers/vegetable-tall_edamame_S_CA-US-FR-GB-AU.png',             size:'S'  },
  { key:'vegetable-root_kohlrabi',          label:'Kohlrabi',            family:'Root Vegetable',       src:'/stickers/vegetable-root_kohlrabi_S_CA-US-FR-GB-AU.png',            size:'S'  },
  { key:'vegetable-tall_okra',              label:'Okra',                family:'Vegetable',            src:'/stickers/vegetable-tall_okra_M_US-FR-AU.png',                      size:'M'  },
  { key:'vegetable-root_parsnip',           label:'Parsnip',             family:'Root Vegetable',       src:'/stickers/vegetable-root_parsnip_S_CA-US-FR-GB.png',                size:'S'  },
  { key:'vegetable-root_rutabaga',          label:'Rutabaga',            family:'Root Vegetable',       src:'/stickers/vegetable-root_rutabaga_S_CA-US-FR-GB.png',               size:'S'  },

  // Rob's picks
  { key:'herb-small_catnip',               label:'Catnip',              family:'Herb',                 src:'/stickers/herb-small_catnip_S_CA-US-FR-GB-AU.png',                 size:'S'  },
  { key:'shrub-flowering_raspberry',        label:'Raspberry',           family:'Shrub / Fruit',        src:'/stickers/shrub-flowering_raspberry_M_CA-US-FR-GB-AU.png',          size:'M'  },
  { key:'flower-daisy_poppy',               label:'Poppy',               family:'Annual Flower',        src:'/stickers/flower-daisy_poppy_M_CA-US-FR-GB-AU.png',                size:'M'  },
  // Missing bulbs
  { key:'bulb-spring_crocus',               label:'Crocus',              family:'Bulb',                 src:'/stickers/bulb-spring_crocus_XS_CA-US-FR-GB-AU.png',               size:'XS' },
  { key:'flower-spike_lily',                label:'Oriental Lily',       family:'Bulb',                 src:'/stickers/flower-spike_lily_M_CA-US-FR-GB-AU.png', size:'M' },
  { key:'bulb-spring_muscari',              label:'Grape Hyacinth',      family:'Bulb',                 src:'/stickers/bulb-spring_muscari_XS_CA-US-FR-GB-AU.png',               size:'XS' },
  // New flowers
  { key:'flower-spike_bleeding-heart',      label:'Bleeding Heart',      family:'Perennial',            src:'/stickers/flower-spike_bleeding-heart_M_CA-US-FR-GB.png',           size:'M'  },
  { key:'flower-daisy_columbine',           label:'Columbine',           family:'Perennial',            src:'/stickers/flower-daisy_columbine_M_CA-US-FR-GB-AU.png',             size:'M'  },
  { key:'flower-daisy_primrose',            label:'Primrose',            family:'Perennial',            src:'/stickers/flower-daisy_primrose_S_CA-US-FR-GB-AU.png',              size:'S'  },
  { key:'flower-rose_ranunculus',           label:'Ranunculus',          family:'Bulb / Annual',        src:'/stickers/flower-rose_ranunculus_S_CA-US-FR-GB-AU.png',             size:'S'  },
  { key:'flower-daisy_anemone',             label:'Anemone',             family:'Bulb / Perennial',     src:'/stickers/flower-daisy_anemone_S_CA-US-FR-GB-AU.png',               size:'S'  },
  { key:'flower-daisy_dianthus',            label:'Dianthus',            family:'Perennial',            src:'/stickers/flower-daisy_dianthus_S_CA-US-FR-GB-AU.png',              size:'S'  },
  { key:'flower-spike_fuchsia',             label:'Fuchsia',             family:'Shrub / Annual',       src:'/stickers/flower-spike_fuchsia_M_CA-US-FR-GB-AU.png',               size:'M'  },
  { key:'flower-spike_astilbe',             label:'Astilbe',             family:'Perennial',            src:'/stickers/flower-spike_astilbe_M_CA-US-FR-GB-AU.png',               size:'M'  },
  { key:'ground-cover_heuchera',            label:'Heuchera',            family:'Ground Cover',         src:'/stickers/ground-cover_heuchera_S_CA-US-FR-GB-AU.png',              size:'S'  },
  { key:'flower-cluster_verbena',           label:'Verbena',             family:'Annual Flower',        src:'/stickers/flower-cluster_verbena_S_CA-US-FR-GB-AU.png',             size:'S'  },
  { key:'flower-cluster_agapanthus',        label:'Agapanthus',          family:'Bulb / Perennial',     src:'/stickers/flower-cluster_agapanthus_M_CA-US-FR-GB-AU.png', size:'M' },
  { key:'flower-spike_liatris',             label:'Liatris',             family:'Perennial',            src:'/stickers/flower-spike_liatris_M_CA-US-FR-GB-AU.png',               size:'M'  },
  { key:'flower-spike_hollyhock',           label:'Hollyhock',           family:'Biennial',             src:'/stickers/flower-spike_hollyhock_XL_CA-US-FR-GB-AU.png',            size:'XL' },
  // New vegetables
  { key:'vegetable-leafy_cauliflower',      label:'Cauliflower',         family:'Vegetable',            src:'/stickers/vegetable-leafy_cauliflower_M_CA-US-FR-GB-AU.png',        size:'M'  },
  { key:'vegetable-tall_asparagus',         label:'Asparagus',           family:'Vegetable',            src:'/stickers/vegetable-tall_asparagus_M_CA-US-FR-GB-AU.png',           size:'M'  },
  { key:'vine-leaf_peas',                   label:'Peas',                family:'Vegetable / Climber',  src:'/stickers/vine-leaf_peas_M_CA-US-FR-GB-AU.png',                     size:'M'  },
  { key:'vegetable-leafy_pumpkin',          label:'Pumpkin',             family:'Vegetable',            src:'/stickers/vegetable-leafy_pumpkin_M_CA-US-FR-GB-AU.png', size:'M' },
  { key:'vegetable-leafy_squash',           label:'Squash',              family:'Vegetable',            src:'/stickers/vegetable-leafy_squash_M_CA-US-FR-GB-AU.png',             size:'M'  },
  { key:'vegetable-leafy_swiss-chard',      label:'Swiss Chard',         family:'Vegetable',            src:'/stickers/vegetable-leafy_swiss-chard_M_CA-US-FR-GB-AU.png',        size:'M'  },
  { key:'vegetable-leafy_sweet-potato',     label:'Sweet Potato',        family:'Vegetable',            src:'/stickers/vegetable-leafy_sweet-potato_M_CA-US-FR-GB-AU.png',       size:'M'  },
  { key:'vegetable-root_onion',             label:'Onion',               family:'Root Vegetable',       src:'/stickers/vegetable-root_onion_S_CA-US-FR-GB-AU.png',               size:'S'  },

  // ── Aquatic ──────────────────────────────────────────────────────────────────
  { key:'aquatic_water-lily',              label:'Water Lily',          family:'Aquatic',              src:'/stickers/aquatic_water-lily_M_CA-US-FR-GB-AU.png',               size:'M' },

  // ── Bulbs ─────────────────────────────────────────────────────────────────────
  { key:'bulb-spring_daffodil',            label:'Daffodil',            family:'Bulb',                 src:'/stickers/bulb-spring_daffodil_S_CA-US-FR-GB-AU.png',             size:'S' },
  { key:'bulb-spring_hyacinth',            label:'Hyacinth',            family:'Bulb',                 src:'/stickers/bulb-spring_hyacinth_S_CA-US-FR-GB-AU.png',             size:'S' },
  { key:'bulb-spring_tulip',               label:'Tulip',               family:'Bulb',                 src:'/stickers/bulb-spring_tulip_S_CA-US-FR-GB-AU.png',                size:'S' },

  // ── Flower Clusters ───────────────────────────────────────────────────────────
  { key:'flower-cluster_allium',           label:'Allium',              family:'Ornamental Bulb',      src:'/stickers/flower-cluster_allium_M_CA-US-FR-GB-AU.png',            size:'M' },
  { key:'flower-cluster_hydrangea',        label:'Hydrangea',           family:'Shrub',                src:'/stickers/flower-cluster_hydrangea_M_CA-US-FR-GB-AU.png', size:'M' },

  // ── Daisy-type Flowers ────────────────────────────────────────────────────────
  { key:'flower-daisy_black-eyed-susan',   label:'Black-eyed Susan',    family:'Perennial',            src:'/stickers/flower-daisy_black-eyed-susan_M_CA-US.png',             size:'M' },
  { key:'flower-daisy_cosmos',             label:'Cosmos',              family:'Annual Flower',        src:'/stickers/flower-daisy_cosmos_M_CA-US-FR-GB-AU.png',              size:'M' },
  { key:'flower-daisy_dahlia',             label:'Dahlia',              family:'Bulb / Annual',        src:'/stickers/flower-daisy_dahlia_M_CA-US-FR-GB-AU.png',              size:'M' },
  { key:'flower-daisy_echinacea',          label:'Echinacea',           family:'Perennial',            src:'/stickers/flower-daisy_echinacea_M_CA-US-FR-GB.png',              size:'M' },
  { key:'flower-daisy_geranium',           label:'Geranium',            family:'Annual Flower',        src:'/stickers/flower-daisy_geranium_S_CA-US-FR-GB-AU.png',            size:'S' },
  { key:'flower-daisy_lobelia',            label:'Lobelia',             family:'Annual Flower',        src:'/stickers/flower-daisy_lobelia_XS_CA-US-FR-GB-AU.png',            size:'XS' },
  { key:'flower-daisy_marigold',           label:'Marigold',            family:'Annual Flower',        src:'/stickers/flower-daisy_marigold_S_CA-US-FR-GB-AU.png',            size:'S' },
  { key:'flower-daisy_nasturtium',         label:'Nasturtium',          family:'Annual Flower',        src:'/stickers/flower-daisy_nasturtium_S_CA-US-FR-GB-AU.png',          size:'S' },
  { key:'flower-daisy_pansy',              label:'Pansy',               family:'Annual Flower',        src:'/stickers/flower-daisy_pansy_S_CA-US-FR-GB-AU.png',               size:'S' },
  { key:'flower-daisy_petunia',            label:'Petunia',             family:'Annual Flower',        src:'/stickers/flower-daisy_petunia_S_CA-US-FR-GB-AU.png',             size:'S' },
  { key:'flower-daisy_portulaca',          label:'Portulaca',           family:'Annual Flower',        src:'/stickers/flower-daisy_portulaca_XS_CA-US-FR-GB-AU.png',          size:'XS' },
  { key:'flower-daisy_zinnia',             label:'Zinnia',              family:'Annual Flower',        src:'/stickers/flower-daisy_zinnia_S_CA-US-FR-AU.png',                 size:'S' },

  // ── Rose-type Flowers ─────────────────────────────────────────────────────────
  { key:'flower-rose_climbing-rose',       label:'Climbing Rose',       family:'Shrub / Rose',         src:'/stickers/flower-rose_climbing-rose_M_CA-US-FR-GB-AU.png',        size:'M'  },
  { key:'flower-rose_peony',               label:'Peony',               family:'Perennial',            src:'/stickers/flower-rose_peony_M_CA-US-FR-GB.png',                   size:'M' },
  { key:'flower-rose_rose',                label:'Rose',                family:'Shrub / Rose',         src:'/stickers/flower-rose_rose_M_CA-US-FR-GB-AU.png',                 size:'M' },

  // ── Spike Flowers ─────────────────────────────────────────────────────────────
  { key:'flower-spike_delphinium',         label:'Delphinium',          family:'Perennial',            src:'/stickers/flower-spike_delphinium_M_CA-US-FR-GB.png', size:'M' },
  { key:'flower-spike_foxglove',           label:'Foxglove',            family:'Biennial',             src:'/stickers/flower-spike_foxglove_M_CA-US-FR-GB.png', size:'M' },
  { key:'flower-spike_gladiolus',          label:'Gladiolus',           family:'Bulb',                 src:'/stickers/flower-spike_gladiolus_M_CA-US-FR-GB-AU.png',           size:'M' },
  { key:'flower-spike_iris',               label:'Iris',                family:'Perennial',            src:'/stickers/flower-spike_iris_M_CA-US-FR-GB-AU.png',                size:'M' },
  { key:'flower-spike_lupin',              label:'Lupin',               family:'Perennial',            src:'/stickers/flower-spike_lupin_M_CA-US-FR-GB-AU.png', size:'M' },
  { key:'flower-spike_salvia',             label:'Salvia',              family:'Perennial / Annual',   src:'/stickers/flower-spike_salvia_M_CA-US-FR-GB-AU.png',              size:'M' },
  { key:'flower-spike_snapdragon',         label:'Snapdragon',          family:'Annual Flower',        src:'/stickers/flower-spike_snapdragon_M_CA-US-FR-GB.png',             size:'M' },

  // ── Grasses ───────────────────────────────────────────────────────────────────
  { key:'grass-clump_blue-oat-grass',      label:'Blue Oat Grass',      family:'Ornamental Grass',     src:'/stickers/grass-clump_blue-oat-grass_M_CA-US-FR-GB-AU.png',       size:'M' },
  { key:'grass-clump_cattail',             label:'Cattail',             family:'Aquatic / Grass',      src:'/stickers/grass-clump_cattail_M_CA-US-FR-GB-AU.png', size:'M' },
  { key:'grass-clump_feather-grass',       label:'Feather Grass',       family:'Ornamental Grass',     src:'/stickers/grass-clump_feather-grass_M_CA-US-FR-GB-AU.png', size:'M' },
  { key:'grass-clump_ornamental-grass',    label:'Ornamental Grass',    family:'Ornamental Grass',     src:'/stickers/grass-clump_ornamental-grass_M_CA-US-FR-GB-AU.png', size:'M' },
  { key:'grass-clump_pampas-grass',        label:'Pampas Grass',        family:'Ornamental Grass',     src:'/stickers/grass-clump_pampas-grass_XL_US-FR-GB-AU.png',           size:'XL' },

  // ── Ground Cover ──────────────────────────────────────────────────────────────
  { key:'ground-cover_ajuga',              label:'Ajuga',               family:'Ground Cover',         src:'/stickers/ground-cover_ajuga_XS_CA-US-FR-GB-AU.png',              size:'XS' },
  { key:'ground-cover_creeping-jenny',     label:'Creeping Jenny',      family:'Ground Cover',         src:'/stickers/ground-cover_creeping-jenny_XS_CA-US-FR-GB-AU.png',     size:'XS' },
  { key:'ground-cover_hostas',             label:'Hostas',              family:'Ground Cover',         src:'/stickers/ground-cover_hostas_M_CA-US-FR-GB-AU.png',              size:'M' },
  { key:'ground-cover_ivy',                label:'English Ivy',         family:'Ground Cover',         src:'/stickers/ground-cover_ivy_S_CA-US-FR-GB-AU.png',                 size:'S' },
  { key:'ground-cover_pachysandra',        label:'Pachysandra',         family:'Ground Cover',         src:'/stickers/ground-cover_pachysandra_XS_CA-US-FR-GB-AU.png',        size:'XS' },
  { key:'ground-cover_sedum',              label:'Sedum',               family:'Ground Cover',         src:'/stickers/ground-cover_sedum_XS_CA-US-FR-GB-AU.png',              size:'XS' },
  { key:'ground-cover_vinca',              label:'Vinca',               family:'Ground Cover',         src:'/stickers/ground-cover_vinca_XS_CA-US-FR-GB-AU.png',              size:'XS' },

  // ── Herbs ─────────────────────────────────────────────────────────────────────
  { key:'herb-small_basil',                label:'Basil',               family:'Herb',                 src:'/stickers/herb-small_basil_S_CA-US-FR-GB-AU.png',                 size:'S' },
  { key:'herb-small_chives',               label:'Chives',              family:'Herb',                 src:'/stickers/herb-small_chives_S_CA-US-FR-GB-AU.png',                size:'S' },
  { key:'herb-small_mint',                 label:'Mint',                family:'Herb',                 src:'/stickers/herb-small_mint_S_CA-US-FR-GB-AU.png',                  size:'S' },
  { key:'herb-small_parsley',              label:'Parsley',             family:'Herb',                 src:'/stickers/herb-small_parsley_S_CA-US-FR-GB-AU.png',               size:'S' },
  { key:'herb-small_rosemary',             label:'Rosemary',            family:'Herb',                 src:'/stickers/herb-small_rosemary_M_US-FR-GB-AU.png',                 size:'M' },
  { key:'herb-small_sage',                 label:'Sage',                family:'Herb',                 src:'/stickers/herb-small_sage_S_CA-US-FR-GB-AU.png',                  size:'S' },

  // ── Shrubs ────────────────────────────────────────────────────────────────────
  { key:'shrub-flowering_azalea',          label:'Azalea',              family:'Shrub',                src:'/stickers/shrub-flowering_azalea_M_CA-US-FR-GB-AU.png', size:'M' },
  { key:'shrub-flowering_blueberry',       label:'Blueberry Bush',      family:'Shrub / Fruit',        src:'/stickers/shrub-flowering_blueberry_M_CA-US-FR-GB-AU.png',        size:'M' },
  { key:'shrub-flowering_buddleia',        label:'Buddleia',            family:'Shrub',                src:'/stickers/shrub-flowering_buddleia_M_CA-US-FR-GB-AU.png', size:'M' },
  { key:'shrub-flowering_forsythia',       label:'Forsythia',           family:'Shrub',                src:'/stickers/shrub-flowering_forsythia_M_CA-US-FR-GB.png', size:'M' },
  { key:'shrub-flowering_lilac',           label:'Lilac',               family:'Shrub',                src:'/stickers/shrub-flowering_lilac_M_CA-US-FR-GB.png', size:'M' },
  { key:'shrub-flowering_rhododendron',    label:'Rhododendron',        family:'Shrub',                src:'/stickers/shrub-flowering_rhododendron_M_CA-US-FR-GB-AU.png', size:'M' },
  { key:'shrub-flowering_saskatoon',       label:'Saskatoon Berry',     family:'Shrub / Fruit',        src:'/stickers/shrub-flowering_saskatoon_M_CA-US.png',                 size:'M' },
  { key:'shrub-flowering_spiraea',         label:'Spiraea',             family:'Shrub',                src:'/stickers/shrub-flowering_spiraea_M_CA-US-FR-GB.png', size:'M' },
  { key:'shrub-flowering_weigela',         label:'Weigela',             family:'Shrub',                src:'/stickers/shrub-flowering_weigela_M_CA-US-FR-GB.png', size:'M' },
  { key:'shrub-lavender_lavender',         label:'Lavender',            family:'Herb / Perennial',     src:'/stickers/shrub-lavender_lavender_M_CA-US-FR-GB-AU.png',          size:'M' },
  { key:'shrub-round_boxwood',             label:'Boxwood',             family:'Shrub',                src:'/stickers/shrub-round_boxwood_M_CA-US-FR-GB-AU.png', size:'M' },

  // ── Conifer Trees ─────────────────────────────────────────────────────────────
  { key:'tree-conifer_blue-spruce',        label:'Blue Spruce',         family:'Conifer Tree',         src:'/stickers/tree-conifer_blue-spruce_XXL_CA-US-FR-GB.png',           size:'XXL' },
  { key:'tree-conifer_leylandii',          label:'Leylandii Cypress',   family:'Conifer Tree',         src:'/stickers/tree-conifer_leylandii_XXL_CA-US-FR-GB.png',             size:'XXL' },
  { key:'tree-conifer_cedar-thuja_XL_CA-US-FR-GB-AU', label:'Cedar (Thuja)', family:'Conifer Tree', src:'/stickers/tree-conifer_cedar-thuja_XL_CA-US-FR-GB-AU.png', size:'XL' },
  { key:'tree-conifer_pine',               label:'Pine Tree',           family:'Conifer Tree',         src:'/stickers/tree-conifer_pine_XXL_CA-US-FR-GB-AU.png',               size:'XXL' },

  // ── Deciduous Trees ───────────────────────────────────────────────────────────
  { key:'tree-deciduous_maple',             label:'Maple Tree',          family:'Deciduous Tree',       src:'/stickers/tree-deciduous_maple_XXL_CA-US-FR-GB-AU.png',              size:'XXL' },
  { key:'tree-deciduous_magnolia',         label:'Magnolia',            family:'Deciduous Tree',       src:'/stickers/tree-deciduous_magnolia_XXL_CA-US-FR-GB-AU.png',         size:'XXL' },
  { key:'tree-deciduous_oak',              label:'Oak Tree',            family:'Deciduous Tree',       src:'/stickers/tree-deciduous_oak_XXL_CA-US-FR-GB-AU.png',              size:'XXL' },
  { key:'tree-deciduous_ornamental-cherry',label:'Ornamental Cherry',   family:'Deciduous Tree',       src:'/stickers/tree-deciduous_ornamental-cherry_XXL_CA-US-FR-GB-AU.png',size:'XXL' },
  { key:'tree-deciduous_silver-birch',     label:'Silver Birch',        family:'Deciduous Tree',       src:'/stickers/tree-deciduous_silver-birch_XXL_CA-US-FR-GB.png',        size:'XXL' },
  { key:'tree-deciduous_weeping-willow',   label:'Weeping Willow',      family:'Deciduous Tree',       src:'/stickers/tree-deciduous_weeping-willow_XXL_CA-US-FR-GB-AU.png',   size:'XXL' },

  // ── Fruit Trees ───────────────────────────────────────────────────────────────
  { key:'tree-fruit_apple',                label:'Apple Tree',          family:'Fruit Tree',           src:'/stickers/tree-fruit_apple_XXL_CA-US-FR-GB-AU.png',                size:'XXL' },
  { key:'tree-fruit_cherry',               label:'Cherry Tree',         family:'Fruit Tree',           src:'/stickers/tree-fruit_cherry_XXL_CA-US-FR-GB-AU.png',               size:'XXL' },
  { key:'tree-fruit_lemon',                label:'Lemon Tree',          family:'Fruit Tree',           src:'/stickers/tree-fruit_lemon_XXL_US-FR-AU.png',                      size:'XXL' },
  { key:'tree-fruit_peach',                label:'Peach Tree',          family:'Fruit Tree',           src:'/stickers/tree-fruit_peach_XXL_CA-US-FR-AU.png',                   size:'XXL' },
  { key:'tree-fruit_pear',                 label:'Pear Tree',           family:'Fruit Tree',           src:'/stickers/tree-fruit_pear_XXL_CA-US-FR-GB-AU.png',                 size:'XXL' },
  { key:'tree-fruit_plum',                 label:'Plum Tree',           family:'Fruit Tree',           src:'/stickers/tree-fruit_plum_XXL_CA-US-FR-GB-AU.png',                 size:'XXL' },

  // ── Leafy Vegetables ──────────────────────────────────────────────────────────
  { key:'vegetable-leafy_cabbage',         label:'Cabbage',             family:'Vegetable',            src:'/stickers/vegetable-leafy_cabbage_M_CA-US-FR-GB-AU.png',          size:'M' },
  { key:'vegetable-leafy_kale',            label:'Kale',                family:'Vegetable',            src:'/stickers/vegetable-leafy_kale_M_CA-US-FR-GB-AU.png',             size:'M' },
  { key:'vegetable-leafy_lettuce',         label:'Lettuce',             family:'Vegetable',            src:'/stickers/vegetable-leafy_lettuce_M_CA-US-FR-GB-AU.png',          size:'M' },
  { key:'vegetable-leafy_potato',          label:'Potato',              family:'Vegetable',            src:'/stickers/vegetable-leafy_potato_M_CA-US-FR-GB-AU.png',           size:'M' },
  { key:'vegetable-leafy_rhubarb',         label:'Rhubarb',             family:'Vegetable / Perennial',src:'/stickers/vegetable-leafy_rhubarb_M_CA-US-FR-GB-AU.png', size:'M' },
  { key:'vegetable-leafy_spinach',         label:'Spinach',             family:'Vegetable',            src:'/stickers/vegetable-leafy_spinach_S_CA-US-FR-GB-AU.png',          size:'S' },
  { key:'vegetable-leafy_zucchini',        label:'Zucchini',            family:'Vegetable',            src:'/stickers/vegetable-leafy_zucchini_M_CA-US-FR-GB-AU.png',         size:'M' },

  // ── Root Vegetables ───────────────────────────────────────────────────────────
  { key:'vegetable-root_beet',             label:'Beet',                family:'Root Vegetable',       src:'/stickers/vegetable-root_beet_S_CA-US-FR-GB-AU.png',              size:'S' },
  { key:'vegetable-root_carrot',           label:'Carrot',              family:'Root Vegetable',       src:'/stickers/vegetable-root_carrot_S_CA-US-FR-GB-AU.png',            size:'S' },
  { key:'vegetable-root_garlic',           label:'Garlic',              family:'Root Vegetable',       src:'/stickers/vegetable-root_garlic_S_CA-US-FR-GB-AU.png',            size:'S' },
  { key:'vegetable-root_radish',           label:'Radish',              family:'Root Vegetable',       src:'/stickers/vegetable-root_radish_S_CA-US-FR-GB-AU.png',            size:'S' },
  { key:'vegetable-root_turnip',           label:'Turnip',              family:'Root Vegetable',       src:'/stickers/vegetable-root_turnip_S_CA-US-FR-GB-AU.png',            size:'S' },

  // ── Tall Vegetables ───────────────────────────────────────────────────────────
  { key:'vegetable-tall_broccoli',         label:'Broccoli',            family:'Vegetable',            src:'/stickers/vegetable-tall_broccoli_M_CA-US-FR-GB-AU.png',          size:'M' },
  { key:'vegetable-tall_cherry-tomato',    label:'Cherry Tomato',       family:'Vegetable',            src:'/stickers/vegetable-tall_cherry-tomato_M_CA-US-FR-GB-AU.png',     size:'M' },
  { key:'vegetable-tall_chilli',           label:'Chilli Pepper',       family:'Vegetable',            src:'/stickers/vegetable-tall_chilli_M_CA-US-FR-GB-AU.png',            size:'M' },
  { key:'vegetable-tall_corn',             label:'Corn',                family:'Vegetable',            src:'/stickers/vegetable-tall_corn_XL_CA-US-FR-GB-AU.png',             size:'XL' },
  { key:'vegetable-tall_eggplant',         label:'Eggplant',            family:'Vegetable',            src:'/stickers/vegetable-tall_eggplant_M_CA-US-FR-GB-AU.png',          size:'M' },
  { key:'vegetable-tall_french-bean',      label:'French Bean',         family:'Vegetable',            src:'/stickers/vegetable-tall_french-bean_S_CA-US-FR-GB-AU.png',       size:'S' },
  { key:'vegetable-tall_leek',             label:'Leek',                family:'Vegetable',            src:'/stickers/vegetable-tall_leek_M_CA-US-FR-GB-AU.png',              size:'M' },
  { key:'vegetable-tall_sunflower',        label:'Sunflower',           family:'Annual Flower',        src:'/stickers/vegetable-tall_sunflower_M_CA-US-FR-GB-AU.png',         size:'M'  },
  { key:'vegetable-tall_sweet-pepper',     label:'Sweet Pepper',        family:'Vegetable',            src:'/stickers/vegetable-tall_sweet-pepper_M_CA-US-FR-GB-AU.png',      size:'M' },
  { key:'vegetable-tall_tomato',           label:'Tomato',              family:'Vegetable',            src:'/stickers/vegetable-tall_tomato_M_CA-US-FR-GB-AU.png',            size:'M' },

  // ── Vines & Climbers ──────────────────────────────────────────────────────────
  { key:'vine-leaf_clematis',              label:'Clematis',            family:'Climber',              src:'/stickers/vine-leaf_clematis_M_CA-US-FR-GB-AU.png', size:'M' },
  { key:'vine-leaf_cucumber',              label:'Cucumber',            family:'Vegetable / Climber',  src:'/stickers/vine-leaf_cucumber_M_CA-US-FR-GB-AU.png',               size:'M' },
  { key:'vine-leaf_honeysuckle',           label:'Honeysuckle',         family:'Climber',              src:'/stickers/vine-leaf_honeysuckle_M_CA-US-FR-GB-AU.png', size:'M' },
  { key:'vine-leaf_jasmine',               label:'Jasmine',             family:'Climber',              src:'/stickers/vine-leaf_jasmine_M_CA-US-FR-GB-AU.png',                size:'M' },
  { key:'vine-leaf_passion-flower',        label:'Passion Flower',      family:'Climber',              src:'/stickers/vine-leaf_passion-flower_M_CA-US-FR-GB-AU.png', size:'M' },
  { key:'vine-leaf_runner-bean',           label:'Runner Bean',         family:'Vegetable / Climber',  src:'/stickers/vine-leaf_runner-bean_M_CA-US-FR-GB-AU.png',            size:'M' },
  { key:'vine-leaf_sweet-pea',             label:'Sweet Pea',           family:'Annual Flower',        src:'/stickers/vine-leaf_sweet-pea_S_CA-US-FR-GB-AU.png',              size:'S' },
  { key:'vine-leaf_virginia-creeper',      label:'Virginia Creeper',    family:'Climber',              src:'/stickers/vine-leaf_virginia-creeper_M_CA-US-FR-GB-AU.png', size:'M' },
  { key:'vine-leaf_wisteria',              label:'Wisteria',            family:'Climber',              src:'/stickers/vine-leaf_wisteria_XL_US-FR-GB-AU.png',                 size:'XL' },

  // ── New additions
  { key:'herb-small_thyme_S_CA-US-FR-GB-AU', label:'Thyme', family:'Herb', src:'/stickers/herb-small_thyme_S_CA-US-FR-GB-AU.png', size:'S' },

  // ── New additions
  { key:'flower-cluster_phlox_M_CA-US-FR-GB-AU', label:'Phlox', family:'Perennial Flower', src:'/stickers/flower-cluster_phlox_M_CA-US-FR-GB-AU.png', size:'M' },

  // ── New additions
  { key:'water-feature_fountain-sm_S_CA-US-FR-GB-AU', label:'Small Fountain',  family:'Water Feature', src:'/stickers/water-feature_fountain-sm_S_CA-US-FR-GB-AU.png', size:'S' },
  { key:'water-feature_fountain-md_M_CA-US-FR-GB-AU', label:'Medium Fountain', family:'Water Feature', src:'/stickers/water-feature_fountain-md_M_CA-US-FR-GB-AU.png', size:'M' },
  { key:'water-feature_fountain-lg_L_CA-US-FR-GB-AU', label:'Large Fountain',  family:'Water Feature', src:'/stickers/water-feature_fountain-lg_L_CA-US-FR-GB-AU.png', size:'L' },

  { key:'flower-daisy_feverfew_S_CA-US-FR-GB-AU', label:'Feverfew', family:'Perennial', src:'/stickers/flower-daisy_feverfew_S_CA-US-FR-GB-AU.png', size:'S' },
  // ── New additions

  // ── New additions

  // ── New additions

  // ── New additions

  // ── New additions

  // ── New additions

  // ── New additions

  // ── New additions

  // ── New additions

  // ── New additions

  // ── New additions

  // ── New additions

  // ── New additions

  // ── New additions

  // ── New additions

  // ── New additions

  // ── New additions

  // ── New additions

  // ── New additions

  // ── New additions

  // ── New additions

  // ── New additions

  // ── New additions

  // ── New additions

  // ── New additions

  // ── New additions

  // ── New additions

  // ── New additions
  { key:'tree-fruit_medlar_XL_CA-US-FR-GB-AU', label:'Medlar', family:'Fruit Tree', src:'/stickers/tree-fruit_medlar_XL_CA-US-FR-GB-AU.png', size:'XL' },

  // ── Reference entry (kept for catalog structure reference only) ───────────────
  // { key:'tree-svg-ref', label:'Apple Tree (SVG ref)', family:'Fruit Tree', src:'/stickers/tree.svg', size:'L' },
  { key:'plant-fern_fern_L_CA-US-FR-GB-AU', label:'Fern', family:'Fern / Groundcover', src:'/stickers/plant-fern_fern_L_CA-US-FR-GB-AU.png', size:'L' },
  { key:'decor_rock-small_M_CA-US-FR-GB-AU', label:'Small Garden Stone', family:'Decor', src:'/stickers/decor_rock-small_M_CA-US-FR-GB-AU.png', size:'M' },

  { key:'decor_rock-medium_L_CA-US-FR-GB-AU', label:'Medium Garden Stone', family:'Decor', src:'/stickers/decor_rock-medium_L_CA-US-FR-GB-AU.png', size:'L' },

  { key:'decor_rock-large_XL_CA-US-FR-GB-AU', label:'Large Garden Stone', family:'Decor', src:'/stickers/decor_rock-large_XL_CA-US-FR-GB-AU.png', size:'XL' },

  { key:'decor_gazebo-square_XL_CA-US-FR-GB-AU', label:'Square Gazebo',  family:'Decor', src:'/stickers/decor_gazebo-square_XL_CA-US-FR-GB-AU.png', size:'XL' },
  { key:'decor_gazebo-oct_XL_CA-US-FR-GB-AU',   label:'Octagon Gazebo', family:'Decor', src:'/stickers/decor_gazebo-oct_XL_CA-US-FR-GB-AU.png',   size:'XL' },
  { key:'decor_gazebo-large_XL_CA-US-FR-GB-AU',  label:'Large Gazebo',   family:'Decor', src:'/stickers/decor_gazebo-large_XL_CA-US-FR-GB-AU.png',  size:'XL' },

  { key:'decor_lounge-modern_XL_CA-US-FR-GB-AU', label:'Plastic Loungers', family:'Decor', src:'/stickers/decor_lounge-modern_XL_CA-US-FR-GB-AU.png', size:'XL' },

  { key:'decor_lounge-wood_XL_CA-US-FR-GB-AU', label:'Wood Loungers', family:'Decor', src:'/stickers/decor_lounge-wood_XL_CA-US-FR-GB-AU.png', size:'XL' },

  { key:'decor_table-pine_XXL_CA-US-FR-GB-AU',    label:'Pine Table',     family:'Decor', src:'/stickers/decor_table-pine_XXL_CA-US-FR-GB-AU.png',    size:'XXL' },
  { key:'decor_table-stained_XXL_CA-US-FR-GB-AU',  label:'Stained Table',  family:'Decor', src:'/stickers/decor_table-stained_XXL_CA-US-FR-GB-AU.png',  size:'XXL' },
  { key:'decor_table-enameled_XXL_CA-US-FR-GB-AU', label:'Enameled Table', family:'Decor', src:'/stickers/decor_table-enameled_XXL_CA-US-FR-GB-AU.png', size:'XXL' },
  { key:'decor_table-bronzed_XXL_CA-US-FR-GB-AU',  label:'Bronzed Table',  family:'Decor', src:'/stickers/decor_table-bronzed_XXL_CA-US-FR-GB-AU.png',  size:'XXL' },

  { key:'decor_umbrella_L_CA-US-FR-GB-AU', label:'Beach Umbrella', family:'Decor', src:'/stickers/decor_umbrella_L_CA-US-FR-GB-AU.png', size:'L' },

  { key:'decor_pot-red-round_S_CA-US-FR-GB-AU',        label:'Red Round Pot',        family:'Decor', src:'/stickers/decor_pot-red-round_S_CA-US-FR-GB-AU.png',        size:'S' },
  { key:'decor_pot-terracotta-round_M_CA-US-FR-GB-AU',  label:'Terracotta Round Pot',  family:'Decor', src:'/stickers/decor_pot-terracotta-round_M_CA-US-FR-GB-AU.png',  size:'M' },
  { key:'decor_pot-blue_S_CA-US-FR-GB-AU',              label:'Blue Pot',              family:'Decor', src:'/stickers/decor_pot-blue_S_CA-US-FR-GB-AU.png',              size:'S' },
  { key:'decor_pot-terracotta_S_CA-US-FR-GB-AU',        label:'Terracotta Pot',        family:'Decor', src:'/stickers/decor_pot-terracotta_S_CA-US-FR-GB-AU.png',        size:'S' },
  { key:'decor_pot-green-round_M_CA-US-FR-GB-AU',       label:'Green Round Pot',       family:'Decor', src:'/stickers/decor_pot-green-round_M_CA-US-FR-GB-AU.png',       size:'M' },

  { key:'decor_stairs-wood_M_CA-US-FR-GB-AU', label:'Wood Stairs', family:'Decor', src:'/stickers/decor_stairs-wood_M_CA-US-FR-GB-AU.png', size:'M' },

  { key:'decor_stairs-stone_M_CA-US-FR-GB-AU', label:'Stone Stairs', family:'Decor', src:'/stickers/decor_stairs-stone_M_CA-US-FR-GB-AU.png', size:'M' },

  { key:'decor_stairs-brick_M_CA-US-FR-GB-AU', label:'Brick Stairs', family:'Decor', src:'/stickers/decor_stairs-brick_M_CA-US-FR-GB-AU.png', size:'M' },

  { key:'decor_stairs-cement_M_CA-US-FR-GB-AU', label:'Cement Stairs', family:'Decor', src:'/stickers/decor_stairs-cement_M_CA-US-FR-GB-AU.png', size:'M' },

  { key:'decor_arch-wood_XL_CA-US-FR-GB-AU', label:'Wood Garden Arch', family:'Decor', src:'/stickers/decor_arch-wood_XL_CA-US-FR-GB-AU.png', size:'XL' },

  { key:'decor_arch-metal_XL_CA-US-FR-GB-AU', label:'Metal Garden Arch', family:'Decor', src:'/stickers/decor_arch-metal_XL_CA-US-FR-GB-AU.png', size:'XL' },

]

// Families that are placed via the Decor/Water menus — exclude from plant tray
export const DECOR_FAMILIES = new Set(['Decor', 'Water Feature', 'Fern / Groundcover'])
export const PLANT_CATALOG_TRAY = PLANT_CATALOG.filter(e => !DECOR_FAMILIES.has(e.family))

// Group catalog by family for tray sections (excludes decor/non-plant entries)
export function groupCatalog(catalog) {
  const groups = {}
  catalog.forEach(entry => {
    const f = entry.family || 'Other'
    if (!groups[f]) groups[f] = []
    groups[f].push(entry)
  })
  return groups
}

// ── Lazy Pack Loader ──────────────────────────────────────────────────────────
// Manages on-demand loading of sticker packs beyond the core catalog.
// Usage: const { loadPack, getPackEntries, isPackLoaded, isPackLoading } = useLazyPacks()

import { useState, useCallback, useRef } from 'react'
import { PACK_REGISTRY } from '../data/packs/index.js'

export function useLazyPacks() {
  const [loadedPacks, setLoadedPacks] = useState({})   // packId → entries[]
  const [loadingPacks, setLoadingPacks] = useState({}) // packId → true
  const inflightRef = useRef({})                       // prevent duplicate fetches

  const loadPack = useCallback(async (packId) => {
    if (loadedPacks[packId] || inflightRef.current[packId]) return
    const reg = PACK_REGISTRY.find(p => p.id === packId)
    if (!reg || reg.eager) return

    inflightRef.current[packId] = true
    setLoadingPacks(prev => ({ ...prev, [packId]: true }))
    try {
      const mod = await reg.loader()
      setLoadedPacks(prev => ({ ...prev, [packId]: mod.entries }))
    } catch (e) {
      console.error(`[Garden Mapper] Failed to load pack: ${packId}`, e)
    } finally {
      setLoadingPacks(prev => ({ ...prev, [packId]: false }))
      delete inflightRef.current[packId]
    }
  }, [loadedPacks])

  const getPackEntries = useCallback((packId) => {
    return loadedPacks[packId] || []
  }, [loadedPacks])

  const isPackLoaded  = (packId) => !!loadedPacks[packId]
  const isPackLoading = (packId) => !!loadingPacks[packId]

  // All entries across core + any loaded lazy packs (for key lookup in save/load)
  const allEntries = useCallback(() => {
    const lazy = Object.values(loadedPacks).flat()
    return [...PLANT_CATALOG, ...lazy]
  }, [loadedPacks])

  return { loadPack, getPackEntries, isPackLoaded, isPackLoading, allEntries, PACK_REGISTRY }
}







