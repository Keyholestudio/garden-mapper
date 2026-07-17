// create-portal-session — Supabase Edge Function
// Creates a Stripe Customer Portal session for an authenticated user.
// Returns: { url: string } — redirect the user to this URL.
//
// Requires: stripe_customer_id in user_subscriptions table (written by stripe-webhook on checkout)

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const STRIPE_SECRET_KEY = Deno.env.get('STRIPE_SECRET_KEY') ?? '';
const SUPABASE_URL      = Deno.env.get('SUPABASE_URL') ?? '';

function getAdminClient() {
  const key = Deno.env.get('SVC_ROLE_KEY') ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  return createClient(SUPABASE_URL, key, {
    global: { headers: { Authorization: `Bearer ${key}` } },
    auth: { persistSession: false },
  });
}

serve(async (req) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      },
    });
  }

  try {
    const { userId, returnUrl } = await req.json();
    if (!userId) {
      return new Response(JSON.stringify({ error: 'Missing userId' }), { status: 400 });
    }

    // Look up stripe_customer_id from Supabase
    const db = getAdminClient();
    const { data, error } = await db
      .from('user_subscriptions')
      .select('stripe_customer_id')
      .eq('user_id', userId)
      .single();

    if (error || !data?.stripe_customer_id) {
      console.error('[create-portal-session] No stripe_customer_id found for user:', userId, error);
      return new Response(
        JSON.stringify({ error: 'No billing record found. Please contact support.' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Create Stripe portal session
    const stripeRes = await fetch('https://api.stripe.com/v1/billing_portal/sessions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${STRIPE_SECRET_KEY}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        customer: data.stripe_customer_id,
        return_url: returnUrl ?? 'https://app.gardenmapper.ca',
      }),
    });

    if (!stripeRes.ok) {
      const errBody = await stripeRes.text();
      console.error('[create-portal-session] Stripe error:', errBody);
      return new Response(
        JSON.stringify({ error: 'Failed to create portal session' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const session = await stripeRes.json();
    return new Response(JSON.stringify({ url: session.url }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });

  } catch (err) {
    console.error('[create-portal-session] Unexpected error:', err);
    const msg = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});
