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
  // Time is on Y-axis (vertical) for falling notes.
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
    const notes: SongNote[] = items
      ? (items.filter((i) => i.type === 'note') as SongNote[])
      : ([{ midiNote: 21 }, { midiNote: 108 }] as SongNote[])

    let minNotes = state.zoomMode ?? 0
    if (state.zoomMode === undefined && state.height > state.windowWidth) {
      if (state.height > 800) minNotes = 48
      else if (state.height > 600) minNotes = 36
      else if (state.height > 500) minNotes = 24
      else minNotes = 24
    }

    const { startNote: songStart, endNote: songEnd } = getSongRange({ notes }, minNotes)
    const instrumentRange = midiState.detectedRange
    const range = getKeyboardRange(songStart, songEnd, instrumentRange)
    startNote = range.startNote
    endNote = range.endNote
  }
  const pianoMeasurements = getPianoRollMeasurements(state.windowWidth, { startNote, endNote })
  const pianoTopY = Math.max(0, state.height - pianoMeasurements.whiteHeight - 65)
  const pianoWidth = pianoMeasurements.pianoWidth
  const noteHitY = pianoTopY - 120

  const averageLaneWidth = state.windowWidth / Math.max(endNote - startNote, 1)
  const averageCircleRadius = (averageLaneWidth / 2) - 1
  // Perfect tolerance inside the circle, exactly matching the radius in terms of MS
  // Multiplied by 2.5 to make it more forgiving and easier to get green.
  const perfectRangeMs = (averageCircleRadius / state.pps) * 1000 * 1.5
  // Yellow/blue boundary (e.g. 4 times the circle radius)
  const goodRangeMs = perfectRangeMs * 4
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

  // Shift incoming hardware MIDI notes by k octaves so the user can play the song
  midiState.midiOctaveDiff = k

  // Determine bounds by taking the union of the song's range and the shifted instrument's range
  let displayStart = songStart
  let displayEnd = songEnd

  if (instrumentRange) {
    displayStart = Math.min(songStart, instrumentRange.start + k * 12)
    displayEnd = Math.max(songEnd, instrumentRange.end + k * 12)
  }

  // Snap to the nearest C octaves (multiples of 12)
  let start = Math.floor(displayStart / 12) * 12
  let end = Math.ceil(displayEnd / 12) * 12

  // Ensure minimum of 1 octave (13 keys, e.g. C to C)
  if (end - start < 12) {
    end = start + 12
  }

  // Constrain to valid piano MIDI range (A0 = 21, C8 = 108)
  start = Math.max(21, start)
  end = Math.min(108, end)

  return {
    startNote: start,
    endNote: end
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
  // Items are sorted by ascending time.
  // Earliest items (small time) have the largest Y (below screen),
  // latest items (large time) have the smallest Y (above screen).
  // startPred: start collecting when the top of the note enters the bottom of the screen
  let startPred = (item: CanvasItem) => getItemStartEnd(item, state).end <= state.height
  // endPred: stop collecting when the bottom of the note is completely above the screen
  // In 3D mode with beta=3.0, notes remain visible further up the screen.
  let endPred = (item: CanvasItem) => getItemStartEnd(item, state).start < -state.height * 2.5
  return getItemsInView(state, startPred, endPred)
}

function projectPoint(x: number, y: number, state: State): { x: number; y: number; scale: number } {
  const anchorY = state.pianoTopY
  const d = anchorY - y
  if (d <= 0) {
    return { x, y, scale: 1 }
  }
  const beta = 3.0
  const scale = anchorY / (anchorY + d / beta)
  const centerX = state.windowWidth / 2
  const px = centerX + (x - centerX) * scale
  const py = anchorY - d * scale
  return { x: px, y: py, scale }
}

