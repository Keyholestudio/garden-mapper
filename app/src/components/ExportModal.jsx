// ExportModal.jsx — PDF export modal (7.7)
// Two options: 1-page plan or 4-page tiled print
import { useState } from 'react'
import { exportOnePage, exportFourPage } from '../utils/exportUtils'
import './ExportModal.css'

export default function ExportModal({ open, onClose, stage, plantLayer, plantDataRef, propBoundsRef, gardenName }) {
  const [exporting, setExporting] = useState(null)  // null | '1page' | '4page'
  const [done, setDone]           = useState(null)

  if (!open) return null

  const handle = async (type) => {
    setExporting(type)
    setDone(null)
    try {
      if (type === '1page') {
        await exportOnePage(stage, plantLayer, plantDataRef, propBoundsRef, gardenName)
      } else {
        await exportFourPage(stage, plantLayer, plantDataRef, propBoundsRef, gardenName)
      }
      setDone(type)
    } catch (e) {
      console.error('Export failed:', e)
      alert('Export failed — check browser console for details.')
    }
    setExporting(null)
  }

  return (
    <div className="export-overlay" onClick={onClose}>
      <div className="export-panel" onClick={e => e.stopPropagation()}>

        <div className="export-header">
          <span className="export-title">🖨 Export Garden Plan</span>
          <button className="export-close" onClick={onClose}>✕</button>
        </div>

        <div className="export-body">
          <p className="export-desc">
            Exports a PDF with your garden layout, numbered plant callouts, and a plant legend.
          </p>

          <div className="export-options">

            <div className="export-option">
              <div className="export-option-icon">📄</div>
              <div className="export-option-info">
                <div className="export-option-title">Single Page</div>
                <div className="export-option-sub">Full garden on one 8.5×11" page. Good for overview and digital sharing.</div>
              </div>
              <button
                className={`export-btn${exporting === '1page' ? ' loading' : ''}${done === '1page' ? ' done' : ''}`}
                onClick={() => handle('1page')}
                disabled={!!exporting}
              >
                {exporting === '1page' ? '⏳' : done === '1page' ? '✅ Saved' : 'Export'}
              </button>
            </div>

            <div className="export-option">
              <div className="export-option-icon">🗂</div>
              <div className="export-option-info">
                <div className="export-option-title">4-Page Tiled</div>
                <div className="export-option-sub">Garden split across four 8.5×11" pages. Print and tape together for a large-format plan.</div>
              </div>
              <button
                className={`export-btn${exporting === '4page' ? ' loading' : ''}${done === '4page' ? ' done' : ''}`}
                onClick={() => handle('4page')}
                disabled={!!exporting}
              >
                {exporting === '4page' ? '⏳' : done === '4page' ? '✅ Saved' : 'Export'}
              </button>
            </div>

          </div>

          <div className="export-note">
            💡 Plant callouts use numbers — a legend maps each number to the plant name. Same plant type shares one number.
          </div>
        </div>

      </div>
    </div>
  )
}
