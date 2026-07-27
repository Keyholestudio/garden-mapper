# Garden Planner — Project Lessons
_L001–L009, L016–L019, L020, L026, L027, L028 archived at: `memory/deep/garden-planner/lessons-archive.md`_

## L046 — Sticker prompt amendments: how to apply them correctly (2026-07-27)

### The problem this fixes
When Rob says "regenerate X with cyan background" or "add to the prompt: [text]", two bugs were occurring:
1. **Duplicate background colours** — the prompt builder was hardcoding `flat solid magenta background (#FF00FF)` after the colours string, so if the colours string already contained a background spec (e.g. cyan), both ended up in the prompt. Gemini then generated split cyan+magenta backgrounds.
2. **Shape text ignored** — the `else` branch in the prompt builder was hardcoding `"Correct proportions. No roots."` instead of using the `shape` field from PLANT_LOOKUP. So any custom shape text added to PLANT_LOOKUP was silently discarded.

### Rules for applying prompt amendments

**When Rob says "regenerate X with [colour] background":**
1. Update PLANT_LOOKUP `colours` string — **remove any existing `flat solid X background (#XXXXXX)` spec** from the colours string entirely
2. Do NOT add the background spec to the colours string. The prompt builder handles the BG line separately now.
3. Update the background in the PLANT_LOOKUP `colours` string only if it affects plant colour decisions (e.g. "no magenta petals"). Otherwise leave colours alone.
4. The correct place to set BG is: add a `flat solid X background (#XXXXXX)` note anywhere in the colours string — the builder will detect and isolate it cleanly.

**When Rob says "add to the prompt: [text]":**
1. That text goes into the `shape` field (7th element) of the PLANT_LOOKUP tuple, not the colours string
2. Replace or append to the existing shape text — do not add it as a colour
3. The `else` prompt template uses `{shape}` verbatim — whatever is in shape goes directly into the prompt
4. Confirm the edit by printing the assembled prompt before generating

**When Rob provides a corrected prompt from Gemini:**
1. Cross-check it against the current PLANT_LOOKUP entry
2. Identify any conflicts (duplicate BGs, missing additions, wrong text)
3. Fix PLANT_LOOKUP to match Rob's intent — not just copy-paste the broken Gemini prompt back in

### How the prompt builder works (as of 2026-07-27)
```
colours string (from PLANT_LOOKUP)
  → strip any existing background spec
  → if colours had a bg spec: use it
  → else: append default magenta (#FF00FF)
  → combine as single colours_line

shape string (from PLANT_LOOKUP)
  → inserted verbatim into Shape: field
  → NOT overridden by template hardcoding
```

### Background removal: always auto-detect from raw image corners
Do NOT rely on the colours string to decide which chroma to remove. Gemini doesn't reliably follow background colour instructions. Always sample the actual raw image corners to determine the background colour, then pass `--chroma RRGGBB` to the pipeline accordingly. See `detect_background_chroma()` in `sticker-generate-one.py`.

**Split backgrounds (cyan + magenta):** Gemini sometimes generates a half-cyan half-magenta background. When corner sampling detects two distinct chromas, run the pipeline twice — magenta pass first, then cyan pass on the output.

---

## L045 — Chroma key background colour system (2026-07-26)
**The full process for generating stickers with different background colours:**

### Background colour options
| Background | Hex | Use when |
|---|---|---|
| Magenta | `#FF00FF` | Default. Any plant that does NOT have pink/red/purple petals or cyan tones |
| Cyan | `#00FFFF` | Plants with pink, red, magenta, or purple petals (avoids colour bleed) |
| Magenta | `#FF00FF` | Plants with cyan/blue tones (e.g. delphinium, foxglove, blue deckle hydrangea) |

**Rule of thumb:** If the plant colour is close to magenta → use cyan. If close to cyan → use magenta.

### How to generate with a specific BG colour
**sticker-generate-one.py** — uses magenta by default. Prompt in PLANT_LOOKUP includes the BG hex.

**sticker-custom-prompt.py** — supports `--cyan` flag:
```powershell
# Magenta BG (default)
& $python sticker-custom-prompt.py "sticker-id" $prompt

# Cyan BG
& $python sticker-custom-prompt.py "sticker-id" $prompt --cyan
```
Include the BG colour in the prompt text too: `flat solid cyan background (#00FFFF)` or `flat solid magenta background (#FF00FF)`

