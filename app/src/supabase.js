import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://oxecjcdxkmtdgmdxlxyt.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im94ZWNqY2R4a210ZGdtZHhseHl0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE2MzA2NDIsImV4cCI6MjA5NzIwNjY0Mn0.ihJ6a6w2m51KjSAf2-tEbn_iPK8jjBkZztV_faQnsr4';

const isNative = !!(window.Capacitor?.isNative);

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    flowType: 'implicit',
    // On native (Capacitor): we parse the deep-link URL manually in useAuth via appUrlOpen
    // On web: let Supabase detect the token from the URL hash automatically after redirect
    detectSessionInUrl: !isNative,
  },
});

// ── Garden sync helpers ──────────────────────────────────────────

/** Fetch the user's garden from Supabase. Returns null if not found. */
export async function fetchCloudGarden(userId) {
  const { data, error } = await supabase
    .from('gardens')
    .select('garden_json, updated_at')
    .eq('user_id', userId)
    .single();

  if (error && error.code !== 'PGRST116') {
    // PGRST116 = no rows found — not a real error
    console.error('[Supabase] fetchCloudGarden error:', error);
    return null;
  }
  return data ?? null;
}

/** Upsert the user's garden to Supabase. */
export async function pushCloudGarden(userId, gardenJson) {
  const { error } = await supabase
    .from('gardens')
    .upsert(
      { user_id: userId, garden_json: gardenJson, updated_at: new Date().toISOString() },
      { onConflict: 'user_id' }
    );

  if (error) {
    console.error('[Supabase] pushCloudGarden error:', error);
    return false;
  }
  return true;
}
