import type { State } from './state'

// Memoized subtle noise pattern — generated once, reused every frame.
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
    data[i + 3] = Math.floor(Math.random() * 6) // max ~2.3% opacity
  }
  offCtx.putImageData(imageData, 0, 0)
  noisePattern = ctx.createPattern(canvas, 'repeat')
  return noisePattern
}

/**
 * Fills the canvas with a radial dark gradient and overlays a subtle noise
 * pattern to prevent banding and add a premium matte texture.
 */
export function renderBackground(state: State): void {
  const { ctx, windowWidth, height } = state
  const cx = windowWidth / 2
  const cy = height / 2
  const radius = Math.max(windowWidth, height)

  const bgGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius)
  bgGrad.addColorStop(0, '#242424')
  bgGrad.addColorStop(0.7, '#0a0a0a')
  bgGrad.addColorStop(1, '#000000')

  ctx.fillStyle = bgGrad
  ctx.fillRect(0, 0, windowWidth, height)

  const pattern = getNoisePattern(ctx)
  if (pattern) {
    ctx.fillStyle = pattern
    ctx.fillRect(0, 0, windowWidth, height)
  }
}
