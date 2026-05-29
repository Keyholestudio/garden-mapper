# Garden Planner — Revision Log

_This file tracks all changes made to each prototype version. Use it to backdate, audit, or roll back._

---

## React Scaffold — `projects/garden-planner/app/` (2026-05-29)
**Base:** Vite + React + Konva. Runs on http://localhost:5175 (or next available port).
**Reference:** `prototype/index-v8.html` — always open for comparison.
**Git:** initialized in `projects/garden-planner/`, commit after every confirmed change.

### Phases
- [x] Phase 1: useGardenState hook, Konva canvas init, grid, pan, zoom-to-fit, setup overlay
- [x] Phase 2: plant catalog (36 plants), image loading, tray with search + recents, click-to-place
- [x] Phase 3: draw tools — freeform beds/fences/paths/building/water, rect drag, circle drag, Enter to close, Escape to cancel, draw hint bar
- [x] Phase 4: select + edit — transformer, right panel (colour, dims, delete, copy, layer order, transparency, disconnect), edit mode handles, Ctrl+C/V
- [x] Phase 4 bug fixes — layout, zoom, draw conflicts, fountain snap, plumbing, copy/paste, setup overlay
- [x] Phase 5: save/load localStorage + garden switcher modal

### Phase 5 bug fixes (all resolved 2026-05-29)
- [x] Stale useCallback closures on handleLoad/handleSave → switched to plain functions
- [x] null entries in gardenData array → readGardens() filters nulls; save uses safe index bounds
- [x] GardenSwitcher crash on null entry → null guard on .map()
- [x] group.hitFunc() not a method → replaced with makePlantGroup() factory from plantUtils.js
- [x] Setup overlay flicker on refresh → isSetup initializes to true when saved garden exists in localStorage
- [x] Auto-load on startup → useEffect loads garden[0] after stage+images ready; skips setup for returning users
- [x] New garden doesn't clear canvas → canvas cleared before setup overlay shown
- [x] clearSelection/handleResetView used before definition in useEffect → moved useEffect below all handler definitions

### Outstanding
- [ ] Phase 5 remainder: persist last-used garden index in localStorage (refresh always loads garden[0] currently)
- [ ] Phase 5 remainder: draw tools need full testing (square beds, building, deck, hedge — curved/path/electrical confirmed only)
- [ ] Phase 6: season themes (colour palette swap per season beyond canvas bg — already partial)
- [ ] Phase 6: promo banner (rotating slogans, v8 style)
- [ ] Phase 6: logo bar polish (match v8 final layout exactly)
- [ ] Code legend / architecture doc (see ARCHITECTURE.md — to be created)

---

## index-v7.html — Complete (2026-05-28)
**Base:** Copied from index-v6.html (last modified 2026-05-27 9:51 PM)

### Changes
- [ ] #1  V7 created from V6 (baseline copy)
- [x] #2  Logo bar: cell size + season icon side-by-side, no wrap, auto-width button
- [x] #3  Right zone: garden name + size on one line, no wrap (wrapped in logo-garden-info flex row)
- [x] #4  Scrollbar: 10px wide, inset track (margin:10px 0), 2px white border on thumb, no arrows, search bar pinned above scroll area via #tray-scroll wrapper div
- [x] #5  Default zoom: zoomToFit() function added, called at end of initKonva() and loadGarden(). Calculates scale to fit propBounds with 80px padding, centers garden in viewport.
- [x] #6  Disconnect button added to right panel — shows only when a group is selected, calls disconnectGroup() which splits back to individual rects at original positions
- [x] #7  tryMergeRects updated: supports adding to existing groups (up to MAX_GROUP=4). Also extended to pool-sq and hedge-sq types. (already in v6b — verify still present)
- [x] #8  Multi-select: Ctrl/Shift+click adds plants/structs to multiSelection[]. Yellow dashed bounding box drawn on uiLayer per selected object. Right panel shows count + Delete All button. Del key also works. Fence icon updated to brown picket SVG.
- [x] #9  User icon: added min-width/min-height:28px, aspect-ratio:1/1, flex-shrink:0, overflow:hidden — stays circular regardless of flex container pressure
- [x] #10 Curved bed boundary close: boundary-closed curved shapes now use Konva.Path with SVG cubic beziers (Catmull-Rom converted) for drawn section + straight L commands for boundary edges. buildHybridSvgPath() handles the conversion.
- [x] #11 PNG sticker selectability: makePlantGroup() factory added — listening:false on Konva.Image, explicit hitFunc rect on Group. Used in addPlant() and loadGarden(). L026 added to lessons.md.
- [x] #12 Clear button: browser confirm() was silently blocked. Replaced with custom modal overlay (Cancel / Clear All buttons). Also calls clearMultiHighlights() on confirm.
- [x] #13 Square Hedge tool added to Fences panel. fenceSubTool='square' uses rect draw mode (not freeform). hedge-sq type wired into addRectStructReturn, renderPanel typeNames/colours, tryMergeRects (was already there), isFreeMode exclusion.
- [x] #14 Dimension entry for square objects: pnl-dim-rect shown when rect selected (bed-sq/building/deck/pool-sq/hedge-sq). Length+width inputs in garden units. Apply Dimensions button resizes shape.
- [x] #15 Dimension entry for circle objects: pnl-dim-circle shown for fountain/pool-circle. Diameter input in garden units. Apply Diameter button resizes radius.
- [x] #16 Fountains + pool-circle: snap on placement + dragmove snap added. loadGarden circles also get dragmove snap.
- [x] #17 Decks: collapsed under "Deck Type" accordion in Building panel. Toggle shows/hides Curved/Straight/Square deck options. Deck toggle stays highlighted when any deck tool is active.
- [x] #18 Season slider: labels absolutely positioned under each thumb stop using positionSeasonLabels(). Accounts for thumb radius (20px). Re-runs on resize and after initKonva. Works across screen sizes.
- [x] #19 Underground category added to Building panel. tension=0.4 (not 0) — curved preview must match placed shape tension. L028 logged. Electrical (black/red/yellow) + Plumbing (grey/blue/brown). Freeform open line drawing, line width slider, transparency toggle.
  - DEBUG (1:40-2:12pm): 6 failed patch attempts called setMode()/currentMode inside setUndergroundType() breaking Enter for ALL tools.
  - FIX: Reverted isFreeMode, setBuildingTool, setMode to v6-identical logic. Only change: added ||buildingSubTool==='underground' to isFreeMode. activateUndergroundDraw() = setBuildingTool('underground') + setMode('building'). L027 logged.
  - NOTE: Revision log was not updated during debug loop — standing gap in process.
