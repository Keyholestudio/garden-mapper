# Garden Planner — Project Lessons
_L001–L009, L016–L019, L020, L026–L028, L030–L053 archived at: `memory/deep/garden-planner/lessons-archive.md`_


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

