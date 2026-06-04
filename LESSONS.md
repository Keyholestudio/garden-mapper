# Garden Planner — Project Lessons
_L001–L009 archived at: `memory/deep/garden-planner/lessons-archive.md`_

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
