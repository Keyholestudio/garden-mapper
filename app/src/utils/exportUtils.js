// exportUtils.js — PDF export for Garden Mapper
// Renders garden canvas with numbered plant callouts + legend table
// Uses jsPDF for PDF generation, Konva stage.toDataURL() for canvas capture

import { jsPDF } from 'jspdf'

// jsPDF letter page in pts: 612 × 792
const MARGIN   = 18    // ~0.25" margins
const HDR_H    = 22    // space reserved for header above image
const ROW_H    = 10    // legend row height (pt)
const CIRCLE_R = 3.8   // legend number circle radius (pt)
const COL_GAP  = 4     // gap between circle edge and label text

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

// ── Core export: crops to propBounds, renders callouts, returns dataURL ──────
// propBoundsRef: { x, y, w, h } in Konva world coords
export async function renderExportCanvas(stage, plantLayer, plantDataRef, propBoundsRef) {
  const { legend, plantNums } = buildPlantLegend(plantLayer, plantDataRef)
  const PR = 2  // pixelRatio for crisp output

  // propBounds in stage-pixel space
  const pb     = propBoundsRef.current
  const pad    = 24  // small padding around property boundary (world px)
  const cropX  = (pb.x - pad) * stage.scaleX() + stage.x()
  const cropY  = (pb.y - pad) * stage.scaleY() + stage.y()
  const cropW  = (pb.w + pad * 2) * stage.scaleX()
  const cropH  = (pb.h + pad * 2) * stage.scaleY()

  // Capture full stage at PR then crop to propBounds region
  const stageDataUrl = stage.toDataURL({ pixelRatio: PR })
  const stageImg     = await loadImage(stageDataUrl)

  const outW = Math.round(cropW * PR)
  const outH = Math.round(cropH * PR)

  const offscreen = document.createElement('canvas')
  offscreen.width  = outW
  offscreen.height = outH
  const ctx = offscreen.getContext('2d')

  // Draw only the cropped region
  ctx.drawImage(
    stageImg,
    Math.round(cropX * PR), Math.round(cropY * PR), outW, outH,  // src region
    0, 0, outW, outH                                               // dest
  )

  // Draw numbered callout circles — positions relative to crop origin
  plantLayer.find('Group').forEach(group => {
    const id  = group.id()
    const num = plantNums[id]
    if (num === undefined) return

    const SIZE = group.width() * group.scaleX()
    // Plant center in full-stage pixel space (PR applied)
    const fullCx = (group.x() * stage.scaleX() + stage.x() + SIZE * stage.scaleX() / 2) * PR
    const fullCy = (group.y() * stage.scaleY() + stage.y() + SIZE * stage.scaleY() / 2) * PR
    // Shift to crop-relative coords
    const cx = fullCx - Math.round(cropX * PR)
    const cy = fullCy - Math.round(cropY * PR)
    const r  = Math.max(12, Math.min(22, SIZE * stage.scaleX() * PR * 0.18))

    // White fill, dark green border
    ctx.beginPath()
    ctx.arc(cx, cy, r, 0, Math.PI * 2)
    ctx.fillStyle   = '#ffffff'
    ctx.fill()
    ctx.strokeStyle = '#11502A'
    ctx.lineWidth   = Math.max(2, r * 0.14)
    ctx.stroke()

    // Number — centered
    const fontSize = Math.max(10, Math.min(16, r * 1.05))
    ctx.save()
    ctx.font         = `bold ${fontSize}px sans-serif`
    ctx.fillStyle    = '#11502A'
    ctx.textAlign    = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(String(num), cx, cy)
    ctx.restore()
  })

  return { dataUrl: offscreen.toDataURL('image/png'), legend, canvasW: outW, canvasH: outH }
}

// ── Fit image into available area preserving aspect ratio ────────────────────
function fitImage(srcW, srcH, areaW, areaH) {
  const aspect = srcW / srcH
  let w = areaW
  let h = w / aspect
  if (h > areaH) { h = areaH; w = h * aspect }
  return { w, h }
}

// ── Draw page header ──────────────────────────────────────────────────────────
function drawHeader(doc, title, margin) {
  doc.setFontSize(11)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(17, 80, 42)
  doc.text(title, margin, margin + 9)
  doc.setFontSize(7)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(150, 150, 150)
  doc.text(`Garden Mapper  ·  ${new Date().toLocaleDateString()}`, margin, margin + 17)
}

