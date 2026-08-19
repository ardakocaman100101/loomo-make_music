import type { Song } from '@/types'
import { Midi } from '@tonejs/midi'

/**
 * Encodes a loomo Song object back into standard MIDI binary data (Uint8Array).
 */
export function songToMidiBytes(song: Partial<Song>): Uint8Array {
  const midi = new Midi()

  // 1. Set name
  midi.name = 'loomou Studio Session'

  // 2. Set Tempos (BPMs)
  if (song.bpms && song.bpms.length > 0) {
    // Set initial tempo
    midi.header.setTempo(song.bpms[0].bpm)

    // Assign tempos array
    midi.header.tempos = song.bpms.map((bpmEvent) => {
      const ticks = song.secondsToTicks
        ? song.secondsToTicks(bpmEvent.time)
        : Math.round(bpmEvent.time * 480 * (bpmEvent.bpm / 60))
      return {
        ticks,
        bpm: bpmEvent.bpm,
      }
    })
  } else {
    midi.header.setTempo(120)
  }

  // 3. Set Time Signature
  if (song.timeSignature) {
    midi.header.timeSignatures = [
      {
        ticks: 0,
        timeSignature: [song.timeSignature.numerator, song.timeSignature.denominator],
      },
    ]
  }

  // 4. Set Key Signature
  if (song.keySignature) {
    midi.header.keySignatures = [
      {
        ticks: 0,
        key: song.keySignature,
        scale: song.keySignature.toLowerCase().includes('minor') ? 'minor' : 'major',
      },
    ]
  }

  midi.header.update()

  // 5. Create tracks and add notes
  const trackIds = Array.from(
    new Set([
      ...Object.keys(song.tracks || {}).map(Number),
      ...(song.notes || []).map((n) => n.track),
    ]),
  ).sort((a, b) => a - b)

  const toneTracks: { [id: number]: any } = {}
  trackIds.forEach((id) => {
    const toneTrack = midi.addTrack()
    toneTracks[id] = toneTrack

    const trackMeta = song.tracks?.[id]
    if (trackMeta) {
      toneTrack.name = trackMeta.name || `Track ${id + 1}`
      if (trackMeta.instrument === 'percussion') {
        toneTrack.channel = 9
      }
      if (trackMeta.program !== undefined) {
        toneTrack.instrument.number = trackMeta.program
      }
    }
  })

  // Add notes
  if (song.notes) {
    song.notes.forEach((note) => {
      const toneTrack = toneTracks[note.track]
      if (toneTrack) {
        toneTrack.addNote({
          midi: note.midiNote,
          time: note.time,
          duration: note.duration,
          velocity: note.velocity !== undefined ? note.velocity / 127 : 0.8,
        })
      }
    })
  }

  return midi.toArray()
}
