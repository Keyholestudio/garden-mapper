import { useState, useEffect, useCallback } from 'react';
import { supabase, fetchCloudGarden, pushCloudGarden } from '../supabase';
import { Browser } from '@capacitor/browser';
import { App } from '@capacitor/app';

const REDIRECT_URL = 'ca.gardenmapper.app://auth/callback';

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
      const hasLocalData = local && local.length > 0 && local.some(g => !g._isDreamGarden);

      const cloud = await fetchCloudGarden(user.id);

      if (hasLocalData) {
        // Local exists → push local to cloud (local wins)
        await pushCloudGarden(user.id, local);
      } else if (cloud?.garden_json) {
        // Local is empty, cloud has data → show restore prompt
        setCloudGardenData(cloud.garden_json);
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

  // ── Push to cloud (call this from useSaveLoad after every save) ──
  const syncToCloud = useCallback(async (gardens) => {
    if (!user) return;
    await pushCloudGarden(user.id, gardens);
  }, [user]);

  // ── Google Sign-In (PKCE via device browser) ────────────────────
  const signInWithGoogle = useCallback(async () => {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: REDIRECT_URL,
        skipBrowserRedirect: true,
        queryParams: { access_type: 'offline', prompt: 'consent' },
      },
    });
    if (error) { console.error('[Auth] signInWithGoogle error:', error); return; }
    console.log('[Auth] OAuth URL:', data?.url);
    // Open in Chrome specifically — avoids DuckDuckGo intercepting the deep-link
    await Browser.open({ url: data.url, windowName: '_blank' });
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
