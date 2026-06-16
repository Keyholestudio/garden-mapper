import React from 'react';
import './RestorePrompt.css';

/**
 * RestorePrompt — shown when local is empty but cloud has garden data.
 * Per SYNC-POLICY.md: never auto-restore; always ask the user first.
 */
export default function RestorePrompt({ onRestore, onDismiss }) {
  return (
    <div className="restore-overlay">
      <div className="restore-card">
        <div className="restore-icon">🌱</div>
        <h2>Your garden is in the cloud</h2>
        <p>We found a saved garden linked to your account. Would you like to restore it?</p>
        <div className="restore-actions">
          <button className="btn-restore-primary" onClick={onRestore}>
            Restore my garden
          </button>
          <button className="btn-restore-secondary" onClick={onDismiss}>
            Start fresh
          </button>
        </div>
      </div>
    </div>
  );
}
