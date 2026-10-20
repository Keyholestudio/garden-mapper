# Garden Mapper - Decor Database
> Single source of truth for all decor items in the app.
> Updated every time a decor item is added, modified, or given colour variants.
> Two sources: core catalog (`usePlantCatalog.js`) and pack (`pack-decor.js`). Both are listed here.

---

## Schema

| Label | Key | Source | Size | Variants | Status | Notes |
|---|---|---|---|---|---|---|

> **Source:** `core` = usePlantCatalog.js | `pack` = pack-decor.js
> **Variants:** none | done (key in PLANT_VARIANTS in useGardenState.js)
> **Status:** ✅ live | 🔲 pending

---

## 🪨 Rocks / Stones

| Label | Key | Source | Size | Variants | Status | Notes |
|---|---|---|---|---|---|---|
| Small Garden Stone | `decor_rock-small_M_CA-US-FR-GB-AU` | core | M | none | ✅ live | |
| Medium Garden Stone | `decor_rock-medium_L_CA-US-FR-GB-AU` | core | L | none | ✅ live | |
| Large Garden Stone | `decor_rock-large_XL_CA-US-FR-GB-AU` | core | XL | none | ✅ live | |

---

## ⛲ Water Features

| Label | Key | Source | Size | Variants | Status | Notes |
|---|---|---|---|---|---|---|
| Fountain | `water-feature_fountain_L_CA-US-FR-GB-AU` | pack | L | none | ✅ live | |

---

## 🐝 Beehives

| Label | Key | Source | Size | Variants | Status | Notes |
|---|---|---|---|---|---|---|
| Beehive (Classic) | `decor_beehive-default_L_CA-US-FR-GB-AU` | core | L | done | ✅ live | PLANT_VARIANTS key: `beehives`. Default = white+wood |
| Beehive (Natural Wood) | `decor_beehive-natural_L_CA-US-FR-GB-AU` | core | L | done | ✅ live | variant swatch |

---

## 🏛️ Structures

| Label | Key | Source | Size | Variants | Status | Notes |
|---|---|---|---|---|---|---|
| Square Gazebo | `decor_gazebo-square_XL_CA-US-FR-GB-AU` | core | XXL | done | ✅ live | PLANT_VARIANTS key: `gazebos` |
| Octagon Gazebo | `decor_gazebo-oct_XL_CA-US-FR-GB-AU` | core | XXL | done | ✅ live | variant swatch |
| Large Gazebo (Tiled) | `decor_gazebo-large_XL_CA-US-FR-GB-AU` | core | XXL | done | ✅ live | variant swatch |
| Greenhouse (Default / Open Front) | `decor_greenhouse-default_XXL_CA-US-FR-GB-AU` | core | XXL | done | ✅ live | PLANT_VARIANTS key: `greenhouses`. Default = l113hx |
| Greenhouse (Victorian Open) | `decor_greenhouse-victorian-open_XXL_CA-US-FR-GB-AU` | core | XXL | done | ✅ live | variant swatch |
| Greenhouse (Victorian) | `decor_greenhouse-victorian_XXL_CA-US-FR-GB-AU` | core | XXL | done | ✅ live | variant swatch |
| Greenhouse (White Frame) | `decor_greenhouse-white_XXL_CA-US-FR-GB-AU` | core | XXL | done | ✅ live | variant swatch |
| Greenhouse (Open Rectangular) | `decor_greenhouse-open-rect_XXL_CA-US-FR-GB-AU` | core | XXL | done | ✅ live | variant swatch |
| Greenhouse (Rectangular) | `decor_greenhouse-rect_XXL_CA-US-FR-GB-AU` | core | XXL | done | ✅ live | variant swatch |
| Wood Garden Arch | `decor_arch-wood_XL_CA-US-FR-GB-AU` | core | XL | none | ✅ live | |
| Metal Garden Arch | `decor_arch-metal_XL_CA-US-FR-GB-AU` | core | XL | none | ✅ live | |
| Wooden Trellis (default) | `decor_trellis-wood-default_L_CA-US-FR-GB-AU` | core | L | trellises | ✅ live | added 2026-10-20 |
| Wooden Lattice | `decor_trellis-lattice_L_CA-US-FR-GB-AU` | core | L | trellises | ✅ live | added 2026-10-20 |
| Metal Trellis | `decor_trellis-metal_XL_CA-US-FR-GB-AU` | core | XL | trellises | ✅ live | added 2026-10-20 |

