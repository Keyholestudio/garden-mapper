// RightPanel.jsx — Context-sensitive right sidebar
// Phase 1: stub with selection state awareness

import './RightPanel.css'

export default function RightPanel({ selectedPlant, selectedStruct, multiSelection }) {
  const hasMulti = multiSelection && multiSelection.length > 1

  return (
    <div className="right-panel">
      {hasMulti ? (
        <div className="panel-content">
          <div className="panel-h2">Multiple Selected</div>
          <p className="panel-sub">{multiSelection.length} objects</p>
          <button className="btn-panel danger">🗑 Delete All</button>
        </div>
      ) : selectedPlant ? (
        <div className="panel-content">
          <div className="panel-h2">{selectedPlant.label || 'Plant'}</div>
          <p className="panel-sub">{selectedPlant.family || ''}</p>
          {/* Plant properties — Phase 4 */}
          <p className="panel-placeholder">Plant tools coming in Phase 4</p>
        </div>
      ) : selectedStruct ? (
        <div className="panel-content">
          <div className="panel-h2">{selectedStruct.type || 'Object'}</div>
          {/* Struct properties — Phase 4 */}
          <p className="panel-placeholder">Object tools coming in Phase 4</p>
        </div>
      ) : (
        <div className="panel-empty">
          <p>Select an object<br/>to edit its properties</p>
        </div>
      )}
    </div>
  )
}