- [x] #20 Feature Roadmap doc additions appended to Expanded App Plan tab (t.npmvdfwpe860). Added V4 sections: Touch/Mobile Framework, Gamification Module, Subscriptions+Payments, Texture System Research, Google Play Store Roadmap. Updated V1: PDF Export with watermark.

### V7 Round 2 — 2026-05-28 (4:00pm+)
- [x] V7-R2-1: Garden switcher delete — replaced confirm() with custom modal (same fix as Clear button)
- [x] V7-R2-2: Logo stays centered — logo-right max-width:45%, garden-name truncates with ellipsis, logo-center flex:1 with min-width:0
- [x] V7-R2-3: Grid minimum cell size 6in/15cm — mult forced to minimum 2 in both drawGrid() and updateScaleDisplay()
- [x] V7-R2-7: Reset button now calls zoomToFit() instead of resetting to scale 1 position 0,0
- [x] V7-R2-4: Position drift fixed — three root causes found:
  (1) Plant scaleX/scaleY not saved — now saved and restored on load
  (2) Line x/y drag offset not saved — now saved as lx/ly, restored with dX/dY applied to position not points
  (3) Konva.Path shapes (boundary-close curves) not saved at all (find() only searched Line,Rect,Circle) — added Path to finder, svgPath+lx/ly now saved and restored
  (4) propBounds origin shift — saved as originX/originY, dX/dY correction applied to all object positions on load
- [x] V7-R2-5: Struct transparency toggle added to right panel (btn-struct-transparency). Sends struct to back of structLayer at 0.35 opacity. Saved/restored on load.
- [x] V7-R2-6: Forward/Back buttons added to both pnl-struct and pnl-plant. Plant: moveUp/moveDown within plantLayer. Struct: moveUp/moveDown within structLayer. zIndex saved per struct and restored on load.

### DEBUG LOG — Enter key broken (2:17pm 2026-05-28)
**Symptom:** Enter does not close freeform shapes (beds, paths, hedges, decks, underground).
**Keydown handler:** Identical to v6. Guard: `if(tag==='INPUT'||tag==='TEXTAREA')return`.
**Root cause identified:** `document.activeElement` is likely an INPUT element when Enter is pressed. Candidates: `plant-search` (type=search, always visible), `pnl-struct-label` (type=text), `dim-rect-w/h` (type=number, new in v7), `dim-circle-d` (type=number, new in v7). Even `display:none` inputs can hold activeElement in some browsers.
**Secondary cause possible:** `isFreeMode()` returning false — but code analysis shows it's correct for all tool types.
**Proposed fix:** Add `document.activeElement.blur()` to stage mousedown handler. This ensures any focused input loses focus when user clicks canvas, before keydown for Enter fires.
**Fix applied (2:29pm):** Added `document.activeElement.blur()` to stage mousedown handler.
**Root cause found (2:36pm):** `const opacity` was declared INSIDE the `else` block of the useSvgPath if/else, but referenced OUTSIDE it (after the closing brace). JavaScript `const` is block-scoped — referencing it outside its block throws a ReferenceError at runtime. This crashed `closeFreeShape()` silently on every call, so Enter appeared to do nothing.

**Why it was missed:**
- The error was silent (no visible UI feedback, no alert)
- I was focused on `isFreeMode()`, `setMode()`, and focus/blur issues — not looking for JS scoping errors in closeFreeShape
- The opacity variable was added as a patch inside an existing else-block without checking the reference below it
- No browser console was open to catch the ReferenceError

