# Garden Planner — Project Lessons
_L001–L009, L016–L018, L020 archived at: `memory/deep/garden-planner/lessons-archive.md`_

---

## L028 — "Update the Dream Garden to the website" workflow
**Trigger phrase:** "update the Dream Garden to the website"
1. Browser tool → localhost:5200 → eval `JSON.parse(localStorage.getItem('gardenData'))[0]` → grab JSON
2. Validate: `_isDreamGarden: true` present; bump `_dreamVersion` +1
3. Overwrite `app/src/data/dreamGarden.json`
4. `git add -A && git commit -m "Dream Garden: v[N] — [desc]" && git push`
5. Verify raw GitHub URL serves new version; confirm to Rob

**No manual steps from Rob. No export button in UI (no auth yet).**

---

## L027 — Browser zoom-in clips right panel (#32) — known limitation
**Date:** 2026-06-09
Zoom-out works. Zoom-in clips right panel until page refresh. Chrome/Brave don't fire resize on Ctrl++ zoom — `window.innerWidth` stays constant. All attempted fixes failed (see archive for full list).
**Current state (commit `0e13c9f`):** `flex-shrink:1` + `min-width` on panels; `max-width:100vw` on root; Konva updates on zoom-out. Workaround: refresh after zooming in.
**Future option:** `ResizeObserver` on `document.documentElement`, or "Refresh to fit" banner via `visualViewport.scale !== 1`.

---

## L026 — Struct copy: RESOLVED 2026-06-15
~~Two known limitations~~ Both fixed during panel standardization + copy session.
1. Copy button disabled for groups ✅ (already greyed in UI)
2. Copied rects connect/merge correctly ✅ (dragend listener wired)

## L026 — Struct copy: two known limitations to fix (ARCHIVED)
**Date:** 2026-06-09

### Issue 1 — Copy button should be greyed/disabled for Konva.Group (connected buildings)
`handleCopyStruct` skips Groups with an early return. The button should reflect this visually.
**Fix:** In RightPanel and MobileSheet struct panels, add `disabled={isGroup}` to the Copy button.
Add CSS: `.btn-panel:disabled { opacity: 0.4; cursor: not-allowed; }`

### Issue 2 — Copied rects cannot be joined/connected to other rects
The original rect gets a `dragend` listener wired by `addRectStruct` in `drawUtils.js` that calls
`tryMergeRects`. The copied rect in `handleCopyStruct` creates a bare `Konva.Rect` without this
listener — so it can be dragged but never triggers a merge/join.
**Fix:** After creating the new rect in `handleCopyStruct`, attach the same `dragend` handler.
Requires importing `tryMergeRects` from `drawUtils.js` into `GardenEditor.jsx` and calling it
identically to how `addRectStruct` does. Check `addRectStruct` in `drawUtils.js` for the exact
dragend handler signature before implementing.

---

## L025 — Sticker continuity: never delete a key, only replace/alias/retire
**Date:** 2026-06-09
Saved gardens store **keys**, not paths. Missing key = silent broken image.
- **Replace:** overwrite PNG in-place (both `app/public/stickers/` + `stickers/`), key unchanged. Commit: `"Stickers: replace [name] image in-place"`
- **Rename:** keep old key pointing to new file + add new key alongside
- **Retire:** mark `hidden:true` in catalog — hides from menus, still renders in saves. Never delete PNG.
- **Missing PNG:** shows grey `?` tile — restore via `git checkout HEAD -- stickers/<file>.png app/public/stickers/<file>.png`, then Ctrl+Shift+R
- **Adding:** follow L023 checklist
- **What broke June 9:** deleted `decor_pot-s/m/l` keys → broken images in any garden with old pots

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

## L019 — How to add a repeating texture to a season
**Date:** 2026-06-04
Textures = 256×256 JPGs in `app/public/textures/`, applied as `fillPatternImage` on `__propBounds`.
1. Rob sends JPG via Telegram → `C:\Users\RG\.openclaw\media\inbound\`
2. Resize 256×256, blend white. **Always from original** — re-fading stacks. Fade levels: spring 30%, summer 20%, fall 10%, winter 50%.
3. Save as `app/public/textures/lawn-<season>.jpg`
4. Wire `LAWN_TEXTURES` in **3 places**: `GardenCanvas.jsx`, `useSaveLoad.js`, `GardenEditor.jsx` (onStart handler). All must match.
5. Commit: `"Textures: update <season> lawn texture"`
**Flash-then-disappear bug (fixed):** `applyLawnTexture()` called after rect added in `useSaveLoad.js` — do not remove.

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