### Pipeline scripts
- `tools/sticker-pipeline.py` — removes magenta `#FF00FF` background (default)
- `tools/sticker-pipeline-cyan.py` — removes cyan `#00FFFF` background

Both do: chroma key removal → edge spill suppression → watermark erase → crop → resize to 512px

The cyan pipeline suppresses G+B spill (cyan spill = G and B elevated above R). The magenta pipeline suppresses R+B spill.

### How sticker-custom-prompt.py picks the right pipeline
The `--cyan` flag in `sticker-custom-prompt.py` routes to `sticker-pipeline-cyan.py` instead of the default:
```python
pipe = PIPELINE_CYAN if "--cyan" in sys.argv else PIPELINE
subprocess.run([PYTHON, pipe, raw_path], check=True)
```

### Processing Rob's own Gemini images
If Rob creates an image in Gemini and sends it via Telegram:
1. Image lands in `C:\Users\RG\.openclaw\media\inbound\<filename>.jpg`
2. Run the appropriate pipeline directly:
```powershell
$python = "C:\Users\RG\AppData\Local\Python\bin\python3.exe"
$pipeline = "projects/garden-planner/tools/sticker-pipeline-cyan.py"  # or sticker-pipeline.py
& $python $pipeline "path\to\inbound\file.jpg"
# Output: file_nobg.png alongside the input
```
3. Copy `_nobg.png` to `app/public/stickers/<correct-name>.png`

## L044 — Gemini CDP download doesn't save to disk (2026-07-26)
**What:** Clicking Gemini's download button via CDP shows "Image downloaded" toast but no file appears in Downloads.
**Why:** The blob URL expires immediately after the click; CDP click doesn't trigger Brave's native save dialog.
**Fix:** Ask Rob to send the image via Telegram instead. Process it through `sticker-pipeline-cyan.py` directly from `C:\Users\RG\.openclaw\media\inbound\<filename>.jpg`.
**Works perfectly** — confirmed with Rob's romaine lettuce (2026-07-26).

## L043 — Lettuce colour variant filenames (2026-07-26)
**What:** Lettuce colour variants in useGardenState.js use SHORT filenames without region codes (e.g., `_M_burgundy.png`) unlike all other colour picker variants which include `_CA-US-FR-GB-AU`.
**Why:** Legacy from original setup before region codes were added.
**Fix:** When deploying lettuce variants, always copy to the short filename path. New cyan-generated files have region codes — strip them when copying to `public/stickers/`.

## L042 — Brave Debug: attach don't launch (2026-07-22)
**What:** `sticker-generate-one.py` tries to open Gemini itself if it can't find a tab — which spawns a new Brave instance instead of attaching to the existing debug one.
**Root cause:** Port 9222 responds but returns no tabs when Brave was launched without the debug flag on the main process.
**Correct flow:**
1. Rob opens **Brave (Debug)** shortcut on desktop and navigates to gemini.google.com — already logged in as contactsunsetpoetvintage@gmail.com
2. I verify port 9222 is live: `Invoke-RestMethod http://127.0.0.1:9222/json/list`
3. Run the sticker script — it attaches to the existing tab, no new windows opened
**Rule:** Never kill or relaunch Brave when Rob says it's already open. Verify port 9222, then run. If tabs show empty, ask Rob to navigate to Gemini — don't open it myself.

## L041 — Batch copy from pending/ must filter by prefix (2026-07-21)
**What:** Batch-copying all `*.png` from `pending/` to `app/public/stickers/` accidentally deleted `plant-fern_lady-fern` because it was also in pending and got overwritten/removed.
**Fix:** Always filter by the specific key prefix being committed (e.g. `herb-*` or `plant-fern_*`) — never copy the entire pending folder wholesale.
**Rule:** `Get-ChildItem "$pendingDir\<prefix>-*.png" | Where-Object { $_.Name -notlike "*_raw*" -and $_.Name -notlike "*test*" }`

## L037 — MobileSheet and PlantTray are completely separate (2026-06-26)
**What:** Fixes to PlantTray do nothing on mobile. On mobile (`isMobile=true`) the app renders MobileSheet, NOT PlantTray. They share no code.
**Why it matters:** Lazy pack wiring, image loading logic, src fallbacks — any change must be made in BOTH components or it only works on one platform.
**Rule:** When fixing plant tray behaviour, always check both `PlantTray.jsx` AND `MobileSheet.jsx`.

