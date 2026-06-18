# Garden Mapper — Workflows
_Central reference for how we do things. When in doubt, check here first._
_Last updated: 2026-06-18_

---

## Index

1. [Add a new plant sticker (core catalog)](#1-add-a-new-plant-sticker-core-catalog)
2. [Add a new plant sticker (lazy pack)](#2-add-a-new-plant-sticker-lazy-pack)
3. [Create a new pack file](#3-create-a-new-pack-file)
4. [Add a colour variant to an existing plant](#4-add-a-colour-variant-to-an-existing-plant)
5. [Regenerate / replace an existing sticker](#5-regenerate--replace-an-existing-sticker)
6. [Update the Dream Garden](#6-update-the-dream-garden)
7. [Deploy to Android](#7-deploy-to-android)
8. [Run the tray validator](#8-run-the-tray-validator)
9. [End-of-session commit checklist](#9-end-of-session-commit-checklist)

---

## 1. Add a new plant sticker (core catalog)

> Use this for: herbs, vegetables, perennials, annuals, shrubs, ornamental trees, bulbs, groundcovers, grasses, climbers, aquatics — anything that lives in `usePlantCatalog.js`.

**Step 1 — Check PLANT-DATABASE.md first**
- Search `research/PLANT-DATABASE.md` for the plant by common name AND latin name
- **If already listed with a Sticker ID:** it's already in the app — stop
- **If already listed without a Sticker ID:** the row exists, review it and proceed from Step 2
- **If not listed:** add the row now — Common Name, Latin Name, Family Group, Regions, Size, Pack (`core`), Traits, Search Terms, Variants — before doing anything else
- Also check `usePlantCatalog.js` by key name to confirm it's not already in code without a DB entry
- This step locks the key name, size, and search metadata. Nothing proceeds until it's done.

**Step 2 — Generate the sticker**
- Run: `python sticker-generate-one.py "[Plant Name]"` (no `--force`)
- PNG lands in `stickers/generated/pending/<key>.png`
- Open the folder and show Rob the PNG for review

**Step 3 — Approval gate**
- Rob says "Approve [name]" → proceed
- Rob says "Redo [name]" → regenerate with updated prompt
- Rob says "Skip [name]" → discard, do not commit

**Step 4 — Commit (only after approval)**
1. Copy PNG → `app/public/stickers/<key>.png` AND `stickers/<key>.png`
2. Add entry to `app/src/hooks/usePlantCatalog.js`:
   - `key`, `label`, `family`, `size`, `latinName`, `searchTerms[]`, `traits[]`
   - Use the PLANT-DATABASE.md row as the source
3. Run `pwsh tools/validate-tray.ps1` — must show 0 errors
4. Update `research/PLANT-DATABASE.md` → fill in the Sticker ID column
5. `git add -A && git commit -m "Sticker: add [Name] ([key])"`
6. `git push` → Vercel auto-deploys in ~15s

**Files touched:** `usePlantCatalog.js`, `app/public/stickers/`, `stickers/`, `PLANT-DATABASE.md`

---

## 2. Add a new plant sticker (lazy pack)

> Use this for: any plant that belongs to one of the 63 defined pack subtypes (see pack list below).

> ⚠️ **PLANT-DATABASE.md is checked BEFORE anything else. No exceptions. No generation until the database check is complete.**

**Step 1 — Check PLANT-DATABASE.md first**
- Search `research/PLANT-DATABASE.md` for the plant by common name AND latin name
- **If already listed:** confirm the pack column — use exactly that pack, stop here if Sticker ID is already filled (already done)
- **If not listed:** add the row now with all fields before proceeding. This is the gate.

**Step 2 — Duplicate check (3 places)**
1. `research/PLANT-DATABASE.md` — already covered in Step 1
2. `app/src/hooks/usePlantCatalog.js` — search for the key AND the common name. Many plants (herbs, vegetables, shrubs, climbers) are already in core. If found → stop, it's already in the app.
3. `app/src/data/packs/pack-cacti-succulents.js` — check this legacy file for any cactus or succulent addition, even if using a new granular pack name
- **If a duplicate is found anywhere:** tell Rob before doing anything else. Do not proceed.

**Step 3 — Resolve ambiguous pack assignment**
- Some plants fit multiple subtypes (e.g. Rosemary → culinary, woody, or perennial herbs; Lavender → woody herbs or flowering shrubs)
- If the correct pack isn't obvious: present the options to Rob and confirm before generating
- Once confirmed, lock it in PLANT-DATABASE.md before touching anything else

**Step 4 — Confirm the pack file exists**
- Check `app/src/data/packs/` — if the pack file doesn't exist yet, do [Workflow 3](#3-create-a-new-pack-file) first

**Step 5 — Generate the sticker**
- Run: `python sticker-generate-one.py "[Plant Name]"` (no `--force`)
- PNG lands in `stickers/generated/pending/<key>.png`
- Open the folder for Rob to review

**Step 6 — Approval gate**
- Rob says "Approve [name]" → proceed
- Rob says "Redo [name]" → regenerate with updated prompt
- Rob says "Skip [name]" → discard, do not commit

**Step 7 — Commit (only after approval)**
1. Copy PNG → `app/public/stickers/<key>.png` AND `stickers/<key>.png`
2. Add entry to the correct pack file — **NEVER to `usePlantCatalog.js`**
   - `key`, `label`, `size`, `latinName`, `searchTerms[]`, `traits[]` — use PLANT-DATABASE.md as the source
3. Run `pwsh tools/validate-tray.ps1` — must show 0 errors before committing
4. Update `research/PLANT-DATABASE.md` → fill in the Sticker ID column
5. `git add -A && git commit -m "Sticker: add [Name] ([key]) to [pack name]"`
6. `git push` → Vercel auto-deploys in ~15s

**Duplication rule:** A key must appear in exactly ONE file — core catalog OR one pack. Never both. The validator catches this but the database check should catch it first.

---

## 3. Create a new pack file

> Use this when a new category from the Recommended Master Structure needs its own lazy-load pack.

**Step 1 — Confirm the pack group**
- Check the Garden Organizer doc → "Plant Lazy Loading folder Structure" tab
- Identify the category and its red-highlighted main subtypes
- These subtypes become `packGroup` values (search filter tags) inside the pack file

**Step 2 — Create the pack file**
- Copy `app/src/data/packs/pack-cacti-succulents.js` as a template
- Rename to `pack-[category]-[subtype].js` (e.g. `pack-ferns-woodland.js`)
- Update the `packId`, `packName`, `packGroup`, and clear the `plants[]` array
- Plants array starts empty — populate via [Workflow 2](#2-add-a-new-plant-sticker-lazy-pack)

**Step 3 — Register the pack**
- Open `app/src/data/packs/index.js`
- Add import + export entry for the new pack

**Step 4 — Verify the tray shows it**
- Start dev server (`npm run dev` → http://localhost:5200)
- Confirm the pack appears in the plant tray when loaded
- Run `pwsh tools/validate-tray.ps1` — 0 errors

**Step 5 — Commit**
- `git add -A && git commit -m "Packs: add [pack name] pack file (empty)"`

**No groups/packGroup tagging** — each pack file IS the group. One subtype = one file. No further sub-filtering needed.

**Note:** Core catalog plants are NOT migrated to new packs without explicit planning session. Deferred — see PROJECT.md.

---

## 4. Add colour variants to a plant

> Use this for any plant with meaningful cultivar colour differences.
> Works for both **new plants** (no sticker yet) and **existing plants** (sticker already in app).

### Trigger prompt
> **"Add colour variants to [Plant Name]"**
> or: **"[Plant Name] needs colour variants"**
> or: **"Add [Plant Name] with colour variants to Garden Mapper"**

---

**Step 1 — Check PLANT-DATABASE.md**
- Search for the plant by name
- If not listed: add the row now (Common Name, Latin Name, Family, Regions, Size, Pack, Traits, Search Terms)
- Check the Variants column: `none` = not started | `planned` = approved for variants | `done` = complete
- If already `done`: confirm with Rob before re-doing

**Step 2 — Confirm the base sticker exists**
- Check `app/public/stickers/` for the plant's base PNG
- **If it exists:** the first swatch will point to it — no new base sticker needed
- **If it doesn't exist:** do [Workflow 1](#1-add-a-new-plant-sticker-core-catalog) or [Workflow 2](#2-add-a-new-plant-sticker-lazy-pack) first to add the base plant, then return here

**Step 3 — Research the colour variants**
- Look up 3–6 most common cultivar colours for this plant
- Record for each: colour label (e.g. "Deep Pink"), cultivar name (e.g. "Kanzan Cherry"), hex code, variant filename
- Present the proposed swatch list to Rob for confirmation before generating anything
- Format:
  ```
  Proposed variants for [Plant]:
  1. Pink — Yoshino Cherry — #F48FB1
  2. White — Tai Haku Cherry — #F5F5F5
  3. Deep Pink — Kanzan Cherry — #C2185B
  Proceed?
  ```

**Step 4 — Generate variant stickers**
- One PNG per colour variant (not the default — that reuses the base)
- Filename convention: `[catalog-key]_[size]_[colour-label].png`
  e.g. `tree-deciduous_ornamental-cherry_XXL_deep-pink.png`
- Run `sticker-generate-one.py` for each, no `--force`
- All pending PNGs land in `stickers/generated/pending/`
- Open the folder for Rob to review locally

**Step 5 — Approval gate**
- Rob approves each swatch individually, or says "Approve all"
- "Redo [colour]" → regenerate that one with updated prompt
- Do not commit any swatch until its approval is confirmed

**Step 6 — Commit**
1. Copy each approved PNG → `app/public/stickers/` AND `stickers/`
2. Add (or update) the `PLANT_VARIANTS` entry in `app/src/hooks/useGardenState.js`:
   ```js
   'plant_key': [
     { label: 'Green',     name: 'Plant Name',      colour: '#hex', src: '/stickers/base-key.png' },  // default — always first, points to base PNG
     { label: 'Deep Pink', name: 'Cultivar Name',   colour: '#hex', src: '/stickers/key_deep-pink.png' },
     { label: 'White',     name: 'Cultivar Name',   colour: '#hex', src: '/stickers/key_white.png' },
   ]
   ```
   - First entry = default, always points to existing base PNG, no new sticker needed
   - `label` = colour word shown on the swatch
   - `name` = cultivar name shown in the panel subtitle when that swatch is selected
3. Update `research/PLANT-DATABASE.md` → Variants column = `done`
4. Update `COLOUR-VARIANTS.md` → mark plant as ✅ Done with swatch count
5. Run `pwsh tools/validate-tray.ps1` — 0 errors
6. `git add -A && git commit -m "Variants: add [Plant] colour swatches ([N] colours)"`
7. `git push` → Vercel auto-deploys

**Step 7 — Test**
- Select the plant in app at localhost:5200
- Verify swatch row appears in the info panel
- Click each swatch — image swaps, subtitle updates to cultivar name
- Save garden, reload, verify `variantSrc` persists correctly

---

**Standing rules:**
- Default swatch always first — points to the base PNG, no new sticker needed for it
- Never add variants to a plant that doesn’t have a base sticker yet
- `variantSrc` is user-only — adding new variants never changes existing saved gardens
- Max 2–3 plants per session (sticker generation limits)
- Prompt style reference: `COLOUR-VARIANTS.md` — Approved Prompt Style section

---

## 5. Regenerate / replace an existing sticker

> Use when a sticker needs a visual update but the key stays the same.

1. Run `sticker-generate-one.py "[Name]"` — no `--force`
2. Open folder → show Rob the new PNG
3. On approval: overwrite PNG in-place at BOTH locations:
   - `app/public/stickers/<key>.png`
   - `stickers/<key>.png`
4. Key stays unchanged — saved gardens continue working (L025)
5. Run validator — 0 errors
6. `git add -A && git commit -m "Sticker: replace [Name] image (v2)"`

**Never:** delete the key, rename the key, or delete the PNG while it's still referenced.

---

## 6. Update the Dream Garden

> Trigger phrase: **"update the Dream Garden to the website"**

1. Open browser → `localhost:5200`
2. Eval: `JSON.parse(localStorage.getItem('gardenData'))[0]`
3. Validate: `_isDreamGarden: true` present
4. Bump `_dreamVersion` + 1
5. Overwrite `app/src/data/dreamGarden.json`
6. `git add -A && git commit -m "Dream Garden: v[N] — [desc]" && git push`
7. Verify raw GitHub URL serves new version
8. Confirm to Rob — live in ~15s

---

## 7. Deploy to Android

**One-click:** Double-click `app/deploy-android.bat` on the desktop
- Builds web, syncs Capacitor, builds APK, installs via adb
- Phone must be connected via USB with USB Debugging on

**Manual if needed:**
```powershell
cd projects/garden-planner/app
npx cap sync android
$env:JAVA_HOME = "C:\Program Files\Android\Android Studio\jbr"
npx cap build android
```
APK: `app/android/app/build/outputs/apk/debug/app-debug.apk`

---

## 8. Run the tray validator

```powershell
pwsh tools/validate-tray.ps1
```

**Checks:**
- Every sticker key in all pack + catalog files has a matching PNG in `app/public/stickers/`
- No key appears in more than one source (catalog + packs)
- Reports missing PNGs and duplicates

**Run:** Before AND after any sticker add, replace, or pack change. Must show 0 errors before committing.

**Auto-run:** Daily cron at 9 AM ET → pings Telegram topic 3954 on errors.

---

## 9. End-of-session commit checklist

Before `/new` or closing the session:

- [ ] `git status` — nothing uncommitted
- [ ] `pwsh tools/validate-tray.ps1` — 0 errors
- [ ] `research/PLANT-DATABASE.md` — Sticker ID filled in for anything added this session
- [ ] `REVISION-LOG.md` — new entries marked ✅
- [ ] `PROJECT.md` — Open Items updated if anything changed status

---

---

## Reference: Complete Pack File List

63 pack files — one per subtype. All live in `app/src/data/packs/`.

### Trees (4)
| Pack File | Subtype |
|-----------|--------|
| `pack-trees-deciduous.js` | Deciduous trees |
| `pack-trees-evergreen.js` | Evergreen trees |
| `pack-trees-coniferous.js` | Coniferous trees |
| `pack-trees-broadleaf-evergreen.js` | Broadleaf evergreen trees |

### Shrubs (5)
| Pack File | Subtype |
|-----------|--------|
| `pack-shrubs-deciduous.js` | Deciduous shrubs |
| `pack-shrubs-evergreen.js` | Evergreen shrubs |
| `pack-shrubs-flowering.js` | Flowering shrubs |
| `pack-shrubs-coniferous.js` | Coniferous shrubs |
| `pack-shrubs-broadleaf-evergreen.js` | Broadleaf evergreen shrubs |

### Flowers / Perennials (5)
| Pack File | Subtype |
|-----------|--------|
| `pack-flowers-perennials.js` | Flowering perennials |
| `pack-flowers-bulbs.js` | Bulbs / tuberous plants |
| `pack-flowers-cottage.js` | Cottage-garden flowers |
| `pack-flowers-wildflowers.js` | Native wildflowers |
| `pack-flowers-evergreen-perennials.js` | Evergreen perennials |

### Grasses (5)
| Pack File | Subtype |
|-----------|--------|
| `pack-grasses-ornamental.js` | Ornamental grasses |
| `pack-grasses-tufting.js` | Tufting grasses |
| `pack-grasses-spreading.js` | Spreading grasses |
| `pack-grasses-reeds.js` | Reeds / tall grasses |
| `pack-grasses-sedge.js` | Sedge-like plants |

### Climbers / Vines (5)
| Pack File | Subtype |
|-----------|--------|
| `pack-climbers-flowering.js` | Flowering climbers |
| `pack-climbers-evergreen.js` | Evergreen climbers |
| `pack-climbers-deciduous.js` | Deciduous climbers |
| `pack-climbers-tendrilled.js` | Tendrilled vines |
| `pack-climbers-twining.js` | Twining climbers |

### Groundcovers (5)
| Pack File | Subtype |
|-----------|--------|
| `pack-groundcovers-flowering.js` | Flowering groundcovers |
| `pack-groundcovers-evergreen.js` | Evergreen groundcovers |
| `pack-groundcovers-mat-forming.js` | Mat-forming groundcovers |
| `pack-groundcovers-spreading.js` | Spreading groundcovers |
| `pack-groundcovers-succulents.js` | Groundcover succulents |

### Succulents & Cacti (6)
> ⚠️ **Legacy:** `pack-cacti-succulents.js` currently holds all cacti/succulents. New plants go into the granular packs below. Migration of existing plants deferred.

| Pack File | Subtype |
|-----------|--------|
| `pack-succulents-rosette.js` | Rosette succulents |
| `pack-succulents-trailing.js` | Trailing succulents |
| `pack-cacti-columnar.js` | Columnar cacti |
| `pack-cacti-barrel.js` | Barrel / globular cacti |
| `pack-cacti-paddle.js` | Paddle / pad cacti |
| `pack-cacti-shrubby.js` | Shrubby succulents |

### Ferns (5)
| Pack File | Subtype |
|-----------|--------|
| `pack-ferns-tree.js` | Tree ferns |
| `pack-ferns-woodland.js` | Soft woodland ferns |
| `pack-ferns-evergreen.js` | Evergreen ferns |
| `pack-ferns-moisture.js` | Moisture-loving ferns |
| `pack-ferns-rock.js` | Rock / wall ferns |

### Herbs (6)
| Pack File | Subtype |
|-----------|--------|
| `pack-herbs-culinary.js` | Culinary herbs |
| `pack-herbs-medicinal.js` | Medicinal herbs |
| `pack-herbs-woody.js` | Woody herbs |
| `pack-herbs-soft-leaved.js` | Soft-leaved herbs |
| `pack-herbs-perennial.js` | Perennial herbs |
| `pack-herbs-annual.js` | Annual herbs |

### Vegetables (9)
| Pack File | Subtype |
|-----------|--------|
| `pack-vegetables-leafy.js` | Leafy vegetables |
| `pack-vegetables-root.js` | Root vegetables |
| `pack-vegetables-bulb.js` | Bulb vegetables |
| `pack-vegetables-stem.js` | Stem vegetables |
| `pack-vegetables-fruiting.js` | Fruiting vegetables |
| `pack-vegetables-legumes.js` | Legumes / pod vegetables |
| `pack-vegetables-brassica.js` | Brassica vegetables |
| `pack-vegetables-asian-greens.js` | Asian greens |
| `pack-vegetables-perennial.js` | Perennial vegetables |

### Fruit (8)
| Pack File | Subtype |
|-----------|--------|
| `pack-fruit-pome.js` | Pome fruit |
| `pack-fruit-stone.js` | Stone fruit |
| `pack-fruit-citrus.js` | Citrus |
| `pack-fruit-berry.js` | Berry fruit |
| `pack-fruit-vine.js` | Vine fruit |
| `pack-fruit-tropical.js` | Tropical fruit |
| `pack-fruit-melons.js` | Melons |
| `pack-fruit-nuts.js` | Nut-bearing plants |

---

## Reference: Key File Locations

| What | Where |
|------|-------|
| Core plant catalog | `app/src/hooks/usePlantCatalog.js` |
| Colour variants | `PLANT_VARIANTS` in `usePlantCatalog.js` |
| Lazy pack files | `app/src/data/packs/pack-*.js` |
| Pack registry | `app/src/data/packs/index.js` |
| Plant database | `research/PLANT-DATABASE.md` |
| Colour variant rollout plan | `COLOUR-VARIANTS.md` |
| Sticker prompts | `research/STICKER-PROMPT-GUIDE.md` |
| Decor prompts | `research/DECOR-PROMPT-GUIDE.md` |
| Tray validator | `tools/validate-tray.ps1` |
| Architecture | `ARCHITECTURE.md` |
| Project status | `PROJECT.md` |
| Lessons | `LESSONS.md` |