**Fix:** Moved `const opacity=(isUnderground&&!undergroundOpaque)?0.45:1` to the TOP of the relevant section, BEFORE the if/else block, so it's in scope for both branches and the code after them.

**Prevention rule (added to lessons.md L027):** When adding a variable inside an if/else block that is referenced after the block closes, always hoist it above the if/else. Before committing any closeFreeShape edit, mentally trace: does every variable used after the if/else exist in the outer scope?

**3:10pm — Underground still placing deck instead of line:**
- Root cause: activateUndergroundDraw was skipping setMode('building') when currentMode was already 'building'. setMode is what calls deselectAll() and renderPanel() — without it, the previously selected deck struct stayed selected, isFreeMode() returned true but clicks on canvas hit the existing deck shape and selected it instead of placing a freeform point.
- Fix: Always call setMode('building') from activateUndergroundDraw, but set buildingSubTool='underground' BEFORE calling setMode so isFreeMode() is already true when setMode evaluates it. Then manually restore highlight on subb-underground-toggle and subu-electrical/plumbing (correct IDs — subb-underground doesn't exist).
- console.log debug line left in closeFreeShape for now — remove after confirmed working.

---

## index-v6.html — Released 2026-05-26 (updated in-place 2026-05-27)
**Base:** Copied from index-v5.html

### Changes (v6 original — 2026-05-26)
- ✅ Object merge groups preserve original sizes (no bounding-box expansion)
- ✅ ← Back button in right panel
- ✅ Rotating banner (#11502A, 60s, fade, 5 slogans)
- ✅ White page background, floating panels
- ✅ Logo bar with Garden Mapper logo
- ✅ Old topbar removed

### Changes (v6b — updated in-place 2026-05-27)
- ✅ Logo bar: cell ratio + season badge side-by-side (left zone)
- ✅ Garden name + dimensions side-by-side (right zone)
- ✅ Tray scrollbar: top/bottom margin, no corner overlap
- ✅ Canvas rounded corners (14px radius)
- ✅ Gap above/below canvas (floating look)
- ✅ Default zoom fits full property (80px padding)
- ✅ Disconnect Objects button for grouped objects
- ✅ Group merge up to 4 same-type rects
- ✅ Banner rotation confirmed (setInterval 60s)

---

## index-v5.html — 2026-05-26
**Base:** Copied from index-v4.html

### Changes
- ✅ Dynamic min zoom, grid always renders, straight bed preview fix
- ✅ Edit handles follow shape on drag
- ✅ Plant size classifications (XS/S/M/L)
- ✅ Snap-to-grid toggle
- ✅ Insert point anywhere on line
- ✅ Square bed/building snap-join merge
- ✅ Hedges → Fences (renamed), Gate types, Water tool, Decking
- ✅ Two gardens per user, boundary close fix

---

## index-v4.html — 2026-05-24
**Base:** Copied from index-v3.html

### Changes
- ✅ Tool consolidation (Beds/Hedges/Paths sub-tools in right panel)
- ✅ Boundary close via perimeter traversal
- ✅ Edit mode (dblclick → draggable handles, add/remove points)
- ✅ Path width slider

---

## index-v3.html — 2026-05-22 (updated 2026-05-24)
**Base:** Copied from index-v2.html

### Changes
- ✅ Pan by click+drag on empty canvas
- ✅ Adaptive grid (readable at any zoom)
- ✅ Stroke width fix (strokeScaleEnabled:false + transformend normalization)
- ✅ Square corners on beds
- ✅ Plant transparency toggle (0.35 opacity, sends behind other plants)
- ✅ Copy/paste plants (Ctrl+C / Ctrl+V with offset)
- ✅ Freeform bed tool (smooth spline)
- ✅ Freeform path tool (open shape, thick stroke)
- ✅ Hedge tool (green palette)

---

## index-v2.html — 2026-05-22
**Base:** Copied from index.html (v1)

### Changes
- ✅ Property setup (name, dimensions, ft/m)
- ✅ Bed/building/path tools
- ✅ Search + recently used
- ✅ Grid + scale bar

---

## index.html (v1) — 2026-05-20
**Base:** Original

### Changes
- ✅ Basic drag/drop
- ✅ Season slider
- ✅ 3 initial stickers

## Phase 5 — Save/Load (2026-05-29)
**Status:** Working after 3 fix rounds

### Bugs found and fixed
- [x] Stale useCallback closures on handleLoad/handleSave — switched to plain functions
- [x] null entries in gardenData array — readGardens() now filters nulls; save uses safe index bounds
- [x] GardenSwitcher crash on null garden entry — null guard on .map()
- [x] Load did nothing (gardens with objects) — root cause was a 500 compile error from bad debug code; load itself works
- [x] Auto-load on startup — useEffect loads garden[0] from localStorage once stage+images are ready; skips setup overlay for returning users
- [x] New garden doesn't immediately load — canvas is now cleared before showing setup overlay; onStart reinits boundary with new dimensions
- [x] New garden name not persisted — createNewGarden saves current first, new entry pushed to LS


