import React from 'react';
import './RestorePrompt.css';

/**
 * RestorePrompt — two modes:
 *
 * mode="restore"  — New device: cloud has gardens not in local
 *   Props: gardens (array of cloud rows), onRestore(garden), onDismiss
 *   isSubscribed: bool — controls whether Load buttons are gated
 *   localUserGardenCount: number — how many non-Dream local gardens exist
 *
 * mode="conflict" — Same garden, cloud is newer than local
 *   Props: conflict { local, cloud }, onLoadCloud(conflict), onKeepLocal
 */

const MAX_FREE_GARDENS = 1;

function formatTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString('en-CA', { month: 'short', day: 'numeric' }) +
    ' · ' + d.toLocaleTimeString('en-CA', { hour: 'numeric', minute: '2-digit', hour12: true });
}

// ── Restore prompt — new device flow ─────────────────────────────────────────
function RestoreMode({ gardens, onRestore, onDismiss, isSubscribed = false, localUserGardenCount = 0 }) {
  return (
    <div className="restore-overlay">
      <div className="restore-card restore-card--list">
        <div className="restore-icon">🌱</div>
        <h2>Gardens found on another device</h2>
        <p className="restore-subtitle">Choose which gardens to load, or start fresh.</p>

        <div className="restore-garden-list">
          {gardens.map((g, i) => {
            const name = g?.garden_name || g?.garden_json?.name || 'Garden';
            const device = g?.device_label || 'Another device';
            const time = formatTime(g?.updated_at);
            // Free tier: only allow loading if slot available
            const slotsUsed = localUserGardenCount + i; // each load above takes a slot
            const canLoad = isSubscribed || slotsUsed < MAX_FREE_GARDENS;

            return (
              <div key={g.garden_id} className="restore-garden-row">
                <div className="restore-garden-row-info">
                  <span className="restore-garden-row-name">{name}</span>
                  <span className="restore-garden-row-meta">{device}{time ? ` · ${time}` : ''}</span>
                </div>
                {canLoad ? (
                  <button
                    className="btn-restore-load"
                    onClick={() => onRestore([g])}
                  >
                    Load
                  </button>
                ) : (
                  <span className="restore-garden-row-gated">Subscribe</span>
                )}
              </div>
            );
          })}
        </div>

        <button className="btn-restore-secondary restore-dismiss" onClick={onDismiss}>
          Start fresh
        </button>
      </div>
    </div>
  );
}

// ── Conflict prompt — same garden, cloud is newer ─────────────────────────────
function ConflictMode({ conflict, onLoadCloud, onKeepLocal }) {
  const { local, cloud } = conflict;
  const name = local?.name || cloud?.garden_name || 'Your Garden';
  const cloudDevice = cloud?.device_label || 'Another device';
  const cloudTime = formatTime(cloud?.updated_at);
  const localDevice = local?._deviceLabel || 'This device';
  const localTime = local?._savedAt ? formatTime(local._savedAt) : 'Unknown';

  return (
    <div className="restore-overlay">
      <div className="restore-card restore-card--conflict">
        <div className="restore-icon">⚠️</div>
        <h2>Garden updated on another device</h2>
        <p className="restore-conflict-name">"{name}"</p>
        <div className="restore-versions">
          <div className="restore-version restore-version--cloud">
            <span className="restore-version-label">Cloud version</span>
            <span className="restore-version-device">{cloudDevice}</span>
            <span className="restore-version-time">{cloudTime}</span>
          </div>
          <div className="restore-version-vs">vs</div>
          <div className="restore-version restore-version--local">
            <span className="restore-version-label">This device</span>
            <span className="restore-version-device">{localDevice}</span>
            <span className="restore-version-time">{localTime}</span>
          </div>
        </div>
        <p className="restore-note">A backup of your local version will be saved automatically.</p>
        <div className="restore-actions">
          <button className="btn-restore-primary" onClick={() => onLoadCloud?.(conflict)}>
            Load cloud version
          </button>
          <button className="btn-restore-secondary" onClick={onKeepLocal}>
            Keep local version
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────
export default function RestorePrompt({
  mode = 'restore',
  // Restore mode
  gardens,
  onRestore,
  onDismiss,
  isSubscribed,
  localUserGardenCount,
  // Conflict mode
  conflict,
  onLoadCloud,
  onKeepLocal,
}) {
  if (mode === 'conflict' && conflict) {
    return <ConflictMode conflict={conflict} onLoadCloud={onLoadCloud} onKeepLocal={onKeepLocal} />;
  }
  if (mode === 'restore' && gardens && gardens.length > 0) {
    return (
      <RestoreMode
        gardens={gardens}
        onRestore={onRestore}
        onDismiss={onDismiss}
        isSubscribed={isSubscribed}
        localUserGardenCount={localUserGardenCount}
      />
    );
  }
  return null;
}
