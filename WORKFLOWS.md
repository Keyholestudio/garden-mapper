# Garden Mapper — Workflows
_Central reference for how we do things. When in doubt, check here first._
_Last updated: 2026-07-27_
_Archived workflows (1, 3, pack list): `memory/deep/garden-planner/workflows-archive.md`_

---

## Index

0. [Plant pipeline: Staging → Database](#0-plant-pipeline-staging--database)
0a. [Sticker prompt template sync](#0a-sticker-prompt-template-sync)
0b. [Apply a prompt amendment to an existing sticker](#0b-apply-a-prompt-amendment-to-an-existing-sticker)
2. [Add a new plant sticker (lazy pack)](#2-add-a-new-plant-sticker-lazy-pack)
4. [Add a colour variant to an existing plant](#4-add-a-colour-variant-to-an-existing-plant)
5. [Regenerate / replace an existing sticker](#5-regenerate--replace-an-existing-sticker)
6. [Update the Dream Garden](#6-update-the-dream-garden)
7. [Deploy to Android](#7-deploy-to-android)
8. [Run the tray validator](#8-run-the-tray-validator)
9. [End-of-session commit checklist](#9-end-of-session-commit-checklist)
10. [Make everything live](#10-make-everything-live)
11. [Full deploy: web + Android in one shot](#11-full-deploy-web--android-in-one-shot)
12. [Session Start — Version Sync Check](#12-session-start--version-sync-check)

---

## 0a. Sticker prompt template sync

> **Trigger:** Any time Rob updates `research/STICKER-PROMPT-GUIDE.md`

**Rule:** `STICKER-PROMPT-GUIDE.md` is the source of truth for all prompt wording. The script's `TEMPLATES` dict in `tools/sticker-generate-one.py` is a mirror of it. They must always match.

**When Rob says "I updated the sticker guide" or "the prompt guide changed":**
1. Read `research/STICKER-PROMPT-GUIDE.md` → Section 1 (Prompt Templates by Plant Type)
2. Open `tools/sticker-generate-one.py` → find the `TEMPLATES = {` dict (lines ~35–70)
3. Update each template key to match the guide exactly — word for word
4. Update the `# Last synced:` comment date
5. Commit: `git add -A && git commit -m "Sticker: sync TEMPLATES dict with STICKER-PROMPT-GUIDE.md"`

**Template keys and their guide sections:**
| Script key | Guide section |
|---|---|
| `plant` | Plants (herbs, flowers, shrubs, perennials) |
| `deciduous` | Deciduous Trees |
| `pine` | Pines |
| `rootveg` | Root Vegetables |
| `cedar` | (cedar/thuja — same as Pines but no trunk) |

**Never generate stickers if you haven't confirmed the TEMPLATES dict matches the guide.**

---

## 0. Plant pipeline: Staging → Database

> **Three files. Plants move forward, never backward.**

| File | Purpose | When used |
|------|---------|----------|
| `research/PLANT-PACK-RESEARCH.md` | Full researched plant lists per pack — counts + names only | Reference only. Never edit directly during sticker work. |
| `research/PLANT-STAGING-*.md` | Full schema rows for all researched plants, not yet in app — split by category | Source of truth before a sticker is made. Pick plants from here. |
| `research/PLANT-DATABASE.md` | Plants that exist in the app (sticker generated + committed) | Destination. A row arrives here only after sticker is approved + committed. |

### Staging file map (load only the one you need)

| File | Contents |
|------|----------|
| `PLANT-STAGING-trees.md` | Deciduous, Evergreen, Coniferous, Broadleaf Evergreen trees |
| `PLANT-STAGING-shrubs.md` | Deciduous, Evergreen, Flowering, Coniferous, Broadleaf Evergreen shrubs |
| `PLANT-STAGING-flowers-grasses-climbers-groundcovers.md` | Perennials, Bulbs, Cottage, Wildflowers, Evergreen Perennials, all Grasses, all Climbers, all Groundcovers |
| `PLANT-STAGING-succulents-cacti.md` | Succulents (Rosette, Trailing), Cacti (Columnar, Barrel, Paddle, Shrubby) |
| `PLANT-STAGING-edibles.md` | All Herbs, all Vegetables, all Fruit |

**The flow:**
1. Rob says "let's do [pack name]" → identify which staging file contains that pack
2. Read **only that file** — do not load staging files you don't need
3. Pick plants for that pack (batch of 5 per session)
4. Generate stickers via Workflow 2 (lazy pack) or Workflow 1 (core)
5. After approval + commit: **move the row** from the staging file → `PLANT-DATABASE.md` (fill in Sticker ID)
6. Delete the migrated row from the staging file

**Rules:**
- Never add a plant to `PLANT-DATABASE.md` without a Sticker ID
- Never skip the staging file — it is the duplicate-check gate before generation
- `PLANT-PACK-RESEARCH.md` is read-only reference — update it only when adding new packs
- Check the correct staging file first before any sticker generation
- The old monolithic `PLANT-STAGING.md` is now archived — do not use it

---

## 0b. Apply a prompt amendment to an existing sticker

> **Trigger:** Rob says "regenerate X with [change]" — background colour change, added shape text, corrected colours, etc.

### Step 1 — Locate the PLANT_LOOKUP entry
Open `tools/sticker-generate-one.py` and find the plant's row in `PLANT_LOOKUP`. It has 7 fields:
```
"plant name": (sticker_prefix, size_tier, size_px, family, template, colours, shape)
```

### Step 2 — Apply the amendment to the correct field

| Rob says | Which field to edit | Rule |
|----------|-------------------|------|
| "regenerate with cyan/magenta/yellow background" | `colours` | Remove any existing `flat solid X background (#XXXXXX)` from colours. Add the new one: `flat solid cyan background (#00FFFF)` |
| "add to the prompt: [text]" | `shape` | Prepend Rob's exact words before "Correct proportions. No roots." — copy verbatim, no embellishment, no extra sentences. |
| "update the colours to [description]" | `colours` | Edit colour hex values and labels. Do NOT touch the background spec unless Rob said to. |
| "remove [colour] from the colour options" | `colours` | Remove that colour entry. |

**Critical rule — background colours:** The `colours` string must contain **exactly one** background spec. The prompt builder strips it out and rebuilds the BG line. If you change the BG colour:
1. Remove the old `flat solid X background (#XXXXXX)` from the colours string entirely
2. Add the new `flat solid Y background (#YYYYYY)` in its place
3. Never leave two background specs in the colours string

**Critical rule — shape text:** The `shape` field is used verbatim in the prompt. If Rob says "add to the prompt", that text goes in `shape`. Do NOT add it to `colours`.

### Step 3 — Verify the assembled prompt before generating
Print the final prompt to confirm it looks right:
```powershell
$PYTHON = "C:\Users\RG\AppData\Local\Python\bin\python3.exe"
# Quick check: run the script with a dry-run or read the prompt build logic
# Confirm colours_line has exactly one background spec
# Confirm shape text appears correctly
```
At minimum: mentally trace the 7 fields and confirm no conflict exists before running.

### Step 4 — Generate
```powershell
cd "C:\Users\RG\.openclaw\workspace\projects\garden-planner\tools"
C:\Users\RG\AppData\Local\Python\bin\python3.exe sticker-generate-one.py "plant name" --force
```

### Step 5 — Fix the background removal
The script auto-detects the background from image corners via `detect_background_chroma()`. Check the output:
- If it reports `chroma: FF00FF` → magenta removal (correct for most plants)
- If it reports `chroma: 00FFFF` → cyan removal
- If corners show two different colours (split BG): the script runs two passes automatically

If the output PNG still has background residue: sample the corners manually and re-run the pipeline with the correct `--chroma` flag (see L046).

### Step 6 — Send preview to Rob
```powershell
# Script sends via Telegram automatically (or falls back to message tool)
# If Telegram send fails, use message tool directly:
# message action=send media=<pending path> caption="Plant name — [description]. Approve?"
```

### Step 7 — On approval: deploy
```powershell
$file = "<sticker-id>.png"
Copy-Item "stickers\generated\pending\$file" "app\public\stickers\$file" -Force
Copy-Item "stickers\generated\pending\$file" "stickers\$file" -Force
git add -A
git commit -m "Sticker: replace [Plant] ([what changed])"
git push
```

### Step 8 — Update PROJECT.md open items
Mark the item as resolved in the Batch 8 rework list.

---

## 2. Add a new plant sticker (lazy pack)

> Use this for: any plant that belongs to one of the 63 defined pack subtypes (see pack list below).

> ⚠️ **PLANT-STAGING.md is checked BEFORE anything else. No exceptions. No generation until the check is complete.**

**Step 1 — Check staging file and PLANT-DATABASE.md first**
- Identify which `PLANT-STAGING-*.md` file covers this pack (see Workflow 0 staging file map)
- Search that file for the plant by common name AND latin name
- **If found in staging with no Sticker ID:** row is ready — confirm the pack column and proceed from Step 3
- **If not in staging:** check `research/PLANT-DATABASE.md` — if Sticker ID is filled, it's already in the app — stop
- **If in neither:** add the row to the correct staging file now with all fields before proceeding. This is the gate.

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

**Step 6 — Batch approval gate**
- After generating a batch of up to 5 stickers, provide the pending folder path:
  `C:\Users\RG\.openclaw\workspace\projects\garden-planner\stickers\generated\pending\`
- Rob reviews all PNGs in the folder, then replies with approvals/redos:
  - "Approve all" → commit all
  - "Approve [name], redo [name2]" → commit approved, regenerate redo
  - "Skip [name]" → discard, do not commit
- Do not commit any sticker until Rob's approval is confirmed
- Commit all approved stickers in a single git commit (not one per sticker)

**Step 7 — Commit (only after approval)**
1. Copy all approved PNGs → `app/public/stickers/<key>.png` AND `stickers/<key>.png`
2. Add entries to the correct pack file — **NEVER to `usePlantCatalog.js`**
   - `key`, `label`, `size`, `latinName`, `searchTerms[]`, `traits[]` — use staging file as the source
3. Run `pwsh tools/validate-tray.ps1` — must show 0 errors before committing
4. Update `research/PLANT-DATABASE.md` → fill in the Sticker ID column for each approved plant
5. Delete the committed rows from the staging file
6. `git add -A && git commit -m "Sticker: add [Name1], [Name2] ([pack name])"` — batch in one commit
7. `git push` → Vercel auto-deploys in ~15s

**Duplication rule:** A key must appear in exactly ONE file — core catalog OR one pack. Never both. The validator catches this but the database check should catch it first.

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

### What the Dream Garden actually is
- **JSON** (`dreamGarden.json`) stores only plant positions + IDs. It does NOT store the logo or sandbox.
- **Logo + sandbox zone** are rendered by `GardenCanvas.jsx` code whenever `_isDreamGarden: true` — they are always current with the code, not the data.
- **Local:5200 dev mode:** sandbox shows as an orange dashed border (dev indicator only — not visible in production). Logo is dimmed to 50%. Drop restrictions are disabled so you can design freely anywhere on the canvas.

### Pre-flight check
- [ ] Brave Debug is open and connected (port 9222)
- [ ] Dev server running at `localhost:5200`
- [ ] Dream Garden is loaded (index 0, `_isDreamGarden: true`)
- [ ] Design is saved (click Save in the app)

### Steps
1. Eval in browser at `localhost:5200`:
   ```js
   JSON.parse(localStorage.getItem('gardenData'))[0]
   ```
2. Validate: `_isDreamGarden: true` present
3. Bump `_dreamVersion` + 1
4. Overwrite `app/src/data/dreamGarden.json` with the new JSON
5. `git add -A && git commit -m "Dream Garden: v[N] — [desc]" && git push`
6. Verify GitHub raw URL serves new version (check `_dreamVersion` in the raw JSON)
7. Confirm to Rob — web live in ~15s, Android auto-fetches on next launch

### After the commit
- Web: live in ~15s via Vercel auto-deploy
- Android: fetches updated Dream Garden silently on next launch (no APK rebuild needed)
- Local:5200: reset localStorage to pick up the new seed (Workflow 12 Step 3)

### Note on the GardenCanvas dev changes (2026-07-14)
`GardenCanvas.jsx` was updated so that on `localhost`:
- Sandbox border is shown in orange (was hidden)
- Logo is shown at 50% opacity (was hidden)
- Drop restrictions outside sandbox are disabled (production only)
This is intentional — do NOT revert before committing Dream Garden updates. The `isLocalDev` check is what gates this; production is unaffected.

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

## 10. Make everything live

> **Trigger:** "make sure all our changes are live"
> Run any time before ending a session that touched app code.

### Step 1 — Local state
- [ ] `git status` → confirm nothing uncommitted
- [ ] `git log --oneline -3` → note current HEAD commit hash

### Step 2 — GitHub (required for Vercel + future store deployments)
- [ ] `git push origin main`
- [ ] Confirm push succeeded — this is the single source of truth for all targets

### Step 3 — Web (Vercel auto-deploys from GitHub)
- [ ] Wait ~15–30s after push
- [ ] Confirm 200 at https://app.gardenmapper.ca (hard-refresh)
- [ ] If Vercel fails: check Vercel dashboard for build errors

### Step 4 — Android APK (manual — phone required)
- [ ] Phone connected via USB with USB Debugging on?
  - **YES** → double-click `deploy-android.bat` on desktop
  - **NO** → skip and note: *"Android pending — run deploy-android.bat when phone is connected"*
  - Code is already saved on GitHub. Nothing is lost. Deploy next session.

### Step 5 — Google Play Store *(not yet set up)*
- [ ] *(Placeholder — requires Google Play Developer account + signed release build)*
- [ ] Once live: build signed APK → upload to Play Console → submit for review

### Step 6 — Apple App Store *(not yet set up)*
- [ ] *(Placeholder — requires Mac + Apple Developer account ($99/yr) + Xcode)*
- [ ] Once live: build iOS release → upload via Xcode/Transporter → submit for review

---

### Deployment map (reference)

| Target | How it deploys | Trigger | Manual? | Status |
|--------|---------------|---------|---------|--------|
| Web (gardenmapper.ca) | Vercel | git push to main | No — auto | ✅ Live |
| Android APK (sideload) | deploy-android.bat | Phone connected | Yes — always | ✅ Working |
| Google Play Store | Play Console | Signed build upload | Yes | 🔲 Not set up |
| Apple App Store | Xcode / Transporter | Signed build upload | Yes | 🔲 Not set up |

---

---

## 12. Session Start — Version Sync Check

> **Trigger:** Every session start. Run before touching any code or design.
> Goal: ensure web, Android APK, and local:5200 are all running the same version.

### Step 1 — Check repo state
```powershell
cd "C:\Users\RG\.openclaw\workspace\projects\garden-planner"
git log --oneline -3        # note HEAD commit
git status                  # must be clean
```

### Step 2 — Check local:5200 Dream Garden version
1. Open `localhost:5200` in Brave (dev server must be running)
2. Open DevTools console → run:
   ```js
   JSON.parse(localStorage.getItem('gardenData'))?.[0]?._dreamVersion
   ```
3. Compare to `app/src/data/dreamGarden.json` → `_dreamVersion`
   - **Match** → local is current ✅
   - **Mismatch** → clear localStorage and reload (Step 3)

### Step 3 — Reset local:5200 Dream Garden (if stale)
> Run this any time local:5200 shows an old Dream Garden (missing logo, missing sandbox, etc.)
```js
// In DevTools console at localhost:5200:
localStorage.removeItem('gardenData');
localStorage.removeItem('gardenData_backup');
localStorage.removeItem('gardenLastIndex');
location.reload();
```
After reload: the app seeds from `dreamGarden.json` (current repo version) → Dream Garden will be current.

### Step 4 — Check Android APK version
- Ask Rob: "Is Android showing [feature from last commit]?"
- If Android is behind → run Workflow 11 (Full deploy) to rebuild + install APK
- Android won't auto-update — it always needs a manual build + install

### Step 5 — Dream Garden version check
- `dreamGarden.json` → `_dreamVersion` is the master version number
- Web (live): fetches from GitHub raw — will be current within seconds of a push
- Local:5200: loads from repo file on cold start (after localStorage clear)
- Android: baked into the APK build — needs a redeploy to update

### Version sync summary
| Surface | Dream Garden source | Code source | Needs manual update? |
|---------|-------------------|-------------|---------------------|
| Web (app.gardenmapper.ca) | GitHub raw (auto-fetched) | Vercel (auto from git push) | No — auto |
| Local:5200 | `dreamGarden.json` in repo | Local file system | Clear localStorage if stale |
| Android APK | Baked into APK at build time + GitHub raw fetch on launch | APK build | Yes — run Workflow 11 |

### Prompts to use
- **Check versions:** "Are all versions in sync?"
- **Reset local Dream Garden:** "Reset the local Dream Garden" → run Step 3 console commands
- **Full sync after changes:** "Make everything live" → Workflow 10 (web) + Workflow 11 (Android)
- **Update Dream Garden only:** "Update the Dream Garden to the website" → Workflow 6

---

## 11. Full deploy: web + Android in one shot

> **Trigger:** After any committed code or sticker change — use this single command block to push web + build + install Android.
> Phone must be connected via USB with USB Debugging enabled.

```powershell
cd "C:\Users\RG\.openclaw\workspace\projects\garden-planner"
git push  # push to GitHub → Vercel auto-deploys web in ~15s

cd app
$env:JAVA_HOME = "C:\Program Files\Android\Android Studio\jbr"
npm run build
npx cap sync android
cd android
.\gradlew assembleDebug
$adb = "C:\Users\RG\AppData\Local\Android\Sdk\platform-tools\adb.exe"
& $adb install -r "app\build\outputs\apk\debug\app-debug.apk"
```

**All 4 steps must run in order:** build → sync → assemble → install.
Skipping `npm run build` before `cap sync` = stale JS in the APK.
Skipping `cap sync` before `gradlew` = web assets not copied to Android project.

**If phone shows "unauthorized":** tap Allow on the USB debugging prompt on the phone, then re-run `adb install`.

**Web only (no phone):**
```powershell
cd "C:\Users\RG\.openclaw\workspace\projects\garden-planner"
git push  # Vercel handles the rest
```

**Android only (already pushed to GitHub):**
```powershell
cd "C:\Users\RG\.openclaw\workspace\projects\garden-planner\app"
$env:JAVA_HOME = "C:\Program Files\Android\Android Studio\jbr"
npm run build; npx cap sync android; cd android; .\gradlew assembleDebug
$adb = "C:\Users\RG\AppData\Local\Android\Sdk\platform-tools\adb.exe"
& $adb install -r "app\build\outputs\apk\debug\app-debug.apk"
```

---

## Reference: Complete Pack File List
_63 pack files archived at: `memory/deep/garden-planner/workflows-archive.md`_

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
