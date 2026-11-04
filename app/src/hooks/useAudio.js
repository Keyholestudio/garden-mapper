/**
 * useAudio.js — Garden Mapper audio manager
 *
 * Handles:
 *  - SFX: short one-shot clips (plant place, remove, select, UI)
 *  - Music: looping background tracks with crossfade
 *  - Mute state: persisted to localStorage, separate SFX vs music toggles
 *  - Subscription gate: premium music tracks only resolve if isSubscribed
 *
 * Uses Web Audio API only — zero external deps.
 * Capacitor (Android/iOS) supports Web Audio API natively.
 *
 * Usage:
 *   const audio = useAudio({ isSubscribed })
 *   audio.playSfx('plant-place')
 *   audio.playMusic('garden-morning')
 *   audio.stopMusic()
 *   audio.toggleSfx()
 *   audio.toggleMusic()
 *   audio.sfxEnabled   // boolean
 *   audio.musicEnabled // boolean
 */

import { useState, useEffect, useRef, useCallback } from 'react'

// ---------------------------------------------------------------------------
// Sound registry — add new sounds here only
// ---------------------------------------------------------------------------
const SFX_FILES = {
  'plant-place':  '/sounds/sfx/plant-place.mp3',
  'plant-remove': '/sounds/sfx/plant-remove.mp3',
  'plant-select': '/sounds/sfx/plant-select.mp3',
  'decor-place':  '/sounds/sfx/decor-place.mp3',
  'ui-click':     '/sounds/sfx/ui-click.mp3',
  'save':         '/sounds/sfx/save.mp3',
  'season-change':'/sounds/sfx/season-change.mp3',
}

// Playlist order — Rob's preferred sequence
const PLAYLIST = [
  { key: 'track-07', url: '/sounds/music/free/track-07-dream-of-a-garden-alt.mp3', label: 'Dream of a Garden Reprise' },
  { key: 'track-01', url: '/sounds/music/free/track-01-town-ocean-view.mp3',        label: 'Town with an Ocean View' },
  { key: 'track-02', url: '/sounds/music/free/track-02-dream-of-a-garden.mp3',      label: 'Dream of a Garden' },
  { key: 'track-03', url: '/sounds/music/free/track-03-town-ocean-view-alt.mp3',    label: 'Town with an Ocean View Reprise' },
  { key: 'track-04', url: '/sounds/music/free/track-04-garden-party-alt.mp3',       label: 'Garden Party' },
  { key: 'track-05', url: '/sounds/music/free/track-05-garden-ocean-view.mp3',      label: 'Garden with a Meadow View' },
  { key: 'track-06', url: '/sounds/music/free/track-06-garden-party.mp3',           label: 'Garden Party Reprise' },
]

// Premium placeholder — add tracks here when music pack is ready
const PLAYLIST_PREMIUM = []

const DEFAULT_TRACK_INDEX = 0
const MUSIC_VOLUME = 0.35   // subtle background level
const SFX_VOLUME   = 0.7
const FADE_DURATION = 1.5   // seconds for music crossfade

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function getStoredBool(key, fallback = true) {
  try {
    const v = localStorage.getItem(key)
    return v === null ? fallback : v === 'true'
  } catch { return fallback }
}

