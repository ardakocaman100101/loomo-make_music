import { line, roundRect } from '@/features/drawing'
import {
  drawPianoRoll,
  getPianoRollMeasurements,
  handlePianoRollMousePress,
  PianoRollMeasurements,
} from '@/features/drawing/piano'
import { getFixedDoNoteFromKey, getKey, isBlack } from '@/features/theory'
import { palette } from '@/styles/common'
import type { SongMeasure, SongNote } from '@/types'
import { clamp } from '@/utils'
import midiState from '../midi'
import { getRelativePointerCoordinates } from '../pointer'
import { GivenState } from './canvas-renderer'
import {
  CanvasItem,
  getFontSize,
  getItemsInView,
  getOptimalFontSize,
  getSongRange,
  isMatchingHand,
  Viewport,
} from './utils'

const TEXT_FONT = 'monospace'

// Memoized subtle noise pattern to prevent banding and add premium matte texture
let noisePattern: CanvasPattern | null = null
function getNoisePattern(ctx: CanvasRenderingContext2D): CanvasPattern | null {
  if (noisePattern) return noisePattern

  const canvas = document.createElement('canvas')
  canvas.width = 128
  canvas.height = 128
  const offCtx = canvas.getContext('2d')
  if (!offCtx) return null

  const imageData = offCtx.createImageData(128, 128)
  const data = imageData.data
  for (let i = 0; i < data.length; i += 4) {
    const v = Math.random() > 0.5 ? 255 : 0
    data[i] = v
    data[i + 1] = v
    data[i + 2] = v
    data[i + 3] = Math.floor(Math.random() * 6) // Max ~2.3% opacity
  }
  offCtx.putImageData(imageData, 0, 0)
  noisePattern = ctx.createPattern(canvas, 'repeat')
  return noisePattern
}

const colors = {
  right: {
    black: palette.purple.dark,
    white: palette.purple.primary,
  },
  left: {
    black: palette.orange.dark,
    white: palette.orange.primary,
  },
  measure: 'rgb(60,60,60)',
  octaveLine: 'rgb(90,90,90)',
  rangeSelectionFill: '#44b22e',
}

const feedbackColors: Record<string, string> = {
  green: '#2ecc71',
  yellow: '#f1c40f',
  grey: '#95a5a6',
  red: '#e74c3c',
  purple: '#b08eff',
}

function getActiveNotes(state: State): Map<number, string> {
  const activeNotes = new Map<number, string>(state.player.pressFeedback)
  for (let midiNote of midiState.getPressedNotes().keys()) {
    if (!activeNotes.has(midiNote)) {
      activeNotes.set(midiNote, 'purple')
    }
  }

  return activeNotes
}

function isPlayingNote(state: State, note: SongNote) {
  const baselineY = state.noteHitY
  const itemPos = getItemStartEnd(note, state)
  return itemPos.end <= baselineY && itemPos.start > baselineY
}

function getViewport(state: Readonly<GivenState>): Viewport {
  return {
    start: state.time * state.pps,
    end: state.time * state.pps + state.height,
  }
}

type State = GivenState & {
  viewport: Viewport
  pianoMeasurements: PianoRollMeasurements
  pianoTopY: number
  pianoWidth: number
  noteHitY: number
}

