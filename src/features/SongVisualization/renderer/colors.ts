import { palette } from '@/styles/common'

export const noteColors = {
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
} as const

export const feedbackColors: Record<string, string> = {
  green: '#2ecc71',
  yellow: '#f1c40f',
  grey: '#95a5a6',
  red: '#e74c3c',
  purple: '#b08eff',
}

// ---------------------------------------------------------------------------
// Memoized rgba converter — previously an inline closure allocated every frame
// per note. Now lives at module scope and caches results in a bounded Map.
// ---------------------------------------------------------------------------
const rgbaCache = new Map<string, string>()

/**
 * Converts any colour token (hex, rgb/rgba name, or named string) to an
 * `rgba(...)` string with the given alpha. Results are cached so the string
 * only needs to be built once per unique colour+alpha pair.
 */
export function getRgbaColor(hexOrName: string, alpha: number): string {
  const cacheKey = `${hexOrName}:${alpha}`
  const cached = rgbaCache.get(cacheKey)
  if (cached !== undefined) return cached

  let result: string
  if (hexOrName.startsWith('#')) {
    const hex = hexOrName.replace('#', '')
    const r = parseInt(hex.substring(0, 2), 16)
    const g = parseInt(hex.substring(2, 4), 16)
    const b = parseInt(hex.substring(4, 6), 16)
    result = `rgba(${r}, ${g}, ${b}, ${alpha})`
  } else if (hexOrName.startsWith('rgba')) {
    result = hexOrName.replace(/[\d.]+\)$/, `${alpha})`)
  } else if (hexOrName.startsWith('rgb')) {
    result = hexOrName.replace('rgb', 'rgba').replace(')', `, ${alpha})`)
  } else {
    const namedMap: Record<string, string> = {
      purple: '176, 142, 255',
      orange: '243, 156, 18',
      green: '46, 204, 113',
      blue: '52, 152, 219',
      red: '231, 76, 60',
      yellow: '241, 196, 15',
      grey: '149, 165, 166',
    }
    const rgb = namedMap[hexOrName.toLowerCase()]
    result = rgb ? `rgba(${rgb}, ${alpha})` : hexOrName
  }

  // Prevent unbounded growth (palettes are small — this is a safety valve)
  if (rgbaCache.size > 512) rgbaCache.clear()
  rgbaCache.set(cacheKey, result)
  return result
}
