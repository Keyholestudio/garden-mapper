// revenuecat-webhook — Supabase Edge Function
// Receives RevenueCat webhook events and updates subscription_flag in Supabase.
//
// RC appUserID = Supabase user.id (set via Purchases.logIn in useRevenueCat.js)
// so we can look up the user directly without any extra mapping.
//
// Events handled:
//   INITIAL_PURCHASE      — new Google Play purchase
//   RENEWAL               — subscription renewed
//   PRODUCT_CHANGE        — plan changed (annual ↔ lifetime)
//   CANCELLATION          — subscription cancelled (access until period end)
//   EXPIRATION            — subscription expired (revoke access)
//   BILLING_ISSUE         — payment failed (grace period — don't revoke yet)
//
// Security: RC signs requests with a shared secret in the Authorization header.
// Set RC_WEBHOOK_SECRET in Supabase secrets, paste the same value in RC dashboard.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const RC_WEBHOOK_SECRET = Deno.env.get('RC_WEBHOOK_SECRET') ?? '';

function getAdminClient() {
  const url = Deno.env.get('SUPABASE_URL') ?? '';
  const key = Deno.env.get('SVC_ROLE_KEY') ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  return createClient(url, key, {
    global: { headers: { Authorization: `Bearer ${key}` } },
    auth: { persistSession: false },
  });
}

serve(async (req) => {
  // ── Auth check ─────────────────────────────────────────────────────────────
  // RC sends the secret as a Bearer token in the Authorization header
  if (RC_WEBHOOK_SECRET) {
    const authHeader = req.headers.get('Authorization') ?? '';
    const token = authHeader.replace('Bearer ', '').trim();
    if (token !== RC_WEBHOOK_SECRET) {
      console.error('[rc-webhook] Unauthorized — token mismatch');
      return new Response('Unauthorized', { status: 401 });
    }
  } else {
    console.warn('[rc-webhook] RC_WEBHOOK_SECRET not set — skipping auth check (dev mode)');
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return new Response('Invalid JSON', { status: 400 });
  }

  const event = body.event;
  if (!event) {
    return new Response('Missing event', { status: 400 });
  }

  // RC appUserID = Supabase user.id (set in useRevenueCat.js via Purchases.logIn)
  const userId = event.app_user_id;
  const eventType = event.type;

  console.log('[rc-webhook] Event:', eventType, '| userId:', userId);

  if (!userId) {
    console.warn('[rc-webhook] No app_user_id in event — skipping');
    return new Response(JSON.stringify({ received: true, skipped: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const adminSupabase = getAdminClient();

  try {
    switch (eventType) {

      case 'INITIAL_PURCHASE':
      case 'RENEWAL':
      case 'PRODUCT_CHANGE': {
        // Grant or maintain Pro access
        const productId = event.product_id ?? null;
        const plan = productId?.includes('annual') ? 'annual' : 'lifetime';
        const expiresAt = event.expiration_at_ms
          ? new Date(event.expiration_at_ms).toISOString()
          : null; // lifetime = no expiry

        await upsertSubscription(adminSupabase, userId, {
          subscription_flag: true,
          plan,
          subscription_source: 'revenuecat',
          rc_product_id: productId,
          subscribed_at: new Date().toISOString(),
          expires_at: expiresAt,
        });

        console.log('[rc-webhook] Pro granted for user:', userId, 'plan:', plan);
        break;
      }

      case 'EXPIRATION': {
        // Subscription fully expired — revoke Pro access
        await revokeSubscription(adminSupabase, userId);
        console.log('[rc-webhook] Pro revoked (expired) for user:', userId);
        break;
      }

      case 'CANCELLATION': {
        // Cancelled but still within paid period — don't revoke yet.
        // RC will fire EXPIRATION when access actually ends.
        console.log('[rc-webhook] Cancellation noted for user:', userId, '— access maintained until expiry');
        break;
      }

      case 'BILLING_ISSUE': {
        // Payment failed — RC gives a grace period before EXPIRATION fires.
        // Log only — don't revoke yet.
        console.warn('[rc-webhook] Billing issue for user:', userId, '— grace period active');
        break;
      }

      default:
        console.log('[rc-webhook] Unhandled event type:', eventType);
    }
  } catch (err) {
    console.error('[rc-webhook] Handler error:', err);
    const msg = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify({ received: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
});

// ── Helpers ───────────────────────────────────────────────────────────────────

async function upsertSubscription(db: any, userId: string, fields: Record<string, any>) {
  const { error } = await db
    .from('user_subscriptions')
    .upsert(
      { user_id: userId, ...fields, updated_at: new Date().toISOString() },
      { onConflict: 'user_id' }
    );
  if (error) throw new Error(`upsertSubscription failed: ${error.message}`);
}

async function revokeSubscription(db: any, userId: string) {
  const { error } = await db
    .from('user_subscriptions')
    .update({
      subscription_flag: false,
      expires_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId);
  if (error) throw new Error(`revokeSubscription failed: ${error.message}`);
}
