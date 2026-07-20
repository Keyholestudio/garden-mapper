# Garden Mapper — Sticker Prompt Guide
_Last updated: 2026-07-20 (removed "No background showing in the center of the plant" from all templates) — Rob's master edition_

---

## 1. Prompt Templates by Plant Type

Use the correct template for the plant type. Rob's wording is intentional — do not modify prompts without his approval.

---

### Pines

```
Aerial side view. Art style: watercolor painting — tasteful simplified representation of this plant with crisp edges, focusing on a primary characteristics of the plant, no trunk, bold flat icon. Dark outline 2–3px. No shadows. Centered, 75% canvas fill. Vibrant and iconic.

Subject: [PLANT NAME], stubby [TYPE OF PLANT], no trunk.
Canvas: [SIZE]px square.
Colours: [4-5 colours or hex codes], flat solid magenta background (#FF00FF)
Shape: Correct proportions.
```

---

### Plants (herbs, flowers, shrubs, perennials)

```
Aerial side view. Art style: watercolor painting — tasteful simplified representation of this plant with crisp edges, focusing on a primary characteristics of the plant, bold flat icon. Dark outline 2–3px. No shadows. Centered, 75% canvas fill. Vibrant and iconic.

Subject: [PLANT NAME], [TYPE OF PLANT].
Canvas: [SIZE]px square.
Colours: [4-5 colours or hex codes], flat solid magenta background (#FF00FF)
Shape: [Primary characteristics], stems at bottom and leafy florals at the top. Only a few leaves and flowers, small plant. Correct proportions.
```

---

### Root Vegetables

```
Side aerial view. Art style: watercolor painting — tasteful simplified representation of this plant with crisp edges, focusing on a primary characteristics of the plant, bold flat icon. Dark outline 2–3px. Line texturing. No shadows. Centered, 75% canvas fill. Vibrant and iconic.

Subject: [PLANT NAME], [TYPE OF PLANT].
Canvas: [SIZE]px square.
Colours: [4-5 colours or hex codes], flat solid magenta background (#FF00FF)
Shape: [PLANT NAME] and tops peeking from a plant wide soil line. Only show the top of the root/plant above the minimal soil line. [Basic plant description] shoulders visible above the soil, root at bottom and leafy tops. Natural proportions. Root crown only — do NOT show the full root extracted from soil or hanging in the air.
```

---

### Deciduous Trees

```
Side aerial view. Art style: Watercolor painting — tasteful simplified representation of this plant with crisp edges, focusing on primary characteristics of the plant, leafy canopy only, NO TRUNK, NO STEM, NO BARK VISIBLE. Dark outline 2-3px. No shadows. Centered, 75% canvas fill. Vibrant and iconic.

Subject: [PLANT NAME], large broad deciduous tree. NO TRUNK. Canopy only. Small leaves.
Canvas: [SIZE]px square.
Colours: [4-5 colours or hex codes], flat solid magenta background (#FF00FF)
Shape: Natural full leafy canopy, distinctive lobed leaf shapes visible. No trunk. No branches. Canopy fills the frame. Spring/summer only. No fall colours.
```

---

## 2. Variable Reference

| Variable | Notes |
|---|---|
| `[PLANT NAME]` | Common name, e.g. "English Lavender" |
| `[TYPE]` | e.g. "perennial herb", "compact annual", "tall biennial" |
| `[SIZE]` | Generate at 4× final display size — see size table below |
| `[COLOURS]` | 4–5 values — base fill, outline, limbs, accent, bloom |
| `[SHAPE]` | Primary visual characteristic only. Avoid "radiating" or "centered". |

### Size Tiers (generate at 4× final display size)

| Tier | Generate at | Final display size | Use for |
|---|---|---|---|
| XS | 96px | 24px | Tiny herbs, small ground covers |
| S | 160px | 40px | Small flowers, compact annuals |
| M | 256px | 64px | Mid-size shrubs, most perennials |
| L | 384px | 96px | Large shrubs, tall perennials |
| XL | 512px | 128px | Trees |

---

## 3. Batch Generation Workflow