function deriveState(state: GivenState): State {
  let items = state.constrictView ? state.items : undefined
  let startNote: number
  let endNote: number

  if (state.visualization === 'reverse-waterfall') {
    const range = midiState.detectedRange
    if (range) {
      startNote = range.start
      endNote = range.end
      midiState.midiOctaveDiff = 0
    } else {
      startNote = 21
      endNote = 108
      midiState.midiOctaveDiff = 0
    }
  } else {
    const matchingNotes: SongNote[] = items
      ? (items.filter((i) => i.type === 'note' && isMatchingHand(i, state)) as SongNote[])
      : []

    const notesForRange =
      matchingNotes.length > 0
        ? matchingNotes
        : items
          ? (items.filter((i) => i.type === 'note') as SongNote[])
          : ([{ midiNote: 21 }, { midiNote: 108 }] as SongNote[])

    const activePracticeTracks = Object.values(state.hands || {}).filter((t) => t.practice)
    const isSingleTrackSelected =
      activePracticeTracks.length === 1 ||
      (state.hands && Object.keys(state.hands).length === 1)

    let minNotes = state.zoomMode ?? 0
    if (state.zoomMode === undefined) {
      if (isSingleTrackSelected) {
        minNotes = 12
      } else if (state.height > state.windowWidth) {
        if (state.height > 800) minNotes = 48
        else if (state.height > 600) minNotes = 36
        else minNotes = 24
      } else {
        minNotes = Math.min(36, Math.max(16, Math.floor(state.windowWidth / 28)))
      }
    }

    const { startNote: songStart, endNote: songEnd } = getSongRange(
      { notes: notesForRange },
      minNotes,
    )
    const instrumentRange = midiState.detectedRange
    const range = getKeyboardRange(songStart, songEnd, instrumentRange)
    startNote = range.startNote
    endNote = range.endNote
  }
  const pianoMeasurements = getPianoRollMeasurements(state.windowWidth, { startNote, endNote })
  const pianoTopY = Math.max(0, state.height - pianoMeasurements.whiteHeight - 65)
  const pianoWidth = pianoMeasurements.pianoWidth
  const noteHitY = pianoTopY - 120

  const song = state.player.getSong()
  const currentBpm = song?.bpms?.[state.player.store.get(state.player.currentBpmIndex)]?.bpm || 120
  const bpmModifier = state.player.store.get(state.player.bpmModifier) || 1
  const effectiveBpm = currentBpm * bpmModifier
  const beatDurationMs = (60 / Math.max(20, effectiveBpm)) * 1000

  //Adaptive Feedback (20% of 1 beat for Perfect, 50% of 1 beat for Good)
  const perfectRangeMs = Math.min(80, Math.max(35, beatDurationMs * 0.20))
  const goodRangeMs = Math.min(350, Math.max(120, beatDurationMs * 0.50))
  state.player.setTolerance(perfectRangeMs, goodRangeMs)

  lastState = {
    ...state,
    pianoMeasurements,
    viewport: getViewport(state),
    pianoTopY,
    pianoWidth,
    noteHitY,
  }
  return lastState
}

export function getKeyboardRange(
  songStart: number,
  songEnd: number,
  instrumentRange: { start: number; end: number } | null,
) {
  let k = 0
  if (instrumentRange) {
    const instStart = instrumentRange.start
    const instEnd = instrumentRange.end

    if (songStart < instStart || songEnd > instEnd) {
      const shiftDown = Math.ceil((instStart - songStart) / 12)
      const shiftUp = Math.ceil((songEnd - instEnd) / 12)

      if (shiftDown > 0 && shiftUp <= 0) {
        k = -shiftDown
      } else if (shiftUp > 0 && shiftDown <= 0) {
        k = shiftUp
      } else {
        const songCenter = (songStart + songEnd) / 2
        const instrumentCenter = (instStart + instEnd) / 2
        k = Math.round((songCenter - instrumentCenter) / 12)
      }
    }
  }

  midiState.midiOctaveDiff = k

  let displayStart = songStart
  let displayEnd = songEnd

  if (instrumentRange) {
    displayStart = Math.min(songStart, instrumentRange.start + k * 12)
    displayEnd = Math.max(songEnd, instrumentRange.end + k * 12)
  }

  let start = Math.floor(displayStart / 12) * 12
  let end = Math.ceil(displayEnd / 12) * 12

  if (end - start < 12) {
    end = start + 12
  }

  start = Math.max(21, start)
  end = Math.min(108, end)

  return {
    startNote: start,
    endNote: end,
  }
}

function getFallingNoteItemsInView<T>(state: State): CanvasItem[] {
  if (state.visualization === 'reverse-waterfall') {
    return state.items.filter((item) => {
      if (item.type !== 'note') return false
      const isStarted = item.time <= state.time
      const isVisible = getItemStartEnd(item, state).end >= -state.height
      return isStarted && isVisible
    })
  }
  let startPred = (item: CanvasItem) => getItemStartEnd(item, state).end <= state.height
  let endPred = (item: CanvasItem) => getItemStartEnd(item, state).start < -state.height * 2.5
  return getItemsInView(state, startPred, endPred)
}

function projectPoint(x: number, y: number, state: State): { x: number; y: number; scale: number } {
  const anchorY = state.pianoTopY
  const d = anchorY - y
  if (d <= 0) {
    return { x, y, scale: 1 }
  }
  const beta = 1.6
  const rawScale = anchorY / (anchorY + d / beta)
  const scale = Math.max(0.25, rawScale)
  const centerX = state.windowWidth / 2
  const px = centerX + (x - centerX) * scale
  const py = anchorY - d * scale
  return { x: px, y: py, scale }
}

