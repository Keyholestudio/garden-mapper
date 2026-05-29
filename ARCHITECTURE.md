# Garden Mapper — React Scaffold Architecture

_Reference doc. Read this before touching any code._

---

## Entry Point

```
app/src/main.tsx          → mounts <App> wrapped in <ErrorBoundary>
app/src/App.jsx           → renders <GardenEditor>
```

---

## Component Tree

```
GardenEditor              — top-level shell, owns ALL state and handlers
├── SetupOverlay          — first-run modal (garden name, dimensions, units)
├── LogoBar               — top bar: logo, garden name/dims, season badge, Save + Gardens buttons
├── GardenSwitcher        — modal: list saved gardens, Load / Delete / New Garden
├── editor-body
│   ├── PlantTray         — left sidebar: plant catalog, search, recents, click-to-place
│   ├── GardenCanvas      — Konva stage, grid, pan, zoom, property boundary
│   └── RightPanel        — right sidebar: properties of selected plant or struct
└── BottomBar             — toolbar (Select/Beds/Fences/Paths/Build/Water), season slider, grid toggle
```

---

## Hooks

| Hook | Owns | Notes |
|---|---|---|
| `useGardenState` | All React state | Single source of truth. Returns flat object of state + setters. |
| `useDrawTools` | Stage mousedown, freeform drawing, rect/circle drag | Fires `pan:start` event for select mode. GardenCanvas listens. |
| `useSelection` | Transformer, edit handles, keyboard (Delete/Escape/Enter) | Wired in GardenEditor, receives stage+layers after init. |
| `usePlantCatalog` | PLANT_CATALOG constant (36 plants) | Pure data — no state. |
| `usePlantImages` | (unused directly) | Image preloading done inline in GardenEditor. |
| `useSaveLoad` | localStorage read/write | Exports: saveGarden, loadGarden, createNewGarden, readGardens, deleteGarden. |

---

## Key Refs (not React state — live Konva objects)

| Ref | What it holds |
|---|---|
| `stageRef` | The Konva.Stage instance |
| `layersRef` | `{ gridLayer, structLayer, plantLayer, uiLayer, tr }` |
| `plantDataRef` | `{ [id]: { label, family, key, size, notes, seasons, transparent } }` |
| `structDataRef` | `{ [id]: { type, colour, label, pathWidth, tension, transparent } }` |
| `propBoundsRef` | `{ x, y, w, h }` — property boundary in canvas coords |
| `showGridRef` | mirrors `showGrid` state — used in dragmove closures |
| `plantIdCtr` | auto-increment counter for plant IDs (`plant_0`, `plant_1`, …) |
| `structIdCtr` | auto-increment counter for struct IDs (`struct_0`, `struct_1`, …) |
| `currentGardenIndexRef` | mirrors `currentGardenIndex` state — used in save (avoids stale closures) |

---

## Layers (Konva, bottom to top)

| Layer | Contents |
|---|---|
| `gridLayer` | Grid lines (redrawn on pan/zoom/toggle) |
| `structLayer` | Beds, fences, paths, buildings, water, underground. Also `__propBounds` rect + `__propLabel` text. |
| `plantLayer` | Plant sticker Groups |
| `uiLayer` | Transformer (resize handles), edit point handles |

---

## Struct Types (values stored in structDataRef)

| type | Shape | Notes |
|---|---|---|
| `bed`, `bed-sq` | Line (closed) / Rect | Beds. `bed` = freeform, `bed-sq` = rect drag |
| `fence`, `gate` | Line (open) | Fences and gates |
| `path` | Line (open) | Paths. Has `pathWidth`. |
| `building`, `deck-*` | Rect / Line | Buildings and decks |
| `water`, `fountain`, `pond`, `pool-sq`, `pool-circle` | Circle / Rect / Line | Water features |
| `underground-electrical`, `underground-plumbing` | Line (open) | Underground runs |
| `hedge`, `hedge-sq` | Line / Rect | Hedges |

---

## Save/Load Flow (localStorage key: `gardenData`)

```
gardenData = [
  { name, unit, w, h, originX, originY, plants: [...], structs: [...] },
  { ... }   // up to 2 gardens
]
```

- **Save**: reads Konva layers directly (not React state) → serializes to plain objects → writes to localStorage[currentGardenIndexRef]
- **Load**: reads localStorage → clears Konva layers → rebuilds all shapes → calls React state setters LAST (avoid async race)
- **Auto-load on startup**: `useEffect` after stage+images ready → loads garden[0] → skips setup overlay
- **isSetup init**: `useState(hasSavedGarden)` — reads localStorage synchronously before first render, eliminates flicker

---

## Plant Groups (Konva)

Each plant is a `Konva.Group` containing:
- `Konva.Image` — the sticker PNG (`listening: false`)
- `Konva.Rect` — invisible hit rect (`fill: rgba(0,0,0,0.001)`) — needed because transparent PNGs don't register clicks

Built by `makePlantGroup()` in `plantUtils.js`. Used by both `addPlant()` (new placement) and `loadGarden()` (restore from save).

---

## Critical Rules

1. **Never call `group.hitFunc(fn)` as a method** — it's not a Konva method. Use `makePlantGroup()` which adds an explicit hit rect instead.
2. **React state setters are async** — in `loadGarden`, all Konva work runs first, state setters called at the end.
3. **Plain functions, not useCallback** — `handleSave`, `handleLoad`, `handleNewGarden` are plain functions that close over refs. This avoids stale closure bugs.
4. **`useEffect` order matters** — `clearSelection` and `handleResetView` must be defined BEFORE any `useEffect` that calls them (no hoisting for arrow functions).
5. **Commit after every confirmed change** — git is in `projects/garden-planner/`.
6. **Always test against v8** — `prototype/index-v8.html` is the working reference. When in doubt, read v8 first.
