// exportUtils.js — PDF export for Garden Mapper
// Renders garden canvas with numbered plant callouts + legend table
// Uses jsPDF for PDF generation, Konva stage.toDataURL() for canvas capture

import { jsPDF } from 'jspdf'

// jsPDF letter page in pts: 612 × 792
const MARGIN    = 18   // ~0.25" — small margin, garden fills most of the page
const HDR_H     = 18   // header height (garden name + date)
const ROW_H     = 9    // legend row height
const CIRCLE_R  = 3.5  // legend circle radius (pt)
const COL_GAP   = 4    // gap between circle and label text

// ── Build numbered plant legend ───────────────────────────────────────────────
// Same plant type (key) shares one number — landscape plan convention
export function buildPlantLegend(plantLayer, plantDataRef) {
  const keyToNum  = {}
  const plantNums = {}
  const legend    = []
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

// ── Core export: renders garden + callout circles to a composite dataURL ─────
export async function renderExportCanvas(stage, plantLayer, plantDataRef) {
  const { legend, plantNums } = buildPlantLegend(plantLayer, plantDataRef)

  // Capture stage at 2× for crisp print resolution
  const stageDataUrl = stage.toDataURL({ pixelRatio: 2 })
  const stageImg     = await loadImage(stageDataUrl)
  const sw = stageImg.width
  const sh = stageImg.height

  const offscreen = document.createElement('canvas')
  offscreen.width  = sw
  offscreen.height = sh
  const ctx = offscreen.getContext('2d')
  ctx.drawImage(stageImg, 0, 0)

  // Draw numbered callout circles centered on each plant
  plantLayer.find('Group').forEach(group => {
    const id  = group.id()
    const num = plantNums[id]
    if (num === undefined) return

    const SIZE = group.width() * group.scaleX()
    // Center in rendered-canvas space (pixelRatio:2)
    const cx = (group.x() * stage.scaleX() + stage.x() + SIZE * stage.scaleX() / 2) * 2
    const cy = (group.y() * stage.scaleY() + stage.y() + SIZE * stage.scaleY() / 2) * 2
    const r  = Math.max(12, Math.min(22, SIZE * stage.scaleX() * 2 * 0.18))

    // White fill, dark green border
    ctx.beginPath()
    ctx.arc(cx, cy, r, 0, Math.PI * 2)
    ctx.fillStyle   = '#ffffff'
    ctx.fill()
    ctx.strokeStyle = '#11502A'
    ctx.lineWidth   = Math.max(2, r * 0.14)
    ctx.stroke()

    // Centered number — textBaseline: 'middle' + textAlign: 'center' for true centering
    const fontSize = Math.max(10, Math.min(16, r * 1.05))
    ctx.font         = `bold ${fontSize}px sans-serif`
    ctx.fillStyle    = '#11502A'
    ctx.textAlign    = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(String(num), cx, cy)
  })

  return { dataUrl: offscreen.toDataURL('image/png'), legend, canvasW: sw, canvasH: sh }
}

// ── Legend: draw on current page, add new page if it overflows ───────────────
function addLegend(doc, legend, afterY, pageW, pageH) {
  const margin  = MARGIN
  const colW    = (pageW - margin * 2) / 2
  const rowsPerPage = Math.floor((pageH - margin * 2 - 16) / ROW_H)

  // Check if legend fits on current page — if not, start a new one
  const legendH = Math.ceil(legend.length / 2) * ROW_H + 16
  if (afterY + legendH > pageH - margin) {
    doc.addPage()
    afterY = margin
  }

  // Legend heading
  doc.setFontSize(10)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(17, 80, 42)
  doc.text('Plant Legend', margin, afterY + 8)
  afterY += 14

  // Divider
  doc.setDrawColor(180, 220, 180)
  doc.line(margin, afterY, pageW - margin, afterY)
  afterY += 5

  legend.forEach((item, i) => {
    const col = i % 2
    const row = Math.floor(i / 2)

    // Check if this row overflows onto the next page
    if (row > 0 && row % rowsPerPage === 0 && col === 0) {
      doc.addPage()
      afterY = margin
    }

    const x   = margin + col * colW
    const cy  = afterY + row * ROW_H - (row >= rowsPerPage ? rowsPerPage * ROW_H : 0) + CIRCLE_R + 1

    // Circle — white fill, green stroke
    doc.setFillColor(255, 255, 255)
    doc.setDrawColor(17, 80, 42)
    doc.setLineWidth(0.5)
    doc.circle(x + CIRCLE_R, cy, CIRCLE_R, 'FD')

    // Number — centered in circle using jsPDF text centering
    doc.setFontSize(5.5)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(17, 80, 42)
    // jsPDF baseline is roughly 0.35× fontSize above bottom — offset upward by ~1pt for visual center
    doc.text(String(item.num), x + CIRCLE_R, cy + 1.8, { align: 'center', baseline: 'middle' })

    // Plant name
    doc.setFontSize(8)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(40, 40, 40)
    const label = item.label.length > 26 ? item.label.slice(0, 24) + '…' : item.label
    doc.text(label, x + CIRCLE_R * 2 + COL_GAP, cy + 1.8, { baseline: 'middle' })
  })
}

// ── 1-Page export ─────────────────────────────────────────────────────────────
export async function exportOnePage(stage, plantLayer, plantDataRef, _propBoundsRef, gardenName) {
  const { dataUrl, legend, canvasW, canvasH } = await renderExportCanvas(stage, plantLayer, plantDataRef)

  const doc   = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'letter' })
  const pageW = doc.internal.pageSize.getWidth()   // 612pt
  const pageH = doc.internal.pageSize.getHeight()  // 792pt

  // ── Header ──
  doc.setFontSize(11)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(17, 80, 42)
  doc.text(gardenName || 'My Garden', MARGIN, MARGIN + 8)
  doc.setFontSize(7)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(150, 150, 150)
  doc.text(`Garden Mapper  ·  ${new Date().toLocaleDateString()}`, MARGIN, MARGIN + 16)

  // ── Garden image — fills page leaving only MARGIN on all sides ──
  const imgAreaW = pageW - MARGIN * 2
  const imgAreaH = pageH - MARGIN * 2 - HDR_H
  const aspect   = canvasW / canvasH
  let imgW = imgAreaW
  let imgH = imgW / aspect
  if (imgH > imgAreaH) { imgH = imgAreaH; imgW = imgH * aspect }

  const imgX = MARGIN + (imgAreaW - imgW) / 2
  const imgY = MARGIN + HDR_H

  doc.addImage(dataUrl, 'PNG', imgX, imgY, imgW, imgH)

  // ── Legend — on same page if it fits, new page if not ──
  addLegend(doc, legend, imgY + imgH + 8, pageW, pageH)

  doc.save(`${gardenName || 'garden'}-plan.pdf`)
}

