import type { PianoRollMeasurements } from '@/features/drawing/piano'
import type { GivenState } from '../canvas-renderer'
import type { CanvasItem, Viewport } from '../utils'

/** Derived render state — `GivenState` augmented with computed layout values. */
export type State = GivenState & {
  viewport: Viewport
  pianoMeasurements: PianoRollMeasurements
  pianoTopY: number
  pianoWidth: number
  noteHitY: number
  trackPitchRanges?: Map<number, { minPitch: number; maxPitch: number }>
}

/**
 * Projects a canvas point into perspective space relative to the piano anchor.
 * Points above the piano shrink toward the centre horizon; at or below stay flat.
 */
export function projectPoint(
  x: number,
  y: number,
  state: State,
): { x: number; y: number; scale: number } {
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

/**
 * Returns the canvas Y range (start = bottom of note capsule, end = top) for
 * any canvas item in the current render state.
 */
export function getItemStartEnd(
  item: CanvasItem,
  state: State,
): { start: number; end: number } {
  if (state.visualization === 'reverse-waterfall') {
    const topY = state.noteHitY - (state.time - item.time) * state.pps
    const bottomY =
      state.noteHitY - (state.time - (item.time + item.duration)) * state.pps
    return { start: bottomY, end: topY }
  }
  const noteScreenY = state.noteHitY - (item.time - state.time) * state.pps
  const endY = noteScreenY - item.duration * state.pps
  return { start: noteScreenY, end: endY }
}