**Step 1 — Prep the additions list, reference the plant database**
Update the "plant generated" column in the plant database before opening the generation tool.

**Step 2 — Group by sticker type**
Generate all `flower-daisy` plants back-to-back, then all `herb-small`, etc. Keeps the style consistent and you only tune once per type.

**Step 3 — Generate one image per plant**
Generate 2–3 variants per plant. Reject anything with:
- Side-view drift (not aerial/side as specified)
- Gradients or heavy shading
- Unrecognisable shape at small size (squint test — hold at arm's length)
- Green bleed into the subject (indicates background tolerance issue)

**Step 4 — Name files consistently**

```
{sticker-id}_{plant}_{color}_{size}.png
```

Examples:
- `flower-daisy_marigold_orange_s.png`
- `tree-fruit_apple_green_XL.png`
- `tree-conifer_spruce_M_CA-US.png`

Full naming convention (for catalog/CDN):
```
{category}_{plant-name}_{size-tier}_{regions}.png
```

| Part | Values | Example |
|---|---|---|
| category | `flower-cluster`, `flower-daisy`, `tree-conifer`, `shrub`, `vegetable`, `herb`, etc. | `tree-conifer` |
| plant-name | lowercase, hyphenated | `spruce` |
| size-tier | `XS`, `S`, `M`, `L`, `XL` | `M` |
| regions | ISO codes joined by `-` (optional, omit if universal) | `CA-US-GB` |

---

## 4. Background Removal (Chroma Key Pipeline)

All images are generated with a flat solid magenta background (`#FF00FF`) for clean automated removal.

### Processing script
```powershell
$python = "C:\Users\RG\AppData\Local\Python\bin\python3.exe"
& $python projects\garden-planner\tools\sticker-pipeline.py image1.png image2.png
```

### What the pipeline does (v4 — confirmed working 2026-05-31)

| Step | What happens |
|---|---|
| 1. Chroma key removal | Removes `#FF00FF` background. Tolerance: 80 (Euclidean RGB). Soft transition zone: 40px for anti-aliased edges. |
| 2. Green spill suppression | Semi-transparent edge pixels only. If green > avg(R+B) by more than 15 → pulls green down. Never touches opaque subject pixels. |
| 3. Watermark erasure | Bottom-right 13% × 13% region → alpha = 0. Safe zone — no plant occupies this corner. |
| 4. Crop to content | `Image.getbbox()` trims transparent border on all 4 sides. |
| 5. Resize to 512×512 | `thumbnail(512, 512, LANCZOS)` → centred on transparent canvas with letterbox/pillarbox if needed. |

Output: `<filename>_nobg.png` alongside each input.

### Manual background removal (if pipeline unavailable)
- **remove.bg** — web UI, fast, 1 image at a time
- **Photoshop / GIMP** — Select by color (#FF00FF) → delete → export PNG with alpha

### PNG output checklist
- [ ] Transparent background (no green or white remaining)
- [ ] File size < 50 KB (PNG at 512×512)
- [ ] No green fringe around subject edges
- [ ] Subject centred and fills ~75% of canvas
- [ ] Tested visually at 24–128px display sizes

---

## 5. Output Destination & App Integration

### File location
```
projects/garden-planner/stickers/<filename>.png
```
Also copies to:
```
projects/garden-planner/app/public/stickers/<filename>.png
```

### Wiring into the app
After adding the PNG file, update `app/src/hooks/usePlantCatalog.js` to add the new plant entry:

```js
{
  id: 'flower-daisy_marigold',
  label: 'Marigold',
  family: 'flower-daisy',
  key: 'flower-daisy_marigold_orange_s',   // matches filename (no .png)
  size: 'S',
  seasons: ['spring', 'summer'],
  regions: ['CA', 'US', 'GB'],
  notes: 'French Marigold, compact annual'
}
```

The `key` field maps directly to the sticker filename. The image loader resolves it as:
```
/stickers/{key}.png
```

### Size at which stickers render on canvas

| Tier | PNG file size | Rendered on canvas |
|---|---|---|
| XS | 96px | 24px |
| S | 160px | 40px |
| M | 256px | 64px |
| L | 384px | 96px |
| XL | 512px | 128px |

Stickers are rendered as `Konva.Image` inside a `Konva.Group`. The hit rect is a transparent `Konva.Rect` overlaid on top (transparent PNGs don't register Konva clicks without it). See `plantUtils.js` → `makePlantGroup()`.

---

## 6. Cron / Automated Generation Reference

When the automated sticker generation cron runs, it needs to:

1. **Pull pending requests** from `sticker_requests` DB table (status = `pending`)
2. **Build the prompt** using the correct template above (match `sticker_id` prefix to template type: `tree-conifer` → Pine, `tree-deciduous`/`tree-fruit` → Deciduous Tree, `vegetable-root` → Root Veggie, everything else → Plants)
3. **Fill all variables** — `[PLANT NAME]`, `[TYPE]`, `[SIZE]` (default `M`/256px unless specified), `[COLOURS]` (derive from plant type or use defaults), `[SHAPE]` (from request or plant DB lookup)
4. **Generate image** via AI provider (Gemini image gen / DALL-E 3 / Recraft.ai)
5. **Run chroma key pipeline** — script at `projects/garden-planner/tools/sticker-pipeline.py`
6. **Name the output file** using `{sticker-id}_{plant}_{color}_{size}.png` convention
7. **Move to** `app/public/stickers/` and `stickers/`
8. **Update DB status** → `review` and queue for Rob's approval
9. **Do NOT wire into `usePlantCatalog.js` automatically** — Rob approves before it goes live

### Prompt type routing (for cron use)

| sticker_id prefix | Template to use |
|---|---|
| `tree-conifer` | Pines |
| `tree-deciduous`, `tree-fruit`, `tree-willow` | Deciduous Trees |
| `vegetable-root` | Root Vegetables |
| Everything else | Plants |

### Default colour palettes by type (if not specified in request)

| Type | Default palette |
|---|---|
| `herb-small` | sage green, dark olive, pale lavender, warm brown stems |
| `flower-daisy` | bright colour of bloom, golden yellow, dark centre, mid-green, deep green |
| `shrub-round` | mid-green, deep green, grey-green, dark outline, warm brown stems |
| `tree-deciduous` | mid-green, deep green, warm brown limbs, pale yellow-green accents |
| `tree-fruit` | mid-green, deep green, fruit colour, warm brown limbs, pale yellow-green |
| `tree-conifer` | deep forest green, mid-green, blue-green, dark outline, pale silver-green |
| `vegetable-root` | root colour, bright green tops, mid-green, pale green stem |
| `vegetable-leafy` | mid-green, deep green, pale centre, olive, warm stems |

---

## 7. Worked Examples

### S — Marigold (`flower-daisy`) — PLANT
*Final: 40px · Generate at: 160px*

```
Aerial side view. Art style: meets watercolor painting — tasteful simplified representation of this plant with crisp edges, focusing on a primary characteristics of the plant, bold flat icon. Dark outline 2–3px. No shadows. Centered, 75% canvas fill. Vibrant and iconic.

Subject: French Marigold flower, compact annual.
Canvas: 160px square.
Colours: bright orange #FF8C00, golden yellow #FFD700, dark brown centre #8B3A00, mid-green #4A7C2F, deep green stems #2A5010, flat solid magenta background (#FF00FF)
Shape: Bold layered bloom of orange-yellow petals around a dark warm centre disk, stems at bottom and leafy florals at the top. Only a few leaves and flowers, small plant. Correct proportions.
```

---

### M — Lavender (`shrub-lavender`) — PLANT
*Final: 64px · Generate at: 256px*

```
Aerial side view. Art style: watercolor painting — tasteful simplified representation of this plant with crisp edges, focusing on a primary characteristics of the plant, bold flat icon. Dark outline 2–3px. No shadows. Centered, 75% canvas fill. Vibrant and iconic.

Subject: English Lavender shrub, perennial herb.
Canvas: 256px square.
Colours: purple #7B5EA7, silver-grey foliage #8FAF82, pale lavender #C4A8E0, dark outline #2D1A4A, warm grey stems #A09070, flat solid magenta background (#FF00FF)
Shape: Upright silver-grey stems topped with dense purple flower spikes, stems at bottom and leafy florals at the top. Only a few leaves and flowers, small plant. Correct proportions.
```

---

### XS — Carrots (`vegetable-root`) — ROOT VEGETABLE
*Final: 24px · Generate at: 96px*

```
Side aerial view. Art style: watercolor painting — tasteful simplified representation of this plant with crisp edges, focusing on a primary characteristics of the plant, bold flat icon. Dark outline 2–3px. Line texturing. No shadows. Centered, 75% canvas fill. Vibrant and iconic.

Subject: Carrot, root vegetable.
Canvas: 96px square.
Colours: bright orange #FF6B1A, deep orange #CC4A00, bright green tops #4AAF2F, mid-green #2A7010, pale green stem #8FBF6A, flat solid magenta background (#FF00FF)
Shape: Carrots and tops peeking from a plant wide soil line. Only show the top of the root/plant above the minimal soil line. Bold orange carrot shoulders visible above the soil, root at bottom and leafy tops. Natural proportions.
```

---

### XL — Apple Tree (`tree-fruit`) — DECIDUOUS TREE
*Final: 128px · Generate at: 512px*

```
Side aerial view. Art style: watercolor painting — tasteful simplified representation of this plant with crisp edges, focusing on a primary characteristics of the plant, leafy, Dark outline 2–3px. No shadows. Centered, 75% canvas fill. Vibrant and iconic.

Subject: Apple tree in fruit, round deciduous tree, No trunk.
Canvas: 512px square.
Colours: mid-green #4E8C3A, deep green #2A5C1A, bright red apples #D42B2B, warm brown limbs #6B3A2A, pale yellow-green accents #B8D474, flat solid magenta background (#FF00FF)
Shape: Natural leafy canopy. Minimal fruit, only as accent.
```

---

### XL — Pine Tree (`tree-conifer`) — PINE
*Final: 128px · Generate at: 512px*

```
Aerial side view. Art style: watercolor painting — tasteful simplified representation of this plant with crisp edges, focusing on a primary characteristics of the plant, no trunk, bold flat icon. Dark outline 2–3px. No shadows. Centered, 75% canvas fill. Vibrant and iconic.

Subject: Pine tree, stubby evergreen conifer, no trunk.
Canvas: 512px square.
Colours: deep forest green #1A5C2A, mid-green #2E7A3A, blue-green #4A8C6A, dark outline #0A2A10, pale silver-green #8AAF8A, flat solid magenta background (#FF00FF)
Shape: Correct proportions.
```

---

## 7b. Background Removal Pipeline Settings

**Background colour:** `#FF00FF` solid magenta *(switched from green 2026-06-18 — green caused internal plant colour bleed on leafy plants)*

**Pipeline:** `tools/sticker-pipeline.py` (v10 — current)
- Chroma: `[255, 0, 255]` magenta
- Tolerance: `80` | Soft range: `40`
- Spill suppression: **edge-only** (semi-transparent pixels only, same as original green pipeline). Reduces R and B toward G on edge pixels where R-G > 15 AND B-G > 15.
- Watermark erase: bottom-right 20% corner (covers full Gemini logo after any crop/resize)
- **Do not add second-pass or whole-image spill suppression** — causes grey halos and incomplete BG removal (L035)

**Do not change the background colour** without also updating `TEMPLATES` in `sticker-generate-one.py` and re-syncing this guide (Workflow 0a).

---

## 8. Quality Gates (before any sticker goes live)

- [ ] Background fully removed — no  flat solid magenta background (#FF00FF) pixels remaining
- [ ] Subject clearly recognisable at 24px (squint test)
- [ ] No white halo or dark fringe around edges
- [ ] File named correctly per convention
- [ ] PNG placed in `app/public/stickers/` and `stickers/`
- [ ] `usePlantCatalog.js` entry added (Rob approves before this step for cron-generated stickers)
- [ ] Dev server tested — sticker appears in catalog and places correctly on canvas
- [ ] Committed to git

---

*Wording of all prompts is Rob's. Do not modify without his approval.*
