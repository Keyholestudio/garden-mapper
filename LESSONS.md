# Garden Planner — Project Lessons
_L001–L009 archived at: `memory/deep/garden-planner/lessons-archive.md`_

---

## L021 — Pinch-to-zoom: disable draggable on shapes, not just layer listening
**Date:** 2026-06-07

### The problem
During a pinch-to-zoom gesture, if a finger lands on a Konva draggable object, the object moves or resizes even though no transformer handles are visible. The Konva Transformer (`transformstart`/`stopTransform`) is NOT involved — this is Konva's internal drag handler latching onto the shape from the first finger touch.

### What doesn't work
- `layer.listening(false)` — blocks new events but doesn't interrupt a drag already in progress from finger 1
- `tr.nodes([])` at pinch start — only affects transformer resize, not plain dragging
- `capture: true` on the canvas element — fires before Konva but breaks Vite's HMR and Konva's own touch move processing, killing pinch zoom entirely
- `transformstart` + `stopTransform()` — correct API but only fires for transformer anchor drags, not free dragging

### What works
In `onTouchStart` when `e.touches.length === 2`:
1. Call `Konva.DD?.reset()` to cancel any in-progress drag
2. Call `n.draggable(false)` on every shape in plant and struct layers
3. On pinch end (after 120ms delay): restore `draggable(true)` on all shapes, then call `onPinchEnd` callback so parent can re-apply locked state for any locked objects

### Key insight
Vite hot-reload pushes changes to Cloudflare tunnel immediately — if a fix appears not to work on device, the issue is the fix itself, not the delivery. Don't restart the tunnel or dev server to debug; look at the logic instead.

### Files changed
- `GardenCanvas.jsx` — pinch start/end touch handlers
- `GardenEditor.jsx` — `onPinchEnd` callback re-applies lock state; `transformstart` guard using `e.evt.touches.length >= 2`

---

## L020 — CDP sticker generation: navigate_fresh() causes account switching
**Date:** 2026-06-04
`navigate_fresh()` calls `window.location.href = GEMINI_URL` which forces a full page reload. On machines with multiple Google accounts, this lets Google re-evaluate which account is "active" and switches users mid-run.
**Fix:** Check if `[contenteditable=true]` is already present before navigating. If the input is ready, skip the navigation entirely — reuse the existing chat state.
```python
already_ready = cdp(ws_url, 'document.querySelector("[contenteditable=true]")!==null')
if already_ready:
    return ws_url  # skip navigation
```
**Also:** Always re-verify account AFTER any navigation (added double-check in sticker-generate-one.py).
**Rule:** Never unconditionally reload the Gemini page between prompts on a multi-account machine.

---

## L019 — How to add a repeating texture to a season
**Date:** 2026-06-04

### Overview
Textures are 256×256 JPGs stored in `app/public/textures/`. They are applied as a `fillPatternImage` on the `__propBounds` Konva rect (the property boundary). They swap automatically when the user cycles the season.

