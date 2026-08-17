import { roundCorner, roundRect } from '@/features/drawing'
import { getKey, getOctave, isBlack, isWhite } from '@/features/theory'
import { isNumber } from '@/utils'
import midiState, { getKeyboardBadgeForNote, hasConnectedMidiInputs } from '../midi'
import { isPointerDown } from '../pointer'
import { getImages } from '../SongVisualization/images'
import { isDragging } from '../SongVisualization/touchscroll'

const TEXT_FONT = 'Arial'
type Color = string
const whiteKeyBackground: Color = 'rgb(255,253,240)'

const feedbackColors: Record<string, string> = {
  green: '#2ecc71',
  yellow: '#f1c40f',
  grey: '#95a5a6',
  red: '#e74c3c',
  purple: '#b08eff',
}

function resolveFeedbackColor(color: string): string {
  return feedbackColors[color] ?? color
}

export interface PianoRollMeasurements {
  lanes: {
    [midiNote: number]: { left: number; width: number; whiteMiddle?: number }
  }
  whiteHeight: number
  blackHeight: number
  whiteNoteSeparation: number
  pianoWidth: number
}

export interface VerticalPianoRollMeasurements {
  lanes: {
    [midiNote: number]: { top: number; height: number; whiteMiddle?: number }
  }
  whiteWidth: number
  blackWidth: number
  whiteNoteSeparation: number
  pianoHeight: number
}

function getBlackKeyXOffset(midiNote: number) {
  const offset = 2 / 3 - 0.5
  const blackOffsets: { [note: number]: number } = {
    1: -offset,
    3: +offset,
    6: -offset,
    8: 0, // center of a 3 grouping is still in middle
    10: +offset,
  }
  return blackOffsets[midiNote % 12]
}

export function getPianoRollMeasurements(
  width: number,
  opts?: { startNote?: number; endNote?: number },
): PianoRollMeasurements {
  const startNote = opts?.startNote ?? 21
  const endNote = opts?.endNote ?? 108
  let whiteKeysCount = 0
  for (let i = startNote; i <= endNote; i++) {
    if (isWhite(i)) {
      whiteKeysCount++
    }
  }

  const whiteWidth = width / whiteKeysCount
  const whiteHeight = Math.floor(Math.min(5 * whiteWidth, 250)) // max-height: 250
  const blackWidth = whiteWidth / 2
  const blackHeight = Math.floor(whiteHeight * (2 / 3))
  const whiteNoteSeparation = whiteWidth / 40
  const measurements: PianoRollMeasurements = {
    pianoWidth: width,
    whiteHeight,
    blackHeight,
    whiteNoteSeparation,
    lanes: {},
  }
  let whiteNotes = 0
  for (let note = startNote; note <= endNote; note++) {
    if (isBlack(note)) {
      const whiteMiddle = whiteWidth * whiteNotes
      const left = whiteMiddle - blackWidth / 2 - 2 + getBlackKeyXOffset(note) * blackWidth
      measurements.lanes[note] = { width: blackWidth, left, whiteMiddle }
    } else {
      measurements.lanes[note] = { width: whiteWidth, left: whiteWidth * whiteNotes }
      whiteNotes++
    }
  }

  return measurements
}

