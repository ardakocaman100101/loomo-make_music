import { atom, getDefaultStore } from 'jotai'
import * as Tone from 'tone'

type JotaiStore = ReturnType<typeof getDefaultStore>
const store: JotaiStore = getDefaultStore()

export interface EQBandState {
  freq: number
  gain: number // dB (-24 to +24)
  Q: number // 0.1 to 10
}

export interface EffectsState {
  pitchBend: number // -12 to +12 semitones
  cutoff: number // 20 to 20000 Hz
  distortion: number // 0 to 1
  bassBoost: number // 0 to 12 dB
  delayTime: number // 0.01 to 1.0 s
  volume: number // 0 to 1 linear (0 to 1.2 for boost)
  reverbMix: number // 0 to 1 wet
  delayMix: number // 0 to 1 wet
  resonance: number // 0.1 to 20 Q
  eqLow: EQBandState
  eqMid: EQBandState
  eqHigh: EQBandState
}

export const reverbWetAtom = atom(0.1)
export const eqLowAtom = atom(0)
export const eqMidAtom = atom(0)
export const eqHighAtom = atom(0)
export const masterVolumeDbAtom = atom(0)

export type EffectsStateListener = (state: EffectsState) => void

class AudioEffectsBus {
  private static instance: AudioEffectsBus

  // Tone.js DSP Nodes in sequential chain:
  // Input -> eqLow -> eqMid -> eqHigh -> sweepFilter -> distortion -> bassEnhancer -> delay -> reverb -> limiter -> masterGain -> Destination
  private eqLowNode: Tone.Filter
  private eqMidNode: Tone.Filter
  private eqHighNode: Tone.Filter
  private sweepFilterNode: Tone.Filter
  private distortionNode: Tone.Distortion
  private bassEnhancerNode: Tone.Filter
  private delayNode: Tone.FeedbackDelay
  private reverbNode: Tone.Freeverb
  private limiterNode: Tone.Limiter
  private masterGainNode: Tone.Gain

  private listeners: Set<EffectsStateListener> = new Set()

  private state: EffectsState = {
    pitchBend: 0,
    cutoff: 20000,
    distortion: 0,
    bassBoost: 0,
    delayTime: 0.25,
    volume: 0.9,
    reverbMix: 0.15,
    delayMix: 0.0,
    resonance: 1.0,
    eqLow: { freq: 80, gain: 0, Q: 1.0 },
    eqMid: { freq: 1000, gain: 0, Q: 1.0 },
    eqHigh: { freq: 8000, gain: 0, Q: 1.0 },
  }

