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
    sub: 'Visit our How To page',
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

export default function MoreModal({ onClose, audio }) {
  return createPortal(
    <div className="more-modal-overlay" onClick={onClose}>
      <div className="more-modal" onClick={e => e.stopPropagation()}>

        <div className="more-modal-header">
          <h2 className="more-modal-title">🌿 Garden Mapper</h2>
          <button className="more-modal-close" onClick={onClose} aria-label="Close">✕</button>
        </div>

        {/* ── Sound Settings ── */}
        {audio && (
          <div className="more-modal-sound">
            <div className="more-modal-sound-title">🔊 Sound</div>

            <div className="more-modal-sound-row">
              <span>Sound Effects</span>
              <button
                className={`more-modal-toggle ${audio.sfxEnabled ? 'on' : 'off'}`}
                onClick={audio.toggleSfx}
                aria-label={audio.sfxEnabled ? 'Mute sound effects' : 'Enable sound effects'}
              >
                {audio.sfxEnabled ? 'ON' : 'OFF'}
              </button>
            </div>

            <div className="more-modal-sound-row">
              <span>Music</span>
              <button
                className={`more-modal-toggle ${audio.musicEnabled ? 'on' : 'off'}`}
                onClick={audio.toggleMusic}
                aria-label={audio.musicEnabled ? 'Mute music' : 'Enable music'}
              >
                {audio.musicEnabled ? 'ON' : 'OFF'}
              </button>
            </div>

            {audio.musicEnabled && (
              <>
                <div className="more-modal-now-playing">
                  ♫ {audio.currentTrackLabel || 'Loading…'}
                </div>
                <div className="more-modal-player">
                  <button className="more-modal-player-btn" onClick={audio.prevTrack} title="Previous">⏮️</button>
                  <button className="more-modal-player-btn" onClick={audio.nextTrack} title="Next">⏭️</button>
                  <button
                    className={`more-modal-player-btn ${audio.shuffle ? 'active' : ''}`}
                    onClick={audio.toggleShuffle}
                    title={audio.shuffle ? 'Shuffle on' : 'Shuffle off'}
                  >
                    🔀
                  </button>
                </div>
              </>
            )}
          </div>
        )}

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
          Made by Rob's Lab
        </div>

      </div>
    </div>,
    document.body
  );
}
