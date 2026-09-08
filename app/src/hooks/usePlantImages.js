// usePlantImages.js — Preloads all plant sticker images
// Returns loadedImages map: key → HTMLImageElement
//
// Strategy:
//   Web:    Batch of 10, 50ms between batches, 3 retries (fast CDN/cache)
//   Native: Batch of 3,  150ms between batches, 5 retries (Capacitor WebView asset serving is slower)
//           Images also load lazily — garden renders immediately, images fill in as they load.
//
// Each failed image retries with exponential backoff before resolving null.
// A post-load sweep re-attempts any still-null entries once more.

import { useState, useEffect } from 'react'
import { Capacitor } from '@capacitor/core'
import { PLANT_CATALOG } from './usePlantCatalog'

const IS_NATIVE = Capacitor.isNativePlatform()

const BATCH_SIZE    = IS_NATIVE ? 3  : 10
const BATCH_DELAY   = IS_NATIVE ? 150 : 50   // ms between batches
const MAX_RETRIES   = IS_NATIVE ? 5  : 3
const RETRY_BASE_MS = IS_NATIVE ? 300 : 200

function loadImageWithRetry(key, src, retries = MAX_RETRIES) {
  return new Promise(res => {
    let attempt = 0

    function tryLoad() {
      const img = new Image()
      img.onload = () => res({ key, img })
      img.onerror = () => {
        attempt++
        if (attempt < retries) {
          // Exponential backoff: RETRY_BASE_MS, 2x, 4x …
          const delay = RETRY_BASE_MS * Math.pow(2, attempt - 1)
          setTimeout(tryLoad, delay)
        } else {
          res({ key, img: null })
        }
      }
      img.src = src
    }

    tryLoad()
  })
}

async function loadBatched(entries, onBatchDone) {
  const results = {}
  for (let i = 0; i < entries.length; i += BATCH_SIZE) {
    const batch = entries.slice(i, i + BATCH_SIZE)
    const settled = await Promise.all(batch.map(([k, v]) => loadImageWithRetry(k, v)))
    settled.forEach(({ key, img }) => { if (img) results[key] = img })
    // Notify caller after each batch so canvas can update incrementally
    if (onBatchDone) onBatchDone({ ...results })
    if (i + BATCH_SIZE < entries.length) {
      await new Promise(r => setTimeout(r, BATCH_DELAY))
    }
  }
  return results
}

export function usePlantImages() {
  const [loadedImages, setLoadedImages] = useState({})
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const entries = PLANT_CATALOG.map(p => [p.key, p.src])

    // On native: mark ready immediately so the canvas renders without waiting.
    // Images fill in progressively as batches complete.
    if (IS_NATIVE) setReady(true)

    loadBatched(entries, batchResult => {
      // Update state after each batch — canvas refreshes progressively
      setLoadedImages(prev => ({ ...prev, ...batchResult }))
    }).then(results => {
      setLoadedImages(prev => ({ ...prev, ...results }))
      if (!IS_NATIVE) setReady(true)

      // Post-load sweep: retry any that are still missing
      const failed = PLANT_CATALOG.filter(p => !results[p.key])
      if (failed.length > 0) {
        const failedEntries = failed.map(p => [p.key, p.src])
        loadBatched(failedEntries, batchResult => {
          setLoadedImages(prev => ({ ...prev, ...batchResult }))
        })
      }
    })
  }, [])

  return { loadedImages, ready }
}