// ── 4-Page tiled export ───────────────────────────────────────────────────────
export async function exportFourPage(stage, plantLayer, plantDataRef, _propBoundsRef, gardenName) {
  const { dataUrl, legend, canvasW, canvasH } = await renderExportCanvas(stage, plantLayer, plantDataRef)

  const doc   = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'letter' })
  const pageW = doc.internal.pageSize.getWidth()
  const pageH = doc.internal.pageSize.getHeight()

  const imgAreaW = pageW - MARGIN * 2
  const imgAreaH = pageH - MARGIN * 2 - HDR_H

  const quadrants = [
    { qx: 0,          qy: 0,          label: 'Top Left     (1 of 4)' },
    { qx: canvasW / 2, qy: 0,          label: 'Top Right    (2 of 4)' },
    { qx: 0,          qy: canvasH / 2, label: 'Bottom Left  (3 of 4)' },
    { qx: canvasW / 2, qy: canvasH / 2, label: 'Bottom Right (4 of 4)' },
  ]

  const srcImg = await loadImage(dataUrl)

  for (let i = 0; i < 4; i++) {
    if (i > 0) doc.addPage()
    const { qx, qy, label } = quadrants[i]

    // Crop quadrant to offscreen canvas
    const qCanvas = document.createElement('canvas')
    qCanvas.width  = Math.ceil(canvasW / 2)
    qCanvas.height = Math.ceil(canvasH / 2)
    const qCtx = qCanvas.getContext('2d')
    qCtx.drawImage(srcImg, qx, qy, qCanvas.width, qCanvas.height, 0, 0, qCanvas.width, qCanvas.height)
    const qDataUrl = qCanvas.toDataURL('image/png')

    // Header
    doc.setFontSize(10)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(17, 80, 42)
    doc.text(`${gardenName || 'My Garden'} — ${label}`, MARGIN, MARGIN + 8)
    doc.setFontSize(7)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(150, 150, 150)
    doc.text(`Garden Mapper  ·  ${new Date().toLocaleDateString()}`, MARGIN, MARGIN + 16)

    // Quadrant image — fills page
    const aspect = qCanvas.width / qCanvas.height
    let imgW = imgAreaW
    let imgH = imgW / aspect
    if (imgH > imgAreaH) { imgH = imgAreaH; imgW = imgH * aspect }

    const imgX = MARGIN + (imgAreaW - imgW) / 2
    const imgY = MARGIN + HDR_H

    doc.addImage(qDataUrl, 'PNG', imgX, imgY, imgW, imgH)

    // Legend after the last quadrant (page 4 or new page if it overflows)
    if (i === 3) {
      addLegend(doc, legend, imgY + imgH + 8, pageW, pageH)
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
