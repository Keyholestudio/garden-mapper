# Garden Planner — Project Lessons
_L001–L009 archived at: `memory/deep/garden-planner/lessons-archive.md`_

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

## L012 — Reference v8 before solving any canvas/visual/coordinate problem
**Date:** 2026-05-31
v8 has working Konva math. The React scaffold is a port of v8, not a rewrite. Before writing any positioning, coordinate conversion, drawing, or visual behaviour — read v8 first. If v8 has it, copy it exactly and adapt for React.
**Applies to:** getClientRect, coordinate transforms, pan/zoom math, shape drawing, preview lines, highlights.
