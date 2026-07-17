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

// ── Device identity ────────────────────────────────────────────────────────────
// Stable per-install identifier. Generated once, stored in localStorage forever.
const LS_DEVICE_ID = 'gm_device_id';
const LS_DEVICE_LABEL = 'gm_device_label';

export function getDeviceId() {
  let id = localStorage.getItem(LS_DEVICE_ID);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(LS_DEVICE_ID, id);
  }
  return id;
}

export function getDeviceLabel() {
  let label = localStorage.getItem(LS_DEVICE_LABEL);
  if (!label) {
    // Auto-detect a human-readable label
    const ua = navigator.userAgent;
    let device = 'Unknown device';
    if (/iPhone/.test(ua)) device = 'iPhone';
    else if (/iPad/.test(ua)) device = 'iPad';
    else if (/Android/.test(ua)) device = 'Android';
    else if (/Macintosh/.test(ua)) device = 'Mac';
    else if (/Windows/.test(ua)) device = 'Windows PC';
    else if (/Linux/.test(ua)) device = 'Linux';

    let browser = '';
    if (/Chrome/.test(ua) && !/Chromium|Edg/.test(ua)) browser = ' · Chrome';
    else if (/Firefox/.test(ua)) browser = ' · Firefox';
    else if (/Safari/.test(ua) && !/Chrome/.test(ua)) browser = ' · Safari';
    else if (/Edg/.test(ua)) browser = ' · Edge';

    label = device + browser;
    localStorage.setItem(LS_DEVICE_LABEL, label);
  }
  return label;
}

// ── Per-garden cloud helpers ───────────────────────────────────────────────────

/**
 * Fetch all cloud gardens for a user (non-deleted).
 * Returns array of { garden_id, garden_name, device_id, device_label, garden_json, updated_at, subscription_required }
 */
export async function fetchCloudGardens(userId) {
  const { data, error } = await supabase
    .from('gardens')
    .select('garden_id, garden_name, device_id, device_label, garden_json, updated_at, subscription_required')
    .eq('user_id', userId)
    .eq('is_deleted', false)
    .order('updated_at', { ascending: false });

  if (error) {
    console.error('[Supabase] fetchCloudGardens error:', error);
    return [];
  }
  return data ?? [];
}

/**
 * Push a single garden to Supabase.
 * Uses garden_id as the upsert key — creates on first push, updates on subsequent.
 */
export async function pushCloudGarden(userId, garden) {
  // Hard guard — Dream Garden must never reach the cloud
  if (garden?._isDreamGarden || garden?.name === '\uD83C\uDF38 Dream Garden') {
    console.warn('[Supabase] Blocked Dream Garden push');
    return false;
  }
  // Don't push empty gardens — no plants and no structures = nothing worth saving
  const hasPlants = Array.isArray(garden?.plants) && garden.plants.length > 0;
  const hasStructs = Array.isArray(garden?.structs) && garden.structs.length > 0;
  if (!hasPlants && !hasStructs) {
    console.log('[Supabase] Skipping empty garden push:', garden?.name);
    return false;
  }
  const deviceId = getDeviceId();
  const deviceLabel = getDeviceLabel();

  const { error } = await supabase
    .from('gardens')
    .upsert(
      {
        garden_id: garden.garden_id,
        user_id: userId,
        garden_name: garden.name || 'My Garden',
        device_id: deviceId,
        device_label: deviceLabel,
        garden_json: garden,
        updated_at: new Date().toISOString(),
        is_deleted: false,
      },
      { onConflict: 'garden_id' }
    );

  if (error) {
    console.error('[Supabase] pushCloudGarden error:', error);
    return false;
  }
  return true;
}

/**
 * Soft-delete a garden from Supabase (sets is_deleted = true).
 * Never hard-deletes — preserves history.
 */
export async function softDeleteCloudGarden(gardenId) {
  const { error } = await supabase
    .from('gardens')
    .update({ is_deleted: true, updated_at: new Date().toISOString() })
    .eq('garden_id', gardenId);

  if (error) {
    console.error('[Supabase] softDeleteCloudGarden error:', error);
    return false;
  }
  return true;
}

// ── Subscription status ──────────────────────────────────────────────────────────

/**
 * Fetch subscription flag for a user from user_subscriptions table.
 * Returns true if user has an active Pro subscription, false otherwise.
 */
export async function fetchSubscriptionStatus(userId) {
  if (!userId) return false;
  const { data, error } = await supabase
    .from('user_subscriptions')
    .select('subscription_flag')
    .eq('user_id', userId)
    .single();
  if (error) {
    // PGRST116 = no row found — user hasn't subscribed yet, not a real error
    if (error.code !== 'PGRST116') {
      console.error('[Supabase] fetchSubscriptionStatus error:', error);
    }
    return false;
  }
  return data?.subscription_flag === true;
}

/**
 * Fetch full subscription details for the Account modal.
 * Returns { subscription_flag, plan, stripe_customer_id, subscription_source } or null.
 */
export async function fetchSubscriptionDetails(userId) {
  if (!userId) return null;
  const { data, error } = await supabase
    .from('user_subscriptions')
    .select('subscription_flag, plan, stripe_customer_id')
    .eq('user_id', userId)
    .single();
  if (error) {
    if (error.code !== 'PGRST116') {
      console.error('[Supabase] fetchSubscriptionDetails error:', error);
    }
    return null;
  }
  return data;
}

// ── Legacy compat (used nowhere new — remove after Session B) ─────────────────
/** @deprecated Use fetchCloudGardens instead */
export async function fetchCloudGarden(userId) {
  const gardens = await fetchCloudGardens(userId);
  return gardens.length > 0 ? { garden_json: gardens[0].garden_json, updated_at: gardens[0].updated_at } : null;
}
