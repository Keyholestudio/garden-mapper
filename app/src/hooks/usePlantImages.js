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

import { useState, useEffect } from 'react'
import { Capacitor } from '@capacitor/core'
import { PLANT_CATALOG } from './usePlantCatalog'

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
    if (IS_NATIVE) {
      // Native: mark ready immediately so canvas renders, then stream images in one-by-one
      setReady(true)
      loadSequential(PLANT_CATALOG, (key, img) => {
        setLoadedImages(prev => ({ ...prev, [key]: img }))
      })
    } else {
      // Web: batched loading, mark ready after first pass
      loadBatched(PLANT_CATALOG, batchResult => {
        setLoadedImages(prev => ({ ...prev, ...batchResult }))
      }).then(results => {
        setReady(true)
        // Post-load sweep for anything that failed
        const failed = PLANT_CATALOG.filter(p => !results[p.key])
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