---

## 🛑 Wheelbarrows

| Label | Key | Source | Size | Variants | Status | Notes |
|---|---|---|---|---|---|---|
| Wheelbarrow (Side) | `decor_wheelbarrow-default_L_CA-US-FR-GB-AU` | core | L | done | ✅ live | PLANT_VARIANTS key: `wheelbarrows`. Default = side view |
| Wheelbarrow (Front) | `decor_wheelbarrow-front_L_CA-US-FR-GB-AU` | core | L | done | ✅ live | variant swatch |

---

## 🛖 Sheds

| Label | Key | Source | Size | Variants | Status | Notes |
|---|---|---|---|---|---|---|
| Garden Shed (Weathered) | `decor_shed-default_XXL_CA-US-FR-GB-AU` | core | XXL | done | ✅ live | PLANT_VARIANTS key: `sheds`. Default = weathered grey |
| Garden Shed (Cedar) | `decor_shed-cedar_XXL_CA-US-FR-GB-AU` | core | XXL | done | ✅ live | variant swatch |
| Garden Shed (Pine) | `decor_shed-pine_XXL_CA-US-FR-GB-AU` | core | XXL | done | ✅ live | variant swatch |

---

## 🧙 Gnomes

| Label | Key | Source | Size | Variants | Status | Notes |
|---|---|---|---|---|---|---|
| Garden Gnome (Classic) | `decor_gnome-default_M_CA-US-FR-GB-AU` | core | M | done | ✅ live | PLANT_VARIANTS key: `gnomes`. Default = red hat (w51pvh) |
| Garden Gnome (Green Hat) | `decor_gnome-green_M_CA-US-FR-GB-AU` | core | M | done | ✅ live | variant swatch — female gnome, yellow jacket |

---

## 💡 Lights

| Label | Key | Source | Size | Variants | Status | Notes |
|---|---|---|---|---|---|---|
| Garden Light (Solar Stake) | `decor_light-solar_M_CA-US-FR-GB-AU` | core | M | done | ✅ live | PLANT_VARIANTS key: `lights`. Default = solar stake |
| Garden Light (Victorian Lantern) | `decor_light-lantern_M_CA-US-FR-GB-AU` | core | M | done | ✅ live | variant swatch |
| Garden Light (Stone Lantern) | `decor_light-stone-lantern_M_CA-US-FR-GB-AU` | core | M | done | ✅ live | variant swatch |

---

## 🪑 Benches

| Label | Key | Source | Size | Variants | Status | Notes |
|---|---|---|---|---|---|---|
| Garden Bench (Wood) | `decor_bench-wood_L_CA-US-FR-GB-AU` | core | L | done | ✅ live | PLANT_VARIANTS key: `benches`. Default = wood |
| Garden Bench (Stone) | `decor_bench-stone_L_CA-US-FR-GB-AU` | core | L | done | ✅ live | variant swatch |
| Garden Bench (Iron) | `decor_bench-iron_L_CA-US-FR-GB-AU` | core | L | done | ✅ live | variant swatch |

---

## 🪑 Furniture / Seating

| Label | Key | Source | Size | Variants | Status | Notes |
|---|---|---|---|---|---|---|
| Plastic Loungers | `decor_lounge-modern_XL_CA-US-FR-GB-AU` | core | XL | none | ✅ live | |
| Wood Loungers | `decor_lounge-wood_XL_CA-US-FR-GB-AU` | core | XL | none | ✅ live | |
| Patio Table | `decor_patio-table_L_CA-US-FR-GB-AU` | pack | L | none | ✅ live | |
| Pine Table | `decor_table-pine_XXL_CA-US-FR-GB-AU` | core | XXL | none | ✅ live | |
| Stained Table | `decor_table-stained_XXL_CA-US-FR-GB-AU` | core | XXL | none | ✅ live | |
| Enameled Table | `decor_table-enameled_XXL_CA-US-FR-GB-AU` | core | XXL | none | ✅ live | |
| Bronzed Table | `decor_table-bronzed_XXL_CA-US-FR-GB-AU` | core | XXL | none | ✅ live | |
| Beach Umbrella | `decor_umbrella_L_CA-US-FR-GB-AU` | core | L | none | ✅ live | |

---

## 🪴 Planters / Pots

