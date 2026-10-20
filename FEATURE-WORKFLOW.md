# FEATURE-WORKFLOW.md — Garden Mapper
_How to safely test, roll back, and ship features without touching production._

---

## The Golden Rule
**`main` = production. Vercel auto-deploys from `main` only. Never develop directly on `main`.**

---

## 1. Starting a Feature or Test

```bash
# Always branch off the latest main
git checkout main
git pull origin main
git checkout -b feat/short-description
```

**Naming conventions:**
| Prefix | Use |
|--------|-----|
| `feat/` | New feature (e.g. `feat/raised-bed`) |
| `fix/` | Bug fix (e.g. `fix/rock-border-drag`) |
| `test/` | Experimental / throwaway (e.g. `test/opacity-slider`) |
| `chore/` | Docs, cleanup, non-code (e.g. `chore/update-lessons`) |

---

## 2. While Testing Locally

- Dev server: `cd projects/garden-planner/app && npm run dev` → http://localhost:5200
- Vercel does **not** deploy feature branches (only `main`) — you're safe to experiment
- Commit freely on the branch: `git commit -m "test: trying X"`
- Nothing reaches the live app until you merge to `main`

---

## 3. Shipping — Merge to Main

Once the feature is confirmed working:

```bash
git checkout main
git merge feat/short-description
git push origin main
```

Vercel picks it up in ~15s. Verify on https://app.gardenmapper.ca.

Then clean up the branch:
```bash
git branch -D feat/short-description
```

---

## 4. Rolling Back

### Option A — Feature was never merged (branch still exists)
Just delete the branch. Main is untouched.
```bash
git branch -D feat/short-description
```

### Option B — Feature was just merged, nothing else committed since
```bash
git checkout main
git revert HEAD        # creates a new "undo" commit — safe, non-destructive
git push origin main
```

### Option C — Feature was merged but more commits happened after
Find the bad commit hash, then revert just that one:
```bash
git log --oneline -20                    # find the commit to undo
git revert <commit-hash>                 # reverts just that commit
git push origin main
```

### Option D — Nuclear option (local only, use with caution)
Only if nothing was pushed yet and you want to fully erase:
```bash
git reset --hard HEAD~1                  # destroys last commit locally
# Do NOT push with --force unless Rob explicitly approves
```

---

## 5. Keeping Files Local Only (Never Commit)

If you have test files, scratch components, or local-only experiments:

```bash
# Add to .gitignore
echo "src/components/TestFeature.jsx" >> .gitignore
```

**Warning:** If the file is imported anywhere in production code, Vite will still bundle it even if gitignored. Keep test imports inside the feature branch only.

---

## 6. Checking Branch Status

```bash
git status                     # what's changed locally
git branch -a                  # all branches (local + remote)
git log --oneline -10          # recent commits on current branch
git diff main...feat/xyz --stat  # what's different from main
```

---

## 7. Stale Branch Cleanup

Run occasionally to check for leftover branches:
```bash
git branch          # list local branches
git branch -D <name>  # delete a stale local branch
```

Remote branches (if any were ever pushed):
```bash
git push origin --delete <name>
```

---

## 8. Emergency: Revert to a Known Good State

If the live app is broken and you need to roll back to a specific past commit:

```bash
git log --oneline -20                         # find the last good commit hash
git revert <bad-commit-hash>                  # safe: makes a new undo commit
git push origin main
```

Vercel deploys the revert in ~15s. No data loss, full history preserved.

---

## Quick Reference Card

| Situation | Command |
|-----------|---------|
| Start feature | `git checkout -b feat/name` |
| Ship to production | `git checkout main && git merge feat/name && git push origin main` |
| Kill unmerged feature | `git branch -D feat/name` |
| Undo last merge | `git revert HEAD && git push origin main` |
| Undo specific commit | `git revert <hash> && git push origin main` |
| List all branches | `git branch -a` |
| Check what's different from main | `git diff main...feat/name --stat` |
| Keep file local only | Add path to `.gitignore` |

---

_Last updated: 2026-10-17_
