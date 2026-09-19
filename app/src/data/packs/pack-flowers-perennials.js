// pack-flowers-perennials.js — Perennial Flowers pack
// Loaded on demand when user opens the Perennial Flowers category.
// Keys are permanent — never rename or delete a key once a sticker is committed.
// Add new perennials here (not to PLANT_CATALOG in usePlantCatalog.js).

export const PACK_ID = 'flowers-perennials';

export const entries = [

  // ── Batch 1 (2026-09-15) ────────────────────────────────────────────────────
  { key: 'flower-daisy_rudbeckia',              label: 'Rudbeckia',              family: 'Perennial', src: '/stickers/flower-daisy_rudbeckia_M_CA-US-FR-GB-AU.png',              size: 'M' },
  { key: 'herb-small_catmint',                  label: 'Catmint',                family: 'Perennial', src: '/stickers/herb-small_catmint_S_CA-US-FR-GB-AU.png',                  size: 'S' },
  { key: 'flower-daisy_shasta-daisy',           label: 'Shasta Daisy',           family: 'Perennial', src: '/stickers/flower-daisy_shasta-daisy_M_CA-US-FR-GB-AU.png',           size: 'M' },
  { key: 'flower-spike_verbena-bonariensis',    label: 'Verbena bonariensis',    family: 'Perennial', src: '/stickers/flower-spike_verbena-bonariensis_L_CA-US-FR-GB-AU.png',    size: 'L' },
  { key: 'flower-cluster_gypsophila',           label: 'Gypsophila',             family: 'Perennial', src: '/stickers/flower-cluster_gypsophila_M_CA-US-FR-GB-AU.png',           size: 'M' },

  // ── Batch 2 (2026-09-16) ────────────────────────────────────────────────────
  { key: 'flower-cluster_yarrow',               label: 'Yarrow',                 family: 'Perennial', src: '/stickers/flower-cluster_yarrow_M_CA-US-FR-GB-AU.png',               size: 'M' },
  { key: 'flower-cluster_monarda',              label: 'Monarda',                family: 'Perennial', src: '/stickers/flower-cluster_monarda_M_CA-US-FR-GB-AU.png',              size: 'M' },
  { key: 'flower-cluster_joe-pye-weed',         label: 'Joe Pye Weed',           family: 'Perennial', src: '/stickers/flower-cluster_joe-pye-weed_L_CA-US-FR-GB-AU.png',         size: 'L' },
  { key: 'flower-daisy_hardy-geranium',         label: 'Hardy Geranium',         family: 'Perennial', src: '/stickers/flower-daisy_hardy-geranium_S_CA-US-FR-GB-AU.png',         size: 'S' },
  { key: 'flower-cluster_phacelia',             label: 'Phacelia',               family: 'Perennial', src: '/stickers/flower-cluster_phacelia_S_CA-US-FR-GB-AU.png',             size: 'S' },


  // ── Batch 3 (2026-09-16) ──────────────────────────────────────────────────────────────────────
  { key: 'flower-spike_kniphofia',             label: 'Kniphofia',              family: 'Perennial', src: '/stickers/flower-spike_kniphofia_L_CA-US-FR-GB-AU.png',             size: 'L' },
  { key: 'flower-daisy_japanese-anemone',      label: 'Japanese Anemone',       family: 'Perennial', src: '/stickers/flower-daisy_japanese-anemone_M_CA-US-FR-GB-AU.png',      size: 'M' },
  { key: 'flower-daisy_helenium',              label: 'Helenium',               family: 'Perennial', src: '/stickers/flower-daisy_helenium_M_CA-US-FR-GB-AU.png',              size: 'M' },
  { key: 'flower-spike_sanguisorba',           label: 'Sanguisorba',            family: 'Perennial', src: '/stickers/flower-spike_sanguisorba_M_CA-US-FR-GB-AU.png',           size: 'M' },
  { key: 'flower-cluster_autumn-joy-sedum',    label: 'Autumn Joy Sedum',       family: 'Perennial', src: '/stickers/flower-cluster_autumn-joy-sedum_S_CA-US-FR-GB-AU.png',    size: 'S' },

  // 🌸 Batch 4 (2026-09-18) — Wildflowers, annuals, perennials, variants ─────────────────────────────
  // Wildflowers / cottage
  { key: 'flower-arch_solomons-seal',          label: "Solomon's Seal",          family: 'Perennial',     src: '/stickers/flower-arch_solomons-seal_M_CA-US-FR-GB-AU.png',          size: 'M' },
  { key: 'flower-cluster_alyssum',             label: 'Alyssum',                 family: 'Annual Flower', src: '/stickers/flower-cluster_alyssum_XS_CA-US-FR-GB-AU.png',             size: 'XS' },
  { key: 'flower-cluster_bergenia',            label: 'Bergenia',                family: 'Perennial',     src: '/stickers/flower-cluster_bergenia_S_CA-US-FR-GB-AU.png',             size: 'S' },
  { key: 'flower-cluster_bluebell',            label: 'Bluebell',                family: 'Perennial',     src: '/stickers/flower-cluster_bluebell_M_CA-US-FR-GB-AU.png',             size: 'M' },
  { key: 'flower-cluster_brunnera',            label: 'Brunnera',                family: 'Perennial',     src: '/stickers/flower-cluster_brunnera_S_CA-US-FR-GB-AU.png',             size: 'S' },
  { key: 'flower-cluster_campanula',           label: 'Campanula',               family: 'Perennial',     src: '/stickers/flower-cluster_campanula_L_CA-US-FR-GB-AU.png',            size: 'L' },
  { key: 'flower-cluster_cowslip',             label: 'Cowslip',                 family: 'Perennial',     src: '/stickers/flower-cluster_cowslip_S_CA-US-FR-GB-AU.png',              size: 'S' },
  { key: 'flower-cluster_meadow-rue',          label: 'Meadow Rue',              family: 'Perennial',     src: '/stickers/flower-cluster_meadow-rue_L_CA-US-FR-GB-AU.png',           size: 'L' },
  { key: 'flower-cluster_meadowsweet',         label: 'Meadowsweet',             family: 'Perennial',     src: '/stickers/flower-cluster_meadowsweet_M_CA-US-FR-GB-AU.png',          size: 'M' },
  { key: 'flower-cluster_oxlip',               label: 'Oxlip',                   family: 'Perennial',     src: '/stickers/flower-cluster_oxlip_S_CA-US-FR-GB-AU.png',               size: 'S' },
  { key: 'flower-cluster_plume-poppy',         label: 'Plume Poppy',             family: 'Perennial',     src: '/stickers/flower-cluster_plume-poppy_XL_CA-US-FR-GB-AU.png',         size: 'XL' },
  { key: 'flower-cluster_pulmonaria',          label: 'Pulmonaria',              family: 'Perennial',     src: '/stickers/flower-cluster_pulmonaria_S_CA-US-FR-GB-AU.png',           size: 'S' },
  { key: 'flower-cluster_ragged-robin',        label: 'Ragged Robin',            family: 'Perennial',     src: '/stickers/flower-cluster_ragged-robin_M_CA-US-FR-GB-AU.png',         size: 'M' },
  { key: 'flower-cluster_red-valerian',        label: 'Red Valerian',            family: 'Perennial',     src: '/stickers/flower-cluster_red-valerian_L_CA-US-FR-GB-AU.png',         size: 'L' },
  { key: 'flower-cluster_sea-thrift',          label: 'Sea Thrift',              family: 'Perennial',     src: '/stickers/flower-cluster_sea-thrift_XS_CA-US-FR-GB-AU.png',          size: 'XS' },
  { key: 'flower-cluster_wild-carrot',         label: 'Wild Carrot',             family: 'Perennial',     src: '/stickers/flower-cluster_wild-carrot_M_CA-US-FR-GB-AU.png',          size: 'M' },
  { key: 'flower-cluster_wild-garlic',         label: 'Wild Garlic',             family: 'Perennial',     src: '/stickers/flower-cluster_wild-garlic_M_CA-US-FR-GB-AU.png',          size: 'M' },
  // Cup / nodding flowers
  { key: 'flower-cup_hellebore',               label: 'Hellebore',               family: 'Perennial',     src: '/stickers/flower-cup_hellebore_S_CA-US-FR-GB-AU.png',               size: 'S' },
  { key: 'flower-cup_hepatica',                label: 'Hepatica',                family: 'Perennial',     src: '/stickers/flower-cup_hepatica_XS_CA-US-FR-GB-AU.png',               size: 'XS' },
  { key: 'flower-cup_lisianthus',              label: 'Lisianthus',              family: 'Annual Flower', src: '/stickers/flower-cup_lisianthus_S_CA-US-FR-GB-AU.png',              size: 'S' },
  { key: 'flower-cup_wild-cyclamen',           label: 'Wild Cyclamen',           family: 'Perennial',     src: '/stickers/flower-cup_wild-cyclamen_S_CA-US-FR-GB-AU.png',            size: 'S' },
  // Daisy-form annuals & perennials
  { key: 'flower-daisy_aster',                 label: 'Aster',                   family: 'Perennial',     src: '/stickers/flower-daisy_aster_M_CA-US-FR-GB-AU.png',                 size: 'M' },
  { key: 'flower-daisy_astrantia',             label: 'Astrantia',               family: 'Perennial',     src: '/stickers/flower-daisy_astrantia_M_CA-US-FR-GB-AU.png',              size: 'M' },
  { key: 'flower-daisy_begonia',               label: 'Begonia',                 family: 'Annual Flower', src: '/stickers/flower-daisy_begonia_S_CA-US-FR-GB-AU.png',               size: 'S' },
  { key: 'flower-daisy_blue-flax',             label: 'Blue Flax',               family: 'Perennial',     src: '/stickers/flower-daisy_blue-flax_S_CA-US-FR-GB-AU.png',              size: 'S' },
  { key: 'flower-daisy_calibrachoa',           label: 'Calibrachoa',             family: 'Annual Flower', src: '/stickers/flower-daisy_calibrachoa_XS_CA-US-FR-GB-AU.png',           size: 'XS' },
  { key: 'flower-daisy_coreopsis',             label: 'Coreopsis',               family: 'Perennial',     src: '/stickers/flower-daisy_coreopsis_M_CA-US-FR-GB-AU.png',              size: 'M' },
  { key: 'flower-daisy_cornflower',            label: 'Cornflower',              family: 'Annual Flower', src: '/stickers/flower-daisy_cornflower_M_CA-US-FR-GB-AU.png',             size: 'M' },
  { key: 'flower-daisy_dahlia_purple',         label: 'Dahlia (Purple)',         family: 'Annual Flower', src: '/stickers/flower-daisy_dahlia_M_purple_CA-US-FR-GB-AU.png',          size: 'M' },
  { key: 'flower-daisy_dahlia_red',            label: 'Dahlia (Red)',            family: 'Annual Flower', src: '/stickers/flower-daisy_dahlia_M_red_CA-US-FR-GB-AU.png',             size: 'M' },
  { key: 'flower-daisy_dahlia_yellow',         label: 'Dahlia (Yellow)',         family: 'Annual Flower', src: '/stickers/flower-daisy_dahlia_M_yellow_CA-US-FR-GB-AU.png',          size: 'M' },
  { key: 'flower-daisy_gaillardia',            label: 'Gaillardia',              family: 'Perennial',     src: '/stickers/flower-daisy_gaillardia_M_CA-US-FR-GB-AU.png',             size: 'M' },
  { key: 'flower-daisy_geranium_fancy-leaf',   label: 'Geranium (Fancy Leaf)',   family: 'Annual Flower', src: '/stickers/flower-daisy_geranium_S_fancy-leaf_CA-US-FR-GB-AU.png',    size: 'S' },
  { key: 'flower-daisy_geranium_pink-angel',   label: 'Geranium (Pink Angel)',   family: 'Annual Flower', src: '/stickers/flower-daisy_geranium_S_pink-angel_CA-US-FR-GB-AU.png',    size: 'S' },
  { key: 'flower-daisy_geranium_pink-ivy',     label: 'Geranium (Pink Ivy)',     family: 'Annual Flower', src: '/stickers/flower-daisy_geranium_S_pink-ivy_CA-US-FR-GB-AU.png',      size: 'S' },
  { key: 'flower-daisy_geranium_red-zonal',    label: 'Geranium (Red Zonal)',    family: 'Annual Flower', src: '/stickers/flower-daisy_geranium_S_red-zonal_CA-US-FR-GB-AU.png',     size: 'S' },
  { key: 'flower-daisy_geranium_scented',      label: 'Geranium (Scented)',      family: 'Annual Flower', src: '/stickers/flower-daisy_geranium_S_scented_CA-US-FR-GB-AU.png',       size: 'S' },
  { key: 'flower-daisy_geum',                  label: 'Geum',                    family: 'Perennial',     src: '/stickers/flower-daisy_geum_S_CA-US-FR-GB-AU.png',                  size: 'S' },
  { key: 'flower-daisy_herb-robert',           label: 'Herb Robert',             family: 'Annual Flower', src: '/stickers/flower-daisy_herb-robert_S_CA-US-FR-GB-AU.png',            size: 'S' },
  { key: 'flower-daisy_impatiens',             label: 'Impatiens',               family: 'Annual Flower', src: '/stickers/flower-daisy_impatiens_S_CA-US-FR-GB-AU.png',              size: 'S' },
  { key: 'flower-daisy_knautia',               label: 'Knautia',                 family: 'Perennial',     src: '/stickers/flower-daisy_knautia_M_CA-US-FR-GB-AU.png',                size: 'M' },
  { key: 'flower-daisy_marigold_cream',        label: 'Marigold (Cream)',        family: 'Annual Flower', src: '/stickers/flower-daisy_marigold_S_cream_CA-US-FR-GB-AU.png',         size: 'S' },
  { key: 'flower-daisy_marigold_french',       label: 'Marigold (French)',       family: 'Annual Flower', src: '/stickers/flower-daisy_marigold_S_french_CA-US-FR-GB-AU.png',        size: 'S' },
  { key: 'flower-daisy_marigold_yellow',       label: 'Marigold (Yellow)',       family: 'Annual Flower', src: '/stickers/flower-daisy_marigold_S_yellow_CA-US-FR-GB-AU.png',        size: 'S' },
  { key: 'flower-daisy_meadow-cranesbill',     label: 'Meadow Cranesbill',       family: 'Perennial',     src: '/stickers/flower-daisy_meadow-cranesbill_M_CA-US-FR-GB-AU.png',      size: 'M' },
  { key: 'flower-daisy_mountain-cornflower',   label: 'Mountain Cornflower',     family: 'Perennial',     src: '/stickers/flower-daisy_mountain-cornflower_M_CA-US-FR-GB-AU.png',    size: 'M' },
  { key: 'flower-daisy_nigella',               label: 'Nigella',                 family: 'Annual Flower', src: '/stickers/flower-daisy_nigella_M_CA-US-FR-GB-AU.png',                size: 'M' },
  { key: 'flower-daisy_ox-eye-daisy',          label: 'Ox-Eye Daisy',            family: 'Perennial',     src: '/stickers/flower-daisy_ox-eye-daisy_M_CA-US-FR-GB-AU.png',           size: 'M' },
  { key: 'flower-daisy_scabiosa',              label: 'Scabiosa',                family: 'Perennial',     src: '/stickers/flower-daisy_scabiosa_M_CA-US-FR-GB-AU.png',               size: 'M' },
  { key: 'flower-daisy_sweet-violet',          label: 'Sweet Violet',            family: 'Perennial',     src: '/stickers/flower-daisy_sweet-violet_XS_CA-US-FR-GB-AU.png',          size: 'XS' },
  { key: 'flower-daisy_wood-anemone',          label: 'Wood Anemone',            family: 'Perennial',     src: '/stickers/flower-daisy_wood-anemone_S_CA-US-FR-GB-AU.png',           size: 'S' },
  { key: 'flower-daisy_zinnia_orange',         label: 'Zinnia (Orange)',         family: 'Annual Flower', src: '/stickers/flower-daisy_zinnia_S_orange_CA-US-FR-GB-AU.png',           size: 'S' },
  { key: 'flower-daisy_zinnia_pink',           label: 'Zinnia (Pink)',           family: 'Annual Flower', src: '/stickers/flower-daisy_zinnia_S_pink_CA-US-FR-GB-AU.png',             size: 'S' },
  { key: 'flower-daisy_zinnia_red',            label: 'Zinnia (Red)',            family: 'Annual Flower', src: '/stickers/flower-daisy_zinnia_S_red_CA-US-FR-GB-AU.png',              size: 'S' },
  // Roses & variants
  { key: 'flower-rose_climbing-rose_pink',     label: 'Climbing Rose (Pink)',    family: 'Climber',       src: '/stickers/flower-rose_climbing-rose_M_pink_CA-US-FR-GB-AU.png',      size: 'M' },
  { key: 'flower-rose_climbing-rose_red',      label: 'Climbing Rose (Red)',     family: 'Climber',       src: '/stickers/flower-rose_climbing-rose_M_red_CA-US-FR-GB-AU.png',       size: 'M' },
  { key: 'flower-rose_climbing-rose_white',    label: 'Climbing Rose (White)',   family: 'Climber',       src: '/stickers/flower-rose_climbing-rose_M_white_CA-US-FR-GB-AU.png',     size: 'M' },
  { key: 'flower-rose_peony_coral',            label: 'Peony (Coral)',           family: 'Perennial',     src: '/stickers/flower-rose_peony_M_coral_CA-US-FR-GB-AU.png',             size: 'M' },
  { key: 'flower-rose_peony_pink',             label: 'Peony (Pink)',            family: 'Perennial',     src: '/stickers/flower-rose_peony_M_pink_CA-US-FR-GB-AU.png',              size: 'M' },
  { key: 'flower-rose_peony_white',            label: 'Peony (White)',           family: 'Perennial',     src: '/stickers/flower-rose_peony_M_white_CA-US-FR-GB-AU.png',             size: 'M' },
  { key: 'flower-rose_rose_pink',              label: 'Rose (Pink)',             family: 'Shrub / Rose',  src: '/stickers/flower-rose_rose_M_pink_CA-US-FR-GB-AU.png',               size: 'M' },
  { key: 'flower-rose_rose_red',               label: 'Rose (Red)',              family: 'Shrub / Rose',  src: '/stickers/flower-rose_rose_M_red_CA-US-FR-GB-AU.png',                size: 'M' },
  { key: 'flower-rose_rose_white',             label: 'Rose (White)',            family: 'Shrub / Rose',  src: '/stickers/flower-rose_rose_M_white_CA-US-FR-GB-AU.png',              size: 'M' },
  // Spike & tower flowers
  { key: 'flower-spike_acanthus',              label: 'Acanthus',                family: 'Perennial',     src: '/stickers/flower-spike_acanthus_L_CA-US-FR-GB-AU.png',               size: 'L' },
  { key: 'flower-spike_agastache',             label: 'Agastache',               family: 'Perennial',     src: '/stickers/flower-spike_agastache_M_CA-US-FR-GB-AU.png',              size: 'M' },
  { key: 'flower-spike_bistort',               label: 'Bistort',                 family: 'Perennial',     src: '/stickers/flower-spike_bistort_M_CA-US-FR-GB-AU.png',                size: 'M' },
  { key: 'flower-spike_camassia',              label: 'Camassia',                family: 'Bulb',          src: '/stickers/flower-spike_camassia_M_CA-US-FR-GB-AU.png',               size: 'M' },
  { key: 'flower-spike_hollyhock_pink',        label: 'Hollyhock (Pink)',        family: 'Biennial',      src: '/stickers/flower-spike_hollyhock_XL_pink_CA-US-FR-GB-AU.png',        size: 'XL' },
  { key: 'flower-spike_hollyhock_red',         label: 'Hollyhock (Red)',         family: 'Biennial',      src: '/stickers/flower-spike_hollyhock_XL_red_CA-US-FR-GB-AU.png',         size: 'XL' },
  { key: 'flower-spike_hollyhock_white',       label: 'Hollyhock (White)',       family: 'Biennial',      src: '/stickers/flower-spike_hollyhock_XL_white_CA-US-FR-GB-AU.png',       size: 'XL' },
  { key: 'flower-spike_iris_default',          label: 'Iris',                    family: 'Perennial',     src: '/stickers/flower-spike_iris_M_CA-US-FR-GB-AU.png',                   size: 'M' },
  { key: 'flower-spike_iris_dwarf',            label: 'Iris (Dwarf)',            family: 'Perennial',     src: '/stickers/flower-spike_iris_M_dwarf_CA-US-FR-GB-AU.png',             size: 'M' },
  { key: 'flower-spike_iris_peach',            label: 'Iris (Peach)',            family: 'Perennial',     src: '/stickers/flower-spike_iris_M_peach_CA-US-FR-GB-AU.png',             size: 'M' },
  { key: 'flower-spike_iris_species',          label: 'Iris (Species)',          family: 'Perennial',     src: '/stickers/flower-spike_iris_M_species_CA-US-FR-GB-AU.png',           size: 'M' },
  { key: 'flower-spike_jacobs-ladder',         label: "Jacob's Ladder",          family: 'Perennial',     src: '/stickers/flower-spike_jacobs-ladder_M_CA-US-FR-GB-AU.png',          size: 'M' },
  { key: 'flower-spike_jacobs-ladder-blue',    label: "Jacob's Ladder (Blue)",   family: 'Perennial',     src: '/stickers/flower-spike_jacobs-ladder-blue_M_CA-US-FR-GB-AU.png',     size: 'M' },
  { key: 'flower-spike_larkspur',              label: 'Larkspur',                family: 'Annual Flower', src: '/stickers/flower-spike_larkspur_L_CA-US-FR-GB-AU.png',               size: 'L' },
  { key: 'flower-spike_penstemon',             label: 'Penstemon',               family: 'Perennial',     src: '/stickers/flower-spike_penstemon_M_CA-US-FR-GB-AU.png',              size: 'M' },
  { key: 'flower-spike_sidalcea',              label: 'Sidalcea',                family: 'Perennial',     src: '/stickers/flower-spike_sidalcea_M_CA-US-FR-GB-AU.png',               size: 'M' },
  { key: 'flower-spike_stock',                 label: 'Stock',                   family: 'Annual Flower', src: '/stickers/flower-spike_stock_M_CA-US-FR-GB-AU.png',                  size: 'M' },
  { key: 'flower-spike_toadflax',              label: 'Toadflax',                family: 'Perennial',     src: '/stickers/flower-spike_toadflax_M_CA-US-FR-GB-AU.png',               size: 'M' },
  { key: 'flower-spike_verbascum',             label: 'Verbascum',               family: 'Perennial',     src: '/stickers/flower-spike_verbascum_XL_CA-US-FR-GB-AU.png',             size: 'XL' },
  { key: 'flower-spike_veronica',              label: 'Veronica',                family: 'Perennial',     src: '/stickers/flower-spike_veronica_M_CA-US-FR-GB-AU.png',               size: 'M' },
  { key: 'flower-spike_veronicastrum',         label: 'Veronicastrum',           family: 'Perennial',     src: '/stickers/flower-spike_veronicastrum_L_CA-US-FR-GB-AU.png',          size: 'L' },
  { key: 'flower-spike_wallflower',            label: 'Wallflower',              family: 'Biennial',      src: '/stickers/flower-spike_wallflower_S_CA-US-FR-GB-AU.png',             size: 'S' },
  { key: 'flower-spike_woodland-sage',         label: 'Woodland Sage',           family: 'Perennial',     src: '/stickers/flower-spike_woodland-sage_S_CA-US-FR-GB-AU.png',          size: 'S' },

  // Hydrangea variants
  { key: 'flower-cluster_hydrangea_arborescens', label: 'Hydrangea (Arborescens)', family: 'Shrub / Flower', src: '/stickers/flower-cluster_hydrangea_M_arborescens_CA-US-FR-GB-AU.png', size: 'M' },
  { key: 'flower-cluster_hydrangea_blue-deckle', label: 'Hydrangea (Blue Deckle)', family: 'Shrub / Flower', src: '/stickers/flower-cluster_hydrangea_M_blue-deckle_CA-US-FR-GB-AU.png',  size: 'M' },
  { key: 'flower-cluster_hydrangea_eldorado',    label: 'Hydrangea (Eldorado)',    family: 'Shrub / Flower', src: '/stickers/flower-cluster_hydrangea_M_eldorado_CA-US-FR-GB-AU.png',    size: 'M' },
  { key: 'flower-cluster_hydrangea_miss-saori',  label: 'Hydrangea (Miss Saori)',  family: 'Shrub / Flower', src: '/stickers/flower-cluster_hydrangea_M_miss-saori_CA-US-FR-GB-AU.png',  size: 'M' },
  { key: 'flower-cluster_hydrangea_nikko-blue',  label: 'Hydrangea (Nikko Blue)',  family: 'Shrub / Flower', src: '/stickers/flower-cluster_hydrangea_M_nikko-blue_CA-US-FR-GB-AU.png',  size: 'M' },
  { key: 'flower-cluster_hydrangea_unique',      label: 'Hydrangea (Unique)',      family: 'Shrub / Flower', src: '/stickers/flower-cluster_hydrangea_M_unique_CA-US-FR-GB-AU.png',      size: 'M' },

];
