# Garden Mapper — V8 vs React Scaffold Gap Analysis
_Generated: 2026-05-29_

## ✅ Implemented (confirmed in codebase)

| Feature | Where |
|---|---|
| Plant tray — 36 plants, search, recents, click-to-place | `PlantTray.jsx`, `usePlantCatalog.js` |
| Freeform beds (curved + straight) | `useDrawTools.js`, `drawUtils.js` |
| Freeform fences (curved + straight) | `useDrawTools.js` |
| Freeform paths (open line, width slider) | `useDrawTools.js` |
| Freeform water / pond | `useDrawTools.js` |
| Building (rect drag) | `drawUtils.addRectStruct` |
| Deck sub-types (curved / straight / square accordion) | `BottomBar.jsx`, `useDrawTools.js` |
| Underground draw (electrical / plumbing open lines) | `useDrawTools.js` |
| Gate placement (click 2 posts on fence line) | `useDrawTools.js` |
| Fountain (click to place, snap) | `useDrawTools.js` |
| Snap to property boundary (freeform points) | `drawUtils.snapToBoundary` |
| Rect drag (square beds, buildings, decks, pool, hedge) | `drawUtils.addRectStruct` |
| Circle drag (pool-circle) | `drawUtils.addCircleStruct` |
| Object merge (drag rect adjacent → auto-join group) | `drawUtils.tryMergeRects` — just added |
| Disconnect merged group | `GardenEditor.handleDisconnect` |
| Edit mode (dblclick → drag handles, add/remove points) | `useSelection.js` |
| Insert point on segment (click line in edit mode) | `useSelection.insertPointNearestSegment` |
| Transformer (resize handles) | `useSelection.js` |
| Select struct / plant on click | `useDrawTools.js`, `useSelection.js` |
| Multi-selection (Ctrl/Shift+click, Delete All) | `useSelection.js`, `RightPanel.jsx` |
| Colour picker — struct swatches | `RightPanel.jsx`, `GardenEditor.handleColourChange` |
| Path width slider | `RightPanel.jsx`, `GardenEditor.handlePathWidthChange` |
| Dimension entry — rect (L × W) | `RightPanel.jsx`, `GardenEditor.handleDimRectApply` |
| Dimension entry — circle (diameter) | `RightPanel.jsx`, `GardenEditor.handleDimCircleApply` |
| Layer order forward/back buttons | `RightPanel.jsx`, `GardenEditor.handleLayerMove` |
| Plant transparency toggle | `RightPanel.jsx`, `GardenEditor.handleTransparentPlant` |
| Struct transparency toggle | `RightPanel.jsx`, `GardenEditor.handleTransparentStruct` |
| Plant notes text field | `RightPanel.jsx` |
| Copy plant (button = immediate paste to right) | `GardenEditor.jsx` |
| Paste plant (Ctrl+V — preserves size) | `GardenEditor.jsx` |
| Tap background to deselect | `GardenEditor.handleCanvasClick` |
| Draw hint bar | `GardenCanvas.jsx` (`#draw-hint` div) |
| Snap to grid toggle | `BottomBar.jsx`, `useGardenState.js` |
| Season slider (Spring / Summer / Fall / Winter) | `BottomBar.jsx` |
| Season themes — canvas bg + grid colour per season | `GardenCanvas.jsx` (`SEASON_BG`, `SEASON_GRID`) |
| Season badge in logo bar | `LogoBar.jsx` |
| Scale display (1 cell = 3 in) | `LogoBar.jsx` |
| Promo banner (rotating slogans, 60s, < > nav) | `PromoBanner.jsx` |
| Logo bar (left/center/right layout) | `LogoBar.jsx` |
| YouTube link button | `LogoBar.jsx` |
| Profile / user button | `LogoBar.jsx` |
| Save to localStorage | `useSaveLoad.saveGarden` |
| Load from localStorage | `useSaveLoad.loadGarden` |
| Garden switcher modal (Load / Delete / New) | `GardenSwitcher.jsx` |
| Auto-load on startup (skip setup overlay) | `GardenEditor.jsx` useEffect |
| Error boundary (red box instead of blank page) | `ErrorBoundary.jsx`, `main.tsx` |
| Undo stack (Ctrl+Z) | `useGardenState.pushUndo/undo` |
| Setup overlay (first-run, garden name/dims/units) | `SetupOverlay.jsx` |
| Grid draw | `GardenCanvas.drawGrid` |
| Pan (click+drag empty canvas) | `GardenCanvas.jsx` |
| Zoom (scroll wheel) | `GardenCanvas.jsx` |
| Zoom to fit / Reset view | `GardenEditor.handleResetView` |
| Clear all (with confirm modal) | `GardenEditor.handleClearAll` |

---

## ❌ Missing / Not Implemented

| Feature | V8 function | Priority | Notes |
|---|---|---|---|
| **Last-used garden index persisted** | `currentGardenIndex` in LS | 🟢 Low | Refresh always loads garden[0]. Should store last-used index. |
| **PDF export** | (browser print / canvas export) | 🔵 Deferred | Long-term to-do. Not a priority for current phase. |

## ✅ Recently Completed (2026-05-29 afternoon)

| Feature | Done |
|---|---|
| Season visibility — real-time on slider + checkbox | ✅ |
| Ctrl+Z undo wired | ✅ |
| Scale display — dynamic with zoom | ✅ |
| Season slider labels — precisely positioned under stops | ✅ |
| Struct label rename field | ✅ |
| Clear button — custom modal (was blocked by window.confirm) | ✅ |
| Object merge (tryMergeRects) | ✅ |
| Disconnect merged group | ✅ |
| Copy button — immediate paste (touch-friendly) | ✅ |
| Repeat paste steps correctly | ✅ |
| Background tap to deselect | ✅ |
| Promo banner | ✅ |
| Logo bar — matches v8 exactly | ✅ |
| Right panel — floating card style | ✅ |

---

## ⚠️ Implemented but Needs Testing

| Feature | Concern |
|---|---|
| Object merge (tryMergeRects) | Just ported today — untested |
| Disconnect | Re-wired today — untested |
| Gate placement | In drawTools but not confirmed working end-to-end |
| Underground draw | In drawTools but not confirmed working in React build |
| Fountain placement | In drawTools — confirm snap and click-to-place work |
| Multi-selection yellow highlight | Exists in useSelection — confirm visual highlight draws correctly |
| Undo stack | pushUndo/undo in state — Ctrl+Z not wired, undo() never called |
| Insert point on segment | In useSelection — confirm dblclick-in-edit-mode triggers correctly |
| Edit mode handles | In useSelection — confirm dblclick on Line shape opens handles |
| Boundary snap | In drawUtils — confirm points snap to property edge |

---

## 📋 Suggested Priority Order

1. 🔴 **Season visibility** — core feature, checkboxes already exist, just need `updatePlantVisibility` wired to season slider
2. 🟡 **Ctrl+Z undo** — state already has the stack, just needs keydown handler
3. 🟡 **Scale display dynamic** — minor polish, 1-line fix
4. 🟡 **Season slider labels** — cosmetic, matches v8 exactly
5. 🟡 **Struct label rename** — useful for power users
6. ⚠️ **Test merge/disconnect/gate/fountain/underground/multi-select** — confirm all work before next sprint
7. 🟢 **PDF export** — deferred feature, needs design decision
8. 🟢 **Last-used garden index** — nice-to-have

---
_Compare with Rob's list and reconcile priorities._
