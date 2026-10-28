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

import { useState, useEffect } from 'react'
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
async function loadSequential(catalog, onLoad) {
  for (const p of catalog) {
    const img = await loadImageWithRetry(p.src, 3, 300)
    if (img) onLoad(p.key, img)
  }
}

// Batched loader (web) — groups of BATCH_SIZE with delay between batches.
async function loadBatched(catalog, onBatchDone) {
  const BATCH_SIZE = 10
  const BATCH_DELAY = 50
  const results = {}
  for (let i = 0; i < catalog.length; i += BATCH_SIZE) {
    const batch = catalog.slice(i, i + BATCH_SIZE)
    const settled = await Promise.all(
      batch.map(p => loadImageWithRetry(p.src, 3, 200).then(img => ({ key: p.key, img })))
    )
    settled.forEach(({ key, img }) => { if (img) results[key] = img })
    onBatchDone({ ...results })
    if (i + BATCH_SIZE < catalog.length) await new Promise(r => setTimeout(r, BATCH_DELAY))
  }
  return results
}

export function usePlantImages() {
  const [loadedImages, setLoadedImages] = useState({})
  const [ready, setReady]   = useState(false)

  useEffect(() => {
    // Full catalog: core PLANT_CATALOG + all pack entries, garden-used plants first
    const fullCatalog = buildLoadOrder(PLANT_CATALOG_TRAY)

    if (IS_NATIVE) {
      // Native: mark ready immediately so canvas renders, then stream images in one-by-one
      setReady(true)
      loadSequential(fullCatalog, (key, img) => {
        setLoadedImages(prev => ({ ...prev, [key]: img }))
      })
    } else {
      // Web: batched loading, mark ready after first pass
      loadBatched(fullCatalog, batchResult => {
        setLoadedImages(prev => ({ ...prev, ...batchResult }))
      }).then(results => {
        setReady(true)
        // Post-load sweep for anything that failed
        const failed = fullCatalog.filter(p => !results[p.key])
        if (failed.length > 0) {
          loadBatched(failed, batchResult => {
            setLoadedImages(prev => ({ ...prev, ...batchResult }))
          })
        }
      })
    }
  }, [])

  return { loadedImages, ready }
}
