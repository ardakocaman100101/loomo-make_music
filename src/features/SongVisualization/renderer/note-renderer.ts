import {
  drawPianoRoll,
  handlePianoRollMousePress,
} from '@/features/drawing/piano'
import { getFixedDoNoteFromKey, getKey, isBlack } from '@/features/theory'
import type { SongNote } from '@/types'
import midiState from '../../midi'
import { getRelativePointerCoordinates } from '../../pointer'
import { getOptimalFontSize } from '../utils'
import { feedbackColors, getRgbaColor, noteColors } from './colors'
import { getItemStartEnd, projectPoint, type State } from './state'

const TEXT_FONT = 'monospace'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getNoteDefaultColor(state: State, note: SongNote): string {
  const hand = state.hands[note.track]?.hand ?? 'both'
  const keyType = isBlack(note.midiNote) ? 'black' : 'white'
  return hand === 'left' ? noteColors.left[keyType] : noteColors.right[keyType]
}

/**
 * Returns the feedback colour for a note if it has been hit or missed,
 * otherwise `undefined`.
 * Called once per note per frame — result is stored locally.
 */
function getNoteFeedbackColor(state: State, note: SongNote): string | undefined {
  if (note.feedbackColor) {
    return feedbackColors[note.feedbackColor] ?? note.feedbackColor
  }
  if (state.player.hitNotes.has(note)) return feedbackColors.green
  if (state.player.missedNotes.has(note)) return feedbackColors.red
  return undefined
}

// ---------------------------------------------------------------------------
// Piano bridge (active-note overlay + mouse press)
// ---------------------------------------------------------------------------

/** Builds the current active-note map by merging player feedback with live MIDI. */
export function getActiveNotes(state: State): Map<number, string> {
  const activeNotes = new Map<number, string>(state.player.pressFeedback)
  for (const midiNote of midiState.getPressedNotes().keys()) {
    if (!activeNotes.has(midiNote)) {
      activeNotes.set(midiNote, 'purple')
    }
  }
  return activeNotes
}

