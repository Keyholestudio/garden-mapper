# Sandbox Zone — Setup, Configuration & Edit Guide

_Last updated: 2026-07-08_

The sandbox zone is an interactive training area displayed on the **Dream Garden only**. Outside it, the garden is fully view-only. Inside it, users can freely place and move plants as a tutorial experience.

---

## Current State

| Setting | Value |
|---|---|
| Enabled | ✅ Yes — Dream Garden only |
| Size | 15 × 15 ft |
| Position | Centered horizontally, shifted 5ft down from vertical center |
| Overlay | Invisible (opacity 0) — garden fully visible beneath |
| Sandbox marker | Dashed white border + "✨ Try planting here" label |
| Local dev bypass | ✅ Yes — overlay skipped entirely at `localhost:5200` |
| Last updated | 2026-07-08 (commit `e56e562`) |

---

## How It Works

### The Overlay (interaction blocker)
A dedicated Konva layer (`id: '__dreamOverlay'`) is added **above all other layers** on the Konva stage. It contains:

- **4 invisible `Konva.Rect` frame pieces** — cover everything outside the sandbox zone. `listening: true`, `fill: rgba(0,0,0,0)`. They intercept all pointer events (clicks, drags, taps) so the garden beneath is completely untouchable outside the sandbox.
- **1 dashed border rect** — visual marker around the sandbox zone. `listening: false`, white stroke.
- **1 text label** — "✨ Try planting here". `listening: false`.

The overlay is **reactive** — it tears down and rebuilds whenever the active garden changes. On non-Dream Gardens (index > 0) it is fully destroyed so user gardens are never affected.

### Drop & Click Guards (GardenEditor)
In addition to the Konva overlay, `GardenEditor.jsx` has two JavaScript guards:
- `handleCanvasDrop` — blocks drag-drop placements outside sandbox bounds
- `handleCanvasClick` — blocks click-to-place placements outside sandbox bounds

These use `sandboxBoundsRef` (world coordinates) to check if the drop/click point is inside the sandbox before allowing placement.

### Save Block
`handleSave` in `GardenEditor.jsx` has a hard guard: if `isDreamGarden === true` AND the hostname is not `localhost`, the save is silently skipped. This prevents sandbox plants from ever overwriting the Dream Garden in localStorage.

### Localhost Bypass
At `localhost:5200`, `window.location.hostname === 'localhost'` is true, so:
- The overlay layer is never created
- The save block is bypassed
- Rob can edit the Dream Garden freely as normal

---

## File Locations

| File | What it does |
|---|---|
| `app/src/components/GardenCanvas.jsx` | Creates/destroys the overlay layer + sandbox visuals |
| `app/src/components/GardenEditor.jsx` | `isDreamGarden` flag, `sandboxBoundsRef`, drop/click guards, save block |

---

## How to Edit the Sandbox

### Change the sandbox size
**File:** `app/src/components/GardenCanvas.jsx`
**Location:** Inside the `useEffect(() => { ... }, [isDreamGarden])` block (~line 360)

```js
const SANDBOX_FT = 15  // ← change this value (in feet)
```

`sbW` and `sbH` are derived from this value using `UNIT_PX = 32px/ft`. The 4 frame rects and the visual border all recalculate automatically.

### Change the sandbox position
Currently shifted 5ft down from vertical center:
```js
const sbX = pb.x + (pb.w - sbW) / 2
const sbY = pb.y + (pb.h - sbH) / 2 + (5 * UNIT_PX)
```
To re-center vertically, remove the `+ (5 * UNIT_PX)` offset.

### Change the visual border style
**File:** `GardenCanvas.jsx`, same `useEffect` block — the `Konva.Rect` with `id` not set and `dash: [10, 6]`:
```js
stroke: 'rgba(255,255,255,0.55)',  // border colour + opacity
strokeWidth: 2,                    // border thickness
dash: [10, 6],                     // dash pattern [dash length, gap length]
```

### Change the label text or position
**File:** `GardenCanvas.jsx`, same `useEffect` — the `Konva.Text` node:
```js
text: '✨ Try planting here',      // label text
fontSize: 13,                      // font size
fill: 'rgba(255,255,255,0.75)',    // text colour + opacity
y: sbY + sbH - 28,                // vertical position (currently near bottom of zone)
```
The label is horizontally centered via `lbl.offsetX(lbl.width() / 2)` after creation.

### Disable the sandbox entirely
To remove the sandbox (make Dream Garden fully view-only with no interactive zone):
1. In `GardenCanvas.jsx` — in the `useEffect([isDreamGarden])` block, remove or comment out everything after `if (sandboxBoundsRef) sandboxBoundsRef.current = null`
2. In `GardenEditor.jsx` — the `isInSandbox()` check will always return false since `sandboxBoundsRef.current` is null, so drop/click guards will block everything automatically
3. No other changes needed

### Make the overlay visible (e.g. for debugging or a subtle tint)
Change the frame rect fill from fully transparent to a tinted value:
```js
fill: 'rgba(0,0,0,0)',     // current: invisible
// e.g. subtle dark tint:
fill: 'rgba(0,0,0,0.15)',
```

---

## Adding Content to the Sandbox Zone

The sandbox area is currently a blank interactive zone. Planned additions:
- Tutorial prompt text / instructions
- Highlighted plant suggestions
- Guided first-step hints

To add Konva content inside the sandbox zone, add shapes to `overlayLayer` in the `useEffect([isDreamGarden])` block in `GardenCanvas.jsx`. Use `listening: false` for decorative/instructional content so it doesn't block interaction inside the zone.

Example — adding a centered instruction block:
```js
overlayLayer.add(new Konva.Text({
  x: sbX + sbW / 2,
  y: sbY + 16,
  text: 'Step 1: Drag a plant into this area',
  fontSize: 12,
  fill: 'rgba(255,255,255,0.8)',
  listening: false,
  align: 'center',
}))
```

---

## Checklist — Making Sandbox Changes

- [ ] Edit `GardenCanvas.jsx` → `useEffect([isDreamGarden])` block
- [ ] Test at `app.gardenmapper.ca` (not localhost — overlay is bypassed locally)
- [ ] Verify: plants can be placed inside sandbox, blocked outside
- [ ] Verify: switching to "My Garden" shows no overlay
- [ ] Build + push: `npx vite build && git add -A && git commit -m "..." && git push`
- [ ] Hard refresh browser (`Ctrl+Shift+R`)

---

## Prompt to Resume
Say: **"open the sandbox notes"** or **"update the sandbox zone"** to load this file and continue work.
