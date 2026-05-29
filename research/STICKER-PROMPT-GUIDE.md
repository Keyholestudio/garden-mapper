# Garden Mapper — Sticker Prompt Guide
## Adobe Firefly Edition (≤ 1000 characters per prompt)

---

## 1. Master Style Prefixes

Two templates — one for plants, one for trees. Use the correct one.

### For Plants
```
Slight angled top-down aerial view. Art style: Plants vs. Zombies meets watercolor painting — simplified representation of this plant, focusing on a primary characteristics of the plant, bold flat icon. Dark outline 2–3px. Line texturing. No shadows. Transparent background. Centered, 75% canvas fill. Vibrant and iconic.
```

### For Trees
```
Top-down aerial view, looking straight down. Art style: Plants vs. Zombies meets watercolor painting — simplified representation of this plant, focusing on a primary characteristics of the plant, leafy with central limbs, no trunk, bold flat icon. Dark outline 2–3px. Line texturing. No shadows. Transparent background. Centered, 75% canvas fill. Vibrant and iconic.
```

### Root Vegetables
```
Slight angled top-down aerial view. Art style: Plants vs. Zombies meets watercolor painting — simplified representation of this plant, focusing on a primary characteristics of the plant, bold flat icon. Dark outline 2–3px. Line texturing. No shadows. Transparent background. Centered, 75% canvas fill. Vibrant and iconic.


---

	

Copy the right template, fill in the variables, paste into Firefly. Keep total under 1000 chars.

### Plants
```
[PLANT MASTER PREFIX]

Subject: [PLANT NAME], [TYPE OF PLANT].
Canvas: [SIZE]px square.
Colours: [4-5 colours or hex codes].
Shape: [Primary characteristics], stems at bottom and leafy florals at the top.
```

### Trees
```
[TREE MASTER PREFIX]

