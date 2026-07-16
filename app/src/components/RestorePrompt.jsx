import React, { useState } from 'react';
import './RestorePrompt.css';

const MAX_FREE_GARDENS = 1;

function formatTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString('en-CA', { month: 'short', day: 'numeric' }) +
    ' · ' + d.toLocaleTimeString('en-CA', { hour: 'numeric', minute: '2-digit', hour12: true });
}

// ── Restore prompt — new device flow ─────────────────────────────────────────
function RestoreMode({ gardens, onRestore, onDismiss, isSubscribed = false, localUserGardenCount = 0 }) {
  const [loadedIds, setLoadedIds] = useState(new Set());
  const [selectedId, setSelectedId] = useState(null);

  const totalLoaded = loadedIds.size;
  const slotsTotal = isSubscribed ? Infinity : MAX_FREE_GARDENS;
  const slotsUsed = localUserGardenCount + totalLoaded;
  const slotsRemaining = isSubscribed ? Infinity : Math.max(0, slotsTotal - slotsUsed);

  const slotLabel = isSubscribed
    ? 'Garden Limit: None'
    : 'Garden Limit: 1 · Subscribe for more';

  const handleLoad = (g) => {
    if (loadedIds.has(g.garden_id)) return;
    if (slotsRemaining <= 0) return;
    onRestore([g]);
    setLoadedIds(prev => new Set([...prev, g.garden_id]));
    setSelectedId(g.garden_id);
  };

  const anyLoaded = loadedIds.size > 0;

  return (
    <div className="restore-overlay">
      <div className="restore-card restore-card--list">
        <div className="restore-icon">🌱</div>
        <h2>Gardens found on another device</h2>
        <p className="restore-subtitle">{slotLabel}</p>

        <div className="restore-garden-list">
          {gardens.map((g) => {
            const name = g?.garden_name || g?.garden_json?.name || 'Garden';
            const device = g?.device_label || 'Another device';
            const time = formatTime(g?.updated_at);
            const isLoaded = loadedIds.has(g.garden_id);
            const isSelected = selectedId === g.garden_id;
            const canLoad = !isLoaded && slotsRemaining > 0;

            return (
              <div
                key={g.garden_id}
                className={`restore-garden-row${isSelected ? ' restore-garden-row--selected' : ''}${isLoaded ? ' restore-garden-row--loaded' : ''}`}
                onClick={() => !isLoaded && setSelectedId(g.garden_id)}
              >
                <div className="restore-garden-row-info">
                  <span className="restore-garden-row-name">{name}</span>
                  <span className="restore-garden-row-meta">{device}{time ? ` · ${time}` : ''}</span>
                </div>
                {isLoaded ? (
                  <span className="restore-garden-row-loaded">✓ Loaded</span>
                ) : canLoad ? (
                  <button className="btn-restore-load" onClick={(e) => { e.stopPropagation(); handleLoad(g); }}>
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
          {anyLoaded ? 'Continue' : 'Start fresh'}
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
        <div className="restore-icon">🌱</div>
        <h2>Garden updated on another device</h2>
        <p className="restore-conflict-name">"{name}"</p>
        <p className="restore-conflict-subtitle">Select the garden version you would like to use</p>
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
        <div className="restore-actions">
          <button className="btn-restore-primary" onClick={() => onLoadCloud?.(conflict)}>
            Load cloud version
          </button>
          <button className="btn-restore-secondary" onClick={() => onKeepLocal?.(conflict)}>
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
  gardens,
  onRestore,
  onDismiss,
  isSubscribed,
  localUserGardenCount,
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
