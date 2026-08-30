import { EffectsState, getAudioEffectsBus } from '@/features/synth/effects-bus'
import React, { useEffect, useState } from 'react'
import { RotaryKnob } from './RotaryKnob'
import { TouchPitchBend } from './TouchPitchBend'
import { VerticalFader } from './VerticalFader'
import { VisualEQ } from './VisualEQ'

export { StudioTouchPanel } from './StudioTouchPanel'
export { TouchPitchBend, VisualEQ }

export const HardwareControlMatrix: React.FC = () => {
  const [fxState, setFxState] = useState<EffectsState>(() => getAudioEffectsBus().getState())

  useEffect(() => {
    const bus = getAudioEffectsBus()
    const unsubscribe = bus.subscribe((state) => {
      setFxState({ ...state })
    })
    return () => unsubscribe()
  }, [])

  const bus = getAudioEffectsBus()

  // Format Helpers for dynamic knob & fader readouts
  const formatCutoff = (freq: number) => {
    if (freq >= 1000) return `${(freq / 1000).toFixed(1)}k Hz`
    return `${Math.round(freq)} Hz`
  }

  const formatPercent = (val: number) => `${Math.round(val * 100)}%`
  const formatBass = (dB: number) => `+${dB.toFixed(1)} dB`
  const formatDelayTime = (s: number) => `${Math.round(s * 1000)} ms`
  const formatResonance = (Q: number) => `Q:${Q.toFixed(1)}`

  return (
    <div className="flex shrink-0 items-center gap-2.5">
      {/* 1. Discrete Knob Box (Filter Cutoff, Distortion, Bass Boost, Delay Time) */}
      <div className="flex h-28 flex-col justify-center rounded-xl border border-white/10 bg-[#16161d] px-3 py-1.5 shadow-xl backdrop-blur-md">
        <div className="grid grid-cols-2 gap-x-2.5 gap-y-1">
          <RotaryKnob
            label="Cutoff"
            value={fxState.cutoff}
            min={20}
            max={20000}
            displayValue={formatCutoff(fxState.cutoff)}
            onChange={(val) => bus.setCutoff(val)}
          />
          <RotaryKnob
            label="Distortion"
            value={fxState.distortion}
            min={0}
            max={1}
            step={0.01}
            displayValue={formatPercent(fxState.distortion)}
            onChange={(val) => bus.setDistortion(val)}
          />
          <RotaryKnob
            label="Bass Boost"
            value={fxState.bassBoost}
            min={0}
            max={12}
            step={0.1}
            displayValue={formatBass(fxState.bassBoost)}
            onChange={(val) => bus.setBassBoost(val)}
          />
          <RotaryKnob
            label="Delay Time"
            value={fxState.delayTime}
            min={0.01}
            max={1.0}
            step={0.01}
            displayValue={formatDelayTime(fxState.delayTime)}
            onChange={(val) => bus.setDelayTime(val)}
          />
        </div>
      </div>

      {/* 2. Discrete Fader Box (Volume, Reverb, Delay, Resonance) */}
      <div className="flex h-28 flex-col justify-center rounded-xl border border-white/10 bg-[#16161d] px-3 py-1.5 shadow-xl backdrop-blur-md">
        <div className="flex items-center gap-2">
          <VerticalFader
            label="Volume"
            value={fxState.volume}
            min={0}
            max={1.2}
            step={0.01}
            displayValue={formatPercent(fxState.volume / 1.2)}
            onChange={(val) => bus.setVolume(val)}
          />
          <VerticalFader
            label="Reverb"
            value={fxState.reverbMix}
            min={0}
            max={1}
            step={0.01}
            displayValue={formatPercent(fxState.reverbMix)}
            onChange={(val) => bus.setReverbMix(val)}
          />
          <VerticalFader
            label="Delay"
            value={fxState.delayMix}
            min={0}
            max={1}
            step={0.01}
            displayValue={formatPercent(fxState.delayMix)}
            onChange={(val) => bus.setDelayMix(val)}
          />
          <VerticalFader
            label="RES."
            value={fxState.resonance}
            min={0.1}
            max={20}
            step={0.1}
            displayValue={formatResonance(fxState.resonance)}
            onChange={(val) => bus.setResonance(val)}
          />
        </div>
      </div>
    </div>
  )
}

export const StudioEffectsBar = HardwareControlMatrix
