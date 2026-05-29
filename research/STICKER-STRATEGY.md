# Garden Mapper — Sticker Strategy

---

## 1. How Many Stickers Can a Web App Reasonably Hold?

### SVG File Size Estimates

| Complexity Level | Typical SVG Size | Examples |
|---|---|---|
| Simple (1–3 shapes) | 1–3 KB | Ground cover, grass clump, aquatic pad |
| Moderate (4–8 shapes) | 3–8 KB | Flower-daisy, shrub-round, herb-small |
| Detailed (9–15 shapes) | 8–15 KB | Tree-deciduous, flower-rose, vine-leaf |
| Very detailed (16+ shapes) | 15–25 KB | Not recommended — simplify |

**Recommendation:** Keep all stickers under 10 KB each. Target 3–6 KB average through good SVG design (no embedded bitmaps, minimal paths, reuse `<symbol>` definitions).

### Practical Limits for Tablet/Mobile Web App

| Metric | Safe Limit | Notes |
|---|---|---|
| Total sticker count | **200–300** | Beyond this, catalog UX becomes unwieldy anyway |
| Total SVG payload (inline) | **~1 MB** | ~100–150 stickers at 6 KB avg |
| Total SVG payload (lazy-loaded) | **~5 MB** | Safe with caching |
| Browser memory (SVG sprite sheet) | **~4–8 MB** | Fine for modern mobile browsers |
| Initial load (Tier 1 only) | **< 200 KB** | 20–30 stickers, fast startup |

**Bottom line:** 100–200 stickers is a comfortable working ceiling for a polished, responsive experience. A tiered loading strategy handles growth beyond that.

### Recommended Tiered Loading Strategy

```
Tier 1 — Bundle at startup (20 stickers, ~120 KB)
  • Included inline in the app bundle or preloaded on first launch
  • Covers 80% of all plant placements
  • No network round-trip needed for core use

Tier 2 — Lazy-load on first use (40 total, +20 loaded on demand)
  • Fetched the first time a Tier 2 plant is placed
  • Cached in localStorage / ServiceWorker cache
  • User sees a brief loading spinner (< 200ms on 4G)

Tier 3 — On-demand + CDN cache (60+ total)
  • Rare/regional/specialty stickers
  • Fetched per-request, cached after first load
  • SVG sprite per-category (e.g. aquatic-sprites.svg) to reduce requests
```

**Implementation note:** Use a single SVG sprite sheet per tier (all symbols in one `<svg>` file with `<symbol id="tree-deciduous">` etc.). Reference via `<use href="sprites-tier1.svg#tree-deciduous">`. This gives HTTP caching on a single file and minimal DOM overhead.

---

## 2. Sticker Sharing / Reuse Map

### Visual Grouping by Aerial Silhouette

The key insight: **many plants look nearly identical from directly above**. Group by shape, not by species.

### Canonical Sticker Set (21 base types)

#### `tree-deciduous`
Broad round canopy seen from above. Irregular organic edge, green fill.
- Oak, Silver Birch, Weeping Willow, Japanese Maple, Magnolia, Ornamental Cherry, Liquidambar, Ginkgo, Eucalyptus

#### `tree-conifer`
Star or snowflake shape from above — concentric whorls of branches radiating from centre.
- Blue Spruce, Leylandii Cypress

#### `tree-fruit`
Smaller, tidier round canopy than deciduous. Often denser fill.
- Apple, Pear, Plum, Cherry, Peach, Apricot, Quince, Lemon, Orange, Fig

#### `shrub-round`
Compact dome mound, solid fill, slightly irregular edge.
- Boxwood/Buxus, English Holly, Viburnum, Photinia, Euonymus, Berberis/Barberry, Pittosporum, Camellia

#### `shrub-flowering`
Mound with scattered bloom dots on top — colour varies by plant.
- Forsythia, Rhododendron, Azalea, Spiraea, Potentilla, Weigela, Buddleia, Grevillea, Banksia

#### `shrub-lavender`
Upright linear spike clusters radiating from a central crown.
- Lavender, Salvia (perennial), Agastache, Rosemary (larger specimens)

