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
  const [showRestorePrompt, setShowRestorePrompt] = useState(false);
  const [cloudGardenData, setCloudGardenData] = useState(null);
  const [debugMsg, setDebugMsg] = useState('');

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

      if (hasLocalData) {
        // Local user gardens exist — push each one to cloud (local wins on first sync)
        // Skip if this garden_id is already in cloud with a newer updated_at
        for (const garden of userGardens) {
          const cloudMatch = cloudGardens.find(c => c.garden_id === garden.garden_id);
          if (cloudMatch) {
            const cloudTime = new Date(cloudMatch.updated_at).getTime();
            const localTime = garden._savedAt ? new Date(garden._savedAt).getTime() : 0;
            if (cloudTime > localTime) {
              // Cloud is newer for this garden — queue conflict prompt (Session B)
              // For now: skip push to avoid overwriting newer cloud version
              console.log('[Auth] Cloud newer for garden:', garden.name, '- skipping push');
              continue;
            }
          }
          await pushCloudGarden(user.id, garden);
        }

        // Check if cloud has gardens not in local — surface as ghost entries (Session B)
        const localIds = new Set(userGardens.map(g => g.garden_id));
        const cloudOnly = cloudGardens.filter(c => !localIds.has(c.garden_id));
        if (cloudOnly.length > 0) {
          // Store cloud-only gardens for restore prompt
          setCloudGardenData(cloudOnly);
          setShowRestorePrompt(true);
        }
      } else if (cloudGardens.length > 0) {
        // Local is empty, cloud has gardens → show restore prompt
        setCloudGardenData(cloudGardens);
        setShowRestorePrompt(true);
      }
      // else: both empty → nothing to do
    }

    handleSignIn();
  }, [user]);

  // ── Restore from cloud ───────────────────────────────────────────
  const restoreFromCloud = useCallback(() => {
    if (cloudGardenData) {
      setLocalGardens(cloudGardenData);
    }
    setShowRestorePrompt(false);
    setCloudGardenData(null);
  }, [cloudGardenData, setLocalGardens]);

  const dismissRestore = useCallback(() => {
    setShowRestorePrompt(false);
    setCloudGardenData(null);
  }, []);

  // ── Push to cloud (called from GardenEditor after every save) ──────
  // gardens = full local array; we push each non-Dream garden individually
  const syncToCloud = useCallback(async (gardens) => {
    if (!user) return;
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
  }, [user]);

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
    showRestorePrompt,
    restoreFromCloud,
    dismissRestore,
    syncToCloud,
    signInWithGoogle,
    signOut,
  };
}
