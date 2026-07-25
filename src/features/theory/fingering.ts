import type { Song, SongConfig, SongNote } from '@/types'
import { Note as ModelNote, Models, predictFingerings } from '@lumikey/piano-fingering-model'
import * as ort from 'onnxruntime-web'

// Configure single-thread mode and CDN path for WASM backend to prevent security policy/SharedArrayBuffer/Vite routing errors in browser
ort.env.wasm.numThreads = 1
ort.env.wasm.wasmPaths = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.27.0/dist/'

let cachedModels: Models | null = null
let modelLoadingPromise: Promise<Models> | null = null
let isLoading = false

export function isModelLoading(): boolean {
  return isLoading
}

export function areModelsLoaded(): boolean {
  return cachedModels !== null
}

export async function loadFingeringModels(): Promise<Models> {
  if (cachedModels) return cachedModels
  if (modelLoadingPromise) return modelLoadingPromise

  isLoading = true
  modelLoadingPromise = (async () => {
    try {
      console.log('Loading piano fingering ONNX models in browser...')
      const [left, right] = await Promise.all([
        ort.InferenceSession.create('/models/fingering_transformer_left.onnx'),
        ort.InferenceSession.create('/models/fingering_transformer_right.onnx'),
      ])
      cachedModels = { left, right }
      console.log('Piano fingering ONNX models loaded successfully!')
      return cachedModels
    } catch (err) {
      console.error('Failed to load ONNX piano fingering models:', err)
      modelLoadingPromise = null
      throw err
    } finally {
      isLoading = false
    }
  })()

  return modelLoadingPromise
}

function determineIsLeftHand(note: SongNote, config?: SongConfig): boolean {
  if (config?.tracks?.[note.track]) {
    const hand = config.tracks[note.track].hand
    if (hand === 'left') return true
    if (hand === 'right') return false
  }
  // Fallback: default to right hand (false) for sketches/recordings
  return false
}

/**
 * Predict optimal fingerings (1-5) for a Song, respecting any pre-existing manual finger overrides.
 */
export async function predictSongFingerings(song: Song, config?: SongConfig): Promise<Song> {
  if (!song.notes || song.notes.length === 0) {
    return song
  }

  try {
    const models = await loadFingeringModels()

    // Map Loomo notes to model format
    const modelNotes: ModelNote[] = song.notes.map((note) => {
      const left = determineIsLeftHand(note, config)
      return {
        left,
        note: note.midiNote,
        time: Math.round(note.time * 1000), // seconds to ms
        duration: Math.round(note.duration * 1000), // seconds to ms
        velocity: note.velocity ?? 64,
        finger: note.finger, // preserve constraints
      }
    })

    console.log(`Predicting fingerings for ${song.notes.length} notes...`)
    const results = await predictFingerings(modelNotes, models)

    // Create a lookup map by time and pitch
    const fingerLookup = new Map<string, number>()
    for (const r of results) {
      if (r.finger !== undefined && r.finger !== null) {
        fingerLookup.set(`${r.time}-${r.note}`, r.finger)
      }
    }

    // Merge back into original notes array
    const newNotes = song.notes.map((note) => {
      const timeMs = Math.round(note.time * 1000)
      const key = `${timeMs}-${note.midiNote}`
      const finger = fingerLookup.get(key)
      return {
        ...note,
        finger: finger !== undefined ? finger : note.finger,
      }
    })

    const updatedSong: Song = {
      ...song,
      notes: newNotes,
    }

    if (song.items) {
      const measures = song.items.filter((item) => item.type === 'measure')
      updatedSong.items = [...measures, ...newNotes].sort((a, b) => a.time - b.time)
    }

    return updatedSong
  } catch (err) {
    console.error('Prediction failed, returning unmodified song:', err)
    return song
  }
}
