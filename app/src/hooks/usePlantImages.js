// usePlantImages.js — Preloads all plant sticker images
// Returns loadedImages map: key → HTMLImageElement

import { useState, useEffect } from 'react'
import { PLANT_CATALOG } from './usePlantCatalog'

export function usePlantImages() {
  const [loadedImages, setLoadedImages] = useState({})
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const srcs = {}
    PLANT_CATALOG.forEach(p => { srcs[p.key] = p.src })

    Promise.all(
      Object.entries(srcs).map(([k, v]) =>
        new Promise(res => {
          const img = new Image()
          img.onload  = () => { srcs[k] = img; res() }
          img.onerror = () => res()
          img.src = v
        })
      )
    ).then(() => {
      setLoadedImages({ ...srcs })
      setReady(true)
    })
  }, [])

  return { loadedImages, ready }
}
