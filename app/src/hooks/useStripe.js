// useStripe.js — Stripe web billing integration
// Handles: Checkout redirect, subscription status from Supabase, success callback
//
// Web-only: this hook is a no-op on native (Capacitor). Native billing = RevenueCat.
// Flow:
//   1. User clicks "Go Pro" → openCheckout(plan) → Stripe Checkout page
//   2. Stripe redirects to /subscribe/success?session_id=xxx
//   3. Stripe webhook (Supabase Edge Function) receives payment → sets subscription_flag in DB
//   4. App reads flag on next sign-in via fetchSubscriptionStatus()

import { useState, useEffect, useCallback } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { Capacitor } from '@capacitor/core';
import { supabase, fetchSubscriptionStatus } from '../supabase';

const isNative = Capacitor.isNativePlatform();

// Stripe publishable key (sandbox — replace with live key before production)
const STRIPE_PK = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY;

// Price IDs (sandbox) — created 2026-07-16
// Replace with live price IDs before going to production
export const STRIPE_PRICE_LIFETIME = 'price_1TttCpQlAMq7rOt83v0Vs9LD'; // $14.99 CAD one-time
export const STRIPE_PRICE_ANNUAL   = 'price_1TttCqQlAMq7rOt8ZCnIwnAJ'; // $9.99 CAD/yr

let stripePromise = null;
function getStripe() {
  if (!stripePromise && STRIPE_PK) {
    stripePromise = loadStripe(STRIPE_PK);
  }
  return stripePromise;
}

export function useStripe(userId) {
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [error, setError] = useState(null);

  // ── Fetch subscription status from Supabase on mount / userId change ──
  // Also listens to Supabase auth state changes so sign-in after mount triggers a re-check
  useEffect(() => {
    if (isNative) {
      setLoading(false);
      return;
    }

    async function checkStatus(uid) {
      if (!uid) {
        setIsSubscribed(false);
        setLoading(false);
        return;
      }
      try {
        const flag = await fetchSubscriptionStatus(uid);
        setIsSubscribed(flag);
      } catch (e) {
        console.error('[Stripe] fetchSubscriptionStatus error:', e);
      } finally {
        setLoading(false);
      }
    }

    // Check immediately with current userId
    checkStatus(userId);

    // Also listen for auth state changes (handles delayed session restore on page load)
    const { data: { subscription: authSub } } = supabase.auth.onAuthStateChange((_event, session) => {
      const uid = session?.user?.id ?? null;
      checkStatus(uid);
    });

    return () => authSub.unsubscribe();
  }, [userId]);

  // ── Check for Stripe success redirect ────────────────────────────────
  // When Stripe redirects back with ?stripe=success, re-fetch subscription status.
  // The webhook may take a few seconds to fire, so we poll briefly.
  useEffect(() => {
    if (isNative || !userId) return;

    const params = new URLSearchParams(window.location.search);
    if (params.get('stripe') !== 'success') return;

    // Clean URL immediately
    const cleanUrl = window.location.origin + window.location.pathname;
    window.history.replaceState({}, '', cleanUrl);

    let attempts = 0;
    const maxAttempts = 8;
    const pollInterval = setInterval(async () => {
      attempts++;
      const flag = await fetchSubscriptionStatus(userId);
      if (flag) {
        setIsSubscribed(true);
        clearInterval(pollInterval);
        console.log('[Stripe] Subscription confirmed after', attempts, 'poll(s)');
      } else if (attempts >= maxAttempts) {
        clearInterval(pollInterval);
        console.warn('[Stripe] Subscription not confirmed after', maxAttempts, 'polls — webhook may be delayed');
      }
    }, 2000);

    return () => clearInterval(pollInterval);
  }, [userId]);

  // ── Open Stripe Checkout ──────────────────────────────────────────────
  // plan: 'lifetime' | 'annual'
  const openCheckout = useCallback(async (plan = 'lifetime') => {
    if (isNative) return; // Native uses RevenueCat
    if (!userId) {
      setError('Sign in to subscribe');
      return;
    }

    setCheckoutLoading(true);
    setError(null);

    try {
      const priceId = plan === 'annual' ? STRIPE_PRICE_ANNUAL : STRIPE_PRICE_LIFETIME;
      const successUrl = `${window.location.origin}/?stripe=success`;
      const cancelUrl  = `${window.location.origin}/?stripe=cancel`;

      // Call our Supabase Edge Function to create a Checkout Session
      const { data, error: fnError } = await supabase.functions.invoke('create-checkout-session', {
        body: { priceId, userId, successUrl, cancelUrl },
      });

      if (fnError || !data?.sessionId) {
        throw new Error(fnError?.message || 'Failed to create checkout session');
      }

      // Use the checkout URL returned by Stripe directly
      if (data.url) {
        window.location.href = data.url;
      } else {
        // Fallback: use stripe.js redirectToCheckout
        const stripe = await getStripe();
        if (!stripe) throw new Error('Stripe failed to load');
        const { error: redirectError } = await stripe.redirectToCheckout({ sessionId: data.sessionId });
        if (redirectError) throw redirectError;
      }

    } catch (e) {
      console.error('[Stripe] openCheckout error:', e);
      setError(e.message || 'Checkout failed — please try again');
    } finally {
      setCheckoutLoading(false);
    }
  }, [userId]);

  // ── Manually refresh subscription status ─────────────────────────────
  const refreshStatus = useCallback(async () => {
    if (!userId || isNative) return;
    const flag = await fetchSubscriptionStatus(userId);
    setIsSubscribed(flag);
    return flag;
  }, [userId]);

  return {
    isSubscribed,   // boolean — true if user has active Pro subscription (web)
    loading,        // true while checking Supabase
    checkoutLoading, // true while redirecting to Stripe
    error,          // string or null
    openCheckout,   // (plan: 'lifetime' | 'annual') => void
    refreshStatus,
  };
}