## L038 — Pack entries use `key` not `src` — always use fallback (2026-06-26)
**What:** Lazy pack entries (cacti, ferns, etc.) have a `key` field but NO `src` field. Core catalog entries have both.
**Symptom:** Images silently fail to load. Tray shows grey placeholders forever. No console error visible.
**Fix everywhere `src` is used with pack entries:**
```js
entry.src || `/stickers/${entry.key}.png`
```
**Applies to:** PlantTray TrayItem render, MobileSheet plant grid render, MobileSheet recents render, GardenEditor image preloader (`p.src || ...`).
**Rule:** Never use `entry.src` alone on any entry that could be from a lazy pack.

## L039 — `--force` on sticker generator deletes raw before generating (2026-06-26)
**What:** `sticker-generate-one.py --force` immediately deletes the existing raw + PNG, THEN tries to generate. If Gemini times out after deletion, the original is gone permanently.
**Fix:** Before using `--force`, confirm Gemini is responsive (not showing reload icon). If unsure, manually back up the raw first.
**Rule:** Never use `--force` speculatively. Use it only when Gemini is confirmed ready.

## L040 — Gemini image gen: 13% watermark clip is the sweet spot (2026-06-26)
**What:** Gemini watermark in bottom-right corner. Pipeline erases a square corner region.
- 10% = logo still visible
- 13% = logo gone, plant fronds intact (sweet spot for most images)
- 15% = current pipeline default (acceptable, occasionally clips plants)
- 20% = original default, visibly clips plant corners
**Pipeline file:** `tools/sticker-pipeline.py` — `TOLERANCE=100, SOFT_RANGE=55`
**Note:** White BG images use `reprocess-white-bg.py` — same 13% sweet spot applies.

---

## L036 — Supabase + Google OAuth: setup rules and common failure modes
**Date:** 2026-06-18

### Config checklist (verify before any auth debugging session)
| Item | Where | What to check |
|------|-------|---------------|
| Client ID | Google Cloud Console → Credentials → Web client | Must match exactly what's in Supabase → Auth → Providers → Google |
| Client Secret | Google Cloud Console → Credentials → Web client | Must match exactly — this was the root cause today (`invalid_client`) |
| Authorized redirect URI | Google Cloud Console → Web client | Must include `https://oxecjcdxkmtdgmdxlxyt.supabase.co/auth/v1/callback` exactly |
| Publishing status | Google Cloud Console → OAuth consent screen → Audience | Must be **In production** — Testing mode = only whitelisted emails can sign in |
| Flow type | `app/src/supabase.js` | Must be `flowType: 'implicit'` — PKCE breaks Capacitor external browser deep-links (code verifier lost between browser contexts) |

### Root causes found today (in order of discovery)
1. **OAuth consent screen in Testing mode** — `unexpected_failure` for any non-whitelisted user. Fix: publish the app.
2. **Wrong client secret in Supabase** — `invalid_client` error in Supabase auth logs. Fix: copy secret fresh from Google Cloud Console.
3. **PKCE flow breaks Capacitor deep-links** — `invalid flow state, no valid flow state found`. Fix: use `implicit` flow only.

### Rules
- Never change `flowType` away from `implicit` for this app — PKCE requires shared storage between the authorize call and callback, which breaks across external browser contexts
- When auth breaks: check Supabase Auth Logs first — the error message is specific and diagnostic
- If `unexpected_failure`: check OAuth consent screen publishing status
- If `invalid_client`: re-copy the client secret from Google Cloud Console into Supabase
- If `invalid flow state`: flowType mismatch — revert to implicit
- Keep a note of the Client ID: `284573774009-9qvn...` — verify it matches Supabase if credentials are ever rotated
- **Supabase free tier pauses after ~7 days of inactivity** — DNS will fail (`NXDOMAIN`) with no other warning. Always check project status at https://supabase.com/dashboard/project/oxecjcdxkmtdgmdxlxyt first when auth or API calls fail. Fix: click Restore (~2 min). Add this to the login troubleshooting checklist.

---