#### `hedge-row`
Rectangular or linear block — designed to be placed as a fence/wall element.
- Boxwood (formal hedge), Privet, Leylandii (hedge use)

#### `flower-daisy`
Flat rosette of petals around a centre disk. Immediately iconic.
- Marigold, Petunia, Zinnia, Cosmos, Impatiens, Pansy, Gazania, Echinacea/Coneflower, Black-eyed Susan, Rudbeckia, Geranium (hardy), Yarrow, Coreopsis, Gaillardia, Scabiosa, Marsh Marigold, Nasturtium, Lobelia, Portulaca, Dahlia

#### `flower-tulip`
Upright cup shape — clean oval/goblet seen from slight angle, or teardrop from above.
- Tulip (primary), also Crocus (smaller version)

#### `flower-rose`
Layered concentric petal spiral, viewed from above.
- Rose, Climbing Rose, Peony, Camellia (can share)

#### `flower-spike`
Tall narrow vertical column of small blooms — like a candle from above = small oval/dot.
- Delphinium, Foxglove, Lupin, Gladiolus, Snapdragon, Stock/Matthiola, Larkspur, Penstemon, Astilbe, Camassia, Iris (bearded), Pickerelweed, Iris (water/flag)

#### `flower-cluster`
Ball or dome of small massed blooms — globe from above.
- Hydrangea, Allium (ornamental), Agapanthus, Verbena bonariensis, Lilac, Achillea, Muscari/Grape Hyacinth

#### `grass-clump`
Radiating fan or fountain of fine lines from a central point.
- Ornamental Grass (Miscanthus), Blue Oat Grass, Pampas Grass, Stipa/Feather Grass, Bulrush/Cattail, Chives (smaller version)

#### `ground-cover`
Flat spreading mat or patch — loose blob shape, low detail.
- Lawn Grass, Creeping Jenny, Ajuga/Bugle, Pachysandra, Vinca/Periwinkle, Ivy/English Ivy, Sedum/Stonecrop, Lobelia (trailing)

#### `vine-leaf`
Flat lobed leaf shape, often with a tendril — represents the leading growth point of a climber.
- Clematis, Wisteria, Virginia Creeper, Honeysuckle, Jasmine, Passion Flower, Cucumber, Pea, Sweet Pea, Runner Bean, Nasturtium (trailing form)

#### `vegetable-leafy`
Open rosette of large leaves — cabbage, lettuce silhouette.
- Lettuce, Spinach, Kale, Cabbage, Cauliflower, Hosta, Zucchini/Courgette, Potato, Rhubarb

#### `vegetable-root`
Compact round-top with slight shoulder showing — carrot/beet top view.
- Carrot, Beet/Beetroot, Radish, Turnip, Shallot

#### `vegetable-tall`
Upright stalk seen as a small oval/dot with leaf detail around it.
- Tomato, Cherry Tomato, Corn/Sweetcorn, Sunflower, Dill, Fennel, French Bean, Eggplant, Broccoli, Sweet Pepper, Chilli Pepper, Leek

#### `bulb-spring`
Upright strappy leaf cluster — like a small star or elongated oval from above.
- Daffodil/Narcissus, Hyacinth, Snowdrop, Tulip (leaf form, alternate to flower-tulip), Garlic, Onion, Crocus (early form)

#### `aquatic`
Round lily pad — flat circle with a notch cut in. Optionally with a small bloom dot.
- Water Lily, Lotus, Hornwort, Water Hyacinth

#### `herb-small`
Tiny compact rosette — think Scrabble tile–sized cluster of small leaves.
- Basil, Parsley, Mint, Thyme, Sage, Oregano, Coriander/Cilantro, Catmint/Nepeta, Rosemary (small), Sedum (small), Watermint

---

## 3. Sticker Count by Tier

### Tier 1 — MVP (20 stickers) — covers ~80% of all placements

These 20 sticker IDs handle the vast majority of garden layouts. Every common plant can map to one of these.