// x,y are top-left of the piano about to be drawn.
// height is determined by the width, since aspect ratio is guaranteed.
export async function drawPianoRoll(
  ctx: CanvasRenderingContext2D,
  measurements: PianoRollMeasurements,
  pianoTopY: number,
  activeNotes: Map<number, Color>,
  activeFingerings?: Map<number, number>,
) {
  const { whiteHeight, whiteNoteSeparation, blackHeight, lanes } = measurements
  ctx.save()

  // Render all the white, then render all the black.
  const whiteNotes = Object.entries(lanes).filter(([midiNote]) => !isBlack(+midiNote))
  const blackNotes = Object.entries(lanes).filter(([midiNote]) => isBlack(+midiNote))

  ctx.strokeStyle = 'transparent'
  ctx.fillStyle = 'black'
  // TODO: fix magic number +5. Likely similar solution to getting rid of
  // pianoTopY kludge.
  ctx.fillRect(0, pianoTopY, measurements.pianoWidth, whiteHeight + 5)
  const showKeyboardBadges = !hasConnectedMidiInputs()
  const baseMidiNote = midiState.getBaseMidiNote()

  for (let [midiNote, lane] of whiteNotes) {
    const { left, width } = lane
    const heightPressedOffset = activeNotes.has(+midiNote) ? 2 : 0
    const height = whiteHeight + heightPressedOffset

    // 3D Inner Shadow / Depth vertical linear gradient
    const keyGrad = ctx.createLinearGradient(left, pianoTopY, left, pianoTopY + height)
    keyGrad.addColorStop(0, '#ffffff')
    keyGrad.addColorStop(0.1, '#fffdf0')
    keyGrad.addColorStop(0.85, '#faf7e9')
    keyGrad.addColorStop(1, '#e5e1d3')

    ctx.fillStyle = keyGrad
    roundRect(ctx, left, pianoTopY, width - whiteNoteSeparation, height, {
      topRadius: 0,
      bottomRadius: width / 12,
    })

    const activeColor = activeNotes.get(+midiNote)
    if (activeColor) {
      ctx.fillStyle = resolveFeedbackColor(activeColor)
      roundRect(ctx, left, pianoTopY, width - whiteNoteSeparation, height, {
        topRadius: 0,
        bottomRadius: width / 12,
      })
    }

    // 1. Permanent Note Name Label (Untouched original position at bottom of white key)
    const keyName = getKey(+midiNote)
    const isC = keyName === 'C'
    const octave = getOctave(+midiNote)
    const labelTxt = isC ? `C${octave}` : keyName

    ctx.fillStyle = 'rgba(19, 19, 19, 0.15)'
    ctx.font = `bold ${width * 0.37}px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace`
    const { width: labelWidth } = ctx.measureText(labelTxt)
    ctx.textBaseline = 'bottom'
    ctx.fillText(
      labelTxt,
      left + width / 2 - labelWidth / 2 - measurements.whiteNoteSeparation / 2,
      pianoTopY + whiteHeight - 5,
    )

    // 2. Keyboard Badge (Aligned on the exact SAME horizontal line as the black key badges)
    const keyBadge = showKeyboardBadges ? getKeyboardBadgeForNote(+midiNote) : null

    if (keyBadge) {
      ctx.save()
      const badgeW = Math.max(16, Math.min(22, width * 0.46))
      const badgeH = 20
      const badgeX = left + width / 2 - badgeW / 2 - measurements.whiteNoteSeparation / 2
      const badgeY = pianoTopY + blackHeight - 26 // Exact same horizontal line as black keys
      const badgeR = 4

      // Translucent Loomo Keycap Pill
      ctx.fillStyle = 'rgba(140, 73, 244, 0.14)'
      ctx.strokeStyle = 'rgba(140, 73, 244, 0.45)'
      ctx.lineWidth = 1
      roundRect(ctx, badgeX, badgeY, badgeW, badgeH, { topRadius: badgeR, bottomRadius: badgeR })
      ctx.fill()
      ctx.stroke()

      // Keycap Letter
      ctx.fillStyle = '#8C49F4'
      ctx.font = `bold ${Math.max(9, Math.min(11, badgeW * 0.55))}px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace`
      ctx.textBaseline = 'middle'
      const { width: badgeTextW } = ctx.measureText(keyBadge)
      ctx.fillText(keyBadge, badgeX + badgeW / 2 - badgeTextW / 2, badgeY + badgeH / 2 + 0.5)
      ctx.restore()
    }

    // Top finger number helper if active
    if (activeFingerings?.has(+midiNote)) {
      const finger = activeFingerings.get(+midiNote)
      const fingerTxt = String(finger)
      ctx.fillStyle = 'rgba(108, 121, 240, 0.45)' // loomo blue at 45% opacity
      ctx.font = `bold ${width * 0.35}px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace`
      const { width: fingerWidth } = ctx.measureText(fingerTxt)
      ctx.textBaseline = 'top'
      ctx.fillText(
        fingerTxt,
        left + width / 2 - fingerWidth / 2 - measurements.whiteNoteSeparation / 2,
        pianoTopY + 12, // 12px below the top of the white key
      )
    }
  }

  for (let [midiNote, lane] of blackNotes) {
    let { left, width, whiteMiddle } = lane
    const cornerWidth = measurements.whiteNoteSeparation
    ctx.strokeStyle = 'transparent'
    ctx.fillStyle = 'black'
    ctx.fillRect(left - 2, pianoTopY, width + 3, blackHeight + 2)

    roundCorner(
      ctx,
      whiteMiddle! - measurements.whiteNoteSeparation - cornerWidth,
      pianoTopY + blackHeight + 1.5,
      cornerWidth + 0.2,
      cornerWidth,
      width / 22,
    )
    roundCorner(
      ctx,
      whiteMiddle! + cornerWidth,
      pianoTopY + blackHeight + 1.5,
      -cornerWidth - 0.2,
      cornerWidth,
      width / 22,
    )

    const isPressed = activeNotes.has(+midiNote)
    const images = getImages()
    let img = isPressed ? images.blackKeyPressed : images.blackKeyRaised
    let posY = isPressed ? pianoTopY : pianoTopY - 2

    // Clip the black key image with a smoother bottom radius (3.5px)
    ctx.save()
    ctx.beginPath()
    const clipR = 3.5
    ctx.moveTo(left, posY)
    ctx.lineTo(left + width, posY)
    ctx.arcTo(left + width, posY + blackHeight, left, posY + blackHeight, clipR)
    ctx.arcTo(left, posY + blackHeight, left, posY, clipR)
    ctx.closePath()
    ctx.clip()

    ctx.drawImage(img, left, posY, width, blackHeight)

    // Soft dark matte overlay to tone down glossy highlight and cover bottom gloss
    const blackGrad = ctx.createLinearGradient(left, posY, left, posY + blackHeight)
    blackGrad.addColorStop(0, 'rgba(0, 0, 0, 0.32)') // Darken top
    blackGrad.addColorStop(0.7, 'rgba(0, 0, 0, 0.40)') // Darken middle
    blackGrad.addColorStop(0.92, 'rgba(0, 0, 0, 0.70)') // Start smoothing out bottom gloss
    blackGrad.addColorStop(1, 'rgba(0, 0, 0, 0.90)') // Make bottom edge matte & dark
    ctx.fillStyle = blackGrad
    ctx.fillRect(left, posY, width, blackHeight)

    const blackKeyBadge = showKeyboardBadges ? getKeyboardBadgeForNote(+midiNote) : null
    if (blackKeyBadge) {
      ctx.save()
      const badgeW = Math.max(16, Math.min(20, width * 0.52))
      const badgeH = 18
      const badgeX = left + width / 2 - badgeW / 2
      const badgeY = pianoTopY + blackHeight - 26
      const badgeR = 3.5

      ctx.fillStyle = 'rgba(255, 255, 255, 0.18)'
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.45)'
      ctx.lineWidth = 1
      roundRect(ctx, badgeX, badgeY, badgeW, badgeH, { topRadius: badgeR, bottomRadius: badgeR })
      ctx.fill()
      ctx.stroke()

      ctx.fillStyle = '#FFFFFF'
      ctx.font = `bold ${Math.max(9, Math.min(11, badgeW * 0.55))}px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace`
      ctx.textBaseline = 'middle'
      const { width: textW } = ctx.measureText(blackKeyBadge)
      ctx.fillText(blackKeyBadge, left + width / 2 - textW / 2, badgeY + badgeH / 2 + 0.5)
      ctx.restore()
    }

    if (activeFingerings?.has(+midiNote)) {
      const finger = activeFingerings.get(+midiNote)
      ctx.fillStyle = 'rgba(255, 255, 255, 0.45)' // White at 45% opacity
      ctx.font = `bold ${width * 0.35}px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace`
      const txt = String(finger)
      const { width: textWidth } = ctx.measureText(txt)
      ctx.textBaseline = 'top'
      ctx.fillText(
        txt,
        left + width / 2 - textWidth / 2,
        posY + 12, // 12px below the top of the black key
      )
    }
    ctx.restore()

    const blackActiveColor = activeNotes.get(+midiNote)
    if (blackActiveColor) {
      ctx.globalAlpha = 0.55
      ctx.fillStyle = resolveFeedbackColor(blackActiveColor)
      ctx.fillRect(left, posY, width, blackHeight)
      ctx.globalAlpha = 1
    }
  }
  ctx.restore()
}