### Step 1 — Get the image from Rob
Rob sends a raw Gemini-generated JPG via Telegram. Download it from `C:\Users\RG\.openclaw\media\inbound\` — use the latest `file_NNN---*.jpg` matching the send time.

### Step 2 — Process it
Resize to 256×256 and optionally apply a white fade for subtlety:
```python
from PIL import Image
img = Image.open(src).convert('RGBA').resize((256, 256), Image.LANCZOS)
white = Image.new('RGBA', img.size, (255, 255, 255, 255))
blended = Image.blend(img, white, alpha=0.30)  # 0.30 = 30% fade toward white
blended.convert('RGB').save(dst, 'JPEG', quality=85, optimize=True)
```
**Always process from the original source file** — never re-fade an already-faded file or the effect stacks.

Fade levels used so far:
- Spring: 30% | Summer: 20% | Fall: 10% | Winter: 50%

### Step 3 — Save to textures folder
```
app/public/textures/lawn-<season>.jpg
```
Current files: `lawn-spring.jpg`, `lawn-summer.jpg`, `lawn-fall-early.jpg`, `lawn-winter.jpg`

### Step 4 — Wire into the season map (3 places)
All three must match or a season will show the wrong texture:

**a) `app/src/components/GardenCanvas.jsx`** — `LAWN_TEXTURES` constant near top of file:
```js
const LAWN_TEXTURES = {
  spring: '/textures/lawn-spring.jpg',
  summer: '/textures/lawn-summer.jpg',
  fall:   '/textures/lawn-fall-early.jpg',
  winter: '/textures/lawn-winter.jpg',
}
```

**b) `app/src/hooks/useSaveLoad.js`** — same `LAWN_TEXTURES` constant near top of file.

**c) `app/src/components/GardenEditor.jsx`** — inline object in the `onStart` handler (SetupOverlay callback), search for `LAWN_TEXTURES` — one line.

### Step 5 — Commit
```
git add -A && git commit -m "Textures: update <season> lawn texture"
```

### Adding a NEW season key
The season cycle is driven by `currentSeason` (0=spring, 1=summer, 2=fall, 3=winter). If a new season slot is ever added, update `SEASON_NAMES` arrays everywhere and add the new key to all three `LAWN_TEXTURES` maps.

### The flash-then-disappear bug (already fixed — do not regress)
If a texture ever shows briefly on load then disappears: `loadGarden()` is recreating `__propBounds` without reapplying the texture. The fix is `applyLawnTexture()` called after the rect is added in `useSaveLoad.js`. Do not remove that call.

---

## L016 — Gemini CDP sticker generation: Rob's account uses lh3 URLs, not blob:
**Date:** 2026-06-03
The OpenClaw Google account (used in earlier sessions) serves Gemini-generated images as `blob:` URLs. Rob's personal Gemini account serves them as `https://lh3.googleusercontent.com/...` URLs. The canvas `drawImage()` grab fails on lh3 due to CORS. Fix: detect lh3 URL, return `"URL:" + src`, then download via Python `urllib.request` instead of canvas capture.
**Rule:** Always check both URL types in CDP image detection. `blob:` = canvas grab. `lh3.googleusercontent.com` = direct download.

## L017 — CDP WebSocket target goes stale after long navigation loops
**Date:** 2026-06-03
On long batch runs (20+ prompts), reusing the same `ws_url` from the start of the session causes `WebSocketBadStatusException: 500 No such target id` after Brave reassigns the tab's CDP target. Fix: call `get_gemini_tab()` fresh at the start of every single prompt to get a current `ws_url`. Never cache it across prompts.
**Rule:** Always re-fetch ws_url from `/json` endpoint per prompt. Never reuse across navigations.

## L018 — Navigate to fresh Gemini `/app` before each prompt, grab image BEFORE navigating away
**Date:** 2026-06-03
Gemini's previous conversation history pollutes the blob/lh3 baseline check. Fix: navigate to `gemini.google.com/app` (fresh chat) before each prompt, wait for `contenteditable` to be ready (up to 30s), then send. Wait for new image to appear BEFORE any further navigation. If you navigate away before grabbing, the image is gone.
**Rule:** navigate → wait for input → baseline → send → wait for image → grab → THEN pause/navigate.

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

## L014 — Garden Organizer Google Doc
**Date:** 2026-06-01
Primary planning doc for this project. Doc ID: `1F3mA5UZw1qo2wxd3pqMuSvyph3L4biChiJ18kbhRf5Q`
Read it: `gog docs cat 1F3mA5UZw1qo2wxd3pqMuSvyph3L4biChiJ18kbhRf5Q`
Export it: `gog docs export 1F3mA5UZw1qo2wxd3pqMuSvyph3L4biChiJ18kbhRf5Q --format txt --out projects/garden-planner/garden-organizer-export.txt`
Also add to TOOLS.md under Google Drive Key Documents.

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
