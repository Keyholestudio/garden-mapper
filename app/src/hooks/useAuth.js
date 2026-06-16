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
      },
    });
    if (error) { console.error('[Auth] signInWithGoogle error:', error); return; }
    await Browser.open({ url: data.url });
  }, []);

  // ── Handle deep-link callback ─────────────────────────────────────
  useEffect(() => {
    const handleAppUrl = async ({ url }) => {
      if (!url.startsWith(REDIRECT_URL)) return;
      await Browser.close();
      await supabase.auth.exchangeCodeForSession(url);
    };
    App.addListener('appUrlOpen', handleAppUrl);
    return () => { App.removeAllListeners(); };
  }, []);

  // ── Sign out ─────────────────────────────────────────────────────
  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  return {
    user,
    loading,
    showRestorePrompt,
    restoreFromCloud,
    dismissRestore,
    syncToCloud,
    signInWithGoogle,
    signOut,
  };
}
