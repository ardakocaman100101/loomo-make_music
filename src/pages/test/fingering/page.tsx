import { parseMidi } from '@/features/parsers'
import { loadFingeringModels, predictSongFingerings } from '@/features/theory/fingering'
import { Song, SongConfig, SongNote } from '@/types'
import {
  AlertCircle,
  ArrowLeft,
  Check,
  ChevronDown,
  Clock,
  Code2,
  Copy,
  Download,
  FastForward,
  FileCode2,
  FileMusic,
  Fingerprint,
  Gauge,
  Info,
  Loader2,
  Maximize2,
  Minimize2,
  Minus,
  Play,
  Plus,
  RotateCcw,
  Sliders,
  Sparkles,
  Table as TableIcon,
  Upload,
} from 'lucide-react'
import React, { useCallback, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router'

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']

export function midiToNoteName(midi: number): string {
  const octave = Math.floor(midi / 12) - 1
  const noteIndex = Math.abs(midi % 12)
  return `${NOTE_NAMES[noteIndex]}${octave}`
}

const FINGER_NAMES: Record<number, string> = {
  1: 'Thumb',
  2: 'Index',
  3: 'Middle',
  4: 'Ring',
  5: 'Pinky',
}

const FINGER_COLORS: Record<number, { bg: string; text: string; border: string; bar: string }> = {
  1: { bg: 'bg-amber-500/15', text: 'text-amber-400', border: 'border-amber-500/30', bar: '#f59e0b' },
  2: { bg: 'bg-emerald-500/15', text: 'text-emerald-400', border: 'border-emerald-500/30', bar: '#10b981' },
  3: { bg: 'bg-sky-500/15', text: 'text-sky-400', border: 'border-sky-500/30', bar: '#0ea5e9' },
  4: { bg: 'bg-purple-500/15', text: 'text-purple-400', border: 'border-purple-500/30', bar: '#a855f7' },
  5: { bg: 'bg-rose-500/15', text: 'text-rose-400', border: 'border-rose-500/30', bar: '#f43f5e' },
}

type JsonFormat = 'tuple' | 'compact-obj' | 'short-keys' | 'detailed'
type Precision = 2 | 3 | 4 | 'exact'
type TimeUnit = 'seconds' | 'ms'

interface ProcessedNote {
  index: number
  pitchName: string
  midi: number
  from: number // Normalized to t0 = 0 in base MIDI seconds
  to: number
  duration: number
  finger: number
  track: number
  velocity: number
}

export default function FingeringTestPage() {
  const [fileData, setFileData] = useState<{ name: string; size: number } | null>(null)
  const [song, setSong] = useState<Song | null>(null)
  const [processedNotes, setProcessedNotes] = useState<ProcessedNote[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [statusMessage, setStatusMessage] = useState<string>('')
  const [benchmark, setBenchmark] = useState<{
    parseTimeMs: number
    inferenceTimeMs: number
    totalNotes: number
  } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [timeOffset, setTimeOffset] = useState<number>(0)

  // Tempo (BPM) settings
  const [originalBpm, setOriginalBpm] = useState<number>(120)
  const [tempo, setTempo] = useState<number>(120)

  // Output formatting settings
  const [jsonFormat, setJsonFormat] = useState<JsonFormat>('tuple')
  const [precision, setPrecision] = useState<Precision>(3)
  const [timeUnit, setTimeUnit] = useState<TimeUnit>('seconds')
  const [isMinified, setIsMinified] = useState(false)

  // UI tabs & controls
  const [activeTab, setActiveTab] = useState<'json' | 'table' | 'visualizer'>('json')
  const [tableSearch, setTableSearch] = useState('')
  const [copied, setCopied] = useState(false)
  const [isDragging, setIsDragging] = useState(false)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const rawBytesRef = useRef<Uint8Array | null>(null)

  // Speed multiplier derived from tempo
  const speedRatio = useMemo(() => {
    return originalBpm > 0 && tempo > 0 ? originalBpm / tempo : 1
  }, [originalBpm, tempo])

  const runFingeringPipeline = useCallback(async (parsedSong: Song) => {
    setIsLoading(true)
    setError(null)
    try {
      setStatusMessage('Loading ONNX neural models...')
      const tStart = performance.now()
      await loadFingeringModels()

      setStatusMessage(`Predicting right-hand fingerings for ${parsedSong.notes.length} notes...`)
      const tInferStart = performance.now()

      // Configure all tracks for Right Hand
      const trackSettings: SongConfig['tracks'] = {}
      Object.keys(parsedSong.tracks).forEach((tId) => {
        const idNum = Number(tId)
        trackSettings[idNum] = {
          track: parsedSong.tracks[tId],
          hand: 'right',
          practice: true,
          sound: true,
          instrument: 'acoustic_grand_piano',
        }
      })

      const config: SongConfig = {
        left: false,
        right: true,
        waiting: false,
        visualization: 'falling-notes',
        noteLabels: 'None' as any,
        coloredNotes: true,
        skipMissedNotes: false,
        tracks: trackSettings,
      }

      // Ensure all notes are marked as right hand
      const rightHandSong: Song = {
        ...parsedSong,
        notes: parsedSong.notes.map((n) => ({
          ...n,
          track: 0,
        })),
      }

      const predicted = await predictSongFingerings(rightHandSong, config)
      const tInferEnd = performance.now()

      // Normalize first note's start time to 0 (all timestamps referenced from t0 = 0)
      const minStartTime =
        predicted.notes.length > 0 ? Math.min(...predicted.notes.map((n) => n.time)) : 0
      setTimeOffset(minStartTime)

      // Map into processed notes with normalized timestamps
      const mapped: ProcessedNote[] = predicted.notes
        .map((n, idx) => {
          const normalizedFrom = Math.max(0, n.time - minStartTime)
          const normalizedTo = normalizedFrom + n.duration
          return {
            index: idx + 1,
            pitchName: midiToNoteName(n.midiNote),
            midi: n.midiNote,
            from: normalizedFrom,
            to: normalizedTo,
            duration: n.duration,
            finger: n.finger || 1,
            track: n.track,
            velocity: Math.round(n.velocity || 64),
          }
        })
        .sort((a, b) => a.from - b.from || a.midi - b.midi)
        .map((n, idx) => ({ ...n, index: idx + 1 }))

      setProcessedNotes(mapped)
      setSong(predicted)
      setBenchmark((prev) => ({
        parseTimeMs: prev?.parseTimeMs || 0,
        inferenceTimeMs: Math.round(tInferEnd - tInferStart),
        totalNotes: mapped.length,
      }))
      setStatusMessage('')
    } catch (err: any) {
      console.error('Fingering prediction error:', err)
      setError(err?.message || 'Failed to run fingering prediction.')
    } finally {
      setIsLoading(false)
    }
  }, [])

  const processMidiBytes = useCallback(
    async (bytes: Uint8Array, fileName: string) => {
      setIsLoading(true)
      setError(null)
      setStatusMessage('Parsing MIDI file structure...')
      rawBytesRef.current = bytes
      setFileData({ name: fileName, size: bytes.byteLength })

      try {
        const t0 = performance.now()
        const parsed = parseMidi(bytes as any)
        const t1 = performance.now()

        if (!parsed.notes || parsed.notes.length === 0) {
          throw new Error('No musical notes found in this MIDI file.')
        }

        // Detect initial BPM
        const detectedBpm = Math.round(parsed.bpms?.[0]?.bpm || 120)
        setOriginalBpm(detectedBpm)
        setTempo(detectedBpm)

        setBenchmark({
          parseTimeMs: Math.round(t1 - t0),
          inferenceTimeMs: 0,
          totalNotes: parsed.notes.length,
        })

        await runFingeringPipeline(parsed)
      } catch (err: any) {
        console.error('MIDI parse error:', err)
        setError(err?.message || 'Failed to parse MIDI file.')
        setIsLoading(false)
      }
    },
    [runFingeringPipeline],
  )

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (!file) return
      const reader = new FileReader()
      reader.onload = () => {
        if (reader.result instanceof ArrayBuffer) {
          processMidiBytes(new Uint8Array(reader.result), file.name)
        }
      }
      reader.readAsArrayBuffer(file)
      e.target.value = ''
    },
    [processMidiBytes],
  )

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault()
      setIsDragging(false)
      const file = e.dataTransfer.files?.[0]
      if (file && (file.name.endsWith('.mid') || file.name.endsWith('.midi') || file.type.includes('midi'))) {
        const reader = new FileReader()
        reader.onload = () => {
          if (reader.result instanceof ArrayBuffer) {
            processMidiBytes(new Uint8Array(reader.result), file.name)
          }
        }
        reader.readAsArrayBuffer(file)
      } else {
        setError('Please drop a valid .mid or .midi file.')
      }
    },
    [processMidiBytes],
  )

  const loadSampleMidi = useCallback(
    async (sampleUrl: string, name: string) => {
      setIsLoading(true)
      setError(null)
      setStatusMessage(`Fetching sample: ${name}...`)
      try {
        const res = await fetch(sampleUrl)
        if (!res.ok) throw new Error(`HTTP ${res.status}: Failed to download sample file`)
        const buf = await res.arrayBuffer()
        await processMidiBytes(new Uint8Array(buf), name)
      } catch (err: any) {
        setError(`Failed to load sample: ${err.message}`)
        setIsLoading(false)
      }
    },
    [processMidiBytes],
  )

  // Scaled notes accounting for Tempo (BPM)
  const tempoScaledNotes = useMemo(() => {
    return processedNotes.map((n) => {
      const scaledFrom = n.from * speedRatio
      const scaledTo = n.to * speedRatio
      const scaledDuration = n.duration * speedRatio
      return {
        ...n,
        from: scaledFrom,
        to: scaledTo,
        duration: scaledDuration,
      }
    })
  }, [processedNotes, speedRatio])

  // Total Duration in scaled seconds
  const totalNormalizedDuration = useMemo(() => {
    if (tempoScaledNotes.length === 0) return 0
    return Math.max(...tempoScaledNotes.map((n) => n.to))
  }, [tempoScaledNotes])

  // Generate Compact JSON
  const compactJsonString = useMemo(() => {
    if (tempoScaledNotes.length === 0) return ''

    const roundVal = (v: number): number => {
      const multiplier = timeUnit === 'ms' ? 1000 : 1
      const val = v * multiplier
      if (precision === 'exact') return val
      const factor = Math.pow(10, precision)
      return Math.round(val * factor) / factor
    }

    let outputData: any

    switch (jsonFormat) {
      case 'tuple': {
        // [note, from, to, finger]
        outputData = tempoScaledNotes.map((n) => [
          n.midi,
          roundVal(n.from),
          roundVal(n.to),
          n.finger,
        ])
        break
      }
      case 'compact-obj': {
        // {"n": 60, "from": 0, "to": 0.75, "f": 1}
        outputData = tempoScaledNotes.map((n) => ({
          n: n.midi,
          from: roundVal(n.from),
          to: roundVal(n.to),
          f: n.finger,
        }))
        break
      }
      case 'short-keys': {
        // {"note": 60, "start": 0, "end": 0.75, "finger": 1}
        outputData = tempoScaledNotes.map((n) => ({
          note: n.midi,
          start: roundVal(n.from),
          end: roundVal(n.to),
          finger: n.finger,
        }))
        break
      }
      case 'detailed': {
        // Full descriptive note objects
        outputData = tempoScaledNotes.map((n) => ({
          pitch: n.pitchName,
          midi: n.midi,
          from: roundVal(n.from),
          to: roundVal(n.to),
          duration: roundVal(n.duration),
          finger: n.finger,
          fingerName: FINGER_NAMES[n.finger] || 'Unknown',
          track: n.track,
          velocity: n.velocity,
        }))
        break
      }
    }

    return isMinified ? JSON.stringify(outputData) : JSON.stringify(outputData, null, 2)
  }, [tempoScaledNotes, jsonFormat, precision, timeUnit, isMinified])

  const copyToClipboard = useCallback(() => {
    if (!compactJsonString) return
    navigator.clipboard.writeText(compactJsonString)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [compactJsonString])

  const downloadJsonFile = useCallback(() => {
    if (!compactJsonString) return
    const baseName = fileData?.name ? fileData.name.replace(/\.[^/.]+$/, '') : 'midi_fingerings'
    const fileName = `${baseName}_bpm${tempo}_fingerings_${jsonFormat}.json`
    const blob = new Blob([compactJsonString], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = fileName
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }, [compactJsonString, fileData, tempo, jsonFormat])

  // Filtered notes for the table view
  const filteredNotes = useMemo(() => {
    return tempoScaledNotes.filter((n) => {
      if (tableSearch.trim()) {
        const query = tableSearch.toLowerCase().trim()
        const matchPitch = n.pitchName.toLowerCase().includes(query)
        const matchMidi = String(n.midi).includes(query)
        const matchFinger = String(n.finger).includes(query)
        return matchPitch || matchMidi || matchFinger
      }
      return true
    })
  }, [tempoScaledNotes, tableSearch])

  // Finger distributions
  const fingerStats = useMemo(() => {
    const counts: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
    tempoScaledNotes.forEach((n) => {
      if (n.finger >= 1 && n.finger <= 5) {
        counts[n.finger] = (counts[n.finger] || 0) + 1
      }
    })
    return { counts, total: tempoScaledNotes.length }
  }, [tempoScaledNotes])

  return (
    <div className="min-h-screen bg-[#121118] text-[#e5e2e1] flex flex-col font-sans selection:bg-[#a078ff]/30 selection:text-white">
      {/* Top Header Navigation */}
      <header className="border-b border-[#2d2938] bg-[#1a1724]/90 backdrop-blur-md sticky top-0 z-40 px-6 py-3.5 flex items-center justify-between shadow-lg">
        <div className="flex items-center gap-4">
          <Link
            to="/songs"
            className="flex items-center gap-2 text-sm text-[#cbc3d7]/70 hover:text-white transition-colors bg-[#252233] px-3 py-1.5 rounded-lg border border-[#373249]"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Songs</span>
          </Link>
          <div className="h-4 w-[1px] bg-[#373249]" />
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-[#7c3aed] to-[#a855f7] flex items-center justify-center shadow-md shadow-purple-900/30">
              <Fingerprint className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-bold text-white tracking-wide">MIDI Fingering Algorithm Test Bench</h1>
                <span className="text-[10px] font-semibold tracking-wider uppercase px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30">
                  Right Hand • ONNX WASM
                </span>
              </div>
              <p className="text-xs text-[#cbc3d7]/60">
                Input MIDI &rarr; Right Hand Transformer Model &rarr; Normalized ($t_0=0$) Compact JSON
              </p>
            </div>
          </div>
        </div>

        {/* Quick Sample Button */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => loadSampleMidi('/music/songs/fur-elise.mid', 'Für Elise (Beethoven)')}
            disabled={isLoading}
            className="text-xs flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#2c273e] hover:bg-[#38314e] text-purple-200 border border-purple-500/20 transition-all shadow-sm cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5 text-purple-400" />
            <span>Load &quot;Für Elise&quot; Sample</span>
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-6 space-y-6">
        {/* Error Banner */}
        {error && (
          <div className="flex items-center gap-3 p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 animate-in fade-in">
            <AlertCircle className="w-5 h-5 flex-shrink-0 text-red-400" />
            <div className="text-sm">{error}</div>
          </div>
        )}

        {/* Top Control Grid: File Input + Tempo Control */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* File Upload Dropzone (5 cols) */}
          <div className="lg:col-span-5 flex flex-col">
            <div
              onDragOver={(e) => {
                e.preventDefault()
                setIsDragging(true)
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`relative flex-1 min-h-[220px] rounded-2xl border-2 border-dashed transition-all cursor-pointer flex flex-col items-center justify-center p-6 text-center ${
                isDragging
                  ? 'border-purple-500 bg-purple-500/15 scale-[1.01]'
                  : fileData
                    ? 'border-purple-500/40 bg-[#1c1829] hover:border-purple-500/60'
                    : 'border-[#373249] bg-[#191624] hover:border-[#524a6b] hover:bg-[#201c2e]'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".mid,.midi,audio/midi,audio/x-midi"
                onChange={handleFileChange}
                className="hidden"
              />

              <div className="w-14 h-14 rounded-2xl bg-[#2b253d] border border-purple-500/30 flex items-center justify-center mb-3 shadow-inner">
                {isLoading ? (
                  <Loader2 className="w-7 h-7 text-purple-400 animate-spin" />
                ) : fileData ? (
                  <FileMusic className="w-7 h-7 text-purple-400" />
                ) : (
                  <Upload className="w-7 h-7 text-[#cbc3d7]/70" />
                )}
              </div>

              {isLoading ? (
                <div className="space-y-1">
                  <div className="font-semibold text-sm text-purple-200">{statusMessage || 'Processing...'}</div>
                  <div className="text-xs text-[#cbc3d7]/50">Executing Right-Hand ONNX transformer</div>
                </div>
              ) : fileData ? (
                <div className="space-y-1">
                  <div className="font-semibold text-sm text-white flex items-center justify-center gap-1.5">
                    <span>{fileData.name}</span>
                    <span className="text-xs text-purple-300 font-normal">
                      ({(fileData.size / 1024).toFixed(1)} KB)
                    </span>
                  </div>
                  <div className="text-xs text-[#cbc3d7]/60">Click or drop another MIDI file to replace</div>
                </div>
              ) : (
                <div className="space-y-1">
                  <div className="font-semibold text-sm text-white">Click to upload or drag & drop MIDI</div>
                  <div className="text-xs text-[#cbc3d7]/60">Right-hand finger prediction • Auto normalized to 0</div>
                </div>
              )}
            </div>
          </div>

          {/* Tempo (BPM) & Timing Controls (7 cols) */}
          <div className="lg:col-span-7 bg-[#1c1829] rounded-2xl border border-[#2e2a3d] p-5 flex flex-col justify-between shadow-xl">
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-[#2d2938] pb-3">
                <div className="flex items-center gap-2">
                  <Gauge className="w-4 h-4 text-purple-400" />
                  <h2 className="text-sm font-semibold text-white">Tempo & Timing Calibration</h2>
                </div>
                {benchmark && (
                  <div className="flex items-center gap-3 text-xs text-[#cbc3d7]/70">
                    <span>
                      Parse: <strong className="text-purple-300">{benchmark.parseTimeMs}ms</strong>
                    </span>
                    <span>
                      Inference: <strong className="text-purple-300">{benchmark.inferenceTimeMs}ms</strong>
                    </span>
                    <span>
                      Notes: <strong className="text-purple-300">{benchmark.totalNotes}</strong>
                    </span>
                    <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 font-semibold text-[10px]">
                      $t_0$ = 0.00s
                    </span>
                  </div>
                )}
              </div>

              {/* Tempo Controller Card */}
              <div className="bg-[#14121f] p-4 rounded-xl border border-[#2d2938] space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-purple-400" />
                    <span className="text-xs font-semibold text-white">Playback Tempo (BPM)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-[#cbc3d7]/60">MIDI Original: {originalBpm} BPM</span>
                    {tempo !== originalBpm && (
                      <button
                        type="button"
                        onClick={() => setTempo(originalBpm)}
                        className="text-[11px] text-purple-400 hover:text-purple-300 underline cursor-pointer"
                      >
                        Reset
                      </button>
                    )}
                  </div>
                </div>

                {/* Slider + BPM Input + Nudge */}
                <div className="flex items-center gap-4">
                  <button
                    type="button"
                    onClick={() => setTempo((t) => Math.max(30, t - 5))}
                    className="p-2 rounded-lg bg-[#252136] hover:bg-[#312b47] border border-[#3d3754] text-[#cbc3d7] transition-all cursor-pointer"
                    title="-5 BPM"
                  >
                    <Minus className="w-4 h-4" />
                  </button>

                  <input
                    type="range"
                    min="30"
                    max="280"
                    value={tempo}
                    onChange={(e) => setTempo(Number(e.target.value))}
                    className="flex-1 accent-purple-500 cursor-pointer h-2 bg-[#252136] rounded-lg"
                  />

                  <button
                    type="button"
                    onClick={() => setTempo((t) => Math.min(280, t + 5))}
                    className="p-2 rounded-lg bg-[#252136] hover:bg-[#312b47] border border-[#3d3754] text-[#cbc3d7] transition-all cursor-pointer"
                    title="+5 BPM"
                  >
                    <Plus className="w-4 h-4" />
                  </button>

                  <div className="flex items-center gap-1 bg-[#1a1726] border border-purple-500/40 rounded-xl px-3 py-1.5 shadow-inner">
                    <input
                      type="number"
                      min="30"
                      max="300"
                      value={tempo}
                      onChange={(e) => setTempo(Math.max(20, Math.min(300, Number(e.target.value) || 120)))}
                      className="w-14 bg-transparent text-right font-mono font-bold text-sm text-purple-200 focus:outline-none"
                    />
                    <span className="text-xs text-purple-400 font-semibold">BPM</span>
                  </div>
                </div>

                {/* Speed Multipliers and Timing Info */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                  <div className="flex items-center gap-1.5">
                    {[
                      { label: '0.5x', factor: 0.5 },
                      { label: '0.75x', factor: 0.75 },
                      { label: '1.0x', factor: 1.0 },
                      { label: '1.25x', factor: 1.25 },
                      { label: '1.5x', factor: 1.5 },
                      { label: '2.0x', factor: 2.0 },
                    ].map((preset) => {
                      const targetBpm = Math.round(originalBpm * preset.factor)
                      const isSelected = tempo === targetBpm
                      return (
                        <button
                          key={preset.label}
                          type="button"
                          onClick={() => setTempo(targetBpm)}
                          className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all cursor-pointer ${
                            isSelected
                              ? 'bg-purple-600 text-white shadow-sm'
                              : 'bg-[#1c1929] text-[#cbc3d7]/70 hover:bg-[#28243b] hover:text-white border border-[#373249]'
                          }`}
                        >
                          {preset.label}
                        </button>
                      )
                    })}
                  </div>

                  <div className="text-xs text-[#cbc3d7]/70">
                    Duration: <strong className="text-white">{totalNormalizedDuration.toFixed(2)}s</strong>
                    {tempo !== originalBpm && (
                      <span className="text-purple-300 ml-1.5 text-[11px]">
                        (Scale: {(originalBpm / (tempo || 1)).toFixed(2)}&times;)
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Fingering Distribution Summary */}
              {tempoScaledNotes.length > 0 && (
                <div>
                  <div className="text-xs text-[#cbc3d7]/80 mb-1.5">
                    Right Hand Finger Distribution:
                  </div>
                  <div className="grid grid-cols-5 gap-2">
                    {[1, 2, 3, 4, 5].map((f) => {
                      const count = fingerStats.counts[f] || 0
                      const pct = Math.round((count / (fingerStats.total || 1)) * 100)
                      const styling = FINGER_COLORS[f]
                      return (
                        <div
                          key={f}
                          className={`p-2 rounded-lg border ${styling.border} ${styling.bg} flex flex-col items-center justify-center`}
                        >
                          <div className="flex items-center gap-1">
                            <span className={`text-xs font-bold ${styling.text}`}>#{f}</span>
                            <span className="text-[10px] text-[#cbc3d7]/60">{FINGER_NAMES[f]}</span>
                          </div>
                          <div className="text-xs font-semibold text-white mt-0.5">
                            {count}{' '}
                            <span className="text-[10px] font-normal text-[#cbc3d7]/50">({pct}%)</span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Re-run button */}
            <div className="mt-4 flex items-center justify-end gap-3 pt-3 border-t border-[#2d2938]">
              {song && (
                <button
                  type="button"
                  disabled={isLoading}
                  onClick={() => runFingeringPipeline(song)}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#7c3aed] hover:bg-[#6d28d9] text-white font-medium text-xs shadow-lg shadow-purple-900/30 transition-all disabled:opacity-50 cursor-pointer"
                >
                  {isLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5 fill-current" />}
                  <span>Re-run Fingering Model</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Results Section */}
        {tempoScaledNotes.length > 0 && (
          <div className="space-y-4">
            {/* View Tabs & Format Bar */}
            <div className="bg-[#1c1829] rounded-2xl border border-[#2e2a3d] p-4 flex flex-wrap items-center justify-between gap-4 shadow-xl">
              {/* Tabs */}
              <div className="flex items-center gap-1 bg-[#13111c] p-1 rounded-xl border border-[#2d2938]">
                <button
                  type="button"
                  onClick={() => setActiveTab('json')}
                  className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    activeTab === 'json'
                      ? 'bg-[#7c3aed] text-white shadow-md'
                      : 'text-[#cbc3d7]/70 hover:text-white hover:bg-[#1f1b2c]'
                  }`}
                >
                  <Code2 className="w-3.5 h-3.5" />
                  <span>Compact JSON Output</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('table')}
                  className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    activeTab === 'table'
                      ? 'bg-[#7c3aed] text-white shadow-md'
                      : 'text-[#cbc3d7]/70 hover:text-white hover:bg-[#1f1b2c]'
                  }`}
                >
                  <TableIcon className="w-3.5 h-3.5" />
                  <span>Notes Table ({tempoScaledNotes.length})</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('visualizer')}
                  className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    activeTab === 'visualizer'
                      ? 'bg-[#7c3aed] text-white shadow-md'
                      : 'text-[#cbc3d7]/70 hover:text-white hover:bg-[#1f1b2c]'
                  }`}
                >
                  <FileCode2 className="w-3.5 h-3.5" />
                  <span>Piano Roll Timeline</span>
                </button>
              </div>

              {/* Format Controls (when JSON tab is active) */}
              {activeTab === 'json' && (
                <div className="flex flex-wrap items-center gap-3">
                  {/* Format Selector */}
                  <div className="flex items-center gap-1.5 text-xs">
                    <span className="text-[#cbc3d7]/60">Format:</span>
                    <select
                      value={jsonFormat}
                      onChange={(e) => setJsonFormat(e.target.value as JsonFormat)}
                      className="bg-[#13111c] border border-[#373249] rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-purple-500"
                    >
                      <option value="tuple">Tuple Array [note, from, to, finger] (Ultra Compact)</option>
                      <option value="compact-obj">Compact Object [&#123; n, from, to, f &#125;]</option>
                      <option value="short-keys">Short Keys [&#123; note, start, end, finger &#125;]</option>
                      <option value="detailed">Detailed [&#123; pitch, midi, from, to, finger, ... &#125;]</option>
                    </select>
                  </div>

                  {/* Precision */}
                  <div className="flex items-center gap-1.5 text-xs">
                    <span className="text-[#cbc3d7]/60">Decimals:</span>
                    <select
                      value={precision}
                      onChange={(e) => setPrecision(e.target.value === 'exact' ? 'exact' : (Number(e.target.value) as Precision))}
                      className="bg-[#13111c] border border-[#373249] rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:border-purple-500"
                    >
                      <option value={2}>2 decimals (0.01s)</option>
                      <option value={3}>3 decimals (1ms)</option>
                      <option value={4}>4 decimals (0.1ms)</option>
                      <option value="exact">Exact float</option>
                    </select>
                  </div>

                  {/* Time Unit */}
                  <div className="flex items-center gap-1.5 text-xs">
                    <span className="text-[#cbc3d7]/60">Unit:</span>
                    <select
                      value={timeUnit}
                      onChange={(e) => setTimeUnit(e.target.value as TimeUnit)}
                      className="bg-[#13111c] border border-[#373249] rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:border-purple-500"
                    >
                      <option value="seconds">Seconds (s)</option>
                      <option value="ms">Milliseconds (ms)</option>
                    </select>
                  </div>

                  {/* Minify Toggle */}
                  <label className="flex items-center gap-1.5 text-xs text-[#cbc3d7]/80 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={isMinified}
                      onChange={(e) => setIsMinified(e.target.checked)}
                      className="rounded border-[#373249] bg-[#13111c] text-purple-600 focus:ring-0 cursor-pointer"
                    />
                    <span>Minify</span>
                  </label>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={copyToClipboard}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#252136] hover:bg-[#312b47] border border-[#3d3754] text-xs font-semibold text-white transition-all shadow-sm cursor-pointer"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-purple-400" />}
                  <span>{copied ? 'Copied!' : 'Copy JSON'}</span>
                </button>
                <button
                  type="button"
                  onClick={downloadJsonFile}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#7c3aed] hover:bg-[#6d28d9] text-xs font-semibold text-white transition-all shadow-md shadow-purple-900/20 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download .json</span>
                </button>
              </div>
            </div>

            {/* TAB 1: JSON Output Viewer */}
            {activeTab === 'json' && (
              <div className="bg-[#151320] rounded-2xl border border-[#2e2a3d] overflow-hidden shadow-2xl">
                <div className="bg-[#1a1726] px-4 py-2.5 border-b border-[#2d2938] flex items-center justify-between text-xs text-[#cbc3d7]/70">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-purple-300">
                      {jsonFormat === 'tuple'
                        ? '[midiNote, startTimestamp, endTimestamp, finger]'
                        : jsonFormat === 'compact-obj'
                          ? '[{ n, from, to, f }]'
                          : jsonFormat === 'short-keys'
                            ? '[{ note, start, end, finger }]'
                            : 'Detailed JSON Schema'}
                    </span>
                    <span className="text-[11px] text-purple-400/80">
                      • Tempo: {tempo} BPM (Scale: {(originalBpm / (tempo || 1)).toFixed(2)}&times;)
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span>
                      Size: <strong className="text-white">{(compactJsonString.length / 1024).toFixed(1)} KB</strong> ({compactJsonString.length.toLocaleString()} chars)
                    </span>
                    <span>
                      Total Notes: <strong className="text-white">{tempoScaledNotes.length}</strong>
                    </span>
                  </div>
                </div>
                <div className="p-4 overflow-auto max-h-[600px] font-mono text-xs text-[#d0bcff] bg-[#110f1a] leading-relaxed">
                  <pre className="whitespace-pre-wrap select-all">{compactJsonString}</pre>
                </div>
              </div>
            )}

            {/* TAB 2: Table Viewer */}
            {activeTab === 'table' && (
              <div className="bg-[#1c1829] rounded-2xl border border-[#2e2a3d] overflow-hidden shadow-2xl space-y-3 p-4">
                {/* Search & Info */}
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      placeholder="Filter by note (e.g. C4, 60, finger #)..."
                      value={tableSearch}
                      onChange={(e) => setTableSearch(e.target.value)}
                      className="bg-[#13111c] border border-[#373249] rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-purple-500 w-64"
                    />
                  </div>
                  <div className="text-xs text-[#cbc3d7]/60">
                    Showing {filteredNotes.length} of {tempoScaledNotes.length} notes (Tempo: {tempo} BPM)
                  </div>
                </div>

                {/* Table */}
                <div className="overflow-x-auto max-h-[500px] rounded-xl border border-[#2d2938]">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-[#14121f] text-[#cbc3d7]/80 sticky top-0 border-b border-[#2d2938]">
                      <tr>
                        <th className="py-2.5 px-3">#</th>
                        <th className="py-2.5 px-3">Pitch</th>
                        <th className="py-2.5 px-3">MIDI</th>
                        <th className="py-2.5 px-3">From ({timeUnit === 'ms' ? 'ms' : 's'})</th>
                        <th className="py-2.5 px-3">To ({timeUnit === 'ms' ? 'ms' : 's'})</th>
                        <th className="py-2.5 px-3">Duration ({timeUnit === 'ms' ? 'ms' : 's'})</th>
                        <th className="py-2.5 px-3">Finger (Right Hand 1-5)</th>
                        <th className="py-2.5 px-3">Velocity</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#252136]">
                      {filteredNotes.map((note) => {
                        const styling = FINGER_COLORS[note.finger] || FINGER_COLORS[1]
                        const mul = timeUnit === 'ms' ? 1000 : 1
                        const prec = typeof precision === 'number' ? precision : 3
                        return (
                          <tr key={note.index} className="hover:bg-[#252038]/50 transition-colors">
                            <td className="py-2 px-3 text-[#cbc3d7]/50 font-mono">{note.index}</td>
                            <td className="py-2 px-3 font-bold text-white">{note.pitchName}</td>
                            <td className="py-2 px-3 font-mono text-[#cbc3d7]/70">{note.midi}</td>
                            <td className="py-2 px-3 font-mono text-[#cbc3d7]/90">
                              {(note.from * mul).toFixed(prec)}
                            </td>
                            <td className="py-2 px-3 font-mono text-[#cbc3d7]/90">
                              {(note.to * mul).toFixed(prec)}
                            </td>
                            <td className="py-2 px-3 font-mono text-[#cbc3d7]/70">
                              {(note.duration * mul).toFixed(prec)}
                            </td>
                            <td className="py-2 px-3">
                              <span
                                className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold border ${styling.border} ${styling.bg} ${styling.text}`}
                              >
                                <span>Finger {note.finger}</span>
                                <span className="text-[10px] font-normal opacity-75">
                                  ({FINGER_NAMES[note.finger]})
                                </span>
                              </span>
                            </td>
                            <td className="py-2 px-3 font-mono text-[#cbc3d7]/60">{note.velocity}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* TAB 3: Visualizer */}
            {activeTab === 'visualizer' && (
              <div className="bg-[#1c1829] rounded-2xl border border-[#2e2a3d] p-5 shadow-2xl space-y-4">
                <div className="flex items-center justify-between text-xs text-[#cbc3d7]/70">
                  <div className="flex items-center gap-4">
                    <span className="font-semibold text-white">Visual Piano Roll (Colored by Finger):</span>
                    <div className="flex items-center gap-2">
                      {[1, 2, 3, 4, 5].map((f) => (
                        <div key={f} className="flex items-center gap-1">
                          <span
                            className="w-2.5 h-2.5 rounded-full inline-block"
                            style={{ backgroundColor: FINGER_COLORS[f].bar }}
                          />
                          <span className="text-[10px] text-[#cbc3d7]/70">F{f}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <span>
                    Total Span: {totalNormalizedDuration.toFixed(2)}s ($t_0$ = 0.00s @ {tempo} BPM)
                  </span>
                </div>

                {/* Visual Timeline Strip */}
                <div className="relative h-64 bg-[#110f1a] rounded-xl border border-[#2d2938] overflow-x-auto overflow-y-hidden p-2">
                  <div
                    className="relative h-full"
                    style={{
                      width: `${Math.max(800, (totalNormalizedDuration + 1) * 120)}px`,
                    }}
                  >
                    {/* Time Grid Lines */}
                    {Array.from({
                      length: Math.ceil(totalNormalizedDuration) + 1,
                    }).map((_, sec) => (
                      <div
                        key={sec}
                        className="absolute top-0 bottom-0 border-l border-white/5 text-[9px] font-mono text-white/30 pl-1"
                        style={{ left: `${sec * 120}px` }}
                      >
                        {sec}s
                      </div>
                    ))}

                    {/* Note Blocks */}
                    {tempoScaledNotes.map((note) => {
                      const minPitch = 21 // A0
                      const maxPitch = 108 // C8
                      const pitchRange = maxPitch - minPitch
                      const topPercent = 100 - ((note.midi - minPitch) / pitchRange) * 100
                      const leftPx = note.from * 120
                      const widthPx = Math.max(8, note.duration * 120)
                      const color = FINGER_COLORS[note.finger]?.bar || '#a855f7'

                      return (
                        <div
                          key={note.index}
                          className="absolute h-4 rounded px-1 flex items-center justify-center text-[9px] font-bold text-white/90 shadow cursor-pointer transition-transform hover:scale-105 hover:z-20"
                          style={{
                            left: `${leftPx}px`,
                            width: `${widthPx}px`,
                            top: `${Math.min(90, Math.max(5, topPercent))}%`,
                            backgroundColor: color,
                            border: `1px solid ${color}`,
                          }}
                          title={`Note: ${note.pitchName} (MIDI ${note.midi}) | Finger: ${note.finger} | [${note.from.toFixed(2)}s - ${note.to.toFixed(2)}s]`}
                        >
                          <span className="truncate">{note.pitchName} • F{note.finger}</span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  )
}
