import * as Tone from 'tone'
import midi from '../midi'
import { getGlobalEffectsBus } from './effects-bus'
import { InstrumentName, Synth } from './types'
import { isAudioContextEnabled } from './utils'

export class Tone909DrumMachineSynth implements Synth {
  instrument: InstrumentName
  masterVolume: number
  private outputGain: Tone.Gain

  // 909 Synthesizers
  private kick: Tone.MembraneSynth
  private snareBody: Tone.MembraneSynth
  private snareNoise: Tone.NoiseSynth
  private clapNoise: Tone.NoiseSynth
  private hihatClosed: Tone.MetalSynth
  private hihatOpen: Tone.MetalSynth
  private tomLow: Tone.MembraneSynth
  private tomMid: Tone.MembraneSynth
  private tomHigh: Tone.MembraneSynth
  private crash: Tone.MetalSynth

  constructor(instrument: InstrumentName = 'drum_machine_909') {
    this.instrument = instrument
    this.masterVolume = 1.0
    this.outputGain = new Tone.Gain(1.0)
    this.outputGain.connect(getGlobalEffectsBus())

    // 1. TR-909 Punchy Sub Kick
    this.kick = new Tone.MembraneSynth({
      pitchDecay: 0.05,
      octaves: 8,
      oscillator: { type: 'sine' },
      envelope: { attack: 0.001, decay: 0.4, sustain: 0.01, release: 0.4 },
    }).connect(this.outputGain)

    // 2. TR-909 Snare (Body + Noise)
    this.snareBody = new Tone.MembraneSynth({
      pitchDecay: 0.01,
      octaves: 3,
      oscillator: { type: 'triangle' },
      envelope: { attack: 0.001, decay: 0.15, sustain: 0, release: 0.1 },
    }).connect(this.outputGain)

    this.snareNoise = new Tone.NoiseSynth({
      noise: { type: 'white' },
      envelope: { attack: 0.001, decay: 0.2, sustain: 0 },
    }).connect(this.outputGain)

    // 3. TR-909 Handclap
    this.clapNoise = new Tone.NoiseSynth({
      noise: { type: 'pink' },
      envelope: { attack: 0.005, decay: 0.25, sustain: 0 },
    }).connect(this.outputGain)

    // 4. TR-909 Closed Hi-Hat
    this.hihatClosed = new Tone.MetalSynth({
      envelope: { attack: 0.001, decay: 0.05, release: 0.05 },
      harmonicity: 5.1,
      modulationIndex: 32,
      resonance: 4000,
      octaves: 1.5,
    }).connect(this.outputGain)
    this.hihatClosed.frequency.value = 250
    this.hihatClosed.volume.value = -6

    // 5. TR-909 Open Hi-Hat
    this.hihatOpen = new Tone.MetalSynth({
      envelope: { attack: 0.001, decay: 0.35, release: 0.35 },
      harmonicity: 5.1,
      modulationIndex: 32,
      resonance: 4000,
      octaves: 1.5,
    }).connect(this.outputGain)
    this.hihatOpen.frequency.value = 250
    this.hihatOpen.volume.value = -6

    // 6. TR-909 Low / Mid / High Toms
    this.tomLow = new Tone.MembraneSynth({
      pitchDecay: 0.03,
      octaves: 4,
      oscillator: { type: 'sine' },
      envelope: { attack: 0.001, decay: 0.3, sustain: 0, release: 0.2 },
    }).connect(this.outputGain)

    this.tomMid = new Tone.MembraneSynth({
      pitchDecay: 0.03,
      octaves: 4,
      oscillator: { type: 'sine' },
      envelope: { attack: 0.001, decay: 0.25, sustain: 0, release: 0.2 },
    }).connect(this.outputGain)

    this.tomHigh = new Tone.MembraneSynth({
      pitchDecay: 0.03,
      octaves: 4,
      oscillator: { type: 'sine' },
      envelope: { attack: 0.001, decay: 0.2, sustain: 0, release: 0.2 },
    }).connect(this.outputGain)

    // 7. TR-909 Crash Cymbal
    this.crash = new Tone.MetalSynth({
      envelope: { attack: 0.005, decay: 1.2, release: 1.2 },
      harmonicity: 3.2,
      modulationIndex: 40,
      resonance: 3000,
      octaves: 1.5,
    }).connect(this.outputGain)
    this.crash.frequency.value = 300
    this.crash.volume.value = -8
  }

  playNote(note: number, velocity = 127 / 2) {
    midi.pressOutput(note, this.masterVolume)
    if (!isAudioContextEnabled()) return

    try {
      if (Tone.getContext().state !== 'running') {
        Tone.start()
      }

      const vel = Math.max(0, Math.min(1, velocity / 127)) * this.masterVolume
      const noteInOctave = note % 12
      const now = Tone.now()

      // Standard GM mapping + full Octave Chromatic Drum Map
      switch (noteInOctave) {
        case 0: // C (36 - Kick)
          this.kick.triggerAttackRelease('C1', '8n', now, vel)
          break
        case 1: // C# (37 - Rimshot / Side Stick)
          this.snareBody.triggerAttackRelease('C2', '16n', now, vel * 0.8)
          break
        case 2: // D (38 - Snare Body)
          this.snareBody.triggerAttackRelease('A1', '16n', now, vel)
          this.snareNoise.triggerAttackRelease('16n', now, vel * 0.9)
          break
        case 3: // D# (39 - Hand Clap)
          this.clapNoise.triggerAttackRelease('16n', now, vel)
          break
        case 4: // E (40 - Electric Snare)
          this.snareBody.triggerAttackRelease('G1', '16n', now, vel)
          this.snareNoise.triggerAttackRelease('8n', now, vel)
          break
        case 5: // F (41 - Low Tom)
          this.tomLow.triggerAttackRelease('F1', '8n', now, vel)
          break
        case 6: // F# (42 - Closed Hi-Hat)
          this.hihatClosed.triggerAttackRelease('16n', now, vel * 0.9)
          break
        case 7: // G (43 - Floor Tom / Mid-Low Tom)
          this.tomMid.triggerAttackRelease('G1', '8n', now, vel)
          break
        case 8: // G# (44 - Pedal Hi-Hat)
          this.hihatClosed.triggerAttackRelease('32n', now, vel * 0.7)
          break
        case 9: // A (45 - Mid Tom)
          this.tomMid.triggerAttackRelease('A1', '8n', now, vel)
          break
        case 10: // A# (46 - Open Hi-Hat)
          this.hihatOpen.triggerAttackRelease('8n', now, vel * 0.9)
          break
        case 11: // B (47 / 49 - High Tom / Crash)
          this.tomHigh.triggerAttackRelease('C2', '8n', now, vel)
          this.crash.triggerAttackRelease('8n', now, vel * 0.6)
          break
        default:
          this.kick.triggerAttackRelease('C1', '8n', now, vel)
          break
      }
    } catch (err) {
      console.error(`Error playing note ${note} on TR-909 drum machine:`, err)
    }
  }

  stopNote(note: number) {
    midi.releaseOutput(note)
  }

  setMasterVolume(vol: number) {
    this.masterVolume = vol
    const clampedVol = Math.max(0.0001, Math.min(1, vol))
    this.outputGain.gain.value = clampedVol
  }

  getInstrument(): InstrumentName {
    return this.instrument
  }
}