export function renderFallingVis(givenState: GivenState): void {
  const state: State = deriveState(givenState)
  // Deep charcoal radial gradient fading to pure black
  const cx = state.windowWidth / 2
  const cy = state.height / 2
  const radius = Math.max(state.windowWidth, state.height)

  const bgGrad = state.ctx.createRadialGradient(cx, cy, 0, cx, cy, radius)
  bgGrad.addColorStop(0, '#242424') // Lighter charcoal center
  bgGrad.addColorStop(0.7, '#0a0a0a') // Deep black mid
  bgGrad.addColorStop(1, '#000000') // Pure black edges

  state.ctx.fillStyle = bgGrad
  state.ctx.fillRect(0, 0, state.windowWidth, state.height)

  // Apply subtle matte noise texture overlay
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

  // Pre-calculate active targets for feedback coloring
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

function renderHitLine(state: State) {
  const { ctx, noteHitY, windowWidth } = state
  ctx.save()

  // Linear gradient that only fades out at the outer 5% of the screen
  const grad = ctx.createLinearGradient(0, 0, windowWidth, 0)
  grad.addColorStop(0, 'rgba(255, 220, 180, 0)')
  grad.addColorStop(0.05, 'rgba(255, 220, 180, 0.9)')
  grad.addColorStop(0.95, 'rgba(255, 220, 180, 0.9)')
  grad.addColorStop(1, 'rgba(255, 220, 180, 0)')

  // 1. Draw base semi-transparent white-orange dashed playhead (4.8px thickness)
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
  if (state.player.missedNotes.has(note)) {
    return feedbackColors.red
  }
  if (note.feedbackColor) {
    return feedbackColors[note.feedbackColor] ?? note.feedbackColor
  }
  // Fallback to active press feedback if not saved yet
  const feedback = state.player.pressFeedback.get(note.midiNote)
  if (feedback) {
    return feedbackColors[feedback] ?? feedback
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

function getNoteColor(state: State, note: SongNote, isActiveTarget: boolean): string {
  if (state.player.missedNotes.has(note)) {
    return feedbackColors.red
  }

  const isPressed = midiState.getPressedNotes().has(note.midiNote)
  const feedback = state.player.pressFeedback.get(note.midiNote)

  if (isPressed && feedback && isActiveTarget) {
    // Only apply feedback color if the note is currently near or on the baseline.
    const now = state.time;
    const margin = state.player.goodRange / 1000; // convert ms to seconds
    if (now >= note.time - margin && now <= note.time + note.duration + margin) {
      return feedbackColors[feedback] ?? feedback
    }
  }

  const hand = state.hands[note.track]?.hand ?? 'both'
  const keyType = isBlack(note.midiNote) ? 'black' : 'white'

  let color
  if (hand === 'both' || hand === 'right') {
    color = colors.right[keyType]
  } else {
    color = colors.left[keyType]
  }
  return color
}

function renderRange(state: State) {
  const { ctx, pps } = state
  if (!state.selectedRange) {
    return
  }

  const { start, end } = state.selectedRange
  ctx.save()
  const duration = end - start
  const canvasY = getItemStartEnd({ type: 'note', time: start, duration } as CanvasItem, state).start
  const rectHeight = duration * pps
  const posY = canvasY
  const tailTopY = canvasY - rectHeight

  // Project the 4 corners of the full-width range selection block
  const bottomLeft = projectPoint(0, posY, state)
  const bottomRight = projectPoint(state.windowWidth, posY, state)
  const topRight = projectPoint(state.windowWidth, tailTopY, state)
  const topLeft = projectPoint(0, tailTopY, state)

  ctx.fillStyle = colors.rangeSelectionFill
  ctx.globalAlpha = 0.5

  ctx.beginPath()
  ctx.moveTo(bottomLeft.x, bottomLeft.y)
  ctx.lineTo(bottomRight.x, bottomRight.y)
  ctx.lineTo(topRight.x, topRight.y)
  ctx.lineTo(topLeft.x, topLeft.y)
  ctx.closePath()
  ctx.fill()

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
      // Left boundary of the lane going down
      const pStart = projectPoint(lane.left, yStart, state)
      ctx.moveTo(pStart.x, pStart.y)
      for (let j = 1; j <= segments; j++) {
        const y = yStart + j * yStep
        const p = projectPoint(lane.left, y, state)
        ctx.lineTo(p.x, p.y)
      }

      // Right boundary of the lane going up
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

export function renderFallingNote(note: SongNote, state: State, isActiveTarget: boolean = false): void {
  if (!(note.midiNote in state.pianoMeasurements.lanes)) {
    return
  }

  const { ctx, pps, noteLabels, pianoTopY, pianoMeasurements } = state
  const lane = state.pianoMeasurements.lanes[note.midiNote]
  const keyTop = pianoTopY
  const keyHeight = isBlack(note.midiNote) ? pianoMeasurements.blackHeight : pianoMeasurements.whiteHeight

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

  const actualLength = note.duration * pps
  const circleRadius = Math.min(width / 2, keyHeight / 2)
  const minLengthToDisplayCircle = Math.max(circleRadius * 2, 18)
  const length = Math.max(actualLength, minLengthToDisplayCircle)

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
    const colors: Record<string, string> = {
      purple: '176, 142, 255',
      orange: '243, 156, 18',
      green: '46, 204, 113',
      blue: '52, 152, 219',
      red: '231, 76, 60',
      yellow: '241, 196, 15',
      grey: '149, 165, 166',
    }
    const rgb = colors[hexOrName.toLowerCase()]
    if (rgb) {
      return `rgba(${rgb}, ${alpha})`
    }
    return hexOrName
  }

  ctx.save()

  const circleCenterX = posX + width / 2
  const circleCenterY = posY - circleRadius

  const isPerfectCircle = actualLength <= minLengthToDisplayCircle
  const tailTopY = isPerfectCircle ? (circleCenterY - circleRadius) : (posY - length)

  let overflowPixels = 0
  if (note.userPressStart !== undefined && feedbackColor !== undefined) {
    const pressEnd = note.userPressEnd ?? state.time
    if (!isNaN(note.userPressStart) && !isNaN(pressEnd)) {
      overflowPixels = Math.max(0, (pressEnd - (note.time + note.duration)) * state.pps)
    }
  }
  const drawnTopY = tailTopY - overflowPixels
  const r = isPerfectCircle ? circleRadius : (circleRadius * 0.4)

  const localPoints: { x: number; y: number }[] = []

  // Segment long sides into smaller intervals so 3D perspective curves non-linearly without bowing
  const topCornerY = drawnTopY + r
  const sideSegments = Math.max(1, Math.ceil(Math.abs(circleCenterY - topCornerY) / 25))

  // 1. Bottom half-circle (going from right angle 0 to left angle PI)
  const numCirclePoints = 16
  for (let j = 0; j <= numCirclePoints; j++) {
    const angle = (j / numCirclePoints) * Math.PI
    const x = circleCenterX + circleRadius * Math.cos(angle)
    const y = circleCenterY + circleRadius * Math.sin(angle)
    localPoints.push({ x, y })
  }

  // 1b. Left vertical side (going UP from circleCenterY to topCornerY)
  for (let s = 1; s < sideSegments; s++) {
    const t = s / sideSegments
    const x = circleCenterX - circleRadius
    const y = circleCenterY + t * (topCornerY - circleCenterY)
    localPoints.push({ x, y })
  }

  // 2. Left-top rounded corner (from angle PI to 1.5 * PI)
  const numCornerPoints = 6
  for (let j = 0; j <= numCornerPoints; j++) {
    const angle = Math.PI + (j / numCornerPoints) * (Math.PI / 2)
    const x = (circleCenterX - circleRadius + r) + r * Math.cos(angle)
    const y = topCornerY + r * Math.sin(angle)
    localPoints.push({ x, y })
  }

  // 3. Right-top rounded corner (from angle 1.5 * PI to 2 * PI)
  for (let j = 0; j <= numCornerPoints; j++) {
    const angle = 1.5 * Math.PI + (j / numCornerPoints) * (Math.PI / 2)
    const x = (circleCenterX + circleRadius - r) + r * Math.cos(angle)
    const y = topCornerY + r * Math.sin(angle)
    localPoints.push({ x, y })
  }

  // 3b. Right vertical side (going DOWN from topCornerY to circleCenterY)
  for (let s = 1; s < sideSegments; s++) {
    const t = s / sideSegments
    const x = circleCenterX + circleRadius
    const y = topCornerY + t * (circleCenterY - topCornerY)
    localPoints.push({ x, y })
  }

  const projectedPoints = localPoints.map(pt => projectPoint(pt.x, pt.y, state))

  ctx.beginPath()
  ctx.moveTo(projectedPoints[0].x, projectedPoints[0].y)
  for (let j = 1; j < projectedPoints.length; j++) {
    ctx.lineTo(projectedPoints[j].x, projectedPoints[j].y)
  }
  ctx.closePath()

  const bottomPt = projectPoint(circleCenterX, posY, state)
  const topPt = projectPoint(circleCenterX, drawnTopY, state)

  let startRatio = 0
  let endRatio = 0
  if (note.userPressStart !== undefined && feedbackColor !== undefined) {
    const pressEnd = note.userPressEnd ?? state.time
    if (note.duration > 0 && !isNaN(note.userPressStart) && !isNaN(pressEnd)) {
      const origStartRatio = Math.min(1, Math.max(0, (note.userPressStart - note.time) / note.duration))
      const origEndRatio = Math.min(1, Math.max(0, (pressEnd - note.time) / note.duration))
      const extendedLength = length + overflowPixels
      startRatio = (origStartRatio * length) / extendedLength
      endRatio = overflowPixels > 0 ? 1.0 : (origEndRatio * length) / extendedLength
    } else {
      startRatio = 0
      endRatio = 1
    }
  }

  let grad: CanvasGradient | string = defaultColor
  try {
    const g = ctx.createLinearGradient(circleCenterX, bottomPt.y, circleCenterX, topPt.y)
    if (startRatio < endRatio && feedbackColor) {
      // Bottom segment of the note (before it was pressed) remains default color
      if (startRatio > 0) {
        g.addColorStop(0, getRgbaColor(defaultColor, 1.0))
        g.addColorStop(startRatio, getRgbaColor(defaultColor, 0.9))
      }
      
      // Pressed segment is colored with the feedback color
      const startColorStop = startRatio > 0 ? startRatio : 0
      g.addColorStop(startColorStop, getRgbaColor(feedbackColor, 1.0))
      g.addColorStop(endRatio, getRgbaColor(feedbackColor, 0.9))
      
      // Top segment of the note (after it was released) remains default color
      if (endRatio < 1) {
        g.addColorStop(endRatio, getRgbaColor(defaultColor, 0.9))
        g.addColorStop(1, getRgbaColor(defaultColor, 0.8))
      }
    } else {
      if (feedbackColor === feedbackColors.red && feedbackColor) {
        g.addColorStop(0, getRgbaColor(feedbackColor, 1.0))
        g.addColorStop(1, getRgbaColor(feedbackColor, 0.8))
      } else {
        g.addColorStop(0, getRgbaColor(defaultColor, 1.0))
        g.addColorStop(1, getRgbaColor(defaultColor, 0.8))
      }
    }
    grad = g
  } catch (e) {
    console.warn('Failed to create linear gradient for note rendering, falling back to solid color:', e)
    grad = defaultColor
  }

  ctx.fillStyle = grad
  ctx.fill()

  const center = projectPoint(circleCenterX, circleCenterY, state)
  const radiusScaled = circleRadius * center.scale

  const perfectRangeMs = (Math.min(40 / 2, 250 / 2) / state.pps) * 1000 * 1.5
  const perfectRangeSec = perfectRangeMs / 1000
  const isFingeringActive = state.time >= (note.time - perfectRangeSec) && state.time <= (note.time + note.duration)

  const key = getKey(note.midiNote, state.keySignature)
  const labelType = noteLabels === 'none' ? 'alphabetical' : noteLabels
  const noteText = labelType === 'alphabetical' ? key : getFixedDoNoteFromKey(key)

  if (noteLabels !== 'none') {
    ctx.fillStyle = 'white'
    ctx.textBaseline = 'middle'
    ctx.textAlign = 'center'
    const padding = 2
    const maxWidth = (circleRadius * 2 - padding * 2) * center.scale
    let { fontPx } = getOptimalFontSize(
      ctx,
      noteText,
      TEXT_FONT,
      maxWidth,
    )
    fontPx = Math.min(fontPx, maxWidth * 0.8)

    if (noteText.includes('#')) {
      const letter = noteText.replace('#', '')
      const letterSize = fontPx * 1.1
      const sharpSize = fontPx * 0.7

      ctx.font = `bold ${letterSize}px ui-sans-serif, system-ui, sans-serif`
      const letterW = ctx.measureText(letter).width

      ctx.font = `bold ${sharpSize}px ui-sans-serif, system-ui, sans-serif`
      const sharpW = ctx.measureText('#').width

      const totalW = letterW + sharpW
      const startX = center.x - totalW / 2

      ctx.font = `bold ${letterSize}px ui-sans-serif, system-ui, sans-serif`
      ctx.fillText(letter, startX + letterW / 2, center.y + letterSize * 0.05)

      ctx.font = `bold ${sharpSize}px ui-sans-serif, system-ui, sans-serif`
      ctx.fillText('#', startX + letterW + sharpW / 2, center.y - letterSize * 0.12)
    } else {
      ctx.font = `bold ${fontPx}px ui-sans-serif, system-ui, sans-serif`
      ctx.fillText(noteText, center.x, center.y + fontPx * 0.05)
    }
  }
  ctx.restore()
}

function renderMeasure(measure: SongMeasure, state: State): void {
  const { ctx } = state
  ctx.save()
  const posY = getItemStartEnd(measure, state).start

  // Project the text anchor position (left side of screen)
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
  // Times are already in seconds from MIDI parser (tone.js), pps is pixels/second
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
