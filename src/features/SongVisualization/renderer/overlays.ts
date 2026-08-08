import type { SongMeasure } from '@/types'
import { getItemStartEnd, projectPoint, type State } from './state'
import { noteColors } from './colors'

const TEXT_FONT = 'monospace'

/**
 * Renders a measure number marker as a faint label aligned to the measure's
 * time position in the perspective-projected space.
 */
export function renderMeasure(measure: SongMeasure, state: State): void {
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

/**
 * Renders the translucent green practice-range overlay with dashed boundary
 * lines on all four sides, projected into perspective space.
 */
export function renderRange(state: State): void {
  const { ctx, pps } = state
  if (!state.selectedRange) return

  const { start, end } = state.selectedRange
  ctx.save()

  const duration = Math.max(0, end - start)
  const rectHeight = duration * pps

  const isReverse = state.visualization === 'reverse-waterfall'
  const posY = state.noteHitY
  const tailTopY = isReverse
    ? state.noteHitY + rectHeight
    : state.noteHitY - rectHeight

  const bottomLeft = projectPoint(0, posY, state)
  const bottomRight = projectPoint(state.windowWidth, posY, state)
  const topLeft = projectPoint(0, tailTopY, state)
  const topRight = projectPoint(state.windowWidth, tailTopY, state)

  // Translucent fill
  ctx.fillStyle = noteColors.rangeSelectionFill
  ctx.globalAlpha = 0.22
  ctx.beginPath()
  ctx.moveTo(bottomLeft.x, bottomLeft.y)
  ctx.lineTo(bottomRight.x, bottomRight.y)
  ctx.lineTo(topRight.x, topRight.y)
  ctx.lineTo(topLeft.x, topLeft.y)
  ctx.closePath()
  ctx.fill()

  // Boundary lines
  ctx.globalAlpha = 0.95
  ctx.strokeStyle = '#818cf8'
  ctx.lineWidth = 2.5
  ctx.setLineDash([8, 6])

  const drawLine = (
    a: { x: number; y: number },
    b: { x: number; y: number },
  ) => {
    ctx.beginPath()
    ctx.moveTo(a.x, a.y)
    ctx.lineTo(b.x, b.y)
    ctx.stroke()
  }

  drawLine(bottomLeft, bottomRight)
  drawLine(topLeft, topRight)
  drawLine(bottomLeft, topLeft)
  drawLine(bottomRight, topRight)

  ctx.restore()
}
