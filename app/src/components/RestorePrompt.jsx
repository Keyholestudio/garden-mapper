import React from 'react';
import './RestorePrompt.css';

/**
 * RestorePrompt — two modes:
 *
 * mode="restore"  — New device: cloud has gardens not in local
 *   Props: gardens (array of cloud rows), onRestore(garden), onDismiss
 *
 * mode="conflict" — Same garden, cloud is newer than local
 *   Props: conflict { local, cloud }, onLoadCloud(conflict), onKeepLocal
 */

function formatTime(iso) {
  if (!iso) return 'Unknown time';
  const d = new Date(iso);
  return d.toLocaleDateString('en-CA', { month: 'short', day: 'numeric' }) +
    ' · ' + d.toLocaleTimeString('en-CA', { hour: 'numeric', minute: '2-digit', hour12: true });
}

// ── Restore prompt — new device flow ─────────────────────────────────────────
function RestoreMode({ gardens, onRestore, onDismiss }) {
  // Show the first garden (most recent by updated_at from Supabase)
  const g = gardens[0];
  const name = g?.garden_name || g?.garden_json?.name || 'Your Garden';
  const device = g?.device_label || 'Another device';
  const time = formatTime(g?.updated_at);
  const count = gardens.length;

  return (
    <div className="restore-overlay">
      <div className="restore-card">
        <div className="restore-icon">🌱</div>
        <h2>Garden found from another device</h2>
        <div className="restore-garden-info">
          <span className="restore-garden-name">"{name}"</span>
          <span className="restore-garden-meta">{device} · {time}</span>
          {count > 1 && (
            <span className="restore-garden-more">+{count - 1} more garden{count > 2 ? 's' : ''}</span>
          )}
        </div>
        <div className="restore-actions">
          <button className="btn-restore-primary" onClick={() => onRestore(gardens)}>
            Load {count > 1 ? 'all gardens' : 'it'}
          </button>
          <button className="btn-restore-secondary" onClick={onDismiss}>
            Start fresh
          </button>
        </div>
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
          <button className="btn-restore-primary" onClick={() => {
            console.log('[RestorePrompt] Load cloud version clicked, onLoadCloud:', typeof onLoadCloud);
            onLoadCloud?.(conflict);
          }}>
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
  // Restore mode
  mode = 'restore',
  gardens,
  onRestore,
  onDismiss,
  // Conflict mode
  conflict,
  onLoadCloud,
  onKeepLocal,
}) {
  if (mode === 'conflict' && conflict) {
    return <ConflictMode conflict={conflict} onLoadCloud={onLoadCloud} onKeepLocal={onKeepLocal} />;
  }
  if (mode === 'restore' && gardens && gardens.length > 0) {
    return <RestoreMode gardens={gardens} onRestore={onRestore} onDismiss={onDismiss} />;
  }
  return null;
}
