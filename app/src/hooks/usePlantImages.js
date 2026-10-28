// usePlantImages.js — Preloads all plant sticker images
// Returns loadedImages map: key → HTMLImageElement
//
// Strategy:
//   Web:    Batch of 10, 50ms between batches, 3 retries (fast CDN/cache)
//   Native: Sequential one-at-a-time with 3 retries per image.
//           Capacitor's WebViewLocalServer uses a fixed thread pool for asset serving.
//           Concurrent requests beyond the pool size block each other, causing random
//           onerror failures that aren't real missing-file errors. Sequential loading
//           eliminates thread pool contention entirely.
//           Garden renders immediately (ready=true fires before loading starts).
//
// Load order (garden-first priority):
//   1. Plants used in the saved garden (extracted from localStorage)
//   2. All remaining catalog entries (PLANT_CATALOG + ALL_PACK_ENTRIES)
//   This ensures the canvas renders with correct stickers immediately,
//   and the full tray populates progressively instead of freezing mid-way.

import { useState, useEffect, useRef, useCallback } from 'react'
import { Capacitor } from '@capacitor/core'
import { PLANT_CATALOG, PLANT_CATALOG_TRAY } from './usePlantCatalog'

// Extract plant keys from the saved garden in localStorage.
// Reads gardenData (array of gardens) and returns a Set of plant keys in use.
function getGardenPlantKeys() {
  try {
    const raw = localStorage.getItem('gardenData')
    if (!raw) return new Set()
    const gardens = JSON.parse(raw)
    const keys = new Set()
    const list = Array.isArray(gardens) ? gardens : [gardens]
    list.forEach(garden => {
      if (!garden) return
      const plants = garden.plants || []
      plants.forEach(p => { if (p.key) keys.add(p.key) })
    })
    return keys
  } catch {
    return new Set()
  }
}

// Build the full load order: garden-used plants first, then the rest.
// Deduplicates by key so no image is loaded twice.
function buildLoadOrder(catalog) {
  const gardenKeys = getGardenPlantKeys()
  const seen = new Set()
  const priority = []
  const rest = []
  catalog.forEach(p => {
    if (seen.has(p.key)) return
    seen.add(p.key)
    if (gardenKeys.has(p.key)) priority.push(p)
    else rest.push(p)
  })
  return [...priority, ...rest]
}

const IS_NATIVE = Capacitor.isNativePlatform()

function loadImageWithRetry(src, maxRetries = 3, retryDelayMs = 200) {
  return new Promise(resolve => {
    let attempt = 0
    const try_ = () => {
      const img = new Image()
      img.onload  = () => resolve(img)
      img.onerror = () => {
        attempt++
        if (attempt < maxRetries) setTimeout(try_, retryDelayMs * Math.pow(2, attempt - 1))
        else resolve(null)
      }
      img.src = src
    }
    try_()
  })
}

// Sequential loader — one image at a time, calls onLoad after each success.
// Accepts a queueRef so priority items can be injected at the front mid-run.
async function loadSequential(initialQueue, onLoad, queueRef) {
  queueRef.current = [...initialQueue]
  while (queueRef.current.length > 0) {
    const p = queueRef.current.shift()
    const img = await loadImageWithRetry(p.src, 3, 300)
    if (img) onLoad(p.key, img)
  }
}

// Batched loader (web) — groups of BATCH_SIZE with delay between batches.
// onBatchDone receives only the NEW entries per batch (not cumulative) — keeps state updates small.
async function loadBatched(initialQueue, onBatchDone, queueRef) {
  const BATCH_SIZE = 10
  const BATCH_DELAY = 50
  const results = {}
  queueRef.current = [...initialQueue]
  while (queueRef.current.length > 0) {
    const batch = queueRef.current.splice(0, BATCH_SIZE)
    const batchResult = {}
    const settled = await Promise.all(
      batch.map(p => loadImageWithRetry(p.src, 3, 200).then(img => ({ key: p.key, img })))
    )
    settled.forEach(({ key, img }) => { if (img) { results[key] = img; batchResult[key] = img } })
    if (Object.keys(batchResult).length > 0) onBatchDone(batchResult)
    if (queueRef.current.length > 0) await new Promise(r => setTimeout(r, BATCH_DELAY))
  }
  return results
}

export function usePlantImages() {
  const [loadedImages, setLoadedImages] = useState({})
  const [ready, setReady]   = useState(false)
  // Shared mutable queue — the active loader reads from this ref each iteration.
  // prioritize() prepends unloaded entries so they get loaded in the next batch/step.
  const queueRef = useRef([])
  const loadedRef = useRef({})  // mirrors loadedImages for sync key-existence checks

  useEffect(() => {
    // Full catalog: core PLANT_CATALOG + all pack entries, garden-used plants first
    const fullCatalog = buildLoadOrder(PLANT_CATALOG_TRAY)

    if (IS_NATIVE) {
      // Native: mark ready immediately so canvas renders, then stream images in one-by-one
      setReady(true)
      loadSequential(fullCatalog, (key, img) => {
        loadedRef.current[key] = img
        setLoadedImages(prev => ({ ...prev, [key]: img }))
      }, queueRef)
    } else {
      // Web: batched loading, mark ready after first pass
      loadBatched(fullCatalog, batchResult => {
        Object.assign(loadedRef.current, batchResult)
        setLoadedImages(prev => ({ ...prev, ...batchResult }))
      }, queueRef).then(results => {
        setReady(true)
        // Post-load sweep for anything that failed
        const failed = fullCatalog.filter(p => !results[p.key])
        if (failed.length > 0) {
          loadBatched(failed, batchResult => {
            Object.assign(loadedRef.current, batchResult)
            setLoadedImages(prev => ({ ...prev, ...batchResult }))
          }, { current: [] })  // fresh queue, no priority needed for retry pass
        }
      })
    }
  }, [])

  // Inject keys to the front of the load queue so they load next.
  // Safe to call at any time — skips already-loaded keys.
  const prioritize = useCallback((keys) => {
    if (!keys?.length) return
    const catalog = PLANT_CATALOG_TRAY
    const byKey = {}
    catalog.forEach(p => { byKey[p.key] = p })

    // Find entries that are not yet loaded and not already at the front of the queue
    const toPromote = []
    const frontKeys = new Set(queueRef.current.slice(0, 20).map(p => p.key))
    keys.forEach(key => {
      if (loadedRef.current[key]) return     // already loaded
      if (frontKeys.has(key)) return         // already near the front
      const entry = byKey[key]
      if (entry) toPromote.push(entry)
    })

    if (toPromote.length === 0) return

    // Remove promoted entries from their current position in the queue (avoid duplicates)
    const promoteKeys = new Set(toPromote.map(p => p.key))
    queueRef.current = [
      ...toPromote,
      ...queueRef.current.filter(p => !promoteKeys.has(p.key)),
    ]
  }, [])

  return { loadedImages, ready, prioritize }
}