// ── Legend page ───────────────────────────────────────────────────────────────
// Always called after doc.addPage() — legend gets its own page(s)
function addLegend(doc, legend, pageW, pageH) {
  const margin  = MARGIN
  const colW    = (pageW - margin * 2) / 2

  // Heading
  doc.setFontSize(12)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(17, 80, 42)
  doc.text('Plant Legend', margin, margin + 10)

  doc.setDrawColor(180, 220, 180)
  doc.line(margin, margin + 14, pageW - margin, margin + 14)

  let baseY = margin + 22   // y of first row center

  legend.forEach((item, i) => {
    const col = i % 2
    const row = Math.floor(i / 2)

    // New page when rows would overflow
    const rowY = baseY + row * ROW_H
    if (rowY + ROW_H > pageH - margin) {
      doc.addPage()
      baseY = margin + 10 - row * ROW_H  // reset so next row starts near top
    }

    const cy = baseY + row * ROW_H  // vertical center of this row
    const x  = margin + col * colW

    // Circle
    doc.setFillColor(255, 255, 255)
    doc.setDrawColor(17, 80, 42)
    doc.setLineWidth(0.6)
    doc.circle(x + CIRCLE_R, cy, CIRCLE_R, 'FD')

    // Number — jsPDF centers text horizontally with align:'center'
    // Vertical: jsPDF text y is the baseline. To visually center in circle,
    // offset up by ~35% of font size (empirically correct for helvetica)
    const numFontSize = 6
    doc.setFontSize(numFontSize)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(17, 80, 42)
    doc.text(String(item.num), x + CIRCLE_R, cy + numFontSize * 0.35, { align: 'center' })

    // Plant name
    doc.setFontSize(8)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(40, 40, 40)
    const label = item.label.length > 28 ? item.label.slice(0, 26) + '…' : item.label
    doc.text(label, x + CIRCLE_R * 2 + COL_GAP, cy + 8 * 0.35)
  })
}

// ── 1-Page export ─────────────────────────────────────────────────────────────
// Page 1: full garden filling the page. Page 2: legend.
export async function exportOnePage(stage, plantLayer, plantDataRef, propBoundsRef, gardenName) {
  const { dataUrl, legend, canvasW, canvasH } = await renderExportCanvas(stage, plantLayer, plantDataRef, propBoundsRef)

  const doc   = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'letter' })
  const pageW = doc.internal.pageSize.getWidth()   // 612pt
  const pageH = doc.internal.pageSize.getHeight()  // 792pt

  // Header
  drawHeader(doc, gardenName || 'My Garden', MARGIN)

  // Garden image — fills entire printable area below header
  const areaW = pageW - MARGIN * 2
  const areaH = pageH - MARGIN * 2 - HDR_H
  const { w: imgW, h: imgH } = fitImage(canvasW, canvasH, areaW, areaH)
  doc.addImage(dataUrl, 'PNG', MARGIN + (areaW - imgW) / 2, MARGIN + HDR_H, imgW, imgH)

  // Legend on its own page
  doc.addPage()
  addLegend(doc, legend, pageW, pageH)

  doc.save(`${gardenName || 'garden'}-plan.pdf`)
}

// ── 4-Page tiled export ───────────────────────────────────────────────────────
// Pages 1-4: garden quadrants, each filling a page. Page 5: legend.
export async function exportFourPage(stage, plantLayer, plantDataRef, propBoundsRef, gardenName) {
  const { dataUrl, legend, canvasW, canvasH } = await renderExportCanvas(stage, plantLayer, plantDataRef, propBoundsRef)

  const doc   = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'letter' })
  const pageW = doc.internal.pageSize.getWidth()
  const pageH = doc.internal.pageSize.getHeight()
  const areaW = pageW - MARGIN * 2
  const areaH = pageH - MARGIN * 2 - HDR_H

  const quadrants = [
    { qx: 0,           qy: 0,           label: 'Top Left (1 of 4)'     },
    { qx: canvasW / 2, qy: 0,           label: 'Top Right (2 of 4)'    },
    { qx: 0,           qy: canvasH / 2, label: 'Bottom Left (3 of 4)'  },
    { qx: canvasW / 2, qy: canvasH / 2, label: 'Bottom Right (4 of 4)' },
  ]

  const srcImg = await loadImage(dataUrl)

  for (let i = 0; i < 4; i++) {
    if (i > 0) doc.addPage()
    const { qx, qy, label } = quadrants[i]

    // Crop quadrant
    const qW = Math.ceil(canvasW / 2)
    const qH = Math.ceil(canvasH / 2)
    const qCanvas = document.createElement('canvas')
    qCanvas.width  = qW
    qCanvas.height = qH
    qCanvas.getContext('2d').drawImage(srcImg, qx, qy, qW, qH, 0, 0, qW, qH)
    const qDataUrl = qCanvas.toDataURL('image/png')

    // Header
    drawHeader(doc, `${gardenName || 'My Garden'} — ${label}`, MARGIN)

    // Quadrant fills the page
    const { w: imgW, h: imgH } = fitImage(qW, qH, areaW, areaH)
    doc.addImage(qDataUrl, 'PNG', MARGIN + (areaW - imgW) / 2, MARGIN + HDR_H, imgW, imgH)
  }

  // Legend on its own page (page 5)
  doc.addPage()
  addLegend(doc, legend, pageW, pageH)

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
