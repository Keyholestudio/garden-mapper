// PlantTray.jsx — Left sidebar: plant/tool selection
// Stub — port from v8 prototype tray logic

export default function PlantTray({ selectedTool, onToolSelect }) {
  return (
    <div className="plant-tray">
      <div className="tray-search">
        <input type="search" placeholder="Search plants..." />
      </div>
      <div className="tray-content">
        <p style={{ color: '#999', padding: '1rem', fontSize: '0.85rem' }}>
          Plant tray — coming from v8
        </p>
      </div>
    </div>
  )
}