## L035 — Pipeline: keep it simple — edge-only spill, no second passes
**Date:** 2026-06-18
v9 pipeline added aggressive second-pass spill suppression on ALL visible pixels + white-border detection loop. This broke the output: grey halos remained, magenta wasn't being fully removed, some images had no BG removal at all.
**Fix:** Revert to the same simple structure as the working green pipeline (v4): chroma key distance → alpha, edge-only spill suppression (semi-transparent pixels only), 20% corner erase for watermark. Port to magenta = just change `CHROMA` target and flip spill logic from green-excess to RB-excess.
**Pipeline:** `sticker-pipeline.py` v10 — this is the current working version.
**Rule:** Do not add multi-pass complexity to the pipeline without testing on multiple raws first. Simple = reliable.

## L034 — Use magenta (#FF00FF) background, not green, for sticker generation
**Date:** 2026-06-18
Using chroma-key green (#00FF00) with tolerance=80 caused internal plant colour bleed — mid-greens inside leafy plants were partially erased. Switch to magenta (#FF00FF) avoids this since plants rarely contain magenta.
**Pipeline:** `sticker-pipeline.py` v10. Tolerance=80, soft_range=40, edge-only spill suppression, 20% corner watermark erase.
**Rule:** Always use magenta background. Never revert to green.

## L033 — Always sync TEMPLATES dict before generating stickers
**Date:** 2026-06-18
The `TEMPLATES` dict in `tools/sticker-generate-one.py` contained stale wording ("Plants vs. Zombies meets watercolor painting") that didn't match `research/STICKER-PROMPT-GUIDE.md` ("watercolor painting" only). Result: 4 pome fruit stickers were generated with the wrong art style directive.
**Rule:** Before any sticker generation session, confirm `TEMPLATES` dict matches `STICKER-PROMPT-GUIDE.md` Section 1 word-for-word.
**Workflow added:** Workflow 0a in WORKFLOWS.md — "Sticker prompt template sync".
**When Rob says the guide changed:** immediately run Workflow 0a before generating anything.

---

## L032 — Never auto-commit stickers without Rob's explicit approval
**Date:** 2026-06-16
Using `--force` on `sticker-generate-one.py` auto-uploads and commits without Rob seeing the PNG first. This bypasses the approval gate entirely.
**Rule:** Never use `--force` when generating stickers. Always:
1. Generate → lands in `stickers/generated/pending/`
2. Send PNG to Rob via Telegram message tool
3. Wait for explicit "Approve [name]" before copying to `app/public/stickers/` and committing
**Exception:** Rob explicitly says "auto-commit" or "no approval needed for this batch".

---

## L031 — Never delete keys or PNGs without explicit approval; present alternatives first
**Date:** 2026-06-16
When duplicates or orphans are found, the instinct to "clean up" led to deleting 31 catalog entries without permission, breaking the tray and requiring a full revert.
**Rule:** When a cleanup is needed:
1. List exactly what would be deleted and why
2. Present alternatives (e.g. dedup render fix vs. deletion)
3. Wait for Rob to say "go ahead" with specific approval
4. Never delete keys as a side-effect of another fix
**The correct cleanup path for duplicates:** Fix the render layer (dedup filter) OR remove from the less-authoritative source — never silently delete from both.

---

## L030 — Sticker script --force bypasses catalog check; always verify placement before batch runs
**Date:** 2026-06-16
The `--force` flag on `sticker-generate-one.py` deletes existing PNGs and re-runs without checking where the sticker should live (catalog vs. pack). Combined with the partial-key match bug, this caused stickers to end up in wrong locations.
**Rule:** Before any batch sticker run:
1. Read L029 — confirm which file (catalog vs. pack) each sticker belongs to
2. Run `validate-tray.ps1` before AND after any batch
3. Never run `--force` without Rob's explicit instruction
4. The script's `add_to_catalog()` uses exact key match — do not revert this

---

## L029 — Plant tray: catalog vs pack separation + duplicate prevention
**Date:** 2026-06-16

### Rule: Pack entries must NEVER appear in usePlantCatalog.js
- `usePlantCatalog.js` = core catalog only (original ~144 stickers)
- `pack-cacti-succulents.js`, `pack-tropical.js`, etc. = lazy-loaded packs
- If a key exists in both, the item appears **twice** in the plant tray (duplicate)
- Hedgehog/Bunny Ears/Old Man were grey because they were only in the pack file, not the catalog, AND the script's partial-key check falsely said "Already in catalog"

### Root cause of the bug
`add_to_catalog()` checked `if plant_id in content` — this matched on partial string (e.g. `cactus_hedgehog` matched inside a comment block). Fixed to `if f"key:'{plant_id}'" in content` (exact key match).

### Where new stickers go
| Type | Where to add |
|------|-------------|
| Core plant (herb, flower, veg, shrub, tree) | `usePlantCatalog.js` |
| Cactus / Succulent | `pack-cacti-succulents.js` ONLY |
| Palm / Tropical | `pack-tropical.js` ONLY |
| Future packs | Their pack file ONLY |

### Daily tray validator
A cron runs daily at 9 AM ET (topic 3954) via `tools/validate-tray.ps1`. It checks:
1. Every sticker key in all pack + catalog files has a matching PNG in `app/public/stickers/`
2. No key appears in more than one source (catalog + packs)
3. Reports missing PNGs and duplicates

---

## L025 — Sticker continuity: never delete a key, only replace/alias/retire
**Date:** 2026-06-09 | Updated 2026-07-21
Saved gardens store **keys**, not paths. Missing key = silent broken image.
- **Replace:** overwrite PNG in-place (both `app/public/stickers/` + `stickers/`), key unchanged. Commit: `"Stickers: replace [name] image in-place"`
- **Rename:** keep old key pointing to new file + add new key alongside
- **Retire:** mark `hidden:true` in catalog — hides from menus, still renders in saves. Never delete PNG.
- **Missing PNG:** shows grey `?` tile — restore via `git checkout HEAD -- stickers/<file>.png app/public/stickers/<file>.png`, then Ctrl+Shift+R
- **Adding:** follow L023 checklist
- **What broke June 9:** deleted `decor_pot-s/m/l` keys → broken images in any garden with old pots

### ✅ Pre-commit checklist for any sticker update/reprocess
Run this before every sticker commit — reprocess or new:

1. **Key unchanged** — confirm the `key` field in the pack/catalog JS is identical before and after. Never rename a key.
2. **Both paths updated** — PNG replaced in both `app/public/stickers/` AND `stickers/`. Missing either = broken on web or broken in pipeline.
3. **Pack entry exists** — run `Select-String -Path "app/src/data/packs/*.js" -Pattern "<key>"` to confirm the key is registered. New PNGs without a pack entry = invisible plant.
4. **Key/src consistency** — if a pack entry uses a short key (e.g. `herb-culinary_oregano`), the `src` field must point to the full filename. Never rely on `key` → filename inference alone.
5. **Run the validator** — `node tools/validate-stickers.js`. Check for MISSING entries (broken) not just ORPHAN files (harmless).
6. **Approve before commit** — send PNG to Rob via Telegram. Wait for explicit approval. No auto-commit on reprocesses.
7. **Test on live garden** — after deploy, hard-refresh and confirm the updated plants render (not `?` tiles) in a saved garden that already contains them.

### Root causes from July 2026 incident
- 4 new stickers (Mugwort, Rue, Sweet Marjoram, Wormwood) committed to `app/public/stickers/` with no pack JS entry → invisible
- Pre-existing race condition: pack images loaded async after garden restore → plants placed with placeholder, never swapped. Fixed 2026-07-21: pack image loader now swaps placeholders on canvas after each pack resolves.

---

## L024 — Dev server: kill stale Vite when changes aren't showing
**Date:** 2026-06-09 | Updated 2026-06-10
**Dev:** localhost:5200. **Live:** https://app.gardenmapper.ca (Vercel, ~15s from push). No tunnel.
Stale instances accumulate on 5200–5203 silently. Kill: `Get-NetTCPConnection -LocalPort 5200,5201,5202,5203 -State Listen | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }`. Or use `restart.bat`.

---

## L023 — Checklist: adding a Decor item to the menu
**Date:** 2026-06-09
**4 files + 2 PNG locations.** Miss one = item missing, broken placement, or broken image.

| # | What | Where |
|---|------|-------|
| 1 | PNG (processed, bg removed) | `app/public/stickers/<id>.png` + `stickers/<id>.png` |
| 2 | Catalog entry | `usePlantCatalog.js` — `family:'Decor'`, `key`=filename without `.png` |
| 3 | Placement entry | `GardenEditor.jsx` → `DECOR_CATALOG` — object key must match toolMenuData id |
| 4 | Menu button | `toolMenuData.jsx` → correct group's `children`: `{ id, label, hint }` |
| 5 | Prompt ref | `research/DECOR-PROMPT-GUIDE.md` |
| 6 | Commit | `"Decor: add [name]"` |

**Fountains:** use `FOUNTAIN_CATALOG` + `waterSubTool`, not `DECOR_CATALOG`.
**Plants:** only need `usePlantCatalog.js` + PNG.
**New PNGs:** Vite doesn't hot-reload them — Ctrl+Shift+R after adding.

---

## L022 — Decor items must never appear in the plant tray
**Date:** 2026-06-08
**Rule:** Any new item added to the Decor menu (tables, stones, fountains, loungers, arches, etc.) must have `family: 'Decor'` (or `'Water Feature'` for water items). These families are filtered out of the plant tray via `PLANT_CATALOG_TRAY` in `usePlantCatalog.js`.
**Do not** use a plant-style family (e.g. `'Perennial'`, `'Shrub'`) for decor items — it will make them show up in the plant list.
**Filter lives in:** `usePlantCatalog.js` → `DECOR_FAMILIES` set. If adding a new non-plant family, add it to that set too.

---

## L021 — Pinch-to-zoom: disable draggable on shapes, not just layer listening
**Date:** 2026-06-07
Konva's drag handler latches onto a shape from finger 1 before the second finger registers as a pinch. `layer.listening(false)` doesn't interrupt an in-progress drag. `tr.nodes([])` only affects transformer anchors.
**Fix:** On `e.touches.length === 2`: `Konva.DD?.reset()`, then `n.draggable(false)` on all shapes. After pinch end (120ms): restore `draggable(true)`, call `onPinchEnd` to re-apply lock state.
**Files:** `GardenCanvas.jsx` (touch handlers), `GardenEditor.jsx` (`onPinchEnd` + `transformstart` guard `e.evt.touches.length >= 2`).

---

## L015 — MobileSheet: always destructure new props at the top
**Date:** 2026-06-02
MobileSheet uses nested `function renderPlantPanel()` / `renderStructPanel()` — these close over the component's props. Adding a prop reference inside a render function without adding it to the destructuring list at the top causes a silent `undefined` that only crashes at runtime when that panel renders.
**Rule:** Any time you add a prop to MobileSheet's JSX, immediately add it to the `export default function MobileSheet({...})` destructuring. Check the list before committing.
**Caught by:** `onCopyPlant is not defined` crash on mobile plant select (commit `c06ef28`).

---

## L010 — Git commit discipline
**Date:** 2026-05-29
Every confirmed working change must be committed immediately — not batched at end of session.
**Rules:**
1. After ANY confirmed working change: `git add -A && git commit -m "description"`
2. Before creating a new version file: commit current state first
3. At session end: always run `git status` — nothing uncommitted
**Revert:** `git checkout <hash> -- <file>` (hash from `git log --oneline`)

---

## L011 — Reflect before patching. Read before acting. Reference the legend.
**Date:** 2026-05-29
Don't patch from memory. Read the actual file before editing. Reference ARCHITECTURE.md before touching any hook, util, or Konva layer. One fix at a time — verify compile + behaviour before moving on. If stuck after 2 attempts, stop and explain before trying again.

---

## L013 — Always pin port in vite.config — never let it float
**Date:** 2026-06-01
Vite auto-increments port if the target is occupied. Without a fixed port, Garden Mapper steals 5173 from Market Map if started first or if Market Map isn't running. Always set `port: 5200` in vite.config so it never collides.
**Garden Mapper = 5200. Market Map = 5173. Never swap.**

---

## L012 — Reference v8 before solving any canvas/visual/coordinate problem
**Date:** 2026-05-31
v8 has working Konva math. The React scaffold is a port of v8, not a rewrite. Before writing any positioning, coordinate conversion, drawing, or visual behaviour — read v8 first. If v8 has it, copy it exactly and adapt for React.
**Applies to:** getClientRect, coordinate transforms, pan/zoom math, shape drawing, preview lines, highlights.
