// SubscribeModal.jsx — "Go Pro" paywall modal for web users
// Shown when a free-tier web user tries to load a ghost garden or add a second garden.
// Native users (Android/iOS) use RevenueCat — this modal is web-only.

import React, { useState } from 'react';
import './SubscribeModal.css';

const FEATURES = [
  '🌿 Unlimited gardens',
  '☁️ Cross-device sync',
  '🌱 Full plant catalog',
  '📦 Future plant pack discounts',
];

/**
 * SubscribeModal
 * Props:
 *   isOpen        boolean
 *   onClose       () => void
 *   onSubscribe   (plan: 'lifetime' | 'annual') => void
 *   loading       boolean — true while redirecting to Stripe
 *   error         string | null
 */
export default function SubscribeModal({ isOpen, onClose, onSubscribe, loading, error }) {
  const [selected, setSelected] = useState('lifetime');

  if (!isOpen) return null;

  const handleSubscribe = () => {
    if (!loading) onSubscribe(selected);
  };

  return (
    <div className="subscribe-modal-overlay" onClick={onClose}>
      <div className="subscribe-modal" onClick={e => e.stopPropagation()}>
        <button className="subscribe-modal-close" onClick={onClose} aria-label="Close">✕</button>

        <div className="subscribe-modal-header">
          <span className="subscribe-modal-icon">🌸</span>
          <h2>Garden Mapper Pro</h2>
          <p className="subscribe-modal-tagline">Design without limits</p>
        </div>

        <ul className="subscribe-modal-features">
          {FEATURES.map(f => (
            <li key={f}>{f}</li>
          ))}
        </ul>

        <div className="subscribe-modal-plans">
          <button
            className={`subscribe-plan-btn${selected === 'lifetime' ? ' selected' : ''}`}
            onClick={() => setSelected('lifetime')}
          >
            <div className="plan-label">
              <span className="plan-name">Lifetime</span>
              <span className="plan-badge">Best value</span>
            </div>
            <span className="plan-price">$14.99 <span className="plan-once">one-time</span></span>
          </button>

          <button
            className={`subscribe-plan-btn${selected === 'annual' ? ' selected' : ''}`}
            onClick={() => setSelected('annual')}
          >
            <div className="plan-label">
              <span className="plan-name">Annual</span>
            </div>
            <span className="plan-price">$9.99 <span className="plan-once">/ year</span></span>
          </button>
        </div>

        {error && <p className="subscribe-modal-error">{error}</p>}

        <button
          className="subscribe-modal-cta"
          onClick={handleSubscribe}
          disabled={loading}
        >
          {loading ? 'Redirecting…' : 'Get Pro Access'}
        </button>

        <p className="subscribe-modal-fine">
          Secure payment via Stripe. Cancel anytime (annual plan).
        </p>
      </div>
    </div>
  );
}