| # | Sticker ID | Priority Rationale |
|---|---|---|
| 1 | `tree-deciduous` | Most popular ornamental tree shape |
| 2 | `tree-fruit` | Extremely common in home gardens |
| 3 | `tree-conifer` | Common hedge/accent conifer |
| 4 | `shrub-round` | Boxwood, holly — ubiquitous |
| 5 | `shrub-flowering` | Rhododendron, azalea — very common |
| 6 | `hedge-row` | Essential for garden boundary layouts |
| 7 | `flower-daisy` | Most common flower silhouette |
| 8 | `flower-rose` | Roses are the #1 garden flower worldwide |
| 9 | `flower-spike` | Delphinium, foxglove, lupin — tall borders |
| 10 | `flower-cluster` | Hydrangea, allium — very popular |
| 11 | `flower-tulip` | Most iconic bulb shape |
| 12 | `bulb-spring` | Daffodil, crocus — spring planting |
| 13 | `grass-clump` | Ornamental grasses — trending |
| 14 | `ground-cover` | Lawn, vinca, ivy — always needed |
| 15 | `vine-leaf` | Climbers on fences/walls |
| 16 | `vegetable-leafy` | Lettuce, cabbage, kale |
| 17 | `vegetable-root` | Carrots, beets |
| 18 | `vegetable-tall` | Tomato, corn, sunflower |
| 19 | `herb-small` | Basil, thyme, mint — herb gardens |
| 20 | `aquatic` | Pond plants — water lily |

### Tier 2 — V1 (40 total, +20 new stickers)

Add plant-specific variants once MVP is validated. Suggestions:

| # | New Sticker ID | What it Adds |
|---|---|---|
| 21 | `shrub-lavender` | Lavender, salvia — very requested |
| 22 | `flower-daisy-sm` | Small daisy variant for XS plants (pansy, crocus) |
| 23 | `flower-tulip-open` | Open tulip / parrot tulip variant |
| 24 | `tree-deciduous-autumn` | Autumn colour version (warm orange/red palette) |
| 25 | `tree-fruit-blossom` | Spring blossom variant (pink/white canopy) |
| 26 | `vegetable-tall-corn` | Corn-specific (distinct top-view cross of husks) |
| 27 | `vegetable-tall-sunflower` | Sunflower-specific (bold disk + petals from above) |
| 28 | `climbing-rose` | Climbing rose: vine + rose bloom hybrid |
| 29 | `grass-lawn` | Lawn turf patch (distinct from ornamental clump) |
| 30 | `shrub-round-sm` | Small shrub for compact varieties |
| 31 | `flower-daisy-dahlia` | Dahlia-specific (larger, layered petals) |
| 32 | `bulb-allium` | Giant allium globe (very distinct shape) |
| 33 | `veggie-zucchini` | Zucchini: massive spreading leaf rosette |
| 34 | `herb-rosemary` | Rosemary: upright woody mini-shrub |
| 35 | `flower-iris` | Iris fan from above (distinct strappy fan shape) |
| 36 | `aquatic-emergent` | Emergent aquatics: iris, cattail above water |
| 37 | `tree-willow` | Weeping willow: cascade drape silhouette |
| 38 | `flower-peony` | Peony: large full rose variant |
| 39 | `veggie-rhubarb` | Rhubarb: giant bold-leafed clump |
| 40 | `vine-wisteria` | Wisteria: vine + hanging cluster bloom |

### Tier 3 — V2+ (60+ stickers)

Regional/specialty plants unlocked by user submissions or regional settings:

- AU native stickers (Grevillea, Banksia, Waratah, Bottlebrush)
- FR specialty (Lavande de Provence variants, ornamental kitchen garden)
- CA specialty (native plants: trillium, wild columbine, serviceberry)
- GB specialty (cottage garden classics: hollyhock, sweet william)
- Rare edibles: artichoke, asparagus, horseradish
- Exotic additions: tree fern, olive tree, pomegranate
- Seasonal states: winter bare-branch tree, autumn-colour variants
- Structural: raised bed outline, cold frame, trellis/arch elements

---

*Strategy last updated: 2026-05-26*
