# Image Loading Debug Log
_Garden Mapper Android — Grey Placeholder Investigation_
_Started: 2026-09-08_

---

## Problem Statement

When opening the Garden Mapper Android app, approximately 50% of plant sticker images appear as grey question-mark placeholders instead of their actual stickers. The failures are **random** — a different batch fails each time the app is opened.

### Key Observations
1. **Fails on cold open** — closing and re-opening the app shows the same ~50% failure rate
2. **Failures are random** — not a consistent cutoff, different images fail each time
3. **Leaving it open does NOT fix it** — images don't eventually load; they just stay grey
4. **Loading the garden again fixes it** — going to "Your Gardens" and re-selecting the garden causes all placeholders to immediately disappear (no slow sequential loading — instant)
5. **Web version works fine** — both desktop and mobile web (DuckDuckGo) load all images correctly after a refresh
6. **"Instant" recovery on re-load** — the fact that re-loading the garden fixes it instantly suggests the images ARE loaded into memory by then — the canvas is just still showing stale placeholder Konva nodes

---

## Root Cause Hypotheses

### H1 — Capacitor WebViewLocalServer thread pool contention (TESTED, not the root cause)
Concurrent image requests exceed the thread pool → some get blocked and error out.
- **Tried:** batches of 10 → 3 → sequential (one at a time)
- **Result:** still failing. Random failures persist even with fully sequential loading.
- **Conclusion:** Not a concurrency/thread problem. Something else is happening.

### H2 — Images load fine but Konva canvas doesn't re-render (CURRENT BEST HYPOTHESIS)
Evidence: re-loading the garden makes placeholders disappear *instantly* with no visible loading delay.
This strongly suggests the images ARE in memory (loadedImages state), but the Konva `Image` nodes
on the canvas are not being updated when `loadedImages` state changes.

The garden loads its plant data and renders Konva nodes BEFORE images are ready.
Each Konva Image node gets a placeholder (or nothing). When `loadedImages` state fills in,
React re-renders, but if Konva nodes are not re-created or updated, they stay stale.

Re-loading the garden triggers a full garden re-render, which picks up the now-loaded images → instant fix.

### H3 — Race condition: garden renders before loadedImages is populated
The garden JSON is loaded from localStorage and plants are placed on the canvas.
At that moment, `loadedImages` may be empty (images still loading).
The Konva nodes are created with `null` or placeholder images.
`loadedImages` fills in later via state updates, but the existing Konva nodes aren't refreshed.

---

## Changes Made (Chronological)

### Change 1 — `usePlantImages.js` — retry + batch (commit `b494ce2`)
**What:** Replaced silent `onerror = () => res()` with retry logic (3 retries, exponential backoff).
Batch size 10, 50ms delay between batches.
**Result:** Web fixed. Android still failing (different pattern — random vs. hard cutoff).
**Status:** ✅ kept (correct for web)

### Change 2 — `GardenEditor.jsx` — same retry fix (commit `0e17e81`)
**What:** GardenEditor has its own duplicate image loader separate from usePlantImages.js.
Applied same retry + batch fix there.
**Result:** Android still failing. Same random failure pattern.
**Status:** ✅ kept (correct fix, wrong root cause)

### Change 3 — Native-aware batch settings (commit `ce4a307`)
**What:** Detected `Capacitor.isNativePlatform()`. Used smaller batches (3) + longer delays (150ms)
+ more retries (5) on native. Progressive per-batch state updates. `ready=true` fires immediately on native.
**Result:** Still failing. Same random pattern.
**Status:** ✅ kept (progressive rendering is a UX improvement regardless)

### Change 4 — Fully sequential loading on native (commit `fa76e87`)
**What:** Switched native to strictly one-at-a-time sequential loading (no concurrency at all).
Images stream in one-by-one, updating state after each.
**Result:** Still failing. Same random ~50% grey on cold open.
**Conclusion:** Not a concurrency problem. Points strongly to H2/H3 — canvas re-render issue.
**Status:** ✅ kept (sequential is still safer for native)

---

## Next Steps to Investigate

### Option A — Force Konva node image refresh when loadedImages updates
When `loadedImages` state changes, walk the plant layer and update each Konva `Image` node
with the newly loaded image. This is already done partially for lazy pack loads
(see `lazyPacksProps` effect in GardenEditor) but may not be wired for the initial catalog load.

**Risk:** Low. This is a targeted canvas refresh, not a full re-render.
**Likely fix for:** H2 — stale Konva nodes.

### Option B — Delay garden render until images are ready
Don't place plants on the canvas until `loadedImages` has at least the keys the garden needs.
Wait for the relevant images to load, then render all at once.

**Risk:** Medium. Could make initial load feel slow.
**Pro:** Eliminates the race condition entirely.

### Option C — On app resume / Capacitor `appStateChange` event, re-render garden
When the app comes back to foreground, trigger a garden re-load (like the user manually does).

**Risk:** Low. But only fixes the re-open case, not cold open.

### Option D — Check if `loadedImages` state is actually reaching the canvas render function
Add console.log to verify `loadedImages` has the expected keys when plants are placed.
This confirms H2 vs H3 before writing more code.

---

## What We Know For Sure
- The fix is NOT about image loading itself (sequential loading with retries still fails)
- Re-loading the garden is an instant fix → images must already be in memory
- The problem is almost certainly in how the Konva canvas uses (or doesn't update with) the loaded images
- The web version works because it has a single-load cycle; the native app has a timing gap

---

### Change 5 — Konva node swap on `loadedImages` update (commit `7f52d40`) ← CURRENT
**Hypothesis:** H2 confirmed. Images load fine but Konva canvas nodes are created with placeholders
and never updated. Re-loading garden is instant because images are already in memory.
**What:** Added `useEffect` watching `loadedImages`. When any image arrives, walks the plant layer
and calls `konvaImg.image(realImg)` + `batchDraw()` for any node still showing a placeholder.
Same pattern as the lazy pack image swap (already proven to work for that case).
**Expected result:** Grey boxes replaced in real-time as images stream in. No re-load needed.
**Status:** ✅ FIXED — images load sequentially, placeholders disappear in real-time (zigzag pattern across screen confirms sequential streaming). 2026-09-08

---

## Decision Log
- 2026-09-08: Rob requested a change log before further iterations. ✅ This document.
- 2026-09-08: No more changes without documenting hypothesis + expected result first.
- 2026-09-08: Change 5 identified root cause (stale Konva nodes) from Rob's observation that re-loading garden fixes it instantly.
