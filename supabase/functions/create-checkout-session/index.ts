// create-checkout-session — Supabase Edge Function
// Creates a Stripe Checkout Session and returns the sessionId to the client.
// Client then calls stripe.redirectToCheckout({ sessionId }).

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const STRIPE_SECRET_KEY = Deno.env.get('STRIPE_SECRET_KEY') ?? '';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { priceId, userId, successUrl, cancelUrl } = await req.json();

    if (!priceId || !userId || !successUrl || !cancelUrl) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Determine mode: subscription (recurring) or payment (one-time)
    // We detect by checking if the price has a recurring interval via Stripe API
    const priceRes = await fetch(`https://api.stripe.com/v1/prices/${priceId}`, {
      headers: { Authorization: `Bearer ${STRIPE_SECRET_KEY}` },
    });
    const priceData = await priceRes.json();
    const mode = priceData.recurring ? 'subscription' : 'payment';

    // Build line items
    const body = new URLSearchParams({
      'payment_method_types[0]': 'card',
      'line_items[0][price]': priceId,
      'line_items[0][quantity]': '1',
      'mode': mode,
      'success_url': successUrl,
      'cancel_url': cancelUrl,
      // Embed userId in metadata so the webhook can find the right Supabase user
      'metadata[supabase_user_id]': userId,
    });

    // If subscription mode, also embed in subscription metadata
    if (mode === 'subscription') {
      body.append('subscription_data[metadata][supabase_user_id]', userId);
    }

    const sessionRes = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${STRIPE_SECRET_KEY}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: body.toString(),
    });

    const session = await sessionRes.json();

    if (!sessionRes.ok) {
      console.error('[create-checkout-session] Stripe error:', session);
      return new Response(
        JSON.stringify({ error: session.error?.message ?? 'Stripe session creation failed' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ sessionId: session.id }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err) {
    console.error('[create-checkout-session] Unexpected error:', err);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
