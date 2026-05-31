// useBreakpoint.js — Responsive layout detection
// Returns the current breakpoint and convenience booleans.
//
// Breakpoints (matches mockup targets):
//   mobile  → < 600px  wide  (phone portrait/landscape)
//   tablet  → 600–1024px     (iPad, small laptop)
//   desktop → > 1024px       (web browser, large screen)
//
// Usage:
//   const { isMobile, isTablet, isDesktop, breakpoint } = useBreakpoint()

import { useState, useEffect } from 'react'

const MOBILE_MAX  = 600
const TABLET_MAX  = 1024

function getBreakpoint(w) {
  if (w < MOBILE_MAX)  return 'mobile'
  if (w < TABLET_MAX)  return 'tablet'
  return 'desktop'
}

export function useBreakpoint() {
  const [breakpoint, setBreakpoint] = useState(() => getBreakpoint(window.innerWidth))

  useEffect(() => {
    const handler = () => setBreakpoint(getBreakpoint(window.innerWidth))
    window.addEventListener('resize', handler)
    return () => window.removeEventListener('resize', handler)
  }, [])

  return {
    breakpoint,
    isMobile:  breakpoint === 'mobile',
    isTablet:  breakpoint === 'tablet',
    isDesktop: breakpoint === 'desktop',
  }
}
