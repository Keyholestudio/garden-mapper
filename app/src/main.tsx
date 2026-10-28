import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'
import ErrorBoundary from './components/ErrorBoundary'

createRoot(document.getElementById('app')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)

// Fade out splash screen after app mounts
const splash = document.getElementById('splash')
if (splash) {
  // Minimum display time: 1.2s so it doesn't just flash
  const MIN_MS = 2000
  const start = performance.now()
  const fadeOut = () => {
    const elapsed = performance.now() - start
    const delay = Math.max(0, MIN_MS - elapsed)
    setTimeout(() => {
      splash.style.transition = 'opacity 1.2s ease'
      splash.style.opacity = '0'
      splash.addEventListener('transitionend', () => splash.remove(), { once: true })
    }, delay)
  }
  // Trigger after first paint settles
  requestAnimationFrame(() => requestAnimationFrame(fadeOut))
}
