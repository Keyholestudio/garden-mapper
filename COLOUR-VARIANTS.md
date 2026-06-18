# Colour Variant Rollout Plan
_Created: 2026-06-17 | Status: In progress_

---

## What "done" looks like per plant
1. **`PLANT_VARIANTS` entry** in `useGardenState.js` — first swatch = default PNG, each variant has `label`, `name`, `colour`, `src`
2. **Variant PNGs** exist in `app/public/stickers/` with correct filenames
3. **`name` field** shows the cultivar name in the panel subtitle when selected
4. **Default swatch** always first, points to the existing catalog PNG (no new sticker needed)

---

## Rollout Chunks

### Chunk 1 — Trees
| Plant | Key | Status | Variants |
|-------|-----|--------|----------|
| Maple | `tree-deciduous_maple` | ⚠️ Partial | Green (v1 — regen needed), Dark Green ✅, Silver ✅, Purple ✅, Japanese ✅ — Red Leaf (v1 — regen needed) |
| Japanese Maple | — | ✅ Retired to Maple picker | — |
| Ornamental Cherry | `tree-deciduous_ornamental-cherry` | 🔲 Next | Pink, White, Deep Pink |
| Magnolia | `tree-deciduous_magnolia` | 🔲 Next | White, Pink, Purple |
| Oak Tree | `tree-deciduous_oak` | ⏭ Skip | No spring/summer variants |
| Silver Birch | `tree-deciduous_silver-birch` | ⏭ Skip | No spring/summer variants |
| Weeping Willow | `tree-deciduous_weeping-willow` | ⏭ Skip | No spring/summer variants |

### Chunk 2 — Flowers (high colour variety)
| Plant | Status |
|-------|--------|
| Tulip | 🔲 Planned |
| Rose | 🔲 Planned |
| Climbing Rose | 🔲 Planned |
| Hydrangea | 🔲 Planned |
| Peony | 🔲 Planned |
| Iris | 🔲 Planned |
| Lavender | 🔲 Planned |
| Echinacea | 🔲 Planned |
| Zinnia | 🔲 Planned |
| Marigold | 🔲 Planned |
| Cosmos | 🔲 Planned |
| Petunia | 🔲 Planned |
| Pansy | 🔲 Planned |
| Dahlia | 🔲 Planned |
| Lupin | 🔲 Planned |
| Delphinium | 🔲 Planned |
| Phlox | 🔲 Planned |
| Anemone | 🔲 Planned |
| Salvia | 🔲 Planned |

### Chunk 3 — Vegetables
| Plant | Status | Variants |
|-------|--------|----------|
| Lettuce | ✅ Done | Green, Light Green, Dark Green, Red-Green, Burgundy, Bronze (6) |
| Kale | 🔲 Planned | Green, Purple, Red/Pink |
| Swiss Chard | 🔲 Planned | Green, Red, Yellow, Rainbow |
| Cabbage | 🔲 Planned | Green, Red/Purple |
| Potato | 🔲 Planned | White flower, Purple flower |

### Chunk 4 — Shrubs
| Plant | Status |
|-------|--------|
| Azalea | 🔲 Planned |
| Rhododendron | 🔲 Planned |
| Lilac | 🔲 Planned |
| Hydrangea (shrub) | 🔲 Planned |
| Camellia | 🔲 Planned |

---

## Per-Plant Workflow (repeatable)

**Step A — Research**
- Look up 3–6 most common spring/summer cultivar colours
- Record: cultivar name, hex colour, variant filename
- Update Garden Organizer doc tab

**Step B — Add `PLANT_VARIANTS` entry**
- First entry = default catalog PNG, `name` = standard plant name
- Each variant: `label` (colour word), `name` (cultivar name), `colour` (hex), `src` (filename)
- Edit `useGardenState.js` — one plant at a time

**Step C — Generate stickers**
- Write single-plant script using Rob's approved prompt style (watercolor, no trunk for trees, small leaves)
- Run detached, open pending folder for Rob to review locally
- Rob approves → copy to `app/public/stickers/` + `stickers/`

**Step D — Commit**
- `git add -A && git commit -m "Variants: add [plant] colour variants ([N] swatches)"`
- `git push` → Vercel auto-deploys

**Step E — Test**
- Select plant in app, verify swatch row appears
- Click each swatch, verify image swaps + subtitle updates
- Save garden, reload, verify `variantSrc` persists

---

## Standing Rules
- Never generate more than 2-3 plants per session (sticker limits)
- Always open pending folder for Rob to review before committing
- No auto-commit, no `--force`
- Default swatch always first — no new sticker needed for it
- Filename convention: `[catalog-key]_[colour-label].png` e.g. `tree-deciduous_maple_XXL_dark-green.png`
- Prompt style (trees): watercolor, no trunk, canopy only, small leaves, chroma-key green bg
- User's `variantSrc` never changes when new variants are added — user-only change

---

## Approved Prompt Style — Deciduous Trees
```
Side aerial view. Art style: Watercolor painting — tasteful simplified representation of this plant with crisp edges, focusing on primary characteristics of the plant, leafy canopy only, NO TRUNK, NO STEM, NO BARK VISIBLE. Dark outline 2-3px. No shadows. Centered, 75% canvas fill. Vibrant and iconic.

Subject: [PLANT NAME], large broad deciduous tree. NO TRUNK. Canopy only. Small leaves.
Canvas: 512px square.
Colours: [cultivar description] — [hex1], [hex2], [hex3]. flat chroma-key green background (#00FF00)
Shape: Natural full leafy canopy, distinctive lobed leaf shapes visible. No trunk. No branches. Canopy fills the frame. Spring/summer only. No fall colours.
```
