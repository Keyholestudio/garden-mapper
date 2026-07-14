import { useState, useEffect, useCallback } from 'react';
import { supabase, fetchCloudGardens, pushCloudGarden, softDeleteCloudGarden } from '../supabase';
import { Browser } from '@capacitor/browser';
import { App } from '@capacitor/app';

const APP_REDIRECT_URL = 'ca.gardenmapper.app://auth/callback';  // Capacitor deep-link
const WEB_REDIRECT_URL = `${window.location.origin}/auth/callback`;  // Web browser redirect

// True when running inside a Capacitor native wrapper (Android/iOS), false on plain web
const isNative = !!(window.Capacitor?.isNative);

/**
 * useAuth — manages Supabase auth state + cloud sync triggers.
 *
 * Sync policy (SYNC-POLICY.md):
 * - Cloud wins on empty local
 * - Local wins when local data exists
 * - Never auto-overwrite cloud with empty local
 * - Restore prompt on reinstall (empty local + signed in)
 */
// Dream Garden detection — belt + suspenders
function isDreamGarden(g) {
  return !!(g?._isDreamGarden) || g?.name === '🌸 Dream Garden';
}

export function useAuth({ getLocalGardens, setLocalGardens }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [debugMsg, setDebugMsg] = useState('');

  // ── Restore prompt (new device — cloud gardens not in local) ──────
  const [showRestorePrompt, setShowRestorePrompt] = useState(false);
  const [cloudGardenData, setCloudGardenData] = useState(null); // array of cloud-only gardens

  // ── Conflict prompt (same garden, cloud is newer) ─────────────────
  const [conflictGardens, setConflictGardens] = useState([]); // [{ local, cloud }]
  const [showConflictPrompt, setShowConflictPrompt] = useState(false);

  // ── Ghost gardens (cloud-only, subscription gated) ───────────────
  // Separate from restore prompt — these stay visible in the garden list indefinitely
  const [ghostGardens, setGhostGardens] = useState([]); // cloud-only rows

  // ── Cloud push hold — don't push until restore/conflict resolved ──
  const [cloudPushHeld, setCloudPushHeld] = useState(false);

  // ── Sync status indicator: 'idle' | 'syncing' | 'synced' | 'error' ──
  const [syncStatus, setSyncStatus] = useState('idle');

  // ── Listen for auth state changes ───────────────────────────────
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  // ── On sign-in: check local vs cloud (sync policy) ──────────────
  useEffect(() => {
    if (!user) return;

    async function handleSignIn() {
      // Dedup local gardens by garden_id — remove any duplicates introduced by prior restore bugs
      const rawLocal = getLocalGardens() || [];
      const seenIds = new Set();
      const dedupedLocal = rawLocal.filter(g => {
        if (!g.garden_id || isDreamGarden(g)) return true; // keep Dream Garden + id-less entries as-is
        if (seenIds.has(g.garden_id)) return false; // drop duplicate
        seenIds.add(g.garden_id);
        return true;
      });
      if (dedupedLocal.length !== rawLocal.length) {
        try { localStorage.setItem('gardenData', JSON.stringify(dedupedLocal)); } catch(e) {}
      }

      const local = dedupedLocal;
      // Exclude Dream Garden from user data check — it's always present and not user content
      const userGardens = local.filter(g => !isDreamGarden(g));
      const hasLocalData = userGardens.length > 0;

      // Auto-purge blank cloud gardens (no plants, no structs) — leftovers from dev sessions
      const allCloudGardens = await fetchCloudGardens(user.id);
      for (const cg of allCloudGardens) {
        const json = cg.garden_json || {};
        const hasPlants = Array.isArray(json.plants) && json.plants.length > 0;
        const hasStructs = Array.isArray(json.structs) && json.structs.length > 0;
        if (!hasPlants && !hasStructs) {
          console.log('[Auth] Auto-purging blank cloud garden:', cg.garden_name, cg.garden_id);
          await softDeleteCloudGarden(cg.garden_id);
        }
      }
      const rawCloudGardens = allCloudGardens.filter(cg => {
        const json = cg.garden_json || {};
        const hasPlants = Array.isArray(json.plants) && json.plants.length > 0;
        const hasStructs = Array.isArray(json.structs) && json.structs.length > 0;
        return hasPlants || hasStructs;
      });
      // Deduplicate cloud gardens by garden_id — keep most recent per id
      const cloudMap = new Map();
      for (const g of rawCloudGardens) {
        const existing = cloudMap.get(g.garden_id);
        if (!existing || new Date(g.updated_at) > new Date(existing.updated_at)) {
          cloudMap.set(g.garden_id, g);
        }
      }
      const cloudGardens = Array.from(cloudMap.values());
      if (cloudGardens.length === 0 && !hasLocalData) return; // nothing to do

      if (hasLocalData) {
        // Local user gardens exist — diff against cloud
        const localIds = new Set(userGardens.map(g => g.garden_id));
        const cloudIds = new Set(cloudGardens.map(c => c.garden_id));

        const conflicts = [];
        const toPush = [];

        for (const garden of userGardens) {
          const cloudMatch = cloudGardens.find(c => c.garden_id === garden.garden_id);
          if (cloudMatch) {
            const cloudTime = new Date(cloudMatch.updated_at).getTime();
            const localTime = garden._savedAt ? new Date(garden._savedAt).getTime() : 0;
            // Only conflict if cloud is newer AND we haven't already seen this cloud version
            // _lastSeenCloudTime is stored locally after each conflict resolution
            const lastSeenKey = `gm_last_seen_cloud_${garden.garden_id}`;
            const lastSeenTime = parseInt(localStorage.getItem(lastSeenKey) || '0', 10);
            if (cloudTime > localTime && cloudTime > lastSeenTime) {
              // Cloud is newer and we haven't seen this version yet → conflict prompt
              conflicts.push({ local: garden, cloud: cloudMatch });
            } else {
              toPush.push(garden); // local is same age or newer, or already seen → safe to push
            }
          } else {
            toPush.push(garden); // not in cloud yet → push
          }
        }

        // Cloud-only gardens (not in local) → ghost entries in garden list
        const cloudOnly = cloudGardens.filter(c => !localIds.has(c.garden_id));
        if (cloudOnly.length > 0) {
          setGhostGardens(cloudOnly);
        }

        if (conflicts.length > 0) {
          // Hold cloud push until user resolves conflicts
          setCloudPushHeld(true);
          setConflictGardens(conflicts);
          setShowConflictPrompt(true);
        }

        // Push non-conflicting gardens immediately (never push Dream Garden)
        for (const garden of toPush) {
          if (isDreamGarden(garden)) continue;
          await pushCloudGarden(user.id, garden);
        }

      } else if (cloudGardens.length > 0) {
        // Local is empty, cloud has gardens → restore prompt
        // Filter out any we've already seen/dismissed
        const unseenCloud = cloudGardens.filter(g => {
          const lastSeenKey = `gm_last_seen_cloud_${g.garden_id}`;
          const lastSeen = parseInt(localStorage.getItem(lastSeenKey) || '0', 10);
          return new Date(g.updated_at).getTime() > lastSeen;
        });
        if (unseenCloud.length > 0) {
          setCloudPushHeld(true);
          setCloudGardenData(unseenCloud);
          setShowRestorePrompt(true);
        }
      }
    }

    handleSignIn();
  }, [user]);

  // ── Restore from cloud (new device prompt) ───────────────────────
  // onRestore(garden) — called with a single cloud garden to restore
  const restoreFromCloud = useCallback((gardenToRestore) => {
    // gardenToRestore is always an array of cloud rows (individual Load click = [singleGarden])
    const toLoad = Array.isArray(gardenToRestore) ? gardenToRestore : (gardenToRestore ? [gardenToRestore] : cloudGardenData || []);

    const MAX_FREE = 1;
    const isSubscribed = false; // TODO: wire real subscription state

    if (toLoad.length > 0) {
      const local = getLocalGardens() || [];
      const dream = local.filter(g => g._isDreamGarden);
      const existing = local.filter(g => !g._isDreamGarden);
      const existingIds = new Set(existing.map(g => g.garden_id));

      // Enforce free tier cap — only load gardens that fit within the limit
      const slotsAvailable = isSubscribed ? Infinity : Math.max(0, MAX_FREE - existing.length);
      const toActuallyLoad = toLoad.slice(0, slotsAvailable);
      const blocked = toLoad.slice(slotsAvailable);

      if (toActuallyLoad.length === 0) {
        // All blocked — send to ghosts, keep prompt open if more remain
        setGhostGardens(prev => {
          const existingGhostIds = new Set(prev.map(g => g.garden_id));
          return [...prev, ...toLoad.filter(g => !existingGhostIds.has(g.garden_id))];
        });
        setShowRestorePrompt(false);
        setCloudGardenData(null);
        setCloudPushHeld(false);
        return;
      }

      const restored = toActuallyLoad.map(cg => ({
        ...(cg.garden_json || cg),
        _deviceId: cg.device_id,
        _deviceLabel: cg.device_label,
        _lastSynced: cg.updated_at,
      }));

      // Only add brand-new gardens (no duplicates)
      const brandNew = restored.filter(g => !existingIds.has(g.garden_id));
      const merged = existing.map(g => {
        const match = restored.find(r => r.garden_id === g.garden_id);
        return match || g;
      });
      const loadIdx = dream.length > 0 ? 1 : 0;
      setLocalGardens([...dream, ...brandNew, ...merged], loadIdx);

      // Blocked gardens → ghosts
      if (blocked.length > 0) {
        setGhostGardens(prev => {
          const existingGhostIds = new Set(prev.map(g => g.garden_id));
          return [...prev, ...blocked.filter(g => !existingGhostIds.has(g.garden_id))];
        });
      }

      // Any cloud gardens NOT loaded → stay as ghosts
      const loadedIds = new Set(toLoad.map(g => g.garden_id));
      const remaining = (cloudGardenData || []).filter(g => !loadedIds.has(g.garden_id));
      if (remaining.length > 0) {
        setGhostGardens(prev => {
          const existingGhostIds = new Set(prev.map(g => g.garden_id));
          return [...prev, ...remaining.filter(g => !existingGhostIds.has(g.garden_id))];
        });
        // Keep prompt open if there are more gardens to decide on
        setCloudGardenData(remaining);
        return; // don't dismiss yet
      }
    }

    // Stamp all processed gardens as seen so prompt doesn't repeat on refresh
    (cloudGardenData || []).forEach(g => {
      if (g.garden_id && g.updated_at) {
        localStorage.setItem(`gm_last_seen_cloud_${g.garden_id}`, String(new Date(g.updated_at).getTime()));
      }
    });
    setShowRestorePrompt(false);
    setCloudGardenData(null);
    setCloudPushHeld(false);
  }, [cloudGardenData, getLocalGardens, setLocalGardens]);

  const dismissRestore = useCallback(() => {
    // User chose "Start fresh" — cloud gardens become ghost entries
    if (cloudGardenData && cloudGardenData.length > 0) {
      setGhostGardens(prev => {
        const existingIds = new Set(prev.map(g => g.garden_id));
        const newGhosts = cloudGardenData.filter(c => !existingIds.has(c.garden_id));
        return [...prev, ...newGhosts];
      });
    }
    // Stamp dismissed gardens as seen
    (cloudGardenData || []).forEach(g => {
      if (g.garden_id && g.updated_at) {
        localStorage.setItem(`gm_last_seen_cloud_${g.garden_id}`, String(new Date(g.updated_at).getTime()));
      }
    });
    setShowRestorePrompt(false);
    setCloudGardenData(null);
    setCloudPushHeld(false);
  }, [cloudGardenData]);

  // ── Conflict resolution (same garden, cloud newer) ────────────────
  // Accept cloud version for a specific conflict
  const resolveConflictLoadCloud = useCallback((conflictItem) => {
    // Pre-save local as backup before overwriting
    try {
      const backupKey = `gm_conflict_backup_${conflictItem.local.garden_id}`;
      localStorage.setItem(backupKey, JSON.stringify({
        garden: conflictItem.local,
        savedAt: new Date().toISOString(),
        note: 'Pre-conflict-overwrite backup',
      }));
    } catch (e) { console.warn('[Auth] Conflict backup failed:', e); }

    const cloudGarden = {
      ...(conflictItem.cloud.garden_json || conflictItem.cloud),
      _deviceId: conflictItem.cloud.device_id,
      _deviceLabel: conflictItem.cloud.device_label,
      _lastSynced: conflictItem.cloud.updated_at,
    };
    const local = getLocalGardens() || [];
    const targetIdx = local.findIndex(g => g.garden_id === conflictItem.local.garden_id);
    const updated = local.map(g =>
      g.garden_id === conflictItem.local.garden_id ? cloudGarden : g
    );
    setLocalGardens(updated, targetIdx >= 0 ? targetIdx : 1);
    _resolveConflict(conflictItem);
  }, [getLocalGardens, setLocalGardens]);

  // Keep local version — just dismiss
  const resolveConflictKeepLocal = useCallback((conflictItem) => {
    _resolveConflict(conflictItem);
  }, []);

  function _resolveConflict(conflictItem) {
    // Stamp the cloud updated_at so we don't re-prompt on next sign-in
    if (conflictItem?.cloud?.garden_id && conflictItem?.cloud?.updated_at) {
      const key = `gm_last_seen_cloud_${conflictItem.cloud.garden_id}`;
      localStorage.setItem(key, String(new Date(conflictItem.cloud.updated_at).getTime()));
    }
    setConflictGardens(prev => {
      const remaining = prev.slice(1);
      if (remaining.length === 0) {
        setShowConflictPrompt(false);
        setCloudPushHeld(false);
      }
      return remaining;
    });
  }

  // ── Delete a ghost garden (from garden switcher) ───────────────────
  const deleteGhostGarden = useCallback(async (ghostItem) => {
    const ok = await softDeleteCloudGarden(ghostItem.garden_id);
    if (ok) {
      setGhostGardens(prev => prev.filter(g => g.garden_id !== ghostItem.garden_id));
    } else {
      console.error('[Auth] Failed to delete ghost garden:', ghostItem.garden_id);
    }
  }, []);

  // ── Load a ghost garden (from garden switcher) ────────────────────
  const loadGhostGarden = useCallback((ghostItem) => {
    const cloudGarden = {
      ...(ghostItem.garden_json || ghostItem),
      _deviceId: ghostItem.device_id,
      _deviceLabel: ghostItem.device_label,
      _lastSynced: ghostItem.updated_at,
    };
    const local = getLocalGardens() || [];
    const dream = local.filter(g => g._isDreamGarden);
    const existing = local.filter(g => !g._isDreamGarden);
    setLocalGardens([...dream, cloudGarden, ...existing]);
    // Remove from ghost list
    setGhostGardens(prev => prev.filter(g => g.garden_id !== ghostItem.garden_id));
  }, [getLocalGardens, setLocalGardens]);

  // ── Push to cloud (called from GardenEditor after every save) ──────
  // gardens = full local array; we push each non-Dream garden individually
  // Held if restore/conflict prompt is still open
  const syncToCloud = useCallback(async (gardens) => {
    if (!user || cloudPushHeld) return;
    const userGardens = (gardens || []).filter(g => !g._isDreamGarden && g.garden_id);
    if (userGardens.length === 0) return;

    setSyncStatus('syncing');
    let anyFailed = false;

    for (const garden of userGardens) {
      const ok = await pushCloudGarden(user.id, garden);
      if (ok) {
        console.log('[Sync] ✓ Push succeeded:', garden.name);
        try {
          const raw = JSON.parse(localStorage.getItem('gardenData') || '[]');
          const idx = raw.findIndex(g => g.garden_id === garden.garden_id);
          if (idx !== -1) {
            raw[idx]._lastSynced = new Date().toISOString();
            localStorage.setItem('gardenData', JSON.stringify(raw));
          }
        } catch (e) { console.warn('[Auth] _lastSynced update failed:', e); }
      } else {
        console.error('[Sync] ✗ Push failed:', garden.name);
        anyFailed = true;
      }
    }

    setSyncStatus(anyFailed ? 'error' : 'synced');
    setTimeout(() => setSyncStatus('idle'), 3000);
  }, [user, cloudPushHeld]);

  // ── Google Sign-In ──────────────────────────────────────────────
  const signInWithGoogle = useCallback(async () => {
    if (isNative) {
      // Capacitor (Android/iOS): open OAuth in device browser, deep-link returns to app
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: APP_REDIRECT_URL,
          skipBrowserRedirect: true,
          queryParams: { access_type: 'offline', prompt: 'consent' },
        },
      });
      if (error) { console.error('[Auth] signInWithGoogle error:', error); return; }
      await Browser.open({ url: data.url, windowName: '_blank' });
    } else {
      // Plain web browser (PC/mobile web): let Supabase handle the redirect normally
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: WEB_REDIRECT_URL,
          queryParams: { access_type: 'offline', prompt: 'consent' },
        },
      });
      if (error) { console.error('[Auth] signInWithGoogle error:', error); }
      // Supabase redirects the browser to Google, then back to WEB_REDIRECT_URL automatically
    }
  }, []);

  // ── Handle deep-link callback ─────────────────────────────────────
  useEffect(() => {
    const handleAppUrl = async ({ url }) => {
      setDebugMsg('appUrlOpen fired');
      if (!url.startsWith('ca.gardenmapper.app')) {
        setDebugMsg('URL mismatch: ' + url.substring(0, 40));
        return;
      }
      try { await Browser.close(); } catch (e) { /* ignore */ }
      await new Promise(r => setTimeout(r, 300));

      const hashPart = url.includes('#') ? url.split('#')[1] : url.split('?')[1] || '';
      const params = new URLSearchParams(hashPart);
      const accessToken = params.get('access_token');
      const refreshToken = params.get('refresh_token');
      const code = params.get('code');

      setDebugMsg(`token:${accessToken ? 'yes' : 'no'} code:${code ? 'yes' : 'no'}`);

      if (accessToken) {
        const { data, error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken || '',
        });
        setDebugMsg(data?.session?.user?.email ?? error?.message ?? 'setSession no result');
        if (data?.session?.user) setUser(data.session.user);
      } else if (code) {
        const { data, error } = await supabase.auth.exchangeCodeForSession(url);
        setDebugMsg(data?.session?.user?.email ?? error?.message ?? 'exchange no result');
        if (data?.session?.user) setUser(data.session.user);
      } else {
        setDebugMsg('no token or code in URL: ' + hashPart.substring(0, 60));
      }
    };
    let handle;
    App.addListener('appUrlOpen', handleAppUrl).then(h => { handle = h; });
    return () => { handle?.remove(); };
  }, []);

  // ── Sign out ─────────────────────────────────────────────────────
  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  return {
    user,
    loading,
    debugMsg,
    // Restore prompt (new device)
    showRestorePrompt,
    cloudGardenData,
    restoreFromCloud,
    dismissRestore,
    // Conflict prompt (same garden, cloud newer)
    showConflictPrompt,
    conflictGardens,
    resolveConflictLoadCloud,
    resolveConflictKeepLocal,
    // Ghost gardens (cloud-only, in switcher)
    ghostGardens,
    loadGhostGarden,
    deleteGhostGarden,
    // Sync
    syncToCloud,
    syncStatus,
    signInWithGoogle,
    signOut,
  };
}