| Label | Key | Source | Size | Variants | Status | Notes |
|---|---|---|---|---|---|---|
| Red Round Pot | `decor_pot-red-round_S_CA-US-FR-GB-AU` | core | S | none | ✅ live | |
| Terracotta Round Pot | `decor_pot-terracotta-round_M_CA-US-FR-GB-AU` | core | M | none | ✅ live | |
| Blue Pot | `decor_pot-blue_S_CA-US-FR-GB-AU` | core | S | none | ✅ live | |
| Terracotta Pot | `decor_pot-terracotta_S_CA-US-FR-GB-AU` | core | S | none | ✅ live | |
| Green Round Pot | `decor_pot-green-round_M_CA-US-FR-GB-AU` | core | M | none | ✅ live | |

---

## 🚪 Gates

| Label | Key | Source | Size | Variants | Status | Notes |
|---|---|---|---|---|---|---|
| Gate (Blue) | `decor_gate-wood-blue_XL_CA-US-FR-GB-AU` | pack | XL | none | ✅ live | |
| Gate (Cedar) | `decor_gate-wood-cedar_XL_CA-US-FR-GB-AU` | pack | XL | none | ✅ live | |
| Gate (Charcoal) | `decor_gate-wood-charcoal_XL_CA-US-FR-GB-AU` | pack | XL | none | ✅ live | |
| Gate (Red) | `decor_gate-wood-red_XL_CA-US-FR-GB-AU` | pack | XL | none | ✅ live | |
| Gate (Sage) | `decor_gate-wood-sage_XL_CA-US-FR-GB-AU` | pack | XL | none | ✅ live | |
| Gate (White) | `decor_gate-wood-white_XL_CA-US-FR-GB-AU` | pack | XL | none | ✅ live | |

---

## 🚧 Fences

| Label | Key | Source | Size | Variants | Status | Notes |
|---|---|---|---|---|---|---|
| Picket Fence Black (H) | `decor_picket-fence-black-h_M_CA-US-FR-GB-AU` | pack | M | none | ✅ live | |
| Picket Fence Black (V) | `decor_picket-fence-black-v_M_CA-US-FR-GB-AU` | pack | M | none | ✅ live | |
| Picket Fence Blue (H) | `decor_picket-fence-blue-h_M_CA-US-FR-GB-AU` | pack | M | none | ✅ live | |
| Picket Fence Blue (V) | `decor_picket-fence-blue-v_M_CA-US-FR-GB-AU` | pack | M | none | ✅ live | |
| Picket Fence Cedar (H) | `decor_picket-fence-cedar-h_M_CA-US-FR-GB-AU` | pack | M | none | ✅ live | |
| Picket Fence Cedar (V) | `decor_picket-fence-cedar-v_M_CA-US-FR-GB-AU` | pack | M | none | ✅ live | |
| Picket Fence Red (H) | `decor_picket-fence-red-h_M_CA-US-FR-GB-AU` | pack | M | none | ✅ live | |
| Picket Fence Red (V) | `decor_picket-fence-red-v_M_CA-US-FR-GB-AU` | pack | M | none | ✅ live | |
| Picket Fence Sage (H) | `decor_picket-fence-sage-h_M_CA-US-FR-GB-AU` | pack | M | none | ✅ live | |
| Picket Fence Sage (V) | `decor_picket-fence-sage-v_M_CA-US-FR-GB-AU` | pack | M | none | ✅ live | |
| Picket Fence White | `decor_picket-fence-white_M_CA-US-FR-GB-AU` | pack | M | none | ✅ live | |
| Picket Fence White (H) | `decor_picket-fence-white-h_M_CA-US-FR-GB-AU` | pack | M | none | ✅ live | |
| Picket Fence White (V) | `decor_picket-fence-white-v_M_CA-US-FR-GB-AU` | pack | M | none | ✅ live | |

---

## 🪜 Stairs / Steps

| Label | Key | Source | Size | Variants | Status | Notes |
|---|---|---|---|---|---|---|
| Wood Stairs | `decor_stairs-wood_M_CA-US-FR-GB-AU` | core | M | none | ✅ live | |
| Stone Stairs | `decor_stairs-stone_M_CA-US-FR-GB-AU` | core | M | none | ✅ live | |
| Brick Stairs | `decor_stairs-brick_M_CA-US-FR-GB-AU` | core | M | none | ✅ live | |
| Stairs (Wood with Rail) | `decor_stairs-wood-rail_M_CA-US-FR-GB-AU` | pack | M | none | ✅ live | |
