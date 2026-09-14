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
import { useRevenueCat, PACKAGE_LIFETIME, PACKAGE_YEARLY } from './useRevenueCat';

const isNative = Capacitor.isNativePlatform();

/**
 * useSubscription(userId)
 * @param {string|null} userId — Supabase user ID
 * @returns {{ isSubscribed: boolean, loading: boolean, openCheckout: Function, purchase: Function, refreshStatus: Function }}
 */
export function useSubscription(userId) {
  // Stripe / Supabase — works on both web and native (reads subscription_flag)
  const {
    isSubscribed: stripeSubscribed,
    loading: stripeLoading,
    openCheckout,
    refreshStatus,
  } = useStripe(userId);

  // RevenueCat — native only (Google Play purchases)
  // On web: all RC calls are no-ops (useRevenueCat skips on non-native)
  const {
    isSubscribed: rcSubscribed,
    loading: rcLoading,
    offerings,
    purchasePackage,
    restorePurchases,
  } = useRevenueCat(userId);

  // Merge: either source granting Pro = subscribed (belt + suspenders)
  // Supabase flag is updated by both Stripe webhook (web) and RC webhook (native)
  const isSubscribed = stripeSubscribed || (isNative && rcSubscribed);
  const loading = stripeLoading || (isNative && rcLoading);

  // ── Unified purchase function ───────────────────────────────────────────
  // Web:    opens Stripe Checkout
  // Native: triggers Google Play purchase via RevenueCat
  const purchase = async (plan = 'lifetime') => {
    if (isNative) {
      // Find the matching RC package from current offering
      if (!offerings?.availablePackages) {
        console.warn('[useSubscription] No RC offerings available');
        return { success: false, reason: 'no_offerings' };
      }
      const targetId = plan === 'annual' ? PACKAGE_YEARLY : PACKAGE_LIFETIME;
      const pkg = offerings.availablePackages.find(p => p.identifier === targetId)
                ?? offerings.availablePackages[0]; // fallback to first available
      if (!pkg) return { success: false, reason: 'package_not_found' };
      return purchasePackage(pkg);
    } else {
      // Web: open Stripe Checkout
      await openCheckout(plan);
      return { success: true };
    }
  };

  return {
    isSubscribed,
    loading,
    openCheckout,     // direct Stripe access (web only)
    purchase,         // unified: Stripe on web, RevenueCat on native
    restorePurchases, // RC restore (native only, no-op on web)
    refreshStatus,    // re-fetches Supabase subscription_flag
  };
}