function storeBool(key, val) {
  try { localStorage.setItem(key, String(val)) } catch {}
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------
export function useAudio({ isSubscribed = false } = {}) {
  const [sfxEnabled,   setSfxEnabled]   = useState(() => getStoredBool('audio_sfx', true))
  const [musicEnabled, setMusicEnabled] = useState(() => getStoredBool('audio_music', true))
  const [shuffle,      setShuffle]      = useState(() => getStoredBool('audio_shuffle', false))
  const [trackIndex,   setTrackIndex]   = useState(DEFAULT_TRACK_INDEX)

  const ctxRef        = useRef(null)   // AudioContext
  const sfxCacheRef   = useRef({})     // key → AudioBuffer
  const musicNodeRef  = useRef(null)   // current music BufferSourceNode
  const musicGainRef  = useRef(null)   // GainNode for music volume/fade
  const currentTrack  = useRef(null)   // track key currently playing
  const playGenRef    = useRef(0)      // increments on every play request; stale loads self-cancel
  const shuffleRef      = useRef(shuffle)
  const trackIndexRef   = useRef(trackIndex)
  const shuffleQueueRef = useRef([])   // exhausting shuffle queue
  useEffect(() => { shuffleRef.current = shuffle }, [shuffle])
  useEffect(() => { trackIndexRef.current = trackIndex }, [trackIndex])

  // ------------------------------------------------------------------
  // AudioContext — created lazily on first user gesture
  // ------------------------------------------------------------------
  const getCtx = useCallback(() => {
    if (!ctxRef.current) {
      ctxRef.current = new (window.AudioContext || window.webkitAudioContext)()
    }
    if (ctxRef.current.state === 'suspended') {
      ctxRef.current.resume()
    }
    return ctxRef.current
  }, [])

  // ------------------------------------------------------------------
  // Load an audio buffer (cached)
  // ------------------------------------------------------------------
  const loadBuffer = useCallback(async (url) => {
    if (sfxCacheRef.current[url]) return sfxCacheRef.current[url]
    try {
      const ctx = getCtx()
      const res = await fetch(url)
      if (!res.ok) throw new Error(`Audio fetch failed: ${url}`)
      const ab  = await res.arrayBuffer()
      const buf = await ctx.decodeAudioData(ab)
      sfxCacheRef.current[url] = buf
      return buf
    } catch (e) {
      console.warn('[useAudio] loadBuffer error:', e)
      return null
    }
  }, [getCtx])

  // ------------------------------------------------------------------
  // SFX — fire and forget
  // ------------------------------------------------------------------
  const playSfx = useCallback(async (name) => {
    if (!sfxEnabled) return
    const url = SFX_FILES[name]
    if (!url) return
    const ctx = getCtx()
    const buf = await loadBuffer(url)
    if (!buf) return
    const src  = ctx.createBufferSource()
    const gain = ctx.createGain()
    gain.gain.value = SFX_VOLUME
    src.buffer = buf
    src.connect(gain)
    gain.connect(ctx.destination)
    src.start()
  }, [sfxEnabled, getCtx, loadBuffer])

  // ------------------------------------------------------------------
  // Build active playlist (free + premium if subscribed)
  // ------------------------------------------------------------------
  const getPlaylist = useCallback(() => {
    return isSubscribed ? [...PLAYLIST, ...PLAYLIST_PREMIUM] : PLAYLIST
  }, [isSubscribed])

  // ------------------------------------------------------------------
  // Music — sequential or shuffle, advances to next track on end
  // ------------------------------------------------------------------
  const stopMusic = useCallback((fadeSecs = FADE_DURATION) => {
    if (!musicNodeRef.current) return
    const node = musicNodeRef.current
    const gain = musicGainRef.current
    // Null refs immediately so the generation check in playTrackAtIndex
    // doesn't see a stale node and start stacking sources
    musicNodeRef.current = null
    musicGainRef.current = null
    currentTrack.current = null
    if (gain && fadeSecs > 0) {
      const ctx = getCtx()
      gain.gain.setTargetAtTime(0, ctx.currentTime, fadeSecs / 3)
      setTimeout(() => { try { node.stop() } catch {} }, fadeSecs * 1000)
    } else {
      try { node.stop() } catch {}
    }
  }, [getCtx])

  // ------------------------------------------------------------------
  // Shuffle queue — exhausts all tracks before repeating
  // ------------------------------------------------------------------
  const getNextShuffleIndex = useCallback(() => {
    const pl = getPlaylist()
    if (!shuffleQueueRef.current.length) {
      // Refill: all indexes except current, then shuffle
      const pool = pl.map((_, i) => i).filter(i => i !== trackIndexRef.current)
      for (let i = pool.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));[pool[i], pool[j]] = [pool[j], pool[i]]
      }
      shuffleQueueRef.current = pool
    }
    return shuffleQueueRef.current.shift()
  }, [getPlaylist])

  // ------------------------------------------------------------------
  // Core player — loads + starts a track by index, no state side-effects
  // ------------------------------------------------------------------
  const playTrackAtIndex = useCallback(async (index) => {
    const playlist = getPlaylist()
    if (!playlist.length) return
    const safeIndex = ((index % playlist.length) + playlist.length) % playlist.length
    const track = playlist[safeIndex]
    if (!track) return

    // Claim generation — stale in-flight loads bail out
    const gen = ++playGenRef.current

    stopMusic(0.3)

    // Update index state + ref together, before the async gap
    trackIndexRef.current = safeIndex
    setTrackIndex(safeIndex)

    const ctx = getCtx()
    const buf = await loadBuffer(track.url)
    if (!buf) return
    if (gen !== playGenRef.current) return  // superseded

    const gain = ctx.createGain()
    gain.gain.value = 0
    gain.connect(ctx.destination)

    const src = ctx.createBufferSource()
    src.buffer = buf
    src.loop   = false
    src.connect(gain)

    // On track end — auto-advance without touching React state directly
    src.onended = () => {
      if (musicNodeRef.current !== src) return  // stopped manually
      const next = shuffleRef.current
        ? getNextShuffleIndex()
        : (trackIndexRef.current + 1) % getPlaylist().length
      playTrackAtIndex(next)
    }

    src.start()
    gain.gain.setTargetAtTime(MUSIC_VOLUME, ctx.currentTime, FADE_DURATION / 3)

    musicNodeRef.current = src
    musicGainRef.current = gain
    currentTrack.current = track.key
  }, [getCtx, getPlaylist, getNextShuffleIndex, loadBuffer, stopMusic])

  const playMusic = useCallback(() => {
    playTrackAtIndex(trackIndexRef.current)
  }, [playTrackAtIndex])

  const nextTrack = useCallback(() => {
    const next = shuffleRef.current
      ? getNextShuffleIndex()
      : (trackIndexRef.current + 1) % getPlaylist().length
    playTrackAtIndex(next)
  }, [getPlaylist, getNextShuffleIndex, playTrackAtIndex])

  const prevTrack = useCallback(() => {
    const playlist = getPlaylist()
    const prev = ((trackIndexRef.current - 1) + playlist.length) % playlist.length
    playTrackAtIndex(prev)
  }, [getPlaylist, playTrackAtIndex])

  // ------------------------------------------------------------------
  // Toggles — persist to localStorage
  // ------------------------------------------------------------------
  const toggleSfx = useCallback(() => {
    setSfxEnabled(v => {
      storeBool('audio_sfx', !v)
      return !v
    })
  }, [])

  const toggleMusic = useCallback(() => {
    setMusicEnabled(v => {
      const next = !v
      storeBool('audio_music', next)
      if (!next) stopMusic()
      return next
    })
  }, [stopMusic])

  const toggleShuffle = useCallback(() => {
    setShuffle(v => {
      storeBool('audio_shuffle', !v)
      return !v
    })
  }, [])

  // ------------------------------------------------------------------
  // Autoplay gate — browsers block AudioContext until a user gesture.
  // We listen for the first interaction, then start music.
  // ------------------------------------------------------------------
  const startedRef    = useRef(false)
  const wasPlayingRef  = useRef(false)  // tracks music state across page hide/show

  const tryStart = useCallback(() => {
    if (startedRef.current) return
    if (!musicEnabled) return
    startedRef.current = true
    playTrackAtIndex(trackIndexRef.current)
  }, [musicEnabled, playTrackAtIndex])

  useEffect(() => {
    const events = ['click', 'keydown', 'touchstart', 'pointerdown']
    const handler = () => tryStart()
    events.forEach(e => window.addEventListener(e, handler, { once: true, passive: true }))
    return () => events.forEach(e => window.removeEventListener(e, handler))
  }, [tryStart])

  // ------------------------------------------------------------------
  // Handle music toggle on/off after first interaction
  // ------------------------------------------------------------------
  useEffect(() => {
    if (!startedRef.current) return  // not yet unlocked by user gesture
    if (musicEnabled) {
      playTrackAtIndex(trackIndexRef.current)
    } else {
      stopMusic()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [musicEnabled])

  // ------------------------------------------------------------------
  // Page Visibility — pause on hide, resume on return
  // ------------------------------------------------------------------
  useEffect(() => {
    const handleVisibility = () => {
      if (!startedRef.current) return
      if (document.visibilityState === 'hidden') {
        wasPlayingRef.current = !!musicNodeRef.current
        stopMusic(0.3)
      } else if (document.visibilityState === 'visible') {
        if (wasPlayingRef.current && musicEnabled) {
          playTrackAtIndex(trackIndexRef.current)
        }
      }
    }
    document.addEventListener('visibilitychange', handleVisibility)
    return () => document.removeEventListener('visibilitychange', handleVisibility)
  }, [musicEnabled, stopMusic, playTrackAtIndex])

  // ------------------------------------------------------------------
  // Cleanup on unmount
  // ------------------------------------------------------------------
  useEffect(() => {
    return () => {
      try { musicNodeRef.current?.stop() } catch {}
      try { ctxRef.current?.close() }      catch {}
    }
  }, [])

  return {
    playSfx,
    playMusic,
    stopMusic,
    nextTrack,
    prevTrack,
    toggleSfx,
    toggleMusic,
    toggleShuffle,
    sfxEnabled,
    musicEnabled,
    shuffle,
    trackIndex,
    playlist: getPlaylist(),
    currentTrackLabel: getPlaylist()[trackIndex]?.label ?? '',
  }
}
