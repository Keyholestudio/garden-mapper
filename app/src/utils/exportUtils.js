// exportUtils.js — PDF export for Garden Mapper
// Renders garden canvas with numbered plant callouts + legend table
// Uses jsPDF for PDF generation, Konva stage.toDataURL() for canvas capture

import { jsPDF } from 'jspdf'
import Konva from 'konva'

// Page dimensions at 96dpi — 8.5×11"
const PAGE_W_PX  = 816   // 8.5 * 96
const PAGE_H_PX  = 1056  // 11  * 96
const MARGIN_PX  = 48    // 0.5" margins

// ── Build numbered plant legend ───────────────────────────────────────────────
// Returns: { legend: [{num, label, family}], plantNums: {plantId: num} }
// Same plant type (key) shares a number — matches landscape plan convention
export function buildPlantLegend(plantLayer, plantDataRef) {
  const keyToNum = {}   // plant key → legend number
  const plantNums = {}  // plantId  → legend number
  const legend = []
  let counter = 1

  plantLayer.find('Group').forEach(group => {
    const id = group.id()
    const d  = plantDataRef.current[id]
    if (!d) return
    if (keyToNum[d.key] === undefined) {
      keyToNum[d.key] = counter
      legend.push({ num: counter, label: d.label, family: d.family, key: d.key })
      counter++
    }
    plantNums[id] = keyToNum[d.key]
  })

  return { legend, plantNums }
}

// ── Core export: renders garden + callouts to a canvas dataURL ───────────────
// Returns { dataUrl, legend, gardenBounds } where gardenBounds is {x,y,w,h} in px
export async function renderExportCanvas(stage, plantLayer, plantDataRef, _propBoundsRef) {
  const { legend, plantNums } = buildPlantLegend(plantLayer, plantDataRef)

  // 1. Capture the Konva stage as PNG
  const stageDataUrl = stage.toDataURL({ pixelRatio: 2 })

  // 2. Load it onto an offscreen canvas
  const stageImg = await loadImage(stageDataUrl)
  const sw = stageImg.width
  const sh = stageImg.height

  // 3. Create composite canvas: stage + callout circles
  const offscreen = document.createElement('canvas')
  offscreen.width  = sw
  offscreen.height = sh
  const ctx = offscreen.getContext('2d')

  // Draw stage
  ctx.drawImage(stageImg, 0, 0)

  // Draw callout circles
  const scaleX = stage.scaleX() * 2  // *2 for pixelRatio:2
  const scaleY = stage.scaleY() * 2

  plantLayer.find('Group').forEach(group => {
    const id  = group.id()
    const num = plantNums[id]
    if (num === undefined) return

    const SIZE = group.width() * group.scaleX()
    // Plant center in stage-pixel space (accounting for pixelRatio:2)
    const cx = (group.x() * stage.scaleX() + stage.x() + SIZE * stage.scaleX() / 2) * 2
    const cy = (group.y() * stage.scaleY() + stage.y() + SIZE * stage.scaleY() / 2) * 2

    const r  = Math.max(10, Math.min(18, SIZE * scaleX * 0.18)) // radius scales with plant size

    // White circle with green border
    ctx.beginPath()
    ctx.arc(cx, cy, r, 0, Math.PI * 2)
    ctx.fillStyle   = '#ffffff'
    ctx.fill()
    ctx.strokeStyle = '#11502A'
    ctx.lineWidth   = Math.max(1.5, r * 0.15)
    ctx.stroke()

    // Number text
    const fontSize = Math.max(9, Math.min(14, r * 1.1))
    ctx.fillStyle  = '#11502A'
    ctx.font       = `bold ${fontSize}px sans-serif`
    ctx.textAlign  = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(String(num), cx, cy)
  })

  return {
    dataUrl: offscreen.toDataURL('image/png'),
    legend,
    canvasW: sw,
    canvasH: sh,
  }
}

// ── Add legend table to a jsPDF doc ─────────────────────────────────────────
function addLegendTable(doc, legend, startY, pageW, margin) {
  const colW    = (pageW - margin * 2) / 2  // two columns side by side
  const rowH    = 7
  const cellPad = 3

  doc.setFontSize(11)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(17, 80, 42)
  doc.text('Plant Legend', margin, startY)
  startY += 7

  doc.setFontSize(8)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(50, 50, 50)

  legend.forEach((item, i) => {
    const col    = i % 2
    const row    = Math.floor(i / 2)
    const x      = margin + col * colW
    const y      = startY + row * rowH

    // Number circle
    doc.setFillColor(255, 255, 255)
    doc.setDrawColor(17, 80, 42)
    doc.circle(x + 3, y - 1.5, 3, 'FD')
    doc.setFontSize(6)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(17, 80, 42)
    doc.text(String(item.num), x + 3, y - 1, { align: 'center' })

    // Plant name
    doc.setFontSize(8)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(50, 50, 50)
    const label = item.label.length > 22 ? item.label.slice(0, 20) + '…' : item.label
    doc.text(`${label}`, x + 8, y - 1 + cellPad * 0.3)
  })

  const legendH = Math.ceil(legend.length / 2) * rowH + 10
  return startY + legendH
}

