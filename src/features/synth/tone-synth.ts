import * as Tone from 'tone'
import midi from '../midi'
import { getGlobalEffectsBus } from './effects-bus'
import { InstrumentName, Synth } from './types'
import { isAudioContextEnabled } from './utils'

export class ToneSamplerSynth implements Synth {
  instrument: InstrumentName
  masterVolume: number
  private sampler: Tone.Sampler | Tone.PolySynth

  constructor(instrument: InstrumentName, sampler: Tone.Sampler | Tone.PolySynth) {
    this.instrument = instrument
    this.sampler = sampler
    this.masterVolume = 1.0

    // Connect to global effects bus
    this.sampler.connect(getGlobalEffectsBus())
  }

  playNote(note: number, velocity = 127 / 2) {
    midi.pressOutput(note, this.masterVolume)
    if (!isAudioContextEnabled()) {
      return
    }

    try {
      // Ensure Tone AudioContext is running if suspended
      if (Tone.getContext().state !== 'running') {
        Tone.start()
      }

      const noteName = Tone.Frequency(note, 'midi').toNote()
      const normalizedVel = Math.max(0, Math.min(1, velocity / 127))

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

  setMasterVolume(vol: number) {
    this.masterVolume = vol
    const clampedVol = Math.max(0.0001, Math.min(1, vol))
    // Convert linear volume to decibels
    this.sampler.volume.value = Tone.gainToDb(clampedVol)
  }

  setPitchBend(semitones: number) {
    // Convert semitones (-12 to +12) to cents (-1200 to +1200)
    const samplerAny = this.sampler as any
    if (samplerAny && samplerAny.detune) {
      samplerAny.detune.value = semitones * 100
    }
  }

  getInstrument(): InstrumentName {
    return this.instrument
  }
}
