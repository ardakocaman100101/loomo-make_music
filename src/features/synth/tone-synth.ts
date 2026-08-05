import * as Tone from 'tone'
import midi from '../midi'
import { getGlobalEffectsBus } from './effects-bus'
import { InstrumentName, Synth } from './types'
import { isAudioContextEnabled } from './utils'

export class ToneSamplerSynth implements Synth {
  instrument: InstrumentName
  masterVolume: number
  private sampler: Tone.Sampler | Tone.PolySynth
  // Each ToneSamplerSynth owns its own gain node for independent per-track volume control.
  private trackGain: Tone.Gain
  private activeNotes: Set<number> = new Set()

  constructor(instrument: InstrumentName, sampler: Tone.Sampler | Tone.PolySynth) {
    this.instrument = instrument
    this.sampler = sampler
    this.masterVolume = 1.0

    // Create a private gain node for this track. Initial gain = 1 (fully on).
    this.trackGain = new Tone.Gain(1)
    this.trackGain.connect(getGlobalEffectsBus())

    // Route this track's private sampler into its private gain node.
    this.sampler.connect(this.trackGain)

    // Boost PolySynth fallback volume so synthesizer tracks match sampler loudness
    if (this.sampler instanceof Tone.PolySynth) {
      this.sampler.volume.value = 4
    }
  }

  playNote(note: number, velocity = 127 / 2) {
    midi.pressOutput(note, this.masterVolume)
    if (!isAudioContextEnabled()) {
      return
    }

    try {
      const rawCtx = Tone.getContext().rawContext
      if (rawCtx && rawCtx.state !== 'running') {
        rawCtx.resume()
      }
      if (Tone.getContext().state !== 'running') {
        Tone.start()
      }

      const noteName = Tone.Frequency(note, 'midi').toNote()
      const normalizedVel = Math.max(0.01, Math.min(1, velocity / 127))

      this.activeNotes.add(note)

      if (this.sampler instanceof Tone.Sampler) {
        this.sampler.triggerAttack(noteName, undefined, normalizedVel)
      } else {
        this.sampler.triggerAttack(noteName, undefined, normalizedVel)
      }
    } catch (err) {
      console.error(`Error playing note ${note} on instrument ${this.instrument}:`, err)
    }
  }

  stopNote(note: number) {
    midi.releaseOutput(note)
    if (!isAudioContextEnabled()) {
      return
    }

    if (!this.activeNotes.has(note)) {
      return
    }
    this.activeNotes.delete(note)

    try {
      const noteName = Tone.Frequency(note, 'midi').toNote()
      if (this.sampler instanceof Tone.Sampler) {
        this.sampler.triggerRelease(noteName)
      } else {
        this.sampler.triggerRelease(noteName)
      }
    } catch (err) {
      console.error(`Error stopping note ${note} on instrument ${this.instrument}:`, err)
    }
  }

  stopAllNotes() {
    try {
      if (typeof (this.sampler as any).releaseAll === 'function') {
        ;(this.sampler as any).releaseAll()
      } else {
        this.activeNotes.forEach((note) => {
          const noteName = Tone.Frequency(note, 'midi').toNote()
          try {
            this.sampler.triggerRelease(noteName)
          } catch (_) {}
        })
      }
    } catch (_) {}
    this.activeNotes.clear()
  }

  setMasterVolume(vol: number) {
    this.masterVolume = vol
    const clampedVol = Math.max(0, Math.min(1.2, vol))
    this.trackGain.gain.cancelScheduledValues(Tone.now())
    this.trackGain.gain.setValueAtTime(clampedVol, Tone.now())
  }

  setPitchBend(semitones: number) {
    const samplerAny = this.sampler as any
    if (samplerAny && samplerAny.detune) {
      samplerAny.detune.value = semitones * 100
    }
  }

  getInstrument(): InstrumentName {
    return this.instrument
  }

  dispose() {
    this.stopAllNotes()
    try {
      this.sampler.disconnect()
      this.sampler.dispose()
    } catch (_) {}
    try {
      this.trackGain.disconnect()
      this.trackGain.dispose()
    } catch (_) {}
  }
}
