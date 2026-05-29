// PromoBanner.jsx — Rotating promo banner above the logo bar
// Mirrors v8 exactly: dark green bar, fade transition, 60s auto-advance, < > nav

import { useState, useEffect, useRef } from 'react'
import './PromoBanner.css'

const PROMOS = [
  'Never forget where your garden plants are again',
  'Create your dream garden in your backyard',
  'Tulips done for the year? Change the season and replace them with something new!',
  'Download your Garden Mapper to PDF and have an offline copy.',
  'Plan ahead — see your garden in every season before you plant a single seed.',
]

export default function PromoBanner() {
  const [idx, setIdx]         = useState(0)
  const [visible, setVisible] = useState(true)
  const idxRef = useRef(0)  // always-current idx for the interval closure

  const showPromo = (nextIdx) => {
    const n = (nextIdx + PROMOS.length) % PROMOS.length
    setVisible(false)
    setTimeout(() => {
      idxRef.current = n
      setIdx(n)
      setVisible(true)
    }, 300)
  }

  // Auto-advance every 60s — uses ref so closure always has current idx
  useEffect(() => {
    const timer = setInterval(() => {
      showPromo(idxRef.current + 1)
    }, 60000)
    return () => clearInterval(timer)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="promo-banner">
      <button onClick={() => showPromo(idx - 1)}>&#60;</button>
      <div className="promo-text" style={{ opacity: visible ? 1 : 0 }}>
        {PROMOS[idx]}
      </div>
      <button onClick={() => showPromo(idx + 1)}>&#62;</button>
    </div>
  )
}
