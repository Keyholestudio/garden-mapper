# Garden Mapper — Sticker Processing Pipeline

_Last updated: 2026-05-31_
_Status: v4 settings confirmed working_

---

## Pipeline Overview

Raw generated image (JPG/PNG with green screen) → processed PNG sticker ready for `stickers/` folder.

**Script:** `tmp/chroma_key_remove.py` (copy to a stable location before production use)

---

## Generation Settings (to be confirmed with final prompts)

- **Background:** Flat chroma-key green `#00FF00` — required for clean removal
- **Art style:** PvZ × Stardew Valley — bold outlines, retro game feel
- **Watermark:** Gemini logo appears in bottom-right corner — erased by pipeline
- **Output format:** PNG with transparency

---

## Processing Pipeline — v4 (confirmed working 2026-05-31)

### Step 1 — Chroma Key Removal
- Colour: `#00FF00` (pure green)
- Tolerance: `80` (Euclidean RGB distance) — handles JPEG compression fringe
- Soft transition zone: `40px` above tolerance for anti-aliased edges
- Pixels within tolerance → alpha = 0 (fully transparent)
- Pixels in soft zone → partial alpha (smooth edge)

### Step 2 — Green Spill Suppression (edge pixels only)
- Applies only to semi-transparent pixels (alpha > 0 and < 255)
- If green channel > average of (red + blue) by more than 15 → pull green down to avg(R,B)
- Fully opaque subject pixels are **never touched** — preserves original colours

### Step 3 — Watermark Erasure
- Bottom-right corner: 13% of width × 13% of height
- Entire region set to alpha = 0 (transparent)
- Safe assumption: no plant subject occupies this corner

### Step 4 — Crop to Content
- `Image.getbbox()` — trims transparent border on all 4 sides
- Result: tight crop around subject

### Step 5 — Resize to 512×512
- `thumbnail(512, 512, LANCZOS)` — scales down preserving aspect ratio
- Centred on a 512×512 transparent canvas (letterbox/pillarbox as needed)
- Matches existing sticker resolution in catalog

---

## Output Naming Convention

```
{category}_{plant-name}_{size-tier}_{regions}.png
```

| Part | Values | Example |
|------|--------|---------|
| category | `flower-cluster`, `flower-daisy`, `tree-conifer`, `shrub`, `vegetable`, `herb`, etc. | `tree-conifer` |
| plant-name | lowercase, hyphenated | `spruce` |
| size-tier | `XS`, `S`, `M`, `L` | `M` |
| regions | ISO codes joined by `-` | `CA-US-GB` |

**Examples:**
- `tree-conifer_spruce_M_CA-US.png`
- `flower-cluster_marigold_M_CA-US-GB-AU.png`
- `shrub_flowering-shrub_M_CA-US-GB-AU.png`

---

## Output Destination

```
projects/garden-planner/stickers/<filename>.png
```

Then update `app/src/hooks/usePlantCatalog.js` to add the new entry.

---

## Running the Script

```powershell
$python = "C:\Users\RG\AppData\Local\Python\bin\python3.exe"
& $python tmp\chroma_key_remove.py image1.jpg image2.jpg image3.jpg
```

Outputs `<filename>_nobg.png` alongside each input file.

---

## TODO — Integration
- [ ] Move script from `tmp/` to `projects/garden-planner/tools/sticker-pipeline.py`
- [ ] Accept output filename as argument (skip manual rename)
- [ ] Integrate into sticker request approval flow (STICKER-ROADMAP.md)
- [ ] Batch mode: process entire folder