let lastPressedNote: null | number = null
export function handlePianoRollMousePress(
  measurements: PianoRollMeasurements,
  pianoTopY: number,
  point: { x: number; y: number },
) {
  if (!isPointerDown() || isDragging()) {
    if (isNumber(lastPressedNote)) {
      midiState.release(lastPressedNote)
      lastPressedNote = null
    }
    return
  }

  // Can easily optimize this later.
  const { blackHeight, whiteHeight } = measurements
  let newPressedNote: null | number = null
  for (let [midiNote, lane] of Object.entries(measurements.lanes)) {
    const { left, width } = lane
    const height = isBlack(+midiNote) ? blackHeight : whiteHeight
    const rect = { x: left, y: pianoTopY, height, width }
    if (pointIntersectsWithRect(point, rect)) {
      newPressedNote = +midiNote
      break
    }
  }
  if (
    newPressedNote &&
    !isBlack(newPressedNote) &&
    isBlack(newPressedNote + 1) &&
    newPressedNote < 108
  ) {
    const { left, width } = measurements.lanes[newPressedNote + 1]
    const rect = { x: left, y: pianoTopY, height: blackHeight, width }
    if (pointIntersectsWithRect(point, rect)) {
      newPressedNote = newPressedNote + 1
    }
  }

  if (newPressedNote == lastPressedNote) {
    return
  }

  if (isNumber(lastPressedNote)) {
    midiState.release(lastPressedNote)
    lastPressedNote = null
  }
  if (isNumber(newPressedNote)) {
    midiState.press(newPressedNote, 127 / 2)
    lastPressedNote = newPressedNote
  }
}

