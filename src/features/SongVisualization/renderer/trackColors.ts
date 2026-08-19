import type { SongNote } from '@/types'

export interface TrackColorPalette {
  id: number
  name: string
  base: string
  light: string
  dark: string
}

export const DEFAULT_TRACK_PALETTES: TrackColorPalette[] = [
  {
    id: 0,
    name: 'Melody (Luminous Violet)',
    base: '#7c3aed',
    light: '#b794f6',
    dark: '#4c1d95',
  },
  {
    id: 1,
    name: 'Left Hand (Coral Orange)',
    base: '#eb7847',
    light: '#f7a480',
    dark: '#9a3c10',
  },
  {
    id: 2,
    name: 'Track 3 (Aqua Cyan)',
    base: '#00e5ff',
    light: '#7df3ff',
    dark: '#007f8f',
  },
  {
    id: 3,
    name: 'Track 4 (Pink)',
    base: '#f26d9a',
    light: '#f9a7c3',
    dark: '#94254c',
  },
  {
    id: 4,
    name: 'Track 5 (Teal)',
    base: '#2ecca2',
    light: '#86bfb0',
    dark: '#135745',
  },
  {
    id: 5,
    name: 'Track 6 (Olive Gold)',
    base: '#8a7c2e',
    light: '#a89b4f',
    dark: '#6b5d0d',
  },
]

/**
 * Returns the track color palette for a given track index, cycling if track count > 6.
 */
export function getTrackColorPalette(
  trackIndex: number,
  palettes: TrackColorPalette[] = DEFAULT_TRACK_PALETTES,
): TrackColorPalette {
  const safeIndex = ((trackIndex % palettes.length) + palettes.length) % palettes.length
  return palettes[safeIndex]
}

/** Helper to parse a hex color string (#rrggbb) into RGB tuple [r, g, b] */
export function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace('#', '')
  const r = parseInt(clean.substring(0, 2), 16) || 0
  const g = parseInt(clean.substring(2, 4), 16) || 0
  const b = parseInt(clean.substring(4, 6), 16) || 0
  return [r, g, b]
}

/** Helper to convert RGB tuple [r, g, b] into hex string #rrggbb */
export function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (c: number) => {
    const clamped = Math.max(0, Math.min(255, Math.round(c)))
    return clamped.toString(16).padStart(2, '0')
  }
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`
}

/** Linearly interpolates between two hex colors by ratio t [0, 1] */
export function interpolateHex(hexA: string, hexB: string, t: number): string {
  const [rA, gA, bA] = hexToRgb(hexA)
  const [rB, gB, bB] = hexToRgb(hexB)
  const clampedT = Math.max(0, Math.min(1, t))
  const r = rA + (rB - rA) * clampedT
  const g = gA + (gB - gA) * clampedT
  const b = bA + (bB - bA) * clampedT
  return rgbToHex(r, g, b)
}

/**
 * Computes pitch bounds [minPitch, maxPitch] per track for a list of notes.
 */
export function computeTrackPitchRanges(
  notes: Array<{ midiNote: number; track?: number }>,
): Map<number, { minPitch: number; maxPitch: number }> {
  const ranges = new Map<number, { minPitch: number; maxPitch: number }>()

  for (const note of notes) {
    const trackId = note.track ?? 0
    const existing = ranges.get(trackId)
    if (!existing) {
      ranges.set(trackId, { minPitch: note.midiNote, maxPitch: note.midiNote })
    } else {
      if (note.midiNote < existing.minPitch) existing.minPitch = note.midiNote
      if (note.midiNote > existing.maxPitch) existing.maxPitch = note.midiNote
    }
  }

  return ranges
}

// Bounded LRU cache for dynamic note color lookups across frames
const dynamicColorCache = new Map<string, string>()

/**
 * Calculates the dynamic tone-scaled color for a note based on its pitch relative to
 * the track's complete pitch range (mapping lowest pitch -> light tone, highest pitch -> dark tone).
 */
export function getDynamicNoteColor(
  note: { midiNote: number; track?: number },
  pitchRange?: { minPitch: number; maxPitch: number },
  palettes: TrackColorPalette[] = DEFAULT_TRACK_PALETTES,
): string {
  const trackId = note.track ?? 0
  const palette = getTrackColorPalette(trackId, palettes)

  const minPitch = pitchRange?.minPitch ?? 21
  const maxPitch = pitchRange?.maxPitch ?? 108

  const cacheKey = `${trackId}:${note.midiNote}:${minPitch}:${maxPitch}:${palette.base}`
  const cached = dynamicColorCache.get(cacheKey)
  if (cached) return cached

  let t = 0.5
  if (maxPitch > minPitch) {
    t = Math.max(0, Math.min(1, (note.midiNote - minPitch) / (maxPitch - minPitch)))
  }

  let color: string
  if (t <= 0.5) {
    // Interpolate light -> base (t: 0 -> 0.5 mapped to 0 -> 1)
    color = interpolateHex(palette.light, palette.base, t * 2)
  } else {
    // Interpolate base -> dark (t: 0.5 -> 1 mapped to 0 -> 1)
    color = interpolateHex(palette.base, palette.dark, (t - 0.5) * 2)
  }

  if (dynamicColorCache.size > 2000) {
    dynamicColorCache.clear()
  }
  dynamicColorCache.set(cacheKey, color)
  return color
}
