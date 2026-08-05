import { isBrowser } from '@/utils'
import { atom, getDefaultStore } from 'jotai'
import * as Tone from 'tone'
import { getOctave } from '../theory'

type JotaiStore = ReturnType<typeof getDefaultStore>
let store: JotaiStore = getDefaultStore()
export const audioContextEnabledAtom = atom(true)

export function disableAudioContext() {
  store.set(audioContextEnabledAtom, false)
}

export function enableAudioContext() {
  store.set(audioContextEnabledAtom, true)
  if (isBrowser()) {
    Tone.start()
  }
}

export function isAudioContextEnabled() {
  return store.get(audioContextEnabledAtom)
}

export function getAudioContext(): BaseAudioContext {
  return Tone.getContext().rawContext
}

export function getKeyForSoundfont(note: number) {
  const soundFontIndex = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B']
  return soundFontIndex[note % 12] + getOctave(note)
}

if (isBrowser()) {
  const handleUserInteraction = () => {
    try {
      const rawCtx = Tone.getContext().rawContext
      if (rawCtx && rawCtx.state !== 'running') {
        rawCtx.resume()
      }
      if (Tone.getContext().state !== 'running') {
        Tone.start()
      }
    } catch (_) {}
  }
  window.addEventListener('touchstart', handleUserInteraction, { capture: true, passive: true })
  window.addEventListener('touchend', handleUserInteraction, { capture: true, passive: true })
  window.addEventListener('pointerdown', handleUserInteraction, { capture: true, passive: true })
  window.addEventListener('click', handleUserInteraction, { capture: true, passive: true })
  window.addEventListener('keydown', handleUserInteraction, { capture: true, passive: true })
}