export function renderFallingVis(givenState: GivenState): void {
  const state: State = deriveState(givenState)
  const cx = state.windowWidth / 2
  const cy = state.height / 2
  const radius = Math.max(state.windowWidth, state.height)

  const bgGrad = state.ctx.createRadialGradient(cx, cy, 0, cx, cy, radius)
  bgGrad.addColorStop(0, '#242424')
  bgGrad.addColorStop(0.7, '#0a0a0a')
  bgGrad.addColorStop(1, '#000000')

  state.ctx.fillStyle = bgGrad
  state.ctx.fillRect(0, 0, state.windowWidth, state.height)

  const pattern = getNoisePattern(state.ctx)
  if (pattern) {
    state.ctx.fillStyle = pattern
    state.ctx.fillRect(0, 0, state.windowWidth, state.height)
  }

  const items = getFallingNoteItemsInView(state)

  renderLanes(state)
  renderHitLine(state)

  for (let i of items) {
    if (i.type === 'measure') {
      renderMeasure(i, state)
    }
  }

  const activeTargets = new Set<SongNote>()
  const now = state.time
  const margin = state.player.goodRange / 1000
  const seenPitches = new Set<number>()

  for (let i of items) {
    if (i.type === 'note') {
      if (!seenPitches.has(i.midiNote)) {
        if (now <= i.time + i.duration + margin) {
          activeTargets.add(i)
          seenPitches.add(i.midiNote)
        }
      }
    }
  }

  for (let i of items) {
    if (i.type === 'note') {
      renderFallingNote(i, state, activeTargets.has(i))
    }
  }

  if (state.selectedRange) {
    renderRange(state)
  }

  renderHorizonFade(state)

  const activeFingerings = new Map<number, number>()
  const perfectRangeMs = (Math.min(40 / 2, 250 / 2) / state.pps) * 1000 * 1.5
  const perfectRangeSec = perfectRangeMs / 1000

  for (const item of items) {
    if (item.type === 'note' && item.finger !== undefined) {
      const noteItem = item as SongNote
      const startSec = noteItem.time - perfectRangeSec
      const endSec = noteItem.time + noteItem.duration
      if (state.time >= startSec && state.time <= endSec) {
        activeFingerings.set(noteItem.midiNote, noteItem.finger!)
      }
    }
  }

  handlePianoRollMousePress(
    state.pianoMeasurements,
    state.pianoTopY,
    getRelativePointerCoordinates(state.canvasRect.left, state.canvasRect.top),
  )
  drawPianoRoll(
    state.ctx,
    state.pianoMeasurements,
    state.pianoTopY,
    getActiveNotes(state),
    activeFingerings,
  )
}

function renderHorizonFade(state: State) {
  const { ctx, windowWidth, pianoTopY } = state
  ctx.save()

  // Tighter horizon fade: reduced by 20% vertical height to maximize visible play area
  const fadeHeight = Math.max(96, pianoTopY * 0.36)
  const grad = ctx.createLinearGradient(0, 0, 0, fadeHeight)
  grad.addColorStop(0, '#000000')
  grad.addColorStop(0.35, 'rgba(10, 10, 14, 0.92)')
  grad.addColorStop(0.7, 'rgba(10, 10, 14, 0.45)')
  grad.addColorStop(1.0, 'rgba(10, 10, 14, 0)')

  ctx.fillStyle = grad
  ctx.fillRect(0, 0, windowWidth, fadeHeight)
  ctx.restore()
}

function renderHitLine(state: State) {
  const { ctx, noteHitY, windowWidth } = state
  ctx.save()

  const grad = ctx.createLinearGradient(0, 0, windowWidth, 0)
  grad.addColorStop(0, 'rgba(255, 220, 180, 0)')
  grad.addColorStop(0.05, 'rgba(255, 220, 180, 0.9)')
  grad.addColorStop(0.95, 'rgba(255, 220, 180, 0.9)')
  grad.addColorStop(1, 'rgba(255, 220, 180, 0)')

  ctx.beginPath()
  ctx.setLineDash([12, 4])
  ctx.strokeStyle = grad
  ctx.lineWidth = 4.8
  const projectedY = projectPoint(0, noteHitY, state).y
  ctx.moveTo(0, projectedY)
  ctx.lineTo(windowWidth, projectedY)
  ctx.stroke()

  ctx.restore()
}

