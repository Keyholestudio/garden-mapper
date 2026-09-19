# Garden Planner — Project Lessons
_L001–L009, L016–L019, L020, L026–L028, L030–L053 archived at: `memory/deep/garden-planner/lessons-archive.md`_

## L092 — Non-plant packs MUST have family fields matching DECOR_FAMILIES (2026-09-19)
**What happened:** Created `pack-decor.js` without `family` fields on entries. The tray filter (`PLANT_CATALOG_TRAY`) only filters the core catalog by `DECOR_FAMILIES` — lazy pack entries bypassed it entirely and leaked gates, fences, fountain, patio table into the plant tray.
**Root cause:** Two separate filter paths: core catalog filtered at definition time, lazy pack entries merged raw into `allEntries` in PlantTray with no family filter applied.
**Fix:** (1) Add `family: 'Decor'` or `family: 'Water Feature'` to every entry in non-plant packs. (2) Apply `DECOR_FAMILIES` filter to lazy pack entries in PlantTray `allEntries` useMemo.
**Rule:** Any new pack whose content should NOT appear in the plant tray must: (a) set correct `family` fields on all entries, AND (b) confirm those family names are in `DECOR_FAMILIES` in `usePlantCatalog.js`. Verify in the tray before deploying.

## L091 — Lotus / white-flower plants can't use chroma key (2026-09-18)
**What happened:** Lotus petals are white/pale pink — similar to any bright background. Tried magenta, cyan, red, orange — Gemini always generates dark purple BG for lotus regardless. Even rembg (AI removal) ate the white petals.
**Root cause:** Gemini hardcodes a dark/moody background for lotus regardless of prompt. White petals can't be separated from bright backgrounds by colour. rembg treats white petals as background.
**Fix:** Dark purple BG actually works — it's far enough from pink/white petals that chroma key strips it cleanly. Accept that Gemini will use dark purple for lotus and use that as the target colour for stripping.
**Rule:** For plants with white/pale flowers, check the corner colour of the actual raw before assuming the BG is what the prompt specified. Sample corners, use that as chroma target.

## L090 — Dual-tab generation: use from the start (2026-09-18)
**What happened:** Rob pointed out mid-session that we had two Gemini tabs available but were only using one. Could have doubled throughput from the start.
**Fix:** At the beginning of any sticker generation session, navigate both Gemini tabs to fresh sessions via `Page.navigate` to `gemini.google.com/app`, then run two background PowerShell jobs with `--tab 0` and `--tab 1` simultaneously.
**Rule:** Always use dual-tab. Split the plant list in half, assign half to each tab job.

## L089 — Chroma key halo = 3 outer rings of contaminated pixels (2026-09-18)
**What happened:** Italian Cypress and others showed a persistent magenta/purple halo after standard pipeline processing.
**Root cause:** Anti-aliasing at BG/subject boundary creates 3-4 rings of BG-colour-contaminated pixels that the standard `dist < 80` threshold doesn't catch.
**Fix:** After primary removal, iterate 3-4 times: find outermost ring of opaque pixels adjacent to transparent, kill pixels matching BG tint. Confirmed ring RGB values for magenta: Ring1=#B925B1, Ring2=#780E72, Ring3=#4E0B4D.
**Rule:** For any sticker with visible halo, add 3-ring strip post-process. Don't go more than 4 rings or you eat into the plant.

