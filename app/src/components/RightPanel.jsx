// RightPanel.jsx — Right sidebar: context-sensitive object properties
// Stub — port from v8 prototype right panel logic

export default function RightPanel({ selectedObject }) {
  return (
    <div className="right-panel">
      {selectedObject ? (
        <div className="panel-content">
          <h3>Properties</h3>
          <pre style={{ fontSize: '0.75rem', color: '#666' }}>
            {JSON.stringify(selectedObject, null, 2)}
          </pre>
        </div>
      ) : (
        <div className="panel-empty">
          <p>Select an object to edit</p>
        </div>
      )}
    </div>
  )
}
