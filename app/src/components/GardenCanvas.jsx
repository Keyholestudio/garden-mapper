// GardenCanvas.jsx — Konva stage: the main drawing surface
// Stub — Konva Stage + Layer wired up, ready to receive draw logic from v8

import { useEffect, useRef } from 'react'
import { Stage, Layer, Rect, Text } from 'react-konva'

export default function GardenCanvas({ selectedTool, season, onObjectSelect }) {
  const containerRef = useRef(null)

  return (
    <div className="canvas-container" ref={containerRef}>
      <Stage
        width={containerRef.current?.clientWidth || 800}
        height={containerRef.current?.clientHeight || 600}
        style={{ background: '#e8f5e9', borderRadius: 14 }}
      >
        <Layer>
          <Text
            text="Canvas ready — Konva stage active"
            x={20} y={20}
            fontSize={14}
            fill="#888"
          />
        </Layer>
      </Stage>
    </div>
  )
}