// ── 1-Page export ─────────────────────────────────────────────────────────────
export async function exportOnePage(stage, plantLayer, plantDataRef, propBoundsRef, gardenName) {
  const { dataUrl, legend, canvasW, canvasH } = await renderExportCanvas(
    stage, plantLayer, plantDataRef, propBoundsRef
  )

  const doc    = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'letter' })
  const pageW  = doc.internal.pageSize.getWidth()   // 612pt
  const pageH  = doc.internal.pageSize.getHeight()  // 792pt
  const margin = 36  // 0.5"

  // Header
  doc.setFontSize(14)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(17, 80, 42)
  doc.text(gardenName || 'My Garden', margin, margin + 4)
  doc.setFontSize(8)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(120, 120, 120)
  doc.text(`Exported ${new Date().toLocaleDateString()}`, margin, margin + 14)

  // Garden image — fit in available space above legend
  const legendH   = Math.ceil(legend.length / 2) * 7 + 24  // rough estimate
  const imgAreaH  = pageH - margin * 2 - 24 - legendH - 10
  const imgAreaW  = pageW - margin * 2
  const aspect    = canvasW / canvasH
  let imgW = imgAreaW
  let imgH = imgW / aspect
  if (imgH > imgAreaH) { imgH = imgAreaH; imgW = imgH * aspect }

  const imgX = margin + (imgAreaW - imgW) / 2
  const imgY = margin + 24

  doc.addImage(dataUrl, 'PNG', imgX, imgY, imgW, imgH)

  // Divider
  const divY = imgY + imgH + 10
  doc.setDrawColor(200, 230, 200)
  doc.line(margin, divY, pageW - margin, divY)

  // Legend
  addLegendTable(doc, legend, divY + 8, pageW, margin)

  doc.save(`${gardenName || 'garden'}-plan.pdf`)
}

// ── 4-Page tiled export ───────────────────────────────────────────────────────
export async function exportFourPage(stage, plantLayer, plantDataRef, propBoundsRef, gardenName) {
  const { dataUrl, legend, canvasW, canvasH } = await renderExportCanvas(
    stage, plantLayer, plantDataRef, propBoundsRef
  )

  const doc    = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'letter' })
  const pageW  = doc.internal.pageSize.getWidth()
  const pageH  = doc.internal.pageSize.getHeight()
  const margin = 36

  const imgAreaW = pageW - margin * 2
  const imgAreaH = pageH - margin * 3  // extra room for header

  // Each page shows one quadrant — 2×2 grid
  const quadrants = [
    { qx: 0,         qy: 0,         label: 'Page 1 of 4 — Top Left'     },
    { qx: canvasW/2, qy: 0,         label: 'Page 2 of 4 — Top Right'    },
    { qx: 0,         qy: canvasH/2, label: 'Page 3 of 4 — Bottom Left'  },
    { qx: canvasW/2, qy: canvasH/2, label: 'Page 4 of 4 — Bottom Right' },
  ]

  const srcImg = await loadImage(dataUrl)

  for (let i = 0; i < 4; i++) {
    if (i > 0) doc.addPage()

    const { qx, qy, label } = quadrants[i]

    // Crop this quadrant to an offscreen canvas
    const qCanvas = document.createElement('canvas')
    qCanvas.width  = canvasW / 2
    qCanvas.height = canvasH / 2
    const qCtx = qCanvas.getContext('2d')
    qCtx.drawImage(srcImg, qx, qy, canvasW/2, canvasH/2, 0, 0, canvasW/2, canvasH/2)
    const qDataUrl = qCanvas.toDataURL('image/png')

    // Header
    doc.setFontSize(10)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(17, 80, 42)
    doc.text(`${gardenName || 'My Garden'} — ${label}`, margin, margin + 4)
    doc.setFontSize(7)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(150, 150, 150)
    doc.text(`Exported ${new Date().toLocaleDateString()}`, margin, margin + 13)

    // Quadrant image — fill available area
    const aspect = (canvasW/2) / (canvasH/2)
    let imgW = imgAreaW
    let imgH = imgW / aspect
    if (imgH > imgAreaH) { imgH = imgAreaH; imgW = imgH * aspect }

    const imgX = margin + (imgAreaW - imgW) / 2
    const imgY = margin + 20

    doc.addImage(qDataUrl, 'PNG', imgX, imgY, imgW, imgH)

    // Legend on last page
    if (i === 3) {
      const divY = imgY + imgH + 10
      doc.setDrawColor(200, 230, 200)
      doc.line(margin, divY, pageW - margin, divY)
      addLegendTable(doc, legend, divY + 8, pageW, margin)
    }
  }

  doc.save(`${gardenName || 'garden'}-plan-tiled.pdf`)
}

// ── Helper ────────────────────────────────────────────────────────────────────
function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload  = () => resolve(img)
    img.onerror = reject
    img.src     = src
  })
}
