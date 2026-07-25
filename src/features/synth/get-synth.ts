import { isBrowser } from '@/utils'
import { Tone909DrumMachineSynth } from './drum-machine-909'
import gmInstruments from './instruments'
import { loadInstrument } from './loadInstrument'
import { ToneSamplerSynth } from './tone-synth'
import { InstrumentName, Synth } from './types'

function isValidInstrument(instrument: InstrumentName | undefined) {
  return instrument && gmInstruments.find((s) => s === instrument)
}

export async function getSynth(instrument: InstrumentName | number): Promise<Synth> {
  if (!isBrowser()) {
    return {
      playNote() {},
      stopNote() {},
      setMasterVolume() {},
      getInstrument() {
        return gmInstruments[0]
      },
    }
  }

  if (typeof instrument === 'number') {
    instrument = gmInstruments[instrument]
  }
  if (!isValidInstrument(instrument)) {
    console.log('Invalid instrument: ', instrument, 'reverting to acoustic_grand_piano.')
    instrument = gmInstruments[0]
  }

  if (instrument === 'drum_machine_909') {
    return new Tone909DrumMachineSynth('drum_machine_909')
  }

  const sampler = await loadInstrument(instrument)
  return new ToneSamplerSynth(instrument, sampler)
}

export function getSynthStub(instrument: InstrumentName | number): Synth {
  return new SynthStub(instrument)
}

class SynthStub implements Synth {
  synth: Synth | undefined
  masterVolume: number
  private targetInstrument: InstrumentName

  constructor(instrument: InstrumentName | number) {
    this.masterVolume = 1.0
    if (typeof instrument === 'number') {
      this.targetInstrument = gmInstruments[instrument] || gmInstruments[0]
    } else {
      this.targetInstrument = instrument || gmInstruments[0]
    }

    getSynth(instrument).then((s) => {
      this.synth = s
      this.synth.setMasterVolume(this.masterVolume)
    })
  }

  playNote(note: number, velocity?: number) {
    this.synth?.playNote(note, velocity)
  }

  stopNote(note: number) {
    this.synth?.stopNote(note)
  }

  setMasterVolume(vol: number) {
    this.masterVolume = vol
    this.synth?.setMasterVolume(vol)
  }

  getInstrument(): InstrumentName {
    return this.synth?.getInstrument() ?? this.targetInstrument
  }
}