/** Handles piano key mouse interaction and draws the piano roll. */
export function renderPiano(
  state: State,
  activeFingerings: Map<number, number>,
): void {
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

// ---------------------------------------------------------------------------
// Main note renderer
// ---------------------------------------------------------------------------

/**
 * Renders a single falling note capsule: 3D extrusion shadow, gradient fill
 * with progressive feedback colouring, and an optional label.
 *
 * Per-frame fixes applied here:
 *  - `getItemStartEnd` called once (previously twice)
 *  - `getNoteFeedbackColor` called once (previously twice — lines 566 & 681)
 *  - `getRgbaColor` is now a module-level memoised function (was an inline
 *    closure allocated fresh every call)
 */
export function renderFallingNote(
  note: SongNote,
  state: State,
  isActiveTarget: boolean = false,
): void {
  if (!(note.midiNote in state.pianoMeasurements.lanes)) return

  const { ctx, noteLabels, pianoMeasurements } = state
  const lane = pianoMeasurements.lanes[note.midiNote]
  const keyHeight = isBlack(note.midiNote)
    ? pianoMeasurements.blackHeight
    : pianoMeasurements.whiteHeight

  // --- Layout ---
  let posX = lane.left
  let noteWidth = lane.width

  if (isBlack(note.midiNote)) {
    noteWidth = lane.width * 0.8
    posX = lane.left + (lane.width - noteWidth) / 2
  } else {
    const leftBlack = pianoMeasurements.lanes[note.midiNote - 1]
    const rightBlack = pianoMeasurements.lanes[note.midiNote + 1]

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

  // FIX: single call to getItemStartEnd (was called twice for posY and endY)
  const { start: posY, end: endY } = getItemStartEnd(note, state)

  const circleRadius = Math.min(width / 2, keyHeight / 2)
  const defaultColor = getNoteDefaultColor(state, note)

  // FIX: single call to getNoteFeedbackColor (was called at line 566 and again at line 681)
  const activeFeedbackColor = getNoteFeedbackColor(state, note)
  const isPressed = midiState.getPressedNotes().has(note.midiNote)

  ctx.save()

  const circleCenterX = posX + width / 2
  const circleCenterY = posY - circleRadius
  const drawnTopY = endY
  const r = circleRadius * 0.4

  // --- Geometry: rounded-trapezoid perimeter ---
  const localPoints: { x: number; y: number }[] = []
  const topCornerY = drawnTopY + r
  const sideSegments = Math.max(1, Math.ceil(Math.abs(circleCenterY - topCornerY) / 25))
  const numCirclePoints = 16
  const numCornerPoints = 6

  // Bottom semicircle arc
  for (let j = 0; j <= numCirclePoints; j++) {
    const angle = (j / numCirclePoints) * Math.PI
    localPoints.push({
      x: circleCenterX + circleRadius * Math.cos(angle),
      y: circleCenterY + circleRadius * Math.sin(angle),
    })
  }

  // Left side segments
  for (let s = 1; s < sideSegments; s++) {
    const t = s / sideSegments
    localPoints.push({
      x: circleCenterX - circleRadius,
      y: circleCenterY + t * (topCornerY - circleCenterY),
    })
  }

  // Top-left corner arc
  for (let j = 0; j <= numCornerPoints; j++) {
    const angle = Math.PI + (j / numCornerPoints) * (Math.PI / 2)
    localPoints.push({
      x: circleCenterX - circleRadius + r + r * Math.cos(angle),
      y: topCornerY + r * Math.sin(angle),
    })
  }

  // Top-right corner arc
  for (let j = 0; j <= numCornerPoints; j++) {
    const angle = 1.5 * Math.PI + (j / numCornerPoints) * (Math.PI / 2)
    localPoints.push({
      x: circleCenterX + circleRadius - r + r * Math.cos(angle),
      y: topCornerY + r * Math.sin(angle),
    })
  }

  // Right side segments
  for (let s = 1; s < sideSegments; s++) {
    const t = s / sideSegments
    localPoints.push({
      x: circleCenterX + circleRadius,
      y: topCornerY + t * (circleCenterY - topCornerY),
    })
  }

  // Project all points into perspective space
  const projectedPoints = localPoints.map((pt) => projectPoint(pt.x, pt.y, state))
  const pBottomCenter = projectPoint(circleCenterX, posY, state)
  const pTopCenter = projectPoint(circleCenterX, drawnTopY, state)
  const pCenter = projectPoint(circleCenterX, circleCenterY, state)
  const pBottomLeft = projectPoint(circleCenterX - circleRadius, circleCenterY, state)
  const pBottomRight = projectPoint(circleCenterX + circleRadius, circleCenterY, state)

  // --- 1. 3D Extrusion shadow ---
  const depthZ = Math.max(2.5, 5.0 * pBottomCenter.scale)
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
  ctx.fillStyle = getRgbaColor(defaultColor, 0.35)
  ctx.fill()

  // --- 2. Front tile face (gradient fill with progressive feedback colouring) ---
  ctx.beginPath()
  ctx.moveTo(projectedPoints[0].x, projectedPoints[0].y)
  for (let j = 1; j < projectedPoints.length; j++) {
    ctx.lineTo(projectedPoints[j].x, projectedPoints[j].y)
  }
  ctx.closePath()

  // Compute fill ratios once
  let startRatio = 0
  let endRatio = 0
  let isFilled = false

  if (activeFeedbackColor) {
    const dur = note.duration > 0 ? note.duration : 0.001

    if (note.userPressStart !== undefined) {
      const pressEndSec =
        note.userPressEnd ?? (isPressed ? state.time : note.time + note.duration)
      startRatio = Math.min(1, Math.max(0, (note.userPressStart - note.time) / dur))
      endRatio = Math.min(1, Math.max(0.05, (pressEndSec - note.time) / dur))
      isFilled = true
    } else if (state.player.hitNotes.has(note) || note.feedbackColor) {
      endRatio = 1
      isFilled = true
    } else if (state.player.missedNotes.has(note)) {
      endRatio = 1
      isFilled = true
    } else if (isPressed && state.time >= note.time - 0.05) {
      endRatio = Math.min(1, Math.max(0.05, (state.time - note.time) / dur))
      isFilled = true
    }
  }

  let grad: CanvasGradient | string = defaultColor
  try {
    const g = ctx.createLinearGradient(
      circleCenterX,
      pBottomCenter.y,
      circleCenterX,
      pTopCenter.y,
    )
    if (isFilled && activeFeedbackColor && endRatio > startRatio) {
      if (startRatio > 0.01) {
        g.addColorStop(0, getRgbaColor(defaultColor, 1.0))
        g.addColorStop(startRatio, getRgbaColor(defaultColor, 0.9))
      }
      const startStop = startRatio > 0.01 ? startRatio : 0
      g.addColorStop(startStop, getRgbaColor(activeFeedbackColor, 1.0))
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
  } catch {
    grad = defaultColor
  }

  ctx.fillStyle = grad
  ctx.fill()
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.45)'
  ctx.lineWidth = Math.max(1, 1.4 * pBottomCenter.scale)
  ctx.stroke()

  // --- 3. Note label ---
  if (noteLabels !== 'none') {
    const key = getKey(note.midiNote, state.keySignature)
    const noteText = noteLabels === 'alphabetical' ? key : getFixedDoNoteFromKey(key)

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
      const letterSize = fontPx
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