## L088 — Cyan vs red vs magenta background choice (2026-09-18)
**Best background per plant type:**
- Magenta (#FF00FF): default for most plants. Avoid for blue/purple-flowered plants (bleeds into edge).
- Cyan (#00FFFF): good for blue/purple plants (water hyacinth, pickerel weed, etc). Avoid for green plants (bleeds into leaves).
- Red (#FF0000): good for green plants where cyan would bleed, and white-flowered plants. Avoid for red/orange-flowered plants.
- Orange (#FF6600): good for blue/purple and white plants. Avoid for orange/yellow plants.
**Gemini ignores bg colour for certain subjects** (lotus, some aquatics) — check raw corner pixels before assuming the bg matched the prompt.

## L087 — "Plants vs animals" prompt artifact (2026-09-18)
**What happened:** Agave and yucca prompts used the deciduous tree template which has "NO TRUNK, NO STEM, NO BARK VISIBLE" language. Gemini produced Plants-vs-Zombies-style stylized results.
**Fix:** Use the `plant` template for architectural/non-tree plants. Write shape descriptions that are direct and plant-specific without tree-specific negations.
**Rule:** Only use the `deciduous` template for actual trees. Use `plant` template for everything else.

## L086 — Re-processing sticker images introduces graininess (2026-09-17)
**What happened:** Daphne sticker had a white border artifact. Tried to fix by re-running chroma key pipeline on the already-processed `_nobg.png` file. Result was grainy/blurry.
**Root cause:** Re-processing an already-processed PNG compounds compression artifacts. The numpy float32 cast + chroma key soft transition creates noise when applied to an image that has already been through background removal.
**Fix:** Always regen from Gemini (fresh generation) when quality is poor. If re-processing from raw is needed: (1) crop white margin first, (2) run official sticker-pipeline.py on the clean crop, (3) resize to tier. Never re-process an already-processed sticker.
**White border fix:** If raw has a white margin around the cyan square — crop to non-white content first, save as temp PNG, then run sticker-pipeline.py with --chroma 00FFFF on the temp file.

## L085 — Sticker TODO list + plant/pack/database standardization (2026-09-17)
**What was built:** `research/STICKER-TODO.md` — single source of truth for unbuilt stickers. Auto-generated by comparing PLANT_LOOKUP (in `tools/sticker-generate-one.py`) vs actual PNGs in `app/public/stickers/`. 84 unbuilt, 234 built as of 2026-09-17.
**Key rules:**
1. **Ground truth = `app/public/stickers/`** — the actual PNG files in the app. Not PLANT_LOOKUP, not the pack JS files, not PLANT-DATABASE.md. If a PNG is there, the plant is built.
2. **STICKER-TODO.md = the checklist** — grouped by pack, wild items flagged `<!-- WILD - do last -->`, poppies noted as pending decision. Check off `- [x]` as each sticker is committed.
3. **Wild/non-garden plants flagged in PLANT_LOOKUP** with `# 🌿 WILD — do last` comment. 9 flagged entries: marsh fern, samphire, cape gooseberry, luffa, garland chrysanthemum, water spinach, sea kale, turkish rocket, sloe/blackthorn.
4. **Pack JS files** (`app/src/data/packs/`) have priority annotations in their header comments: `✅ DO FIRST` (pure garden plants) or `⚠️ MIXED` (some wild). All-complete packs have no annotation.
5. **PLANT-DATABASE.md** (`research/PLANT-DATABASE.md`) — detailed reference with Latin names, regions, traits. Not a reliable built/unbuilt tracker (column parsing is fragile). Use `app/public/stickers/` for that, not this file.
6. **Regenerating the TODO list:** Run `check_unbuilt` script pattern (compare PLANT_LOOKUP sticker IDs vs built PNG base IDs) — do not rely on pack JS entry count, those only reflect what's been added to pack files, not what's been generated.
7. **Pack JS files are NOT the source of truth for built status** — a plant can be generated + committed to `app/public/stickers/` before its pack JS entry is added. Always check the PNG folder.
8. **DO FIRST packs (10):** fruit-berry, fruit-citrus, fruit-melons, fruit-nuts, fruit-stone (mostly), fruit-tropical, fruit-vine, vegetables-brassica, vegetables-bulb, vegetables-legumes.
9. **MIXED packs (5):** vegetables-asian-greens, vegetables-fruiting, vegetables-perennial, vegetables-stem, ferns-woodland.
10. **Wildflower poppy decision still pending** as of 2026-09-17: field poppy + california poppy generated (in raw-archive), held pending Option A (separate stickers) vs Option B (colour variants).


## L084 — Dual-tab parallel sticker generation workflow (2026-09-16)
**What was built:** Two Gemini tabs in Brave Debug + two sub-agents, each targeting a tab by index via `--tab N` flag. Generates 2 stickers simultaneously — roughly 2x throughput.
**Key rules:**
1. **Prep PLANT_LOOKUP entries BEFORE spawning generators** — script exits immediately if plant isn't in lookup. Caused wasted runs early in the session.
2. **`Page.navigate` not button click** — `navigate_fresh()` now uses CDP `Page.navigate` to `gemini.google.com/app`. The old "New chat" button click caused race conditions where both tabs landed on the same session. CDP navigate is tab-specific and atomic.
3. **Telegram preview send from subprocess fails** — `openclaw` CLI hangs when called from Python subprocess. Fixed by removing the subprocess call entirely; main agent sends previews via message tool after each batch completes.
4. **Tab URLs must be distinct** — if both tabs show the same `/app/<id>` URL after navigation, they may share a session. `Page.navigate` to `/app` (no suffix) guarantees a fresh conversation.
5. **Batch approvals are faster** — Rob approves per batch (not per plant). Send all previews at once after both subagents finish; commit as one batch.
6. **Transient blob fetch failures are normal** — ~1 in 5 plants fails on first attempt. Script auto-retries once. If it still fails, spawn a `--force` retry as a separate sub-agent.

## L083 — Sticker asset size audit: PNG files are large, WebP conversion needed (2026-09-16)
**What:** Asset check revealed 380 stickers averaging 326 KB each — total 121 MB. 4 files were oversized (never resized by pipeline): phlox (1,171 KB at 1221px), two gazebos (~1,600 KB at 1256px). Fixed by resizing to correct tier sizes (M=256px, XL=512px) via Pillow Lanczos.
**Standing rule:** Always verify new stickers are at correct pixel dimensions. M=256px, S=160px, XS=96px, L=384px, XL=512px, XXL=512px.
**Next step:** WebP batch conversion would cut average size from 326 KB to ~70-100 KB. Do as a standalone session.

## L082 — Field Poppy / California Poppy are distinct plants, not variants of core Poppy (2026-09-16)
**Decision pending:** Core `poppy` sticker (`flower-daisy_poppy`) is the Oriental/garden poppy. Field Poppy (scarlet corn poppy) and California Poppy (orange, ferny foliage) look completely different — not colour variants, separate plants. Decision deferred to next session: Option A = separate tray stickers, Option B = colour variants under poppy with named labels.

## L081 — New plant packs must use the lazy pack system, never PLANT_CATALOG (2026-09-16)
**What happened:** Perennial stickers (Rudbeckia, Catmint, Shasta Daisy, Verbena, Gypsophila, Yarrow, Monarda) were added directly to `PLANT_CATALOG` in `usePlantCatalog.js`, which is always bundled and loaded at boot. This bloats the core bundle for every user.
**Rule:** All new plants go into a lazy pack file (`app/src/data/packs/pack-<name>.js`), registered in `index.js`. `PLANT_CATALOG` is core-only (backward compat). Never add new families to it.
**Pack sizing rule:** Minimum ~10 plants per pack before creating. Don't ship a pack with 1-2 stickers — accumulate the full batch first, then create the pack and register it in one commit.
**See:** Workflow 13 (Create / populate a lazy pack)

## L080 — Browser onload does not fire for cached images (2026-09-11)
**What happened:** Decor variant images restored correctly on first page load, but on refresh (when browser had images cached) the variant swap never applied — stickers reverted to catalog defaults.
**Root cause:** Setting `img.src` to a cached URL may not fire `onload` at all in some browsers. The restore logic relied entirely on `onload`.
**Fix:** After setting `img.src`, immediately check `if (img.complete && img.naturalWidth) applyVariant()` — handles the cached case synchronously.
**Rule:** Any time you use `img.onload` to apply logic after image load, always add the `complete` check immediately after setting `src`. Never assume `onload` fires for cached images.

## L079 — Decor variant panel: 4 places to update when adding a new decor group (2026-09-11)
**What:** Adding a new decor category to the single-tap/colour-picker system requires changes in exactly 4 places.
**Checklist:**
1. `useGardenState.js` → add key to `DECOR_VARIANTS` with `[{label, subtitle, size, colour, src}]`
2. `toolMenuData.jsx` → replace group+children entry with single flat entry `{ id: 'default-variant-id', label: 'Category Name', decorGroup: 'key' }`
3. `GardenEditor.jsx` DECOR_CATALOG → update all variant entries: add `decorGroup`, update `label` to category name, set correct `size`
4. Default placement id in toolMenuData must match the first variant's catalog key (so click-to-place drops the right default sticker)
**Miss any one:** panel falls through to generic plant panel, or wrong sticker placed on first tap.

## L078 — Sticker placement must use aspect-corrected W/H for centering, not raw SIZE (2026-09-11)
**What happened:** All stickers were placed slightly off-center — hit area misaligned with visual content.
**Root cause:** `addPlant()` placed the group at `x - SIZE/2, y - SIZE/2` but `makePlantGroup` adjusts W/H for aspect ratio. Non-square images render smaller than SIZE in one dimension, so the center was wrong.
**Fix:** Compute `_W` and `_H` from the loaded image's natural aspect ratio before calling `makePlantGroup`, then place at `x - _W/2, y - _H/2`.
**Affects:** ALL stickers, not just decor. Fix committed in `plantUtils.js`.

## L077 — Variant size swap must update Image + hitRect + Group, not just Image (2026-09-11)
**What happened:** Switching between fountain sizes (S/M/L) via colour picker left the bounding box and grab area at the original size.
**Root cause:** `handlePlantVariantChange` only called `konvaImg.width(px); konvaImg.height(px)` — the hitRect and Group kept original dimensions.
**Fix:** On variant swap with `newSize`: (1) compute aspect-corrected W/H, (2) update konvaImg, (3) update hitRect, (4) reposition Group by `(oldW-W)/2` to keep sticker visually centered, (5) update Group width/height.
**Rule:** Any time you resize a Konva Image inside a Group, also update the hitRect and Group, and reposition to stay centered.

## L076 — structDataRef restore must include ALL variant fields (2026-09-11)
**What happened:** Picket fence colours reverted to white on every hard refresh despite being saved correctly.
**Root cause:** `useSaveLoad.js` restore block wrote `structDataRef.current[entry.id]` but only included `rockVariant`, not `picketVariant`. So `drawPicketFences` always read `undefined` → fell back to `'white'`.
**Rule:** Any time a new variant/colour field is added to a struct type, it MUST be added in THREE places in `useSaveLoad.js`: (1) the save block, (2) the Group-type save block if applicable, (3) the `structDataRef.current[entry.id]` restore block. Missing any one of these causes silent colour loss on reload.
**Fix commit:** c6b8cf7

## L075 — Iterative async patching creates race conditions — do a clean rewrite instead (2026-09-11)
**What happened:** Spent ~2 hours adding async patches to `addPicketsToGroup` and `buildPicketFenceGroup` to fix colour loss, making the problem worse each time. Multiple async paths competed to render the same fence, with unpredictable winner.
**Root cause:** Each fix added another async render path without removing the old one. 4 separate places ended up calling `addPicketsToGroup` on overlapping async timelines.
**Rule:** When a rendering function has async timing issues, don't patch it — rewrite the render pipeline with a single clear owner:
1. Builder (`buildPicketFenceGroup`) — builds structure only, no rendering
2. Renderer (`addPicketsToGroup`) — pure sync, requires images already loaded, never self-triggers
3. Orchestrator (`drawPicketFences`) — single call site, preloads all images first, then renders synchronously
**Fix commit:** 4e9517e

## L074 — Async race: multiple render paths writing to same Konva Group (2026-09-11)
**What happened:** `buildPicketFenceGroup`, `drawPicketFences`, and `addPicketsToGroup` all called each other's render paths on overlapping async timelines. Whichever finished last "won" — sometimes white, sometimes correct.
**Symptom pattern:** Black/blue showed correctly (small files, loaded fast), red/cedar/sage showed white (larger files, lost the race).
**Rule:** One Konva Group should have exactly one code path responsible for its visual render at any given time. If multiple async paths can render the same node, you have a race condition. Identify the single owner and remove all others.

## L073 — Never start or restart the Vite dev server via OpenClaw exec (2026-09-11)
**What happened:** Every time `npm run dev` was run through OpenClaw exec, the session timed out (SIGKILL) and killed the Vite process with it. This caused repeated "server not loading" reports, wasted debugging time, and nearly crashed OpenClaw.
**Root cause:** OpenClaw exec sessions have a ~60s timeout. Vite is a long-running process — it gets SIGKILL'd when the exec session dies.
**Fix:** Rob starts the dev server manually via the **"Garden Mapper Dev Server"** desktop shortcut. It stays alive as long as that terminal window is open.
**Rule:** I never start or restart `npm run dev`. If localhost:5200 is down, I tell Rob to double-click the desktop shortcut. I do not run any start/stop/restart commands for the Vite server.
**Shortcut:** `C:\Users\RG\Desktop\Garden Mapper Dev Server.lnk` → runs `start-dev.bat`

## L072 — LogoBar.jsx has two render paths that must be kept in sync (2026-09-08)
**What happened:** Profile menu icons were inconsistent between mobile and desktop — 🖸 instead of 🖨 for Print, 🚲 instead of 🚪 for Sign Out.
**Root cause:** `LogoBar.jsx` has an early-return mobile render path and a separate desktop render path. Both contain a full copy of the profile menu JSX. They were edited independently and drifted.
**Rule:** Any change to the profile menu must be made in BOTH blocks. Always grep for the item text (e.g. "Print your Plan") to find both locations before editing.
**Fix commit:** `9956da5`

## L071 — Android grey placeholder fix: root cause was stale Konva nodes, not image loading (2026-09-08)
**Symptom:** ~50% of plant stickers showed grey question-mark placeholders on Android app cold open. Random images failed each time. Leaving the app open did NOT fix it. Manually re-loading the garden via "Your Gardens" fixed it instantly.
**Red herrings pursued:** Concurrent image loading, Capacitor thread pool contention, batch size, retry count — none of these were the cause.
**Root cause:** `loadGarden()` in `useSaveLoad.js` creates Konva `Image` nodes at render time using `loadedImages[entry.key] || makePlaceholderImage()`. On native (Capacitor), images stream in sequentially AFTER the garden renders. Konva nodes get placeholders. When `loadedImages` state fills in later, nothing tells Konva to update the existing nodes.
**Why re-loading worked:** triggered a fresh `loadGarden()` call which re-created all Konva nodes with the now-loaded images already in memory.
**Fix:** Added `useEffect` in `GardenEditor.jsx` watching `loadedImages`. On each update, walks the plant layer and calls `konvaImg.image(realImg)` + `plantLayer.batchDraw()` for any node whose image doesn't match the loaded one. Same pattern as the lazy pack image swap (already proven).
**Key diagnostic question:** "Does manually re-loading the garden fix it instantly?" If yes → stale Konva nodes, not a loading problem.
**Commits:** `b494ce2` (retry fix), `0e17e81` (GardenEditor retry), `ce4a307` (native-aware), `fa76e87` (sequential), `7f52d40` (root cause fix)
**Debug log:** `projects/garden-planner/IMAGE-LOADING-DEBUG.md`

## L070 — App icons vs in-app logos are distinct — never conflate them (2026-09-08)
**What happened:** When cleaning the app icon background, also replaced `garden-mapper-logo-gm.png`, `garden-mapper-logo.webp`, and `stickers/Logo.png` — all distinct in-app logos with their own design purpose. Had to revert.
**Rule:** There are two categories of logo files:
- **App icons** (favicon, PWA icons, Android mipmaps): generated from clean rembg master, white bg, safe zone padding. Touch freely when updating branding.
- **In-app logos** (`garden-mapper-logo-gm.png`, `garden-mapper-logo.webp`, `stickers/Logo.png`): unique designs used inside the app UI. Never replace unless Rob explicitly asks for each one by name.

## L069 — Gemini watermark removal: always scan + vision check before committing (2026-09-08)
**What happened:** Spent multiple back-and-forth rounds removing Gemini watermarks from pot stickers. Each time I thought it was clean, a fragment remained visible in-app.
**Root causes:**
1. Gemini watermarks on these images = TWO sparkle fragments (bottom-left AND bottom-right) + sometimes a horizontal line in the bottom 30px — not just one corner
2. Was iterating on already-edited files instead of restoring from original backup each time
3. Was erasing too conservatively (40px corner) when 100px was needed
4. Not running a mandatory pixel scan + vision check before committing
**Rules:**
- Always restore from original backup before re-editing — never chain edits
- Erase bottom 30px full width + bottom-left 100x100 + bottom-right 100x100 as the starting point
- After editing: pixel scan the erased zones (count non-transparent px — must be 0) AND run vision check asking specifically about all corners
- Do NOT commit until both checks pass
- Full workflow: WORKFLOWS.md section W

## L068 — Always verify prompt template exists before generating (2026-09-08)
**What happened:** Generated stickers using improvised/freeform prompts without checking STICKER-PROMPT-GUIDE.md first. The off-framework prompts weren't caught until after significant generation work had been done.
**Rule:** Before ANY sticker generation, look up the plant's Family Group in `STICKER-PROMPT-GUIDE.md`. If no template exists for that family group — STOP and tell Rob. Never generate from memory or improvisation.
**The line to say:** "No prompt template found for [Family Group] in STICKER-PROMPT-GUIDE.md — do you want to add one before I generate?"
**Added to Workflow 0 Step 4b.**

## L061 — Rock border coordinate system: group.x/y vs flatPoints (2026-08-13)
**The invariant:** `hitLine.points()` = LOCAL coords (relative to group origin). `group.x/y` = world offset. `getShapeWorldPts` = local + group.x/y = world coords.
**dragend handler:** absorbs group.x/y into flatPoints, resets group to (0,0). After any drag, group is always at (0,0).
**Load path:** group restores to `(x: lx, y: ly)`, flatPoints stay as local coords. Do NOT normalize flatPoints on load — that double-offsets them.
**Handle placement:** `h.x = flatPt.x + group.x` (world). **Handle write-back:** `cur[ptIdx] = { x: h.x() - (hitLine.x() + group.x()) }` = local.
**Stone placement:** `addStonesToGroup(group, hitLine.points(), ...)` — stones are children of group, rendered at local coords.
**Rule:** Never add group.x/y to flatPoints at build/load time. Only do it at dragend to normalize.

## L062 — Rock border edit handles: disable Group.draggable + remove dragmove listener during edit (2026-08-13)
**What happened:** In edit mode, dragging one handle caused all handles to jump. On mobile, Konva initiated drag on both the handle (uiLayer) and the Group (structLayer) simultaneously from the same touch.
**Fix:** In `enterEdit` for rock border: `shape.draggable(false)` + `shape.off('dragmove.edithandles')`. Re-enable on `exitEdit`.
**Rule:** Any Konva.Group used as a draggable struct must have drag disabled during point-edit mode.

## L063 — Mobile Konva tap on non-draggable nodes unreliable (2026-08-13)
**What happened:** Remove-mode handles set `draggable(false)` — on mobile, `tap` event didn’t fire reliably on non-draggable Konva.Circle nodes.
**Fix:** Keep handles draggable in remove mode. `dragmove` is already no-op'd via `removingPtRef` check.
**Rule:** On mobile, always keep Konva nodes `draggable:true` if you need tap events on them.

## L066 — Debug overlays: use them earlier, don't guess (2026-08-18)
**What happened:** Spent most of a day guessing at the handle/stone displacement root cause. One screenshot from a debug overlay (showing `hitLine.x/y = (12.7, 259.3)`) confirmed the root cause immediately.
**Rule:** When coordinate bugs appear on mobile and can't be reproduced in DevTools, add an on-screen debug overlay showing the key values. It takes 10 minutes and saves hours.
**Pattern:** `document.getElementById('__debug') || Object.assign(document.createElement('div'), { id:'__debug', style:'position:fixed;top:60px;...' })` then set `.textContent`.

## L067 — Rock border Group architecture: one coordinate model, applied everywhere (2026-08-18)
**What happened:** Rock border has been patched so many times with conflicting coordinate assumptions that Model A (world coords, normalize group to 0,0 on dragend) and Model B (local coords, group accumulates) are now mixed throughout the codebase. This causes stones to jump during drag.
**Rule:** Pick ONE model and make every code path consistent:
- `buildRockBorderGroup` initial flatPoints
- `dragend` normalization
- `addStonesToGroup` input coords
- `getShapeWorldPts` offset calculation
- `makeHandle` write-back
- save/load (lx/ly vs points)
**Before next fix:** Read fence Line drag code. Match rock border to it exactly.

## L064 — Mobile point drift: canvas touch pan vs handle drag race condition (2026-08-13, OPEN)
**Symptom:** In rock border edit mode on mobile, dragging one handle causes other handles to drift from the stone border. Web (mouse) works correctly.
**Root cause (suspected):** `onTouchStart` in GardenCanvas.jsx sets `touchPanStart` on every single-finger touch, including touches on edit handles. If the finger moves even slightly, both stage pan AND handle drag fire. Stage pan shifts the coordinate frame; `h.x()/h.y()` returns position in the shifted frame, which gets written as the wrong local point.
**Fix (not yet applied):** In `onTouchStart`, if `editingShapeRef.current` is set, skip setting `touchPanStart`: `if (editingShapeRef.current) { touchPanStart = null; return }`
**Status:** Open. Next session priority.

## L065 — Always git push immediately after commit — never assume auto-push (2026-08-13)
**What happened:** 5+ commits sat as local-only for hours. Vercel deploys from GitHub. Rob was testing old code the entire time.
**Fix:** Always run `git push origin main` right after `git commit`. Confirm with `git log --oneline origin/main -3`.
**Rule:** Commit + push is one atomic action. Never separate them.

## L057 — Custom struct types: use Konva.Group containing all children, never two separate objects (2026-08-12)
**What happened:** Rock border v1 used an invisible `Konva.Line` + a separate `Konva.Group` of stone images. Any move of the line left the stone group behind as a ghost. Spent ~2 hours on async cancel tokens, dragstart/dragend listeners, batchDraw patches — all failed.
**Root cause:** Two separate Konva objects can never be kept in perfect sync across async redraws, drag events, and point edits.
**Fix:** Single `Konva.Group` with the hit line AND stone images as children. Group is draggable — everything moves together. No sync code needed.
**Rule:** If a custom struct type has a visual representation that must move with a guide line — put both inside one `Konva.Group`. Never maintain two separate top-level objects.

## L058 — Konva.Line inside a Group: world coord offset must include parent Group position (2026-08-12)
**What happened:** Point edit handles placed at wrong positions. `getShapeWorldPts(hitLine)` returned coords in group-local space, not world space.
**Fix:** `const ox = shape.x() + (shape.parent instanceof Konva.Group ? shape.parent.x() : 0)` — add parent Group offset whenever a Line lives inside a Group.
**Also:** Handle dragmove write-back subtracts same Group offset: `lx = shape.x() + (parent Group x)`. Add-point click pos also needs Group offset subtracted before segment search.
**Rule:** Any time you pass a shape's children to a system that expects world coords (edit handles, add-point), account for all ancestor transforms.

## L059 — Konva click falls through transparent shapes to stage (2026-08-12)
**What happened:** Rock border hit line had `listening:false`. Stone images had `listening:false`. Every click passed through to the stage background → `e.target === stage` → pan mode triggered. Cursor showed grab hand instead of pointer.
**Fix:** Hit line `listening:true` so clicks are absorbed by the Group and don't reach the stage.
**Rule:** In any clickable Konva.Group, at least one child must have `listening:true` to prevent clicks falling through to the stage.

## L060 — `useSelection` transformer attaches to all Konva.Groups — exclude custom line tools (2026-08-12)
**What happened:** Rock border Group got scale/skew transformer handles — looked like an image resize box.
**Fix:** Check `d?.type === 'rock-border'` before attaching transformer: `if (sel && !structLocked && !isRockBorder && (shape instanceof Konva.Rect || shape instanceof Konva.Group))`.
**Rule:** Any new Group-based struct type must be explicitly excluded from the transformer in `useSelection`. The transformer should only attach to rect/circle structs and merged bed groups.

