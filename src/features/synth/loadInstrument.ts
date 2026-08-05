import * as Tone from 'tone'
import { getInstrumentSampleMap, InstrumentName } from './instruments'

/**
 * Create a fresh, independent Tone.Sampler (or PolySynth fallback) for one track.
 *
 * WHY no shared cache:
 * Sharing a single Tone.Sampler across multiple tracks causes two problems:
 *  1. Shared polyphony — Track A and Track B fight over voice slots.
 *  2. Shared .volume — setting volume on one track silences all others using that instrument.
 *
 * Each track therefore gets its own Sampler node. The browser's HTTP cache ensures
 * the MP3 files are NOT re-downloaded on subsequent calls for the same instrument.
 */
export async function loadInstrument(
  instrument: InstrumentName,
): Promise<Tone.Sampler | Tone.PolySynth> {
  const sampleMap = getInstrumentSampleMap(instrument)

  const result = await new Promise<Tone.Sampler | Tone.PolySynth>((resolve) => {
    let resolved = false
    const timeout = setTimeout(() => {
      if (!resolved) {
        resolved = true
        resolve(sampler)
      }
    }, 3000)

    const sampler = new Tone.Sampler({
      urls: sampleMap,
      onload: () => {
        if (!resolved) {
          resolved = true
          clearTimeout(timeout)
          resolve(sampler)
        }
      },
      onerror: (err) => {
        if (!resolved) {
          resolved = true
          clearTimeout(timeout)
          console.warn(
            `Failed to load samples for "${instrument}", using PolySynth fallback.`,
            err,
          )
          try {
            sampler.dispose()
          } catch (_) {}
          resolve(new Tone.PolySynth(Tone.Synth))
        }
      },
    })
  })

  return result
}
