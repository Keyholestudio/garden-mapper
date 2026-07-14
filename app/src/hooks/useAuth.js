import { useState, useEffect, useCallback } from 'react';
import { supabase, fetchCloudGardens, pushCloudGarden } from '../supabase';
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
      const local = getLocalGardens();
      // Exclude Dream Garden from user data check — it's always present and not user content
      const userGardens = (local || []).filter(g => !g._isDreamGarden);
      const hasLocalData = userGardens.length > 0;

      const cloudGardens = await fetchCloudGardens(user.id);
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
            if (cloudTime > localTime) {
              // Cloud is newer → conflict prompt
              conflicts.push({ local: garden, cloud: cloudMatch });
            } else {
              toPush.push(garden); // local is same age or newer → safe to push
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

        // Push non-conflicting gardens immediately
        for (const garden of toPush) {
          await pushCloudGarden(user.id, garden);
        }

      } else if (cloudGardens.length > 0) {
        // Local is empty, cloud has gardens → restore prompt
        // Hold cloud push until resolved
        setCloudPushHeld(true);
        setCloudGardenData(cloudGardens);
        setShowRestorePrompt(true);
      }
    }

    handleSignIn();
  }, [user]);

  // ── Restore from cloud (new device prompt) ───────────────────────
  // onRestore(garden) — called with a single cloud garden to restore
  const restoreFromCloud = useCallback((gardenToRestore) => {
    const gardens = gardenToRestore
      ? (Array.isArray(gardenToRestore) ? gardenToRestore : [gardenToRestore])
      : cloudGardenData;
    if (gardens && gardens.length > 0) {
      // Extract garden_json from each cloud row and merge into local
      const restored = gardens.map(cg => ({
        ...(cg.garden_json || cg),
        _deviceId: cg.device_id,
        _deviceLabel: cg.device_label,
        _lastSynced: cg.updated_at,
      }));
      // Prepend to existing local (after Dream Garden)
      const local = getLocalGardens() || [];
      const dream = local.filter(g => g._isDreamGarden);
      const existing = local.filter(g => !g._isDreamGarden);
      setLocalGardens([...dream, ...restored, ...existing]);
    }
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
    const updated = local.map(g =>
      g.garden_id === conflictItem.local.garden_id ? cloudGarden : g
    );
    setLocalGardens(updated);
    _resolveConflict();
  }, [getLocalGardens, setLocalGardens]);

  // Keep local version — just dismiss
  const resolveConflictKeepLocal = useCallback(() => {
    _resolveConflict();
  }, []);

  function _resolveConflict() {
    setConflictGardens(prev => {
      const remaining = prev.slice(1); // resolve one at a time
      if (remaining.length === 0) {
        setShowConflictPrompt(false);
        setCloudPushHeld(false);
      }
      return remaining;
    });
  }

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
    for (const garden of userGardens) {
      const ok = await pushCloudGarden(user.id, garden);
      if (ok) {
        // Mark _lastSynced on the local copy so conflict detection works
        try {
          const raw = JSON.parse(localStorage.getItem('gardenData') || '[]');
          const idx = raw.findIndex(g => g.garden_id === garden.garden_id);
          if (idx !== -1) {
            raw[idx]._lastSynced = new Date().toISOString();
            localStorage.setItem('gardenData', JSON.stringify(raw));
          }
        } catch (e) { console.warn('[Auth] _lastSynced update failed:', e); }
      }
    }
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
      console.log('[Auth] OAuth URL (native):', data?.url);
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
    // Sync
    syncToCloud,
    signInWithGoogle,
    signOut,
  };
}
