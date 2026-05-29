// GardenSwitcher.jsx — Phase 5: garden list modal
// Mirrors v8 showGardenSwitcher / garden-switcher panel

import { useState, useEffect } from 'react'
import { readGardens, deleteGarden } from '../hooks/useSaveLoad'
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

  useEffect(() => {
    if (open) setGardens(readGardens())
  }, [open])

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
          {gardens.map((g, i) => (
            <div key={i} className={`switcher-row ${i === currentIndex ? 'current' : ''}`}>
              <span className="switcher-name">
                {g.name || `Garden ${i + 1}`}
                {i === currentIndex && <span className="switcher-badge">current</span>}
              </span>
              <span className="switcher-dims">{g.w}×{g.h} {g.unit}</span>
              <button className="btn-load" onClick={() => { onLoad(i); onClose() }}>Load</button>
              <button className="btn-delete" onClick={() => handleDelete(i)}>🗑</button>
            </div>
          ))}
        </div>

        {atLimit && (
          <div className="switcher-limit">Max 2 gardens. Delete one to create a new one.</div>
        )}

        <div className="switcher-footer">
          <button className="btn-new" onClick={onNew} disabled={atLimit}>
            + New Garden
          </button>
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