export function getVerticalPianoRollMeasurements(
  height: number,
  opts?: { startNote?: number; endNote?: number },
): VerticalPianoRollMeasurements {
  const startNote = opts?.startNote ?? 21
  const endNote = opts?.endNote ?? 108
  let whiteKeysCount = 0
  for (let i = startNote; i <= endNote; i++) {
    if (isWhite(i)) {
      whiteKeysCount++
    }
  }

  const whiteHeight = height / whiteKeysCount
  const whiteWidth = Math.floor(Math.min(5 * whiteHeight, 150)) // max-width
  const blackHeight = whiteHeight * 0.7
  const blackWidth = Math.floor(whiteWidth * (2 / 3))
  const whiteNoteSeparation = whiteHeight / 40
  const measurements: VerticalPianoRollMeasurements = {
    pianoHeight: height,
    whiteWidth,
    blackWidth,
    whiteNoteSeparation,
    lanes: {},
  }
  let whiteNotes = 0
  for (let note = startNote; note <= endNote; note++) {
    if (isBlack(note)) {
      // The white key below it (lower pitch) has whiteNotes - 1
      // The white key above it (higher pitch) has whiteNotes
      // The distance from the bottom is based on whiteNotes.
      // Top of the key is:
      const whiteMiddle = height - whiteHeight * whiteNotes
      const top = whiteMiddle - blackHeight / 2 - 2 - getBlackKeyXOffset(note) * blackHeight
      measurements.lanes[note] = { height: blackHeight, top, whiteMiddle }
    } else {
      measurements.lanes[note] = {
        height: whiteHeight,
        top: height - whiteHeight * (whiteNotes + 1),
      }
      whiteNotes++
    }
  }

  return measurements
}

