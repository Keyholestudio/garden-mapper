// SignInModal.jsx — Sign In options modal
// Shows Google sign-in and magic link (passwordless email) options.
// Triggered from the profile dropdown when user is signed out.

import { useState } from 'react';
import './SignInModal.css';

export default function SignInModal({ isOpen, onClose, onSignInGoogle, onSendMagicLink }) {
  const [email, setEmail] = useState('');
  const [emailSent, setEmailSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showEmailForm, setShowEmailForm] = useState(false);

  if (!isOpen) return null;

  function handleOverlayClick(e) {
    if (e.target === e.currentTarget) onClose();
  }

  async function handleSendLink(e) {
    e.preventDefault();
    if (!email.trim()) return;
    setLoading(true);
    setError(null);
    try {
      await onSendMagicLink(email.trim());
      setEmailSent(true);
    } catch (err) {
      setError(err.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  function handleClose() {
    // Reset state on close
    setEmail('');
    setEmailSent(false);
    setError(null);
    setShowEmailForm(false);
    onClose();
  }

  return (
    <div className="signin-modal-overlay" onClick={handleOverlayClick}>
      <div className="signin-modal">
        <div className="signin-modal-header">
          <div className="signin-modal-titles">
            <h2 className="signin-modal-title">Sign In</h2>
            <p className="signin-modal-subtitle">Back up your garden</p>
          </div>
          <button className="signin-modal-close" onClick={handleClose} aria-label="Close">✕</button>
        </div>

        <div className="signin-modal-body">
          {emailSent ? (
            /* ── Success state ── */
            <div className="signin-email-sent">
              <div className="signin-email-sent-icon">✉️</div>
              <div className="signin-email-sent-title">Check your inbox</div>
              <div className="signin-email-sent-text">
                We sent a sign-in link to <strong>{email}</strong>.<br />
                Click the link to sign in — no password needed.
              </div>
              <button className="signin-btn signin-btn--secondary" onClick={handleClose}>
                Done
              </button>
            </div>
          ) : !showEmailForm ? (
            /* ── Main options ── */
            <>
              <button
                className="signin-btn signin-btn--google"
                onClick={() => { onSignInGoogle(); handleClose(); }}
              >
                <img
                  src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg"
                  alt=""
                  className="signin-btn-icon"
                />
                Sign in with Google
              </button>

              <button
                className="signin-btn signin-btn--email"
                onClick={() => setShowEmailForm(true)}
              >
                <span className="signin-btn-icon signin-btn-icon--email">✉️</span>
                Sign in with Email
              </button>

              <p className="signin-modal-note">
                Sign in to back up your garden and sync across devices.
              </p>
            </>
          ) : (
            /* ── Email form ── */
            <form className="signin-email-form" onSubmit={handleSendLink}>
              <p className="signin-email-form-label">
                Enter your email and we'll send you a sign-in link — no password needed.
              </p>
              <input
                type="email"
                className="signin-email-input"
                placeholder="you@example.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                autoFocus
                required
              />
              {error && <div className="signin-email-error">{error}</div>}
              <button
                type="submit"
                className="signin-btn signin-btn--primary"
                disabled={loading || !email.trim()}
              >
                {loading ? 'Sending…' : 'Send Sign-In Link'}
              </button>
              <button
                type="button"
                className="signin-btn signin-btn--secondary"
                onClick={() => { setShowEmailForm(false); setError(null); }}
              >
                Back
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
