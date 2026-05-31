# Garden Planner — Project Lessons

## L012 — Reference v8 before solving any canvas/visual/coordinate problem
**Date:** 2026-05-31
**What:** Spent 2 iterations getting multi-select highlight coords wrong (offset down-right, then offset up-left) before referencing v8's `drawMultiHighlight`. V8 had the exact correct math in ~10 lines.
**Rule:** Before writing any Konva positioning, coordinate conversion, drawing, or visual behaviour — **read v8 first**. It is the working reference. The React scaffold is a port of v8, not a rewrite. If v8 has it, copy it exactly and adapt for React.
**Applies to:** getClientRect, coordinate transforms, stage/layer offsets, pan/zoom math, shape drawing, preview lines, highlights, anything visual.


## L006 — Gemini canvas grab bakes in checkerboard background
**Date:** 2026-05-27
**What:** Saving Gemini-generated images via canvas `toDataURL()` captures the UI's checkered transparency indicator baked into the pixels. Corner alpha=255, no real transparency.
**Why:** Gemini renders the transparent background as a visual checkerboard in the DOM. The canvas sees the rendered page, not the underlying transparent image.
**Fix options:**
1. Use `rembg` (AI background removal) as post-processing — works but adds a dependency and processing step
2. Use the Gemini "Download full size image" button which may provide the actual transparent PNG
3. Use a solid colour background in the prompt (e.g. bright magenta), then colour-key remove it
4. Check how SVG stickers were originally created in v1 — they were hand-made with transparent backgrounds natively
**TODO:** Investigate Gemini's actual download file vs canvas capture. Test if Gemini's download button gives true transparency.

## L007 — Plant stickers placed on canvas cannot be selected/moved
**Date:** 2026-05-27
**What:** After placing the new PNG stickers on the Garden Mapper canvas, clicking them to select/move did nothing.
**Why:** NOT yet diagnosed — needs investigation next session. Likely cause: the PNG sticker images loaded via `loadedImages[key]` use `key` as the unique identifier. New PNG stickers use full filename slugs as keys (e.g. `flower-cluster_allium`) which may conflict with how `selectPlant()` looks up `plantData[id]`. OR: the Konva Group's click handler is not firing because the image naturalWidth/height is large (529px) and the hit area is miscalculated.
**Fix:** Debug in next session. Check `plantData[id]` lookup and Konva Group click listener on placed plants.

## L008 — Sequential message spam
**Date:** 2026-05-27
**What:** Sent 7–10 sequential messages in a row multiple times today. Rob explicitly flagged this as a communication pattern problem.
**Why:** Breaking work into micro-updates instead of batching into 1–3 cohesive messages.
**Fix:** Batch all related updates into 1 message. Max 2–3 sequential messages ever. If there's more to say, include it in the same message. This is a standing rule — not situational.
**Recurrence:** This lesson has been noted before. Promote to SOUL.md reminder.

## L009 — Sticker detail level too high for small canvas use
**Date:** 2026-05-27
**What:** Generated stickers look beautiful at full size but lose definition when zoomed out on canvas. Too much fine detail (watercolor texture, thin outlines) disappears at small render sizes.
**Why:** Prompts optimised for visual quality, not for legibility at 24–96px final display size.
**Fix (to try next session):** Simplify prompts — fewer details, bolder shapes, thicker outlines. Consider adding: "Bold simplified silhouette. Must be recognizable at 64px. Minimal detail." Test a simplified vs detailed version side by side on canvas.

---

## L011 — Reflect before patching. Read before acting. Reference the legend.
**Date:** 2026-05-29
**What:** Spent hours in a patch loop on Phase 5 save/load — layering fixes on top of fixes without fully reading the code first. Introduced new bugs (bad debug code, wrong hook placement, duplicated logic incorrectly) while trying to fix existing ones.
**Root causes:**
1. Patched from memory instead of reading the actual file before editing
2. Didn't read ARCHITECTURE.md / the legend before touching unfamiliar code paths
3. Didn't verify each fix compiled and worked before moving to the next
**The rules:**
1. **Read the relevant file(s) in full before making any edit** — especially hooks, utils, and anything with Konva
2. **Reference ARCHITECTURE.md** at the start of any Garden Mapper coding session and before touching save/load, plant groups, or layer management
3. **One fix at a time** — verify it compiles and behaves correctly before moving to the next issue
4. **If stuck after 2 attempts, stop and explain** what you know and don't know before trying again
5. **Update REVISION-LOG.md and ARCHITECTURE.md at session close** — if the code changed, the docs change too
**Standing rule:** No edits without reading first. No session ends with stale docs.

