// useRevenueCat.js — RevenueCat billing integration
// Framework: Capacitor + React
// SDK: @revenuecat/purchases-capacitor v13
// Project: Garden Mapper (project ID: a8a11c30)
//
// IMPORTANT: RevenueCat only works inside the native Capacitor app (Android/iOS).
// On web (localhost / app.gardenmapper.ca), all calls are no-ops — web billing
// goes through Stripe instead (Session C).

import { useEffect, useState, useCallback } from 'react';
import { Capacitor } from '@capacitor/core';
import { Purchases, LOG_LEVEL } from '@revenuecat/purchases-capacitor';

// ── API keys ───────────────────────────────────────────────────────────────────
// test_ prefix = sandbox key (no real charges). Replace with prod key before release.
const RC_API_KEY_IOS     = 'test_YCKSQRAwYqZVvgVNVCijNPLzEbS';
const RC_API_KEY_ANDROID = 'test_YCKSQRAwYqZVvgVNVCijNPLzEbS';

// RevenueCat identifiers — must match dashboard exactly
// Entitlement: "Garden Mapper Pro" | REST API ID: centl71cfe4f3a4
const ENTITLEMENT_ID = 'Garden Mapper Pro';
// Offering: "default" | ID: ofrngcf29b202b5
const OFFERING_ID = 'default';
// Packages
const PACKAGE_LIFETIME = 'prod3faa1b12bd';  // one-time $14.99
const PACKAGE_YEARLY   = 'prod76de34c176';  // annual $9.99/yr

const isNative = Capacitor.isNativePlatform();

// Export for use in paywall UI components
export { ENTITLEMENT_ID, OFFERING_ID, PACKAGE_LIFETIME, PACKAGE_YEARLY };

export function useRevenueCat(userId) {
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [offerings, setOfferings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // ── Configure SDK on mount ─────────────────────────────────────────────────
  useEffect(() => {
    if (!isNative) {
      setLoading(false);
      return; // Web: skip RevenueCat, handled by Stripe
    }

    async function configurePurchases() {
      try {
        await Purchases.setLogLevel({ level: LOG_LEVEL.DEBUG });

        const platform = Capacitor.getPlatform();
        const apiKey = platform === 'ios' ? RC_API_KEY_IOS : RC_API_KEY_ANDROID;

        await Purchases.configure({ apiKey });

        // Link RevenueCat identity to our Supabase user ID so subscription
        // status is consistent across devices for the same user
        if (userId) {
          await Purchases.logIn({ appUserID: userId });
        }

        await checkEntitlement();
        await fetchOfferings();
      } catch (e) {
        console.error('[RevenueCat] configure error:', e);
        setError(e.message);
      } finally {
        setLoading(false);
      }
    }

    configurePurchases();
  }, [userId]);

  // ── Check if user has active Pro entitlement ───────────────────────────────
  const checkEntitlement = useCallback(async () => {
    if (!isNative) return false;
    try {
      const { customerInfo } = await Purchases.getCustomerInfo();
      const active = !!customerInfo?.entitlements?.active?.[ENTITLEMENT_ID];
      setIsSubscribed(active);
      return active;
    } catch (e) {
      console.error('[RevenueCat] checkEntitlement error:', e);
      return false;
    }
  }, []);

  // ── Fetch available packages/offerings ────────────────────────────────────
  const fetchOfferings = useCallback(async () => {
    if (!isNative) return null;
    try {
      const { current } = await Purchases.getOfferings();
      setOfferings(current);
      return current;
    } catch (e) {
      console.error('[RevenueCat] fetchOfferings error:', e);
      return null;
    }
  }, []);

  // ── Purchase a package ────────────────────────────────────────────────────
  const purchasePackage = useCallback(async (pkg) => {
    if (!isNative) return { success: false, reason: 'web' };
    try {
      const { customerInfo } = await Purchases.purchasePackage({ aPackage: pkg });
      const active = !!customerInfo?.entitlements?.active?.[ENTITLEMENT_ID];
      setIsSubscribed(active);
      return { success: active };
    } catch (e) {
      if (e.code === 'PURCHASE_CANCELLED') return { success: false, reason: 'cancelled' };
      console.error('[RevenueCat] purchasePackage error:', e);
      return { success: false, reason: e.message };
    }
  }, []);

  // ── Restore purchases (for reinstalls / new devices) ─────────────────────
  const restorePurchases = useCallback(async () => {
    if (!isNative) return false;
    try {
      const { customerInfo } = await Purchases.restorePurchases();
      const active = !!customerInfo?.entitlements?.active?.[ENTITLEMENT_ID];
      setIsSubscribed(active);
      return active;
    } catch (e) {
      console.error('[RevenueCat] restorePurchases error:', e);
      return false;
    }
  }, []);

  return {
    isSubscribed,   // boolean — true if user has active Pro entitlement
    offerings,      // RevenueCat Offering object with available packages
    loading,        // true while SDK is initialising
    error,          // error message if SDK failed
    checkEntitlement,
    purchasePackage,
    restorePurchases,
  };
}
