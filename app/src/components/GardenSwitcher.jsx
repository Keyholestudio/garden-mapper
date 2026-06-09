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
}) {
  const [gardens, setGardens] = useState([])
  const [confirmDeleteIdx, setConfirmDeleteIdx] = useState(null)
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

  const MAX_GARDENS = 2
  const atLimit = gardens.length >= MAX_GARDENS

  // Placeholder subscription URL — swap in real page when ready
  const SUBSCRIBE_URL = '/subscribe'

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
              <div className={`switcher-row ${i === currentIndex ? 'current' : ''}`}>
                <span className="switcher-name">
                  {g.name || `Garden ${i + 1}`}
                  {i === currentIndex && <span className="switcher-badge">current</span>}
                </span>
                <span className="switcher-dims">{g.w}×{g.h} {g.unit}</span>
                <button className="btn-load" onClick={() => { onLoad(i); onClose() }}>Load</button>
                <button className="btn-delete" onClick={() => handleDelete(i)}>🗑</button>
              </div>
              {/* Backup slots toggle */}
              {(backupSlots[i]?.length > 0) && (
                <div className="switcher-backup-toggle" onClick={() => toggleBackups(i)}>
                  <span>{expandedBackups[i] ? '▾' : '▸'} Backups ({backupSlots[i].length})</span>
                </div>
              )}
              {expandedBackups[i] && (backupSlots[i] || []).map((slot, si) => (
                <div key={si} className="switcher-backup-row">
                  <span className="switcher-backup-time">{formatBackupTime(slot._backupAt)}</span>
                  <button className="btn-load btn-load--sm" onClick={() => { onLoad(i, slot); onClose() }}>Load</button>
                </div>
              ))}
            </div>
          ))}

          {/* Unlock upsell — always shown after the garden list */}
          <a
            href={SUBSCRIBE_URL}
            className="switcher-unlock-row"
            onClick={onClose}
          >
            <span className="switcher-unlock-icon">🔒</span>
            <span className="switcher-unlock-text">Unlock more gardens</span>
            <span className="switcher-unlock-arrow">›</span>
          </a>
        </div>

        <div className="switcher-footer">
          <button className="btn-new" onClick={onNew} disabled={atLimit}>
            + New Garden
          </button>
          {atLimit && (
            <span className="switcher-limit-inline">2-garden limit reached</span>
          )}
        </div>
      </div>

      {/* Delete confirm modal */}
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
    </div>
  )
}
