// Since this is called from Deno as well, we need to use relative paths.
import { Song, Track } from '../../../src/types'
import { getKey } from '../theory'

export function getPitch(midiNote: number): { octave: number; step: string; alter: number } {
  // e.g. Cb3
  const key = getKey(midiNote)
  if (!key) {
    return { step: 'N/A', octave: -1, alter: 0 }
  } else if (key[1] === 'b') {
    return { step: key[0], octave: +key[2], alter: -1 }
  } else {
    return { step: key[0], octave: +key[1], alter: 0 }
  }
}

export function isPiano(t: Track): boolean {
  const program = t.program ?? -1
  return (
    t.instrument?.toLowerCase()?.includes('piano') ||
    t.name?.toLowerCase()?.includes('piano') ||
    (0 <= program && program <= 6)
  )
}
export function parserInferHands(song: Song): { left?: number; right?: number } {
  const trackIds = Object.keys(song.tracks).map(Number)
  if (trackIds.length === 0) {
    return {}
  }
  if (trackIds.length === 1) {
    return { right: trackIds[0] }
  }

  // First, check against known likely left/right names for tracks:
  const trackNames = Object.values(song.tracks).map((track) => track.name ?? '')
  const likelyLeft = ['bass', 'left', 'lh', 'L.H.']
  const likelyRight = ['treble', 'lead', 'rh', 'right', 'R.H.', 'Student']
  const likelyLeftTrack = trackNames.find((name) => likelyLeft.includes(name.toLowerCase()))
  const likelyRightTrack = trackNames.find((name) => likelyRight.includes(name.toLowerCase()))
  if (likelyLeftTrack && likelyRightTrack) {
    const leftId = Object.keys(song.tracks).find(
      (id: any) => song.tracks[id].name === likelyLeftTrack,
    )!
    const rightId = Object.keys(song.tracks).find(
      (id: any) => song.tracks[id].name === likelyRightTrack,
    )!
    return {
      left: +leftId,
      right: +rightId,
    }
  }

  const pianoTracks = Array.from(Object.entries(song.tracks))
    .filter(([_id, track]) => isPiano(track))
    .filter(([id, _track]) => {
      return song.notes.filter((note) => note.track === +id).length > 0
    })

  if (pianoTracks.length === 1) {
    return { right: +pianoTracks[0][0] }
  }

  let t1!: number
  let t2!: number
  if (pianoTracks.length >= 2) {
    ;[t1, t2] = pianoTracks.slice(0, 2).map(([trackId]) => +trackId)
  } else {
    [t1, t2] = trackIds.slice(0, 2)
  }

  if (t1 !== undefined && t2 === undefined) {
    return { right: t1 }
  }

  const sum = (arr: Array<number>) => arr.reduce((a: number, b: number) => a + b, 0)
  const avg = (arr: Array<number>) => (arr.length > 0 ? sum(arr) / arr.length : 0)
  let t1Avg = avg(song.notes.filter((n) => n.track === t1).map((n) => n.midiNote))
  let t2Avg = avg(song.notes.filter((n) => n.track === t2).map((n) => n.midiNote))

  if (t1Avg < t2Avg) {
    return { left: t1, right: t2 }
  }

  return { left: t2, right: t1 }
}