---

## L010 — Git commit discipline for Garden Mapper
**Date:** 2026-05-29
**What:** Git initialized in `projects/garden-planner/` as of today. Every confirmed working change must be committed immediately — not batched at end of session.
**Why:** Yesterday's 4-hour debug session was caused by no version trail. We now have git but it only protects us if we actually use it.
**The rule:**
1. After ANY confirmed working change to index-v8.html (or future versions): `git add -A && git commit -m "description"`
2. Before creating a new version file (v9, v10...): commit the current state first, then copy
3. I commit — Rob doesn't need to think about it. It's my job to run the commit after each confirmed change.
4. At session end: always run `git status` to make sure nothing is uncommitted
**Revert:** `git checkout <hash> -- prototype/index-v8.html` (get hash from `git log --oneline`)
**Health check:** Bi-monthly cron job verifies repo is not broken and not bloated (see cron: "Garden Mapper Git Health Check")
**Standing rule:** No session ends with uncommitted confirmed changes. Ever.

---

## L001 — gog CLI cannot write to specific Google Doc tabs
**Date:** 2026-05-20
**What happened:** `gog docs write` and `gog docs insert` don't support `--tab` flag. Only `gog docs cat` has `--tab`.
**Fix:** Use `tmp/update_doc_tab.py` — Python script that reads gog's OAuth refresh token from Windows Credential Manager (`keyring:gogcli:token:default:k3yh0l35tud10@gmail.com`), exchanges for access token, then calls Google Docs API batchUpdate with tabId in location/range objects.
**Reuse:** This pattern works for any Google Doc tab write. Update the docId, tabId, and content file path in the script.

## L002 — Konva.js object literal syntax gotcha in minified code
**Date:** 2026-05-25
**What happened:** Writing minified JS for the prototype, used `{(x:expr),(y:expr)}` as object literal syntax. This is invalid JS — parentheses around the property keys are not allowed. Browser silently fails to execute the script.
**Fix:** Always write `{x: expr, y: expr}` (no parens around keys).
**Detection:** `node tmp/check-v4.js` — syntax checker script that extracts and validates the `<script>` block of any prototype HTML file.

## L003 — Konva Transformer distorts stroke width on resize
**Date:** 2026-05-22
**What happened:** When resizing a Konva Rect with the Transformer, `scaleX/scaleY` changes but `width/height` stays the same. This makes the stroke appear thicker/thinner.
**Fix:** Two-part solution:
  1. Set `strokeScaleEnabled: false` on the shape — prevents node's own scale from affecting stroke
  2. On `transformend` event: `rect.width(rect.width() * rect.scaleX()); rect.height(rect.height() * rect.scaleY()); rect.scaleX(1); rect.scaleY(1);`

## L004 — Freeform drawing: clicks on plant nodes block point placement
**Date:** 2026-05-24
**What happened:** In freeform drawing mode, clicking on a placed plant sticker triggered `selectPlant()` instead of adding a freeform point. The stage `click` event only fires for clicks on the stage background, not on child nodes.
**Fix:** Events bubble from node → stage. Intercept in stage click handler: `if (isFreeMode()) { handleFreeClick(); return; }`. Also guard `selectPlant()` with `if (isFreeMode()) return;`. This way all clicks in freeform mode add points regardless of what's underneath.

## L005 — Property boundary closure algorithm
**Date:** 2026-05-24
**What happened:** When a user draws a bed starting and ending on the property boundary, the Konva Line with `closed:true` draws a curved line through the interior to close — not along the boundary edge.
**Fix:** On close, detect if first and last points are `onBoundary:true`. Use `getBoundaryClosure(ptLast, ptFirst, propBounds)` to compute the perimeter corner points to insert between the last freePt and the implicit closure back to first.
**Algorithm:**
  - Get edge index for both points (0=top, 1=right, 2=bottom, 3=left)
  - Compute CW distance `(edgeFirst - edgeLast + 4) % 4` and CCW distance
  - Take shorter path — CW: add `corners[(e+1)%4]` and increment e; CCW: add `corners[e]` and decrement e
  - Corners: [TL, TR, BR, BL] = [corners[0..3]]
  - Same edge = no corners needed; different edge = 1–3 corners inserted