function getNoteFeedbackColor(state: State, note: SongNote): string | undefined {
  if (note.feedbackColor) {
    return feedbackColors[note.feedbackColor] ?? note.feedbackColor
  }
  if (state.player.hitNotes.has(note)) {
    return feedbackColors.green
  }
  if (state.player.missedNotes.has(note)) {
    return feedbackColors.red
  }
  return undefined
}

function getNoteDefaultColor(state: State, note: SongNote): string {
  const hand = state.hands[note.track]?.hand ?? 'both'
  const keyType = isBlack(note.midiNote) ? 'black' : 'white'

  if (hand === 'both' || hand === 'right') {
    return colors.right[keyType]
  } else {
    return colors.left[keyType]
  }
}

function renderRange(state: State) {
  const { ctx, pps } = state
  if (!state.selectedRange) {
    return
  }

  const { start, end } = state.selectedRange
  ctx.save()
  const duration = Math.max(0, end - start)
  const rectHeight = duration * pps

  // Constant anchor at the piano strike line throughout practice mode
  const isReverse = state.visualization === 'reverse-waterfall'
  const posY = state.noteHitY
  const tailTopY = isReverse ? state.noteHitY + rectHeight : state.noteHitY - rectHeight

  const bottomLeft = projectPoint(0, posY, state)
  const bottomRight = projectPoint(state.windowWidth, posY, state)
  const topRight = projectPoint(state.windowWidth, tailTopY, state)
  const topLeft = projectPoint(0, tailTopY, state)

  // Translucent background fill for the practice range (constant throughout practice)
  ctx.fillStyle = colors.rangeSelectionFill
  ctx.globalAlpha = 0.22

  ctx.beginPath()
  ctx.moveTo(bottomLeft.x, bottomLeft.y)
  ctx.lineTo(bottomRight.x, bottomRight.y)
  ctx.lineTo(topRight.x, topRight.y)
  ctx.lineTo(topLeft.x, topLeft.y)
  ctx.closePath()
  ctx.fill()

  // Render dashed boundary lines for the fixed practice region
  ctx.globalAlpha = 0.95
  ctx.strokeStyle = '#818cf8'
  ctx.lineWidth = 2.5
  ctx.setLineDash([8, 6])

  // Strike line boundary across canvas
  ctx.beginPath()
  ctx.moveTo(bottomLeft.x, bottomLeft.y)
  ctx.lineTo(bottomRight.x, bottomRight.y)
  ctx.stroke()

  // Top practice boundary line across canvas
  ctx.beginPath()
  ctx.moveTo(topLeft.x, topLeft.y)
  ctx.lineTo(topRight.x, topRight.y)
  ctx.stroke()

  // Vertical side boundary lines extending up the visualizer
  ctx.beginPath()
  ctx.moveTo(bottomLeft.x, bottomLeft.y)
  ctx.lineTo(topLeft.x, topLeft.y)
  ctx.stroke()

  ctx.beginPath()
  ctx.moveTo(bottomRight.x, bottomRight.y)
  ctx.lineTo(topRight.x, topRight.y)
  ctx.stroke()

  ctx.restore()
}

function renderLanes(state: State) {
  const { ctx } = state
  ctx.save()

  const segments = 16
  const yStart = -state.height * 2.5
  const yEnd = state.pianoTopY
  const yStep = (yEnd - yStart) / segments

  for (let [midiNote, lane] of Object.entries(state.pianoMeasurements.lanes)) {
    const midiNum = +midiNote
    if (isBlack(midiNum)) {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.03)'

      ctx.beginPath()
      const pStart = projectPoint(lane.left, yStart, state)
      ctx.moveTo(pStart.x, pStart.y)
      for (let j = 1; j <= segments; j++) {
        const y = yStart + j * yStep
        const p = projectPoint(lane.left, y, state)
        ctx.lineTo(p.x, p.y)
      }

      for (let j = segments; j >= 0; j--) {
        const y = yStart + j * yStep
        const p = projectPoint(lane.left + lane.width, y, state)
        ctx.lineTo(p.x, p.y)
      }

      ctx.closePath()
      ctx.fill()
    }
  }
  ctx.restore()
}

