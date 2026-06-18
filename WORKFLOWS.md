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

**Step 1 — Plan it (PLANT-DATABASE.md first)**
- Add a row to `research/PLANT-DATABASE.md` before touching any code
- Fill in: Common Name, Latin Name, Family Group, Regions, Size, Pack (`core`), Traits, Search Terms, Variants
- This locks the key name, size, and search metadata before generation

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

> Use this for: cacti, succulents, palms, tropicals, ferns — anything that lives in a `pack-*.js` file.

**Step 1 — Plan it (PLANT-DATABASE.md first)**
- Same as above. Pack column = the pack file name (e.g. `pack-ferns-woodland`)

**Step 2 — Confirm the pack file exists**
- Check `app/src/data/packs/` — if the pack file doesn't exist yet, do [Workflow 3](#3-create-a-new-pack-file) first

**Step 3 — Generate + approve**
- Same as Workflow 1, Steps 2–3

**Step 4 — Commit (only after approval)**
1. Copy PNG → both sticker locations (same as above)
2. Add entry to the correct pack file (e.g. `pack-ferns-woodland.js`) — **NEVER to `usePlantCatalog.js`**
3. Run `pwsh tools/validate-tray.ps1` — 0 errors required
4. Update `research/PLANT-DATABASE.md` → fill in Sticker ID
5. `git add -A && git commit -m "Sticker: add [Name] ([key]) to [pack name]"`
6. `git push`

**Duplication rule:** A key must appear in exactly ONE file — catalog OR one pack. Never both.

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

**Note:** Core catalog plants are NOT migrated to new packs without explicit planning session. Deferred — see PROJECT.md.

---

## 4. Add a colour variant to an existing plant

> Use this for plants that have meaningful cultivar colour differences (e.g. Maple, Lettuce).

**Step 1 — Plan it**
- Check `COLOUR-VARIANTS.md` for the rollout plan and current chunk
- Confirm the plant is in the current chunk before starting

**Step 2 — Generate variant stickers**
- Each colour = its own PNG, with a descriptive key suffix (e.g. `tree-deciduous_maple_dark-green`)
- Generate via `sticker-generate-one.py`, no `--force`
- Pending PNGs → open folder for Rob to review

**Step 3 — Approval**
- Rob approves each variant individually
- "Approve all" allowed for a confirmed batch

**Step 4 — Commit**
1. Copy approved PNGs to both sticker locations
2. Add the variant entries to `PLANT_VARIANTS` in `usePlantCatalog.js`:
   ```js
   'plant_key': [
     { label: 'Colour Name', src: '/stickers/key-colour.png', hex: '#RRGGBB' }
   ]
   ```
3. Update `research/PLANT-DATABASE.md` → Variants column = `done`
4. Run validator — 0 errors
5. `git add -A && git commit -m "Variants: add [Plant] colour swatches ([N] colours)"`

**Note:** `variantSrc` is user-only — adding new variants never changes existing saved gardens.

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
