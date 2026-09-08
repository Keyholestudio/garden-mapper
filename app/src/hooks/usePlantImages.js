// usePlantImages.js — Preloads all plant sticker images
// Returns loadedImages map: key → HTMLImageElement
//
// Retry logic: up to 3 attempts per image with exponential backoff (200ms, 600ms, 1400ms).
// Batch loading: images load in groups of 10 to avoid saturating mobile connection queues.
// Failed images after all retries resolve as their src string (string fallback = grey box),
// but a post-load retry sweep re-attempts any remaining string entries once more.

import { useState, useEffect, useRef } from 'react'
import { PLANT_CATALOG } from './usePlantCatalog'

const BATCH_SIZE = 10
const BATCH_DELAY_MS = 50  // ms between batches
const MAX_RETRIES = 3
const RETRY_BASE_MS = 200  // 200ms, 600ms, 1400ms

function loadImageWithRetry(key, src, retries = MAX_RETRIES) {
  return new Promise(res => {
    let attempt = 0

    function tryLoad() {
      const img = new Image()
      img.onload = () => res({ key, img })
      img.onerror = () => {
        attempt++
        if (attempt < retries) {
          const delay = RETRY_BASE_MS * (Math.pow(2, attempt) - 1 + 1)
          setTimeout(tryLoad, delay)
        } else {
          // All retries exhausted — resolve with null so others aren't blocked
          res({ key, img: null })
        }
      }
      img.src = src
    }

    tryLoad()
  })
}

async function loadBatched(entries) {
  const results = {}
  for (let i = 0; i < entries.length; i += BATCH_SIZE) {
    const batch = entries.slice(i, i + BATCH_SIZE)
    const settled = await Promise.all(batch.map(([k, v]) => loadImageWithRetry(k, v)))
    settled.forEach(({ key, img }) => { results[key] = img })
    if (i + BATCH_SIZE < entries.length) {
      await new Promise(r => setTimeout(r, BATCH_DELAY_MS))
    }
  }
  return results
}

export function usePlantImages() {
  const [loadedImages, setLoadedImages] = useState({})
  const [ready, setReady] = useState(false)
  const srcsRef = useRef({})

  useEffect(() => {
    const srcs = {}
    PLANT_CATALOG.forEach(p => { srcs[p.key] = p.src })
    srcsRef.current = srcs

    const entries = Object.entries(srcs)

    loadBatched(entries).then(results => {
      // Merge: keep src string for any that failed (renders as grey placeholder)
      const merged = { ...srcs }
      Object.entries(results).forEach(([k, img]) => {
        if (img) merged[k] = img
      })
      setLoadedImages(merged)
      setReady(true)

      // Post-load sweep: retry any that are still strings (failed all attempts)
      const failed = Object.entries(merged).filter(([, v]) => typeof v === 'string')
      if (failed.length > 0) {
        loadBatched(failed).then(retryResults => {
          setLoadedImages(prev => {
            const next = { ...prev }
            Object.entries(retryResults).forEach(([k, img]) => {
              if (img) next[k] = img
            })
            return next
          })
        })
      }
    })
  }, [])

  return { loadedImages, ready }
}