  private constructor() {
    // 1. Parametric 3-Band EQ Nodes
    this.eqLowNode = new Tone.Filter({
      type: 'lowshelf',
      frequency: this.state.eqLow.freq,
      gain: this.state.eqLow.gain,
      Q: this.state.eqLow.Q,
    })

    this.eqMidNode = new Tone.Filter({
      type: 'peaking',
      frequency: this.state.eqMid.freq,
      gain: this.state.eqMid.gain,
      Q: this.state.eqMid.Q,
    })

    this.eqHighNode = new Tone.Filter({
      type: 'highshelf',
      frequency: this.state.eqHigh.freq,
      gain: this.state.eqHigh.gain,
      Q: this.state.eqHigh.Q,
    })

    // 2. Master Sweep Lowpass Filter (Knob 1 Cutoff, Fader 4 Resonance)
    this.sweepFilterNode = new Tone.Filter({
      type: 'lowpass',
      frequency: this.state.cutoff,
      Q: this.state.resonance,
    })

    // 3. Distortion (Knob 2 Distortion Amount)
    this.distortionNode = new Tone.Distortion({
      distortion: this.state.distortion,
      wet: this.state.distortion > 0 ? 0.8 : 0,
    })

    // 4. Low-End Bass Enhancer (Knob 3 Bass Boost)
    this.bassEnhancerNode = new Tone.Filter({
      type: 'lowshelf',
      frequency: 100,
      gain: this.state.bassBoost,
    })

    // 5. Delay (Knob 4 Delay Time, Fader 3 Delay Mix)
    this.delayNode = new Tone.FeedbackDelay({
      delayTime: this.state.delayTime,
      feedback: 0.35,
      wet: this.state.delayMix,
    })

    // 6. Reverb (Fader 2 Reverb Mix)
    this.reverbNode = new Tone.Freeverb({
      roomSize: 0.7,
      dampening: 3000,
      wet: this.state.reverbMix,
    })

    // 7. Master Limiter & Volume Output (Fader 1 Master Volume)
    this.limiterNode = new Tone.Limiter(-0.5)
    this.masterGainNode = new Tone.Gain(this.state.volume)

    // Connect sequential chain:
    // eqLow -> eqMid -> eqHigh -> sweepFilter -> distortion -> bassEnhancer -> delay -> reverb -> limiter -> masterGain -> Destination
    this.eqLowNode.connect(this.eqMidNode)
    this.eqMidNode.connect(this.eqHighNode)
    this.eqHighNode.connect(this.sweepFilterNode)
    this.sweepFilterNode.connect(this.distortionNode)
    this.distortionNode.connect(this.bassEnhancerNode)
    this.bassEnhancerNode.connect(this.delayNode)
    this.delayNode.connect(this.reverbNode)
    this.reverbNode.connect(this.limiterNode)
    this.limiterNode.connect(this.masterGainNode)
    this.masterGainNode.toDestination()

    // Sync legacy Jotai atoms if modified elsewhere
    store.sub(reverbWetAtom, () => {
      this.setReverbMix(store.get(reverbWetAtom))
    })
    store.sub(masterVolumeDbAtom, () => {
      const db = store.get(masterVolumeDbAtom)
      this.setVolume(Tone.dbToGain(db))
    })
  }

  public static getInstance(): AudioEffectsBus {
    if (!AudioEffectsBus.instance) {
      AudioEffectsBus.instance = new AudioEffectsBus()
    }
    return AudioEffectsBus.instance
  }

  public getInputElement(): Tone.InputNode {
    return this.eqLowNode
  }

  public getState(): Readonly<EffectsState> {
    return this.state
  }

  public subscribe(listener: EffectsStateListener): () => void {
    this.listeners.add(listener)
    listener(this.state)
    return () => {
      this.listeners.delete(listener)
    }
  }

  private notify() {
    for (const listener of this.listeners) {
      listener(this.state)
    }
  }

  // --- Real-Time Zero-Latency DSP Parameter Setters ---

  public setCutoff(frequencyHz: number) {
    const clamped = Math.max(20, Math.min(20000, frequencyHz))
    this.state.cutoff = clamped
    this.sweepFilterNode.frequency.cancelScheduledValues(Tone.now())
    this.sweepFilterNode.frequency.setValueAtTime(clamped, Tone.now())
    this.notify()
  }

  public setDistortion(amount: number) {
    const clamped = Math.max(0, Math.min(1, amount))
    this.state.distortion = clamped
    this.distortionNode.distortion = clamped
    this.distortionNode.wet.setValueAtTime(clamped > 0 ? 0.8 : 0, Tone.now())
    this.notify()
  }

  public setBassBoost(dB: number) {
    const clamped = Math.max(0, Math.min(12, dB))
    this.state.bassBoost = clamped
    this.bassEnhancerNode.gain.cancelScheduledValues(Tone.now())
    this.bassEnhancerNode.gain.setValueAtTime(clamped, Tone.now())
    this.notify()
  }

  public setDelayTime(seconds: number) {
    const clamped = Math.max(0.01, Math.min(1.0, seconds))
    this.state.delayTime = clamped
    this.delayNode.delayTime.cancelScheduledValues(Tone.now())
    this.delayNode.delayTime.setValueAtTime(clamped, Tone.now())
    this.notify()
  }