export function renderFallingNote(
  note: SongNote,
  state: State,
  isActiveTarget: boolean = false,
): void {
  if (!(note.midiNote in state.pianoMeasurements.lanes)) {
    return
  }

  const { ctx, pps, noteLabels, pianoTopY, pianoMeasurements } = state
  const lane = state.pianoMeasurements.lanes[note.midiNote]
  const keyHeight = isBlack(note.midiNote)
    ? pianoMeasurements.blackHeight
    : pianoMeasurements.whiteHeight

  let posX = lane.left
  let noteWidth = lane.width

  if (isBlack(note.midiNote)) {
    const originalWidth = lane.width
    noteWidth = originalWidth * 0.8
    posX = lane.left + (originalWidth - noteWidth) / 2
  } else {
    const leftBlack = state.pianoMeasurements.lanes[note.midiNote - 1]
    const rightBlack = state.pianoMeasurements.lanes[note.midiNote + 1]

    if (leftBlack && isBlack(note.midiNote - 1)) {
      posX = leftBlack.left + leftBlack.width
    }

    let rightEdge = lane.left + lane.width
    if (rightBlack && isBlack(note.midiNote + 1)) {
      rightEdge = rightBlack.left
    }

    noteWidth = rightEdge - posX
  }

  posX = Math.floor(posX + 1)
  const width = Math.max(noteWidth - 2, 8)
  const posY = getItemStartEnd(note, state).start
  const endY = getItemStartEnd(note, state).end

  const circleRadius = Math.min(width / 2, keyHeight / 2)
  const defaultColor = getNoteDefaultColor(state, note)
  const feedbackColor = getNoteFeedbackColor(state, note)

  const getRgbaColor = (hexOrName: string, alpha: number): string => {
    if (hexOrName.startsWith('#')) {
      const hex = hexOrName.replace('#', '')
      const r = parseInt(hex.substring(0, 2), 16)
      const g = parseInt(hex.substring(2, 4), 16)
      const b = parseInt(hex.substring(4, 6), 16)
      return `rgba(${r}, ${g}, ${b}, ${alpha})`
    }
    if (hexOrName.startsWith('rgba')) {
      return hexOrName.replace(/[\d\.]+\)$/, `${alpha})`)
    }
    if (hexOrName.startsWith('rgb')) {
      return hexOrName.replace('rgb', 'rgba').replace(')', `, ${alpha})`)
    }
    const colorsMap: Record<string, string> = {
      purple: '176, 142, 255',
      orange: '243, 156, 18',
      green: '46, 204, 113',
      blue: '52, 152, 219',
      red: '231, 76, 60',
      yellow: '241, 196, 15',
      grey: '149, 165, 166',
    }
    const rgb = colorsMap[hexOrName.toLowerCase()]
    if (rgb) {
      return `rgba(${rgb}, ${alpha})`
    }
    return hexOrName
  }

  ctx.save()

  const circleCenterX = posX + width / 2
  const circleCenterY = posY - circleRadius

  const drawnTopY = endY
  const r = circleRadius * 0.4

  // Build rounded trapezoid perimeter path strictly aligned to lane geometry in projected space
  const localPoints: { x: number; y: number }[] = []
  const topCornerY = drawnTopY + r
  const sideSegments = Math.max(1, Math.ceil(Math.abs(circleCenterY - topCornerY) / 25))

  const numCirclePoints = 16
  for (let j = 0; j <= numCirclePoints; j++) {
    const angle = (j / numCirclePoints) * Math.PI
    const x = circleCenterX + circleRadius * Math.cos(angle)
    const y = circleCenterY + circleRadius * Math.sin(angle)
    localPoints.push({ x, y })
  }

  for (let s = 1; s < sideSegments; s++) {
    const t = s / sideSegments
    const x = circleCenterX - circleRadius
    const y = circleCenterY + t * (topCornerY - circleCenterY)
    localPoints.push({ x, y })
  }

  const numCornerPoints = 6
  for (let j = 0; j <= numCornerPoints; j++) {
    const angle = Math.PI + (j / numCornerPoints) * (Math.PI / 2)
    const x = circleCenterX - circleRadius + r + r * Math.cos(angle)
    const y = topCornerY + r * Math.sin(angle)
    localPoints.push({ x, y })
  }

  for (let j = 0; j <= numCornerPoints; j++) {
    const angle = 1.5 * Math.PI + (j / numCornerPoints) * (Math.PI / 2)
    const x = circleCenterX + circleRadius - r + r * Math.cos(angle)
    const y = topCornerY + r * Math.sin(angle)
    localPoints.push({ x, y })
  }

  for (let s = 1; s < sideSegments; s++) {
    const t = s / sideSegments
    const x = circleCenterX + circleRadius
    const y = topCornerY + t * (circleCenterY - topCornerY)
    localPoints.push({ x, y })
  }

  const projectedPoints = localPoints.map((pt) => projectPoint(pt.x, pt.y, state))
  const pBottomCenter = projectPoint(circleCenterX, posY, state)
  const pTopCenter = projectPoint(circleCenterX, drawnTopY, state)
  const pCenter = projectPoint(circleCenterX, circleCenterY, state)
  const pBottomLeft = projectPoint(circleCenterX - circleRadius, circleCenterY, state)
  const pBottomRight = projectPoint(circleCenterX + circleRadius, circleCenterY, state)

  // --- 1. Tactile 3D Extrusion Layer (Matching Rounded Perimeter) ---
  const depthZ = Math.max(2.5, 5.0 * pBottomCenter.scale)
  const shadowColor = getRgbaColor(defaultColor, 0.35)

  const numBottomPts = numCirclePoints + 1
  ctx.beginPath()
  ctx.moveTo(projectedPoints[0].x, projectedPoints[0].y)
  for (let j = 1; j < numBottomPts; j++) {
    ctx.lineTo(projectedPoints[j].x, projectedPoints[j].y)
  }
  for (let j = numBottomPts - 1; j >= 0; j--) {
    ctx.lineTo(projectedPoints[j].x, projectedPoints[j].y + depthZ)
  }
  ctx.closePath()

  ctx.fillStyle = shadowColor
  ctx.fill()

  // --- 2. Vibrant Front Tile Face ---
  ctx.beginPath()
  ctx.moveTo(projectedPoints[0].x, projectedPoints[0].y)
  for (let j = 1; j < projectedPoints.length; j++) {
    ctx.lineTo(projectedPoints[j].x, projectedPoints[j].y)
  }
  ctx.closePath()

  let activeFeedbackColor = getNoteFeedbackColor(state, note)
  const isPressed = midiState.getPressedNotes().has(note.midiNote)

  let startRatio = 0
  let endRatio = 0
  let isFilled = false

  if (activeFeedbackColor) {
    const dur = note.duration > 0 ? note.duration : 0.001

    if (note.userPressStart !== undefined) {
      // User pressed this note: fill progressively from userPressStart for as long as key is held
      const pressStartSec = note.userPressStart
      const pressEndSec = note.userPressEnd ?? (isPressed ? state.time : note.time + note.duration)
      startRatio = Math.min(1, Math.max(0, (pressStartSec - note.time) / dur))
      endRatio = Math.min(1, Math.max(0.05, (pressEndSec - note.time) / dur))
      isFilled = true
    } else if (state.player.hitNotes.has(note) || note.feedbackColor) {
      // Struck hit note: filled with note's feedback color
      startRatio = 0
      endRatio = 1
      isFilled = true
    } else if (state.player.missedNotes.has(note)) {
      // Missed note: full red tile
      startRatio = 0
      endRatio = 1
      isFilled = true
    } else if (isPressed && state.time >= note.time - 0.05) {
      // Live key press active: fills progressively from bottom edge upward while pressed
      startRatio = 0
      endRatio = Math.min(1, Math.max(0.05, (state.time - note.time) / dur))
      isFilled = true
    }
  }

  let grad: CanvasGradient | string = defaultColor
  try {
    const g = ctx.createLinearGradient(circleCenterX, pBottomCenter.y, circleCenterX, pTopCenter.y)
    if (isFilled && activeFeedbackColor && endRatio > startRatio) {
      if (startRatio > 0.01) {
        g.addColorStop(0, getRgbaColor(defaultColor, 1.0))
        g.addColorStop(startRatio, getRgbaColor(defaultColor, 0.9))
      }
      const startColorStop = startRatio > 0.01 ? startRatio : 0
      g.addColorStop(startColorStop, getRgbaColor(activeFeedbackColor, 1.0))
      g.addColorStop(endRatio, getRgbaColor(activeFeedbackColor, 0.9))

      if (endRatio < 0.99) {
        g.addColorStop(endRatio, getRgbaColor(defaultColor, 0.9))
        g.addColorStop(1.0, getRgbaColor(defaultColor, 0.8))
      }
    } else {
      g.addColorStop(0, getRgbaColor(defaultColor, 1.0))
      g.addColorStop(1, getRgbaColor(defaultColor, 0.8))
    }
    grad = g
  } catch (e) {
    console.warn('Failed to create linear gradient for note rendering:', e)
    grad = defaultColor
  }

  ctx.fillStyle = grad
  ctx.fill()

  ctx.strokeStyle = 'rgba(255, 255, 255, 0.45)'
  ctx.lineWidth = Math.max(1, 1.4 * pBottomCenter.scale)
  ctx.stroke()

  // --- 3. Note Label ---
  const key = getKey(note.midiNote, state.keySignature)
  const labelType = noteLabels === 'none' ? 'alphabetical' : noteLabels
  const noteText = labelType === 'alphabetical' ? key : getFixedDoNoteFromKey(key)

  if (noteLabels !== 'none') {
    const tileWidth = Math.abs(pBottomRight.x - pBottomLeft.x)
    const tileHeight = Math.abs(pBottomCenter.y - pTopCenter.y)

    ctx.fillStyle = 'white'
    ctx.textBaseline = 'middle'
    ctx.textAlign = 'center'

    const maxAllowedWidth = tileWidth * 0.75
    const maxAllowedHeight = Math.max(12, tileHeight * 0.65)

    let { fontPx } = getOptimalFontSize(ctx, noteText, TEXT_FONT, maxAllowedWidth)
    fontPx = Math.min(fontPx, maxAllowedWidth, maxAllowedHeight)

    if (noteText.includes('#')) {
      const letter = noteText.replace('#', '')
      const letterSize = fontPx * 1.0
      const sharpSize = fontPx * 0.65

      ctx.font = `bold ${letterSize}px ui-sans-serif, system-ui, sans-serif`
      const letterW = ctx.measureText(letter).width

      ctx.font = `bold ${sharpSize}px ui-sans-serif, system-ui, sans-serif`
      const sharpW = ctx.measureText('#').width

      const totalW = letterW + sharpW
      const startX = pCenter.x - totalW / 2

      ctx.font = `bold ${letterSize}px ui-sans-serif, system-ui, sans-serif`
      ctx.fillText(letter, startX + letterW / 2, pCenter.y + letterSize * 0.05)

      ctx.font = `bold ${sharpSize}px ui-sans-serif, system-ui, sans-serif`
      ctx.fillText('#', startX + letterW + sharpW / 2, pCenter.y - letterSize * 0.12)
    } else {
      ctx.font = `bold ${fontPx}px ui-sans-serif, system-ui, sans-serif`
      ctx.fillText(noteText, pCenter.x, pCenter.y + fontPx * 0.05)
    }
  }
  ctx.restore()
}

