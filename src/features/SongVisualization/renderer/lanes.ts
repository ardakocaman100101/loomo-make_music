import { isBlack } from '@/features/theory'
import { projectPoint, type State } from './state'

/**
 * Renders translucent vertical strips behind black key columns to give the
 * falling-note lanes a subtle visual grid in perspective space.
 */
export function renderLanes(state: State): void {
  const { ctx } = state
  ctx.save()

  const segments = 16
  const yStart = -state.height * 2.5
  const yEnd = state.pianoTopY
  const yStep = (yEnd - yStart) / segments

  for (const [midiNote, lane] of Object.entries(state.pianoMeasurements.lanes)) {
    const midiNum = +midiNote
    if (!isBlack(midiNum)) continue

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

  ctx.restore()
}

/**
 * Draws a top-of-screen gradient fade that dims notes approaching the far
 * horizon, giving depth to the perspective projection.
 */
export function renderHorizonFade(state: State): void {
  const { ctx, windowWidth, pianoTopY } = state
  ctx.save()

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

/**
 * Draws the dashed hit-line across the canvas at the note-strike position,
 * fading out at the left and right edges with a warm amber glow.
 */
export function renderHitLine(state: State): void {
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
