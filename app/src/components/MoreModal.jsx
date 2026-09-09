// MoreModal.jsx — "More" info modal
// Accessible from the profile menu "More…" button (logged in or out).
// Contains: Visit GardenMapper.ca, Privacy Policy, Delete Account.

import { createPortal } from 'react-dom';
import { Capacitor } from '@capacitor/core';
import { Browser } from '@capacitor/browser';
import './MoreModal.css';

const isNative = Capacitor.isNativePlatform();

async function openLink(url) {
  if (isNative) {
    await Browser.open({ url });
  } else {
    window.open(url, '_blank', 'noopener,noreferrer');
  }
}

const LINKS = [
  {
    icon: '🌐',
    label: 'Visit GardenMapper.ca',
    sub: 'Tips, updates & plant guides',
    url: 'https://gardenmapper.ca',
  },
  {
    icon: '🔒',
    label: 'Privacy Policy',
    sub: 'How we handle your data',
    url: 'https://www.gardenmapper.ca/store-policy',
  },
  {
    icon: '🗑️',
    label: 'Delete Account',
    sub: 'Request data deletion',
    url: 'https://www.gardenmapper.ca/delete-account',
  },
];

export default function MoreModal({ onClose }) {
  return createPortal(
    <div className="more-modal-overlay" onClick={onClose}>
      <div className="more-modal" onClick={e => e.stopPropagation()}>

        <div className="more-modal-header">
          <h2 className="more-modal-title">🌿 Garden Mapper</h2>
          <button className="more-modal-close" onClick={onClose} aria-label="Close">✕</button>
        </div>

        <div className="more-modal-list">
          {LINKS.map(({ icon, label, sub, url }) => (
            <button
              key={label}
              className="more-modal-item"
              onClick={() => { openLink(url); onClose(); }}
            >
              <span className="more-modal-item-icon">{icon}</span>
              <span className="more-modal-item-text">
                <span className="more-modal-item-label">{label}</span>
                {sub && <span className="more-modal-item-sub">{sub}</span>}
              </span>
              <span className="more-modal-item-arrow">↗</span>
            </button>
          ))}
        </div>

        <div className="more-modal-footer">
          Made with 🌱 by Rob's Lab
        </div>

      </div>
    </div>,
    document.body
  );
}