function renderMeasure(measure: SongMeasure, state: State): void {
  const { ctx } = state
  ctx.save()
  const posY = getItemStartEnd(measure, state).start

  const pt = projectPoint(8, posY, state)

  ctx.strokeStyle = 'rgba(130,130,130, 0.4)'
  ctx.fillStyle = 'rgba(130,130,130, 0.4)'
  ctx.font = `${Math.max(8, 14 * pt.scale)}px ${TEXT_FONT}`
  ctx.fillText(measure.number.toString(), pt.x, pt.y + 16 * pt.scale)
  ctx.restore()
}

function getItemStartEnd(item: CanvasItem, state: State): { start: number; end: number } {
  if (state.visualization === 'reverse-waterfall') {
    const topY = state.noteHitY - (state.time - item.time) * state.pps
    const bottomY = state.noteHitY - (state.time - (item.time + item.duration)) * state.pps
    return { start: bottomY, end: topY }
  }
  const noteScreenY = state.noteHitY - (item.time - state.time) * state.pps
  const endY = noteScreenY - item.duration * state.pps
  return { start: noteScreenY, end: endY }
}

let lastState: State | null = null
export function intersectsWithPiano(point: { x: number; y: number }, canvasRect: DOMRect): boolean {
  if (!lastState) return false
  const relativeY = point.y - canvasRect.top
  return relativeY >= lastState.pianoTopY
}
