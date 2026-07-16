// stripe-webhook — Supabase Edge Function
// Receives Stripe webhook events and updates subscription_flag in Supabase.
//
// Events handled:
//   checkout.session.completed       — one-time payment OR subscription started
//   customer.subscription.deleted    — subscription cancelled/expired
//   invoice.payment_failed           — subscription renewal failed (optional: flag expiry)

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const STRIPE_SECRET_KEY      = Deno.env.get('STRIPE_SECRET_KEY') ?? '';
const STRIPE_WEBHOOK_SECRET  = Deno.env.get('STRIPE_WEBHOOK_SECRET') ?? '';

// Build the admin Supabase client lazily so SUPABASE_ vars are fully injected
function getAdminClient() {
  const url = Deno.env.get('SUPABASE_URL') ?? '';
  // SUPABASE_SERVICE_ROLE_KEY auto-inject is unreliable on free tier — use SVC_ROLE_KEY instead
  const key = Deno.env.get('SVC_ROLE_KEY') ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  return createClient(url, key, {
    global: { headers: { Authorization: `Bearer ${key}` } },
    auth: { persistSession: false },
  });
}

serve(async (req) => {
  const signature = req.headers.get('stripe-signature');
  const body = await req.text();

  // Verify webhook signature
  let event: any;
  try {
    event = await verifyStripeWebhook(body, signature ?? '', STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('[stripe-webhook] Signature verification failed:', err);
    // During sandbox testing: log and continue rather than reject
    // TODO: re-enable hard reject before going to production
    try {
      event = JSON.parse(body);
      console.warn('[stripe-webhook] Proceeding without valid signature (sandbox mode)');
    } catch {
      return new Response('Invalid webhook payload', { status: 400 });
    }
  }

  const adminSupabase = getAdminClient();
  const svcKey = Deno.env.get('SVC_ROLE_KEY') ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  console.log('[stripe-webhook] Event:', event.type, '| svcKeyLen:', svcKey.length);
  // Diagnostic: return key info on test events
  if (event.type === 'checkout.session.completed' && event.data?.object?.metadata?.supabase_user_id === 'test-diag') {
    return new Response(JSON.stringify({ svcKeyLen: svcKey.length, url: Deno.env.get('SUPABASE_URL') }), { status: 200 });
  }

  try {
    switch (event.type) {

      case 'checkout.session.completed': {
        const session = event.data.object;
        const userId = session.metadata?.supabase_user_id;
        if (!userId) {
          console.warn('[stripe-webhook] No supabase_user_id in session metadata');
          break;
        }

        // Determine plan type
        const mode = session.mode; // 'payment' (one-time) | 'subscription'
        const plan = mode === 'subscription' ? 'annual' : 'lifetime';

        await upsertSubscription(adminSupabase, userId, {
          subscription_flag: true,
          plan,
          stripe_customer_id: session.customer ?? null,
          stripe_subscription_id: session.subscription ?? null,
          subscribed_at: new Date().toISOString(),
          expires_at: null, // lifetime = never expires; annual expiry handled by subscription events
        });

        console.log('[stripe-webhook] Subscription activated for user:', userId, 'plan:', plan);
        break;
      }

      case 'customer.subscription.deleted': {
        // Subscription cancelled or expired — revoke Pro access
        const subscription = event.data.object;
        const userId = subscription.metadata?.supabase_user_id;
        if (!userId) {
          // Fall back to looking up by stripe_subscription_id
          console.warn('[stripe-webhook] No supabase_user_id in subscription metadata — looking up by subscription ID');
          const { data } = await adminSupabase
            .from('user_subscriptions')
            .select('user_id')
            .eq('stripe_subscription_id', subscription.id)
            .single();
          if (data?.user_id) {
            await revokeSubscription(adminSupabase, data.user_id, subscription.id);
          }
          break;
        }
        await revokeSubscription(adminSupabase, userId, subscription.id);
        console.log('[stripe-webhook] Subscription revoked for user:', userId);
        break;
      }

      case 'invoice.payment_failed': {
        // Optional: you could set a grace period flag here
        // For now just log — the subscription.deleted event will fire after grace period
        const invoice = event.data.object;
        console.warn('[stripe-webhook] Payment failed for customer:', invoice.customer);
        break;
      }

      default:
        console.log('[stripe-webhook] Unhandled event type:', event.type);
    }
  } catch (err) {
    console.error('[stripe-webhook] Handler error:', err);
    const msg = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ error: msg }), { status: 500, headers: { 'Content-Type': 'application/json' } });
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

async function revokeSubscription(db: any, userId: string, subscriptionId: string) {
  const { error } = await db
    .from('user_subscriptions')
    .update({
      subscription_flag: false,
      expires_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId)
    .eq('stripe_subscription_id', subscriptionId);
  if (error) throw new Error(`revokeSubscription failed: ${error.message}`);
}

// Stripe webhook signature verification (manual — no npm dependency needed)
async function verifyStripeWebhook(payload: string, signature: string, secret: string): Promise<any> {
  if (!secret) {
    // No webhook secret configured — skip verification in dev (log warning)
    console.warn('[stripe-webhook] STRIPE_WEBHOOK_SECRET not set — skipping signature check');
    return JSON.parse(payload);
  }

  const parts = Object.fromEntries(signature.split(',').map(p => p.split('=')));
  const timestamp = parts['t'];
  const sig = parts['v1'];

  if (!timestamp || !sig) throw new Error('Invalid signature format');

  const signedPayload = `${timestamp}.${payload}`;
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signatureBytes = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(signedPayload));
  const expectedSig = Array.from(new Uint8Array(signatureBytes))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');

  if (expectedSig !== sig) throw new Error('Signature mismatch');

  // Reject webhooks older than 5 minutes
  const age = Math.floor(Date.now() / 1000) - parseInt(timestamp, 10);
  if (age > 300) throw new Error('Webhook timestamp too old');

  return JSON.parse(payload);
}
