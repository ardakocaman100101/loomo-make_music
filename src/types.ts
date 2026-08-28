import { InstrumentName } from '@/features/synth'
import { KEY_SIGNATURE, NOTE_LABELS } from './features/theory'

export type DifficultyLabel =
  | 'Easiest'
  | 'Easier'
  | 'Easy'
  | 'Medium'
  | 'Hard'
  | 'Hardest'
  // "-" stands for Unknown
  | '-'

export type SongSource = 'local' | 'builtin' | 'generated' | 'base64' | 'upload'
export type SongMetadata = {
  id: string
  file: string
  title: string
  difficulty: number
  duration: number
  source: SongSource
  tags?: string[]
  artist?: string
  url?: string
  license?: string
  handle?: FileSystemFileHandle
}

export interface Size {
  width: number
  height: number
}

export interface Pitch {
  step: string
  octave: number
  alter: number
}

export interface SongNote {
  type: 'note'
  midiNote: number
  track: number
  time: number
  duration: number
  velocity?: number
  measure: number
  finger?: number
  userPressStart?: number
  userPressEnd?: number
  feedbackColor?: string
  durationScore?: number
}

export interface Bpm {
  time: number
  bpm: number
}

export interface Tracks {
  [id: string]: Track
}

export interface Track {
  instrument?: string
  name?: string
  program?: number
  hand?: 'left' | 'right' | 'none'
}

export type SongMeasure = {
  type: 'measure'
  time: number
  duration: number
  number: number
}

export type Song = {
  tracks: Tracks
  duration: number
  measures: Array<SongMeasure>
  notes: Array<SongNote>
  bpms: Array<Bpm>
  timeSignature?: { numerator: number; denominator: number }
  keySignature: KEY_SIGNATURE
  items: Array<SongNote | SongMeasure>
  ppq: number
  secondsToTicks: (seconds: number) => number
  ticksToSeconds: (seconds: number) => number
  backing?: HTMLAudioElement
}

export type Clef = 'bass' | 'treble'
export type VisualizationMode = 'falling-notes' | 'sheet' | 'reverse-waterfall'
export type Hand = 'both' | 'left' | 'right' | 'none'
export type SongConfig = {
  left: boolean
  right: boolean
  waiting: boolean
  visualization: VisualizationMode
  noteLabels: NOTE_LABELS
  coloredNotes: boolean
  skipMissedNotes: boolean
  keySignature?: KEY_SIGNATURE
  tracks: {
    [trackId: number]: TrackSetting
  }
}

export type TrackSetting = {
  track: Track
  hand: 'left' | 'right' | 'none'
  practice: boolean
  sound: boolean
  instrument: InstrumentName
}

export type MidiStateEvent = {
  type: 'down' | 'up' | 'cc'
  note?: number
  time: number
  velocity?: number
  cc?: number
  value?: number
  channel?: number
}

export type HandSettings = {
  [trackId: string]: {
    hand: Hand | 'none'
    practice: boolean
  }
}
