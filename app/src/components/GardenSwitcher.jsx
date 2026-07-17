// GardenSwitcher.jsx — Phase 5: garden list modal
// Mirrors v8 showGardenSwitcher / garden-switcher panel

import { useState, useEffect } from 'react'
import { readGardens, deleteGarden, readBackupSlots } from '../hooks/useSaveLoad'
import './GardenSwitcher.css'

export default function GardenSwitcher({
  open,
  currentIndex,
  onLoad,
  onNew,
  onClose,
  // Cloud sync props
  ghostGardens = [],        // cloud-only gardens (array of cloud rows)
  onLoadGhost,              // (ghostItem) => void — load a ghost into local
  onDeleteGhost,            // (ghostItem) => void — soft-delete a ghost from cloud
  isSubscribed = false,     // subscription status
  onSubscribe,              // () => void — open the subscribe modal
}) {
  const [gardens, setGardens] = useState([])
  const [confirmDeleteIdx, setConfirmDeleteIdx] = useState(null)
  const [confirmDeleteGhost, setConfirmDeleteGhost] = useState(null) // ghost item pending delete confirm
  const [expandedBackups, setExpandedBackups] = useState({}) // { [gardenIndex]: bool }
  const [backupSlots, setBackupSlots] = useState({})         // { [gardenIndex]: slot[] }

  useEffect(() => {
    if (open) {
      const gs = readGardens()
      setGardens(gs)
      // Pre-load backup slots for all gardens
      const slots = {}
      gs.forEach((_, i) => { slots[i] = readBackupSlots(i) })
      setBackupSlots(slots)
    }
  }, [open])

  const toggleBackups = (i) => {
    setExpandedBackups(prev => ({ ...prev, [i]: !prev[i] }))
  }

  const formatBackupTime = (iso) => {
    if (!iso) return ''
    const d = new Date(iso)
    return d.toLocaleDateString('en-CA', { month: 'short', day: 'numeric' }) +
      ', ' + d.toLocaleTimeString('en-CA', { hour: 'numeric', minute: '2-digit', hour12: true })
  }

  if (!open) return null

  const handleDelete = (idx) => {
    setConfirmDeleteIdx(idx)
  }

  const confirmDelete = () => {
    const updated = deleteGarden(confirmDeleteIdx)
    setGardens([...updated])
    setConfirmDeleteIdx(null)
  }

  // Dream Garden is always index 0 (_isDreamGarden flag)
  const isDream = (g) => !!(g?._isDreamGarden)
  // Free tier: 1 user garden (Dream Garden doesn't count toward limit)
  const MAX_USER_GARDENS = 1
  const userGardens = gardens.filter((g) => !isDream(g))
  const atLimit = !isSubscribed && userGardens.length >= MAX_USER_GARDENS

  // Ghost CTA: recheck on every render based on current garden count
  const ghostCTA = (ghostItem) => {
    if (isSubscribed) return { label: 'Load', action: () => onLoadGhost?.(ghostItem), isUpsell: false };
    if (userGardens.length === 0) return { label: 'Load', action: () => onLoadGhost?.(ghostItem), isUpsell: false };
    return { label: 'Subscribe to load', action: () => { onClose?.(); onSubscribe?.(); }, isUpsell: true };
  }

  const formatGhostTime = (iso) => {
    if (!iso) return ''
    const d = new Date(iso)
    return d.toLocaleDateString('en-CA', { month: 'short', day: 'numeric' })
  }

  return (
    <div className="switcher-overlay" onClick={onClose}>
      <div className="switcher-panel" onClick={e => e.stopPropagation()}>
        <div className="switcher-header">
          <span className="switcher-title">🌿 My Gardens</span>
          <button className="switcher-close" onClick={onClose}>✕</button>
        </div>

        <div className="switcher-list">
          {gardens.length === 0 && (
            <div className="switcher-empty">No saved gardens yet. Click Save first.</div>
          )}
          {gardens.map((g, i) => !g ? null : (
            <div key={i} className="switcher-garden-group">
              <div className={`switcher-row ${i === currentIndex ? 'current' : ''} ${isDream(g) ? 'dream' : ''}`}>
                <span className="switcher-name">
                  {g.name || `Garden ${i + 1}`}
                </span>
                {i === currentIndex && <span className="switcher-badge">current</span>}
                <span className="switcher-dims">{g.w}×{g.h} {g.unit}</span>
                <button className="btn-load" onClick={() => { onLoad(i); onClose() }}>Load</button>
                <button
                  className="btn-delete"
                  onClick={() => !isDream(g) && handleDelete(i)}
                  disabled={isDream(g)}
                  title={isDream(g) ? 'Dream Garden cannot be deleted' : ''}
                >🗑</button>
              </div>
              {/* Backup slots toggle — not shown for Dream Garden */}
              {!isDream(g) && (backupSlots[i]?.length > 0) && (
                <div className="switcher-backup-toggle" onClick={() => toggleBackups(i)}>
                  <span>{expandedBackups[i] ? '▾' : '▸'} Backups ({backupSlots[i].length})</span>
                </div>
              )}
              {!isDream(g) && expandedBackups[i] && (backupSlots[i] || []).map((slot, si) => (
                <div key={si} className="switcher-backup-row">
                  <span className="switcher-backup-time">{formatBackupTime(slot._backupAt)}</span>
                  <button className="btn-load btn-load--sm" onClick={() => { onLoad(i, slot); onClose() }}>Load</button>
                </div>
              ))}
            </div>
          ))}

          {/* Ghost gardens — cloud-only, shown greyed out below local list */}
          {ghostGardens.length > 0 && (
            <div className="switcher-ghost-section">
              <div className="switcher-ghost-label">Saved on another device</div>
              {ghostGardens.map((g) => {
                const cta = ghostCTA(g)
                const name = g.garden_name || g.garden_json?.name || 'Garden'
                const device = g.device_label || 'Another device'
                const time = formatGhostTime(g.updated_at)
                return (
                  <div key={g.garden_id} className="switcher-row switcher-row--ghost">
                    <div className="switcher-ghost-info">
                      <span className="switcher-name switcher-name--ghost">{name}</span>
                      <span className="switcher-ghost-meta">{device}{time ? ` · ${time}` : ''}</span>
                    </div>
                    <button
                      className={`btn-load ${cta.isUpsell ? 'btn-load--upsell' : ''}`}
                      onClick={() => { cta.action(); if (!cta.isUpsell) onClose(); }}
                    >
                      {cta.label}
                    </button>
                    <button
                      className="btn-delete btn-delete--ghost"
                      onClick={() => setConfirmDeleteGhost(g)}
                      title="Delete from cloud"
                    >🗑</button>
                  </div>
                )
              })}
            </div>
          )}

          {/* Unlock upsell — shown when no ghost gardens (keeps upsell always visible) */}
          {ghostGardens.length === 0 && (
            <a
              href="#"
              className="switcher-unlock-row"
              onClick={(e) => { e.preventDefault(); onClose?.(); onSubscribe?.(); }}
            >
              <span className="switcher-unlock-icon">🔒</span>
              <span className="switcher-unlock-text">Unlock more gardens</span>
              <span className="switcher-unlock-arrow">›</span>
            </a>
          )}
        </div>

        <div className="switcher-footer">
          <button className="btn-new" onClick={onNew} disabled={atLimit}>
            + New Garden
          </button>
          {atLimit && (
            <span className="switcher-limit-inline">Garden Limit Reached</span>
          )}
        </div>
      </div>

      {/* Delete confirm modal — local garden */}
      {confirmDeleteIdx !== null && (
        <div className="confirm-overlay" onClick={e => e.stopPropagation()}>
          <div className="confirm-box">
            <p>Delete <strong>{gardens[confirmDeleteIdx]?.name || `Garden ${confirmDeleteIdx + 1}`}</strong>?<br/>This cannot be undone.</p>
            <div className="confirm-actions">
              <button className="btn-cancel" onClick={() => setConfirmDeleteIdx(null)}>Cancel</button>
              <button className="btn-confirm-delete" onClick={confirmDelete}>Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirm modal — ghost (cloud) garden */}
      {confirmDeleteGhost !== null && (
        <div className="confirm-overlay" onClick={e => e.stopPropagation()}>
          <div className="confirm-box">
            <p>Delete <strong>{confirmDeleteGhost.garden_name || 'this garden'}</strong> from the cloud?<br/>It will be removed from all devices.</p>
            <div className="confirm-actions">
              <button className="btn-cancel" onClick={() => setConfirmDeleteGhost(null)}>Cancel</button>
              <button className="btn-confirm-delete" onClick={() => {
                onDeleteGhost?.(confirmDeleteGhost);
                setConfirmDeleteGhost(null);
              }}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