Subject: [PLANT NAME], [BASIC DESCRIPTION], aerial top-down, no trunk.
Canvas: 512px square.
Colours: [4-5 colours or hex codes]
Shape: [Primary characteristics], Spacious leafy canopy, sweeping central limbs. [If fruit tree: Minimal fruit, only as accent.][If pine tree: re
```

### Root Vegetables
```
[ROOT VEGETABLE MASTER PREFIX]

Subject: [PLANT NAME], [TYPE OF PLANT].
Canvas: [SIZE]px square.
Colours: [4-5 colours or hex codes — exclude soil colours].
Shape: [PLANT NAME] and tops peeking from a plant wide soil line. Only show the top of the root/plant above the minimal soil line. [Basic plant description], root at bottom and leafy florals at the top.
```

| Variable | Notes |
|---|---|
| `[PLANT NAME]` | Common name, e.g. "English Lavender" |
| `[TYPE]` | e.g. "perennial herb", "compact annual", "tall biennial" |
| `[SIZE]` | Generate at 4× final: XS=96, S=160, M=256, L=384, XL=512 |
| `[COLOURS]` | 4-5 values — base fill, outline, limbs, accent, bloom |
| `[SHAPE]` | Primary visual characteristic only. Avoid "radiating" or "centered". |

---

## 3. Worked Examples — Ready to Copy-Paste into Firefly

Two prompt templates: one for **plants**, one for **trees**. Each example is under 800 chars.

---

### XS — Thyme (`herb-small`) — PLANT
*Final: 24px · Generate at: 96px*

```
Slight angled top-down aerial view. Art style: Plants vs. Zombies meets watercolor painting — simplified representation of this plant, focusing on a primary characteristics of the plant, bold flat icon. Dark outline 2–3px. Line texturing. No shadows. Transparent background. Centered, 75% canvas fill. Vibrant and iconic.

Subject: Common Thyme herb, small woody herb.
Canvas: 96px square.
Colours: sage green #7B9E4E, dark olive #3D5A1A, pale lavender #C8A8D8, warm brown stems #7A5C3A.
Shape: Tiny dense mat of small oval grey-green leaves, scattered with pale lavender-pink flower clusters, stems at bottom and leafy florals at the top.
```

---

### S — Marigold (`flower-daisy`) — PLANT
*Final: 40px · Generate at: 160px*

```
Slight angled top-down aerial view. Art style: Plants vs. Zombies meets watercolor painting — simplified representation of this plant, focusing on a primary characteristics of the plant, bold flat icon. Dark outline 2–3px. Line texturing. No shadows. Transparent background. Centered, 75% canvas fill. Vibrant and iconic.

Subject: French Marigold flower, compact annual.
Canvas: 160px square.
Colours: bright orange #FF8C00, golden yellow #FFD700, dark brown centre #8B3A00, mid-green #4A7C2F, deep green stems #2A5010.
Shape: Bold layered bloom of orange-yellow petals around a dark warm centre disk, stems at bottom and leafy florals at the top.
```

---

### M — Lavender (`shrub-lavender`) — PLANT
*Final: 64px · Generate at: 256px*

```
Slight angled top-down aerial view. Art style: Plants vs. Zombies meets watercolor painting — simplified representation of this plant, focusing on a primary characteristics of the plant, bold flat icon. Dark outline 2–3px. Line texturing. No shadows. Transparent background. Centered, 75% canvas fill. Vibrant and iconic.

Subject: English Lavender shrub, perennial herb.
Canvas: 256px square.
Colours: purple #7B5EA7, silver-grey foliage #8FAF82, pale lavender #C4A8E0, dark outline #2D1A4A, warm grey stems #A09070.
Shape: Upright silver-grey stems topped with dense purple flower spikes, stems at bottom and leafy florals at the top.
```

---

### L — Foxglove (`flower-spike`) — PLANT
*Final: 96px · Generate at: 384px*

```
Slight angled top-down aerial view. Art style: Plants vs. Zombies meets watercolor painting — simplified representation of this plant, focusing on a primary characteristics of the plant, bold flat icon. Dark outline 2–3px. Line texturing. No shadows. Transparent background. Centered, 75% canvas fill. Vibrant and iconic.

Subject: Foxglove in full bloom, tall biennial.
Canvas: 384px square.
Colours: deep magenta #D63F6C, cream #FFF5E0, forest green #2D6A2A, dark outline #1A2E1A, mid-green stems #4A7A3A.
Shape: Tall central spike of stacked magenta bell-shaped blooms with cream-spotted interiors, broad lance-shaped green leaves, stems at bottom and leafy florals at the top.
```

---

### XL — Apple Tree (`tree-fruit`) — TREE
*Final: 128px · Generate at: 512px*

```
Top-down aerial view, looking straight down. Art style: Plants vs. Zombies meets watercolor painting — simplified representation of this plant, focusing on a primary characteristics of the plant, leafy with central limbs, no trunk, bold flat icon. Dark outline 2–3px. Line texturing. No shadows. Transparent background. Centered, 75% canvas fill. Vibrant and iconic.

Subject: Apple tree in fruit, round deciduous tree, aerial top-down, no trunk.
Canvas: 512px square.
Colours: mid-green #4E8C3A, deep green #2A5C1A, bright red apples #D42B2B, warm brown limbs #6B3A2A, pale yellow-green accents #B8D474.
Shape: Spacious leafy canopy, sweeping central limbs. Minimal fruit, only as accent.
```

---

### M — Saskatoon Berry Bush (`shrub-flowering`) — PLANT
*Final: 64px · Generate at: 256px*

```
Slight angled top-down aerial view. Art style: Plants vs. Zombies meets watercolor painting — simplified representation of this plant, focusing on a primary characteristics of the plant, bold flat icon. Dark outline 2–3px. Line texturing. No shadows. Transparent background. Centered, 75% canvas fill. Vibrant and iconic.

Subject: Saskatoon Berry bush, fruiting deciduous shrub.
Canvas: 256px square.
Colours: deep purple-blue berries #4A2080, mid-green leaves #4A7C2F, grey-green foliage #8FAF82, warm brown stems #6B3A2A, pale white blossom #F5F0E8.
Shape: Rounded shrub with clusters of deep purple-blue berries nestled among oval green leaves, stems at bottom and leafy florals at the top.
```

---

### M — Blueberry Bush (`shrub-flowering`) — PLANT
*Final: 64px · Generate at: 256px*

```
Slight angled top-down aerial view. Art style: Plants vs. Zombies meets watercolor painting — simplified representation of this plant, focusing on a primary characteristics of the plant, bold flat icon. Dark outline 2–3px. Line texturing. No shadows. Transparent background. Centered, 75% canvas fill. Vibrant and iconic.

Subject: Blueberry bush, compact fruiting shrub.
Canvas: 256px square.
Colours: bright blue berries #5B8DD9, dusty blue-grey #8BAAC8, mid-green leaves #4A7C2F, deep green #2A5010, warm brown stems #6B3A2A.
Shape: Low compact shrub covered in round bright blue berry clusters among small oval leaves, stems at bottom and leafy florals at the top.
```

---

### XS — Carrots (`vegetable-root`) — ROOT VEGETABLE
*Final: 24px · Generate at: 96px*

```
Slight angled top-down aerial view. Art style: Plants vs. Zombies meets watercolor painting — simplified representation of this plant, focusing on a primary characteristics of the plant, bold flat icon. Dark outline 2–3px. Line texturing. No shadows. Transparent background. Centered, 75% canvas fill. Vibrant and iconic.

Subject: Carrot, root vegetable.
Canvas: 96px square.
Colours: bright orange #FF6B1A, deep orange #CC4A00, bright green tops #4AAF2F, mid-green #2A7010, pale green stem #8FBF6A.
Shape: Carrots and tops peeking from a plant wide soil line. Only show the top of the root/plant above the minimal soil line. Bold orange carrot shoulders visible above the soil, feathery bright green ferny foliage, root at bottom and leafy florals at the top.
```

---

### XL — Pine Tree (`tree-conifer`) — TREE
*Final: 128px · Generate at: 512px*

```
Top-down aerial view, looking straight down. Art style: Plants vs. Zombies meets watercolor painting — simplified representation of this plant, focusing on a primary characteristics of the plant, leafy with central limbs, no trunk, bold flat icon. Dark outline 2–3px. Line texturing. No shadows. Transparent background. Centered, 75% canvas fill. Vibrant and iconic.

Subject: Pine tree, tall evergreen conifer, aerial top-down, no trunk.
Canvas: 512px square.
Colours: deep forest green #1A5C2A, mid-green #2E7A3A, blue-green #4A8C6A, dark outline #0A2A10, pale silver-green #8AAF8A.
Shape: Spacious star-shaped needle canopy, sweeping central limbs radiating outward in layered spoke pattern.
```

---

### S — Phlox (`flower-cluster`) — PLANT
*Final: 40px · Generate at: 160px*

```
Slight angled top-down aerial view. Art style: Plants vs. Zombies meets watercolor painting — simplified representation of this plant, focusing on a primary characteristics of the plant, bold flat icon. Dark outline 2–3px. Line texturing. No shadows. Transparent background. Centered, 75% canvas fill. Vibrant and iconic.

Subject: Phlox, low spreading perennial flower.
Canvas: 160px square.
Colours: hot pink #E8407A, pale pink #F5AACB, bright white #FFFFFF, mid-green #4A7C2F, deep green stems #2A5010.
Shape: Dense flat mat of small five-petalled pink and white flowers packed tightly together, stems at bottom and leafy florals at the top.
```

---

### M — Hostas (`ground-cover`) — PLANT
*Final: 64px · Generate at: 256px*

```
Slight angled top-down aerial view. Art style: Plants vs. Zombies meets watercolor painting — simplified representation of this plant, focusing on a primary characteristics of the plant, bold flat icon. Dark outline 2–3px. Line texturing. No shadows. Transparent background. Centered, 75% canvas fill. Vibrant and iconic.

Subject: Hostas, shade perennial with large leaves.
Canvas: 256px square.
Colours: blue-green #5A8A6A, pale green-white variegation #D4E8C8, deep green #2A5A3A, olive green #6B7A3A, warm brown stems #7A5C3A.
Shape: Bold overlapping large heart-shaped ribbed leaves fanning outward, variegated pale centres with deep green edges, stems at bottom and leafy florals at the top.
```

---

## 4. Batch Generation Workflow

**Step 1 — Prep your list first**
Write all plants in a spreadsheet before opening Firefly: `Plant | Sticker ID | Size | Colours | Shape hint`

**Step 2 — Group by sticker type**
Generate all `flower-daisy` plants back-to-back, then all `herb-small`, etc. Keeps the style consistent and you only tune once per type.

**Step 3 — Generate 2–3 variants per plant**
Pick the best. Reject anything with:
- Side-view drift (not truly top-down)
- Gradients or shading
- Unrecognisable shape at small size (squint test)

**Step 4 — Name files consistently**
Pattern: `{sticker-id}_{plant}.svg`
Examples: `flower-daisy_marigold.svg`, `tree-fruit_apple.svg`

---

## 5. PNG → SVG Conversion (if Firefly outputs raster)

| Tool | Best for |
|---|---|
| **Vectorizer.ai** | Fast, free tier, "flat design" mode. Best starting point. |
| **Adobe Illustrator** | Image Trace → 16 Colours preset → expand → export SVG |
| **Inkscape (free)** | Path → Trace Bitmap → Colours, 8–12 passes |
| **SVGO CLI** | Final cleanup after any conversion: `npx svgo input.svg -o output.svg --multipass` |

**SVG Checklist:**
- [ ] Transparent background (no hidden white rect)
- [ ] File size < 10 KB (target < 6 KB)
- [ ] No embedded base64 raster data
- [ ] `viewBox="0 0 64 64"` set correctly
- [ ] No hardcoded `width`/`height` (let CSS control size)
- [ ] Tested at actual display size

---

*Updated: 2026-05-27 — Firefly 1024-char edition*