  public setVolume(linear: number) {
    const clamped = Math.max(0, Math.min(1.2, linear))
    this.state.volume = clamped
    this.masterGainNode.gain.cancelScheduledValues(Tone.now())
    this.masterGainNode.gain.setValueAtTime(clamped, Tone.now())
    this.notify()
  }

  public setReverbMix(wet: number) {
    const clamped = Math.max(0, Math.min(1, wet))
    this.state.reverbMix = clamped
    this.reverbNode.wet.cancelScheduledValues(Tone.now())
    this.reverbNode.wet.setValueAtTime(clamped, Tone.now())
    this.notify()
  }

  public setDelayMix(wet: number) {
    const clamped = Math.max(0, Math.min(1, wet))
    this.state.delayMix = clamped
    this.delayNode.wet.cancelScheduledValues(Tone.now())
    this.delayNode.wet.setValueAtTime(clamped, Tone.now())
    this.notify()
  }

  public setResonance(Q: number) {
    const clamped = Math.max(0.1, Math.min(20, Q))
    this.state.resonance = clamped
    this.sweepFilterNode.Q.cancelScheduledValues(Tone.now())
    this.sweepFilterNode.Q.setValueAtTime(clamped, Tone.now())
    this.notify()
  }

  public setPitchBend(semitones: number) {
    const clamped = Math.max(-12, Math.min(12, semitones))
    this.state.pitchBend = clamped
    this.notify()
  }

  public setEqBand(band: 'low' | 'mid' | 'high', params: Partial<EQBandState>) {
    const now = Tone.now()
    if (band === 'low') {
      if (params.freq !== undefined) {
        this.state.eqLow.freq = Math.max(20, Math.min(500, params.freq))
        this.eqLowNode.frequency.setValueAtTime(this.state.eqLow.freq, now)
      }
      if (params.gain !== undefined) {
        this.state.eqLow.gain = Math.max(-24, Math.min(24, params.gain))
        this.eqLowNode.gain.setValueAtTime(this.state.eqLow.gain, now)
      }
      if (params.Q !== undefined) {
        this.state.eqLow.Q = Math.max(0.1, Math.min(10, params.Q))
        this.eqLowNode.Q.setValueAtTime(this.state.eqLow.Q, now)
      }
    } else if (band === 'mid') {
      if (params.freq !== undefined) {
        this.state.eqMid.freq = Math.max(200, Math.min(5000, params.freq))
        this.eqMidNode.frequency.setValueAtTime(this.state.eqMid.freq, now)
      }
      if (params.gain !== undefined) {
        this.state.eqMid.gain = Math.max(-24, Math.min(24, params.gain))
        this.eqMidNode.gain.setValueAtTime(this.state.eqMid.gain, now)
      }
      if (params.Q !== undefined) {
        this.state.eqMid.Q = Math.max(0.1, Math.min(10, params.Q))
        this.eqMidNode.Q.setValueAtTime(this.state.eqMid.Q, now)
      }
    } else if (band === 'high') {
      if (params.freq !== undefined) {
        this.state.eqHigh.freq = Math.max(2000, Math.min(20000, params.freq))
        this.eqHighNode.frequency.setValueAtTime(this.state.eqHigh.freq, now)
      }
      if (params.gain !== undefined) {
        this.state.eqHigh.gain = Math.max(-24, Math.min(24, params.gain))
        this.eqHighNode.gain.setValueAtTime(this.state.eqHigh.gain, now)
      }
      if (params.Q !== undefined) {
        this.state.eqHigh.Q = Math.max(0.1, Math.min(10, params.Q))
        this.eqHighNode.Q.setValueAtTime(this.state.eqHigh.Q, now)
      }
    }
    this.notify()
  }
}

export function getGlobalEffectsBus(): Tone.InputNode {
  return AudioEffectsBus.getInstance().getInputElement()
}

export function getAudioEffectsBus(): AudioEffectsBus {
  return AudioEffectsBus.getInstance()
}
