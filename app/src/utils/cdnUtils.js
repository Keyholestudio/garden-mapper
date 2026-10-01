// cdnUtils.js — CDN asset resolution for native vs web
// On native (Android/iOS), sticker assets are served from CDN (Vercel) instead of bundled
// locally. This keeps the APK under Play Store limits (~30 MB vs 750 MB bundled).
// On web, relative paths are used as-is (Vercel serves them directly).

import { Capacitor } from '@capacitor/core'

export const IS_NATIVE = Capacitor.isNativePlatform()
export const CDN_BASE = IS_NATIVE ? 'https://app.gardenmapper.ca' : ''

/**
 * Resolves a sticker src path to the correct URL for the current platform.
 * Web: returns the path unchanged (relative, served by Vite/Vercel)
 * Native: prepends the CDN base URL so assets load from Vercel
 */
export const stickerSrc = (src) => {
  if (!src) return null
  if (!IS_NATIVE) return src
  // Already absolute (e.g. already prefixed) — don't double-prefix
  if (src.startsWith('http://') || src.startsWith('https://')) return src
  return `${CDN_BASE}${src}`
}