export async function drawVerticalPianoRoll(
  ctx: CanvasRenderingContext2D,
  measurements: VerticalPianoRollMeasurements,
  pianoLeftX: number,
  activeNotes: Map<number, Color>,
) {
  const { whiteWidth, whiteNoteSeparation, blackWidth, lanes } = measurements
  ctx.save()

  const whiteNotes = Object.entries(lanes).filter(([midiNote]) => !isBlack(+midiNote))
  const blackNotes = Object.entries(lanes).filter(([midiNote]) => isBlack(+midiNote))

  ctx.strokeStyle = 'transparent'
  ctx.fillStyle = 'black'
  ctx.fillRect(pianoLeftX, 0, whiteWidth + 5, measurements.pianoHeight)

  for (let [midiNote, lane] of whiteNotes) {
    const { top, height } = lane
    ctx.fillStyle = whiteKeyBackground
    const widthPressedOffset = activeNotes.has(+midiNote) ? 2 : 0
    const width = whiteWidth + widthPressedOffset
    roundRect(ctx, pianoLeftX, top, width, height - whiteNoteSeparation, {
      topRadius: 0,
      bottomRadius: height / 10,
    })
    const isC = getKey(+midiNote) == 'C'
    if (isC) {
      const octave = getOctave(+midiNote)
      ctx.fillStyle = 'rgb(190,190,190)'
      ctx.font = `${height * 0.65}px ${TEXT_FONT}`
      const txt = `C${octave}`
      const { width: textWidth } = ctx.measureText(txt)

      ctx.textBaseline = 'middle'
      ctx.fillText(
        txt,
        pianoLeftX + whiteWidth - textWidth - 8,
        top + height / 2 - whiteNoteSeparation / 2,
      )
    }
    const activeColor = activeNotes.get(+midiNote)
    if (activeColor) {
      ctx.fillStyle = resolveFeedbackColor(activeColor)
      roundRect(ctx, pianoLeftX, top, width, height - whiteNoteSeparation, {
        topRadius: 0,
        bottomRadius: height / 10,
      })
    }
  }

  for (let [midiNote, lane] of blackNotes) {
    let { top, height, whiteMiddle } = lane
    const cornerHeight = measurements.whiteNoteSeparation
    ctx.strokeStyle = 'transparent'
    ctx.fillStyle = 'black'
    ctx.fillRect(pianoLeftX, top - 2, blackWidth + 2, height + 3)

    const isPressed = activeNotes.has(+midiNote)
    ctx.fillStyle = activeNotes.get(+midiNote) ?? 'black'

    ctx.save()
    const width = isPressed ? blackWidth : blackWidth + 2
    roundRect(ctx, pianoLeftX, top, width, height, {
      topRadius: 0,
      bottomRadius: height / 10,
    })
    const vBlackActiveColor = activeNotes.get(+midiNote)
    if (vBlackActiveColor) {
      ctx.globalAlpha = 0.55
      ctx.fillStyle = resolveFeedbackColor(vBlackActiveColor)
      ctx.fillRect(pianoLeftX, top, width, height)
      ctx.globalAlpha = 1
    }
    ctx.restore()
  }
  ctx.restore()
}

export function handleVerticalPianoRollMousePress(
  measurements: VerticalPianoRollMeasurements,
  pianoLeftX: number,
  point: { x: number; y: number },
) {
  if (!isPointerDown() || isDragging()) {
    if (isNumber(lastPressedNote)) {
      midiState.release(lastPressedNote)
      lastPressedNote = null
    }
    return
  }

  const { blackWidth, whiteWidth } = measurements
  let newPressedNote: null | number = null
  for (let [midiNote, lane] of Object.entries(measurements.lanes)) {
    const { top, height } = lane
    const width = isBlack(+midiNote) ? blackWidth : whiteWidth
    const rect = { x: pianoLeftX, y: top, height, width }
    if (pointIntersectsWithRect(point, rect)) {
      newPressedNote = +midiNote
      break
    }
  }
  if (
    newPressedNote &&
    !isBlack(newPressedNote) &&
    isBlack(newPressedNote + 1) &&
    newPressedNote < 108
  ) {
    const { top, height } = measurements.lanes[newPressedNote + 1]
    const rect = { x: pianoLeftX, y: top, height, width: blackWidth }
    if (pointIntersectsWithRect(point, rect)) {
      newPressedNote = newPressedNote + 1
    }
  }

  if (newPressedNote == lastPressedNote) {
    return
  }

  if (isNumber(lastPressedNote)) {
    midiState.release(lastPressedNote)
    lastPressedNote = null
  }
  if (isNumber(newPressedNote)) {
    midiState.press(newPressedNote, 127 / 2)
    lastPressedNote = newPressedNote
  }
}

type Point = { x: number; y: number }
type Rect = { x: number; y: number; width: number; height: number }
function pointIntersectsWithRect(point: Point, rect: Rect): boolean {
  const doesXIntersect = rect.x <= point.x && point.x <= rect.x + rect.width
  const doesYIntersect = rect.y <= point.y && point.y <= rect.y + rect.height
  return doesXIntersect && doesYIntersect
}
