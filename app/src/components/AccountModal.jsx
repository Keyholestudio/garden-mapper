// AccountModal.jsx — Account & Subscription Management
//
// Shows: email, subscription status, and a platform-aware "Manage Subscription" button.
//
// Platform routing:
//   stripe        → Stripe Customer Portal (via Edge Function)
//   google_play   → Play Store subscriptions deep link
//   apple         → Apple App Store subscriptions page
//   unknown/free  → "No active subscription" message with upgrade CTA

import { useState, useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import { Browser } from '@capacitor/browser';
import { supabase, fetchSubscriptionDetails } from '../supabase';
import './AccountModal.css';

const isNative = Capacitor.isNativePlatform();
const PLAY_PACKAGE   = 'ca.gardenmapper.app';
const PLAY_PRODUCT   = 'garden_mapper_pro';           // update when Play product ID is confirmed
const PORTAL_RETURN  = 'https://app.gardenmapper.ca';

export default function AccountModal({ user, onClose, onSubscribe }) {
  const [subDetails, setSubDetails] = useState(null);
  const [loading, setLoading] = useState(true);
  const [portalLoading, setPortalLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!user) return;
    fetchSubscriptionDetails(user.id).then(details => {
      setSubDetails(details);
      setLoading(false);
    });
  }, [user?.id]);

  // ── Manage Subscription — platform-aware ─────────────────────────────
  async function handleManage() {
    const source = subDetails?.subscription_source ?? (subDetails?.stripe_customer_id ? 'stripe' : null);

    if (source === 'stripe') {
      await openStripePortal();
    } else if (source === 'google_play') {
      const url = `https://play.google.com/store/account/subscriptions?sku=${PLAY_PRODUCT}&package=${PLAY_PACKAGE}`;
      await openLink(url);
    } else if (source === 'apple') {
      await openLink('https://apps.apple.com/account/subscriptions');
    } else {
      // Subscribed but no source recorded — fall back to Stripe portal if customer_id exists
      if (subDetails?.stripe_customer_id) {
        await openStripePortal();
      }
    }
  }

  async function openStripePortal() {
    setPortalLoading(true);
    setError(null);
    try {
      const { data, error: fnError } = await supabase.functions.invoke('create-portal-session', {
        body: { userId: user.id, returnUrl: PORTAL_RETURN },
      });
      if (fnError || !data?.url) throw new Error(fnError?.message || 'Could not open billing portal');
      await openLink(data.url);
    } catch (e) {
      console.error('[AccountModal] Portal error:', e);
      setError(e.message || 'Could not open billing portal');
    } finally {
      setPortalLoading(false);
    }
  }

  async function openLink(url) {
    if (isNative) {
      await Browser.open({ url });
    } else {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  }

  // ── Subscription label ─────────────────────────────────────────────────
  function planLabel() {
    if (!subDetails?.subscription_flag) return null;
    if (subDetails.plan === 'lifetime') return 'Garden Mapper Pro · Lifetime';
    if (subDetails.plan === 'annual')   return 'Garden Mapper Pro · Annual';
    return 'Garden Mapper Pro';
  }

  // ── Platform for the manage button label ──────────────────────────────
  function manageBtnLabel() {
    const source = subDetails?.subscription_source ?? (subDetails?.stripe_customer_id ? 'stripe' : null);
    if (source === 'google_play') return 'Manage on Google Play';
    if (source === 'apple')       return 'Manage on App Store';
    return 'Manage Subscription';
  }

  return (
    <div className="account-modal-overlay" onClick={onClose}>
      <div className="account-modal" onClick={e => e.stopPropagation()}>
        <div className="account-modal-header">
          <h2 className="account-modal-title">Account</h2>
          <button className="account-modal-close" onClick={onClose} aria-label="Close">✕</button>
        </div>

        {/* Email */}
        <div className="account-section">
          <div className="account-label">Signed in as</div>
          <div className="account-email">{user?.email || '—'}</div>
        </div>

        <div className="account-divider" />

        {/* Subscription */}
        <div className="account-section">
          <div className="account-label">Subscription</div>

          {loading ? (
            <div className="account-sub-loading">Checking…</div>
          ) : subDetails?.subscription_flag ? (
            <>
              <div className="account-sub-active">
                <span className="account-sub-badge">✦ Pro</span>
                <span className="account-sub-plan">{planLabel()}</span>
              </div>
              <button
                className="account-btn account-btn--manage"
                onClick={handleManage}
                disabled={portalLoading}
              >
                {portalLoading ? 'Opening…' : manageBtnLabel()}
              </button>
              {error && <div className="account-error">{error}</div>}
            </>
          ) : (
            <>
              <div className="account-sub-free">Free plan · 1 garden</div>
              {onSubscribe && (
                <button
                  className="account-btn account-btn--upgrade"
                  onClick={() => { onSubscribe(); onClose(); }}
                >
                  Upgrade to Pro
                </button>
              )}
            </>
          )}
        </div>

        <div className="account-divider" />

        {/* Help links */}
        <div className="account-section account-section--links">
          <button className="account-link" onClick={() => openLink('https://gardenmapper.ca/support')}>
            Help & Support ↗
          </button>
          <button className="account-link" onClick={() => openLink('https://gardenmapper.ca/privacy')}>
            Privacy Policy ↗
          </button>
        </div>
      </div>
    </div>
  );
}
