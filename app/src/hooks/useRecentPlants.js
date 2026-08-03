// useRecentPlants.js — Persistent recently-used plant list
// Stored in localStorage under 'gardenRecentPlants'
// Max 5 entries. User can hide the section or remove individual items.

import { useState, useCallback } from 'react'

const LS_KEY     = 'gardenRecentPlants'
const LS_HIDDEN  = 'gardenRecentPlantsHidden'
const MAX_RECENT = 5
// Non-plant families that should never appear in the recently-used list
const NON_PLANT_FAMILIES = ['Decor', 'Water Feature']

function readLS() {
  try { return JSON.parse(localStorage.getItem(LS_KEY) || '[]') } catch { return [] }
}
function writeLS(arr) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(arr)) } catch {}
}
function readHidden() {
  try { return localStorage.getItem(LS_HIDDEN) === 'true' } catch { return false }
}

export function useRecentPlants() {
  const [recents, setRecents] = useState(() => readLS())
  const [hidden,  setHidden]  = useState(() => readHidden())

  const addRecent = useCallback((entry, { defer } = {}) => {
    // Skip non-plant entries (decor, water features, etc.)
    if (NON_PLANT_FAMILIES.includes(entry?.family)) return
    // Store only what's needed for display (no Konva/Image objects — those can't be serialised)
    const slim = { key: entry.key, label: entry.label, family: entry.family, src: entry.src, size: entry.size, seasons: entry.seasons }
    // Always write to localStorage immediately so it persists even if the state update is deferred.
    // When defer=true, delay the setRecents call so no React re-render occurs mid-drag/click —
    // a re-render during an in-flight drag causes the browser to drop the drag connection.
    const apply = () => {
      setRecents(prev => {
        const next = [slim, ...prev.filter(r => r.key !== slim.key)].slice(0, MAX_RECENT)
        writeLS(next)
        return next
      })
    }
    if (defer) {
      writeLS([slim, ...readLS().filter(r => r.key !== slim.key)].slice(0, MAX_RECENT))
      setTimeout(apply, 0)
    } else {
      apply()
    }
  }, [])

  const removeRecent = useCallback((key) => {
    setRecents(prev => {
      const next = prev.filter(r => r.key !== key)
      writeLS(next)
      return next
    })
  }, [])

  const clearRecents = useCallback(() => {
    setRecents([])
    writeLS([])
  }, [])

  const setHiddenPersist = useCallback((val) => {
    setHidden(val)
    try { localStorage.setItem(LS_HIDDEN, String(val)) } catch {}
  }, [])

  return { recents, addRecent, removeRecent, clearRecents, hidden, setHidden: setHiddenPersist }
}
