// useSubscription.js — unified subscription status hook
//
// Returns a single `isSubscribed` boolean regardless of platform or payment method.
//
// Source of truth: Supabase `subscription_flag` (set by Stripe webhook on web,
// and by RevenueCat webhook in Session D on native).
//
// Platform routing:
//   Web:     useStripe → reads subscription_flag from Supabase ✅
//   Native:  useStripe → reads subscription_flag from Supabase ✅ (Session 1 fix)
//            + useRevenueCat → checks RC entitlement (Session D, wired below when ready)
//
// In Session D: uncomment the RevenueCat block and combine both sources with OR logic.
// Either source granting Pro = user is subscribed (belt + suspenders).

import { Capacitor } from '@capacitor/core';
import { useStripe } from './useStripe';
// SESSION D: import { useRevenueCat } from './useRevenueCat';

const isNative = Capacitor.isNativePlatform();

/**
 * useSubscription(userId)
 * @param {string|null} userId — Supabase user ID
 * @returns {{ isSubscribed: boolean, loading: boolean, openCheckout: Function, refreshStatus: Function }}
 */
export function useSubscription(userId) {
  // Stripe / Supabase — works on both web and native (reads subscription_flag)
  const {
    isSubscribed: stripeSubscribed,
    loading: stripeLoading,
    openCheckout,
    refreshStatus,
  } = useStripe(userId);

  // SESSION D — RevenueCat (native only, Google Play purchases)
  // Uncomment when RC is connected to Google Play in dashboard:
  //
  // const {
  //   isSubscribed: rcSubscribed,
  //   loading: rcLoading,
  // } = useRevenueCat(userId);
  //
  // const isSubscribed = stripeSubscribed || (isNative && rcSubscribed);
  // const loading = stripeLoading || (isNative && rcLoading);

  // Current: Supabase flag is the single source of truth on all platforms
  const isSubscribed = stripeSubscribed;
  const loading = stripeLoading;

  return {
    isSubscribed,
    loading,
    openCheckout,   // opens Stripe Checkout (web only — no-op on native until Play billing is wired)
    refreshStatus,  // manually re-fetches subscription_flag from Supabase
  };
}
