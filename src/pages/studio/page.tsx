import { ensureSongFunctions, useSong } from '@/features/data'
import { useSongMetadata } from '@/features/data/library'
import midiState from '@/features/midi'
import { parseMidi } from '@/features/parsers'
import * as persistence from '@/features/persist/persistence'
import {
  StudioEffectsBar,
  TouchPitchBend,
  VisualEQ,
} from '@/features/studio/components/StudioEffectsBar'
import { songToMidiBytes } from '@/features/studio/midi-encoder'
import { getSynthStub, InstrumentName, Synth } from '@/features/synth'
import gmInstruments from '@/features/synth/instruments'
import { predictSongFingerings } from '@/features/theory/fingering'
import { useEventListener } from '@/hooks'
import { Logo } from '@/icons'
import type { Song, SongNote, SongSource, Track, Tracks } from '@/types'
import { bytesToBase64 } from '@/utils'
import * as idb from 'idb-keyval'
import {
  ArrowLeft,
  AudioWaveform,
  Check,
  ChevronDown,
  Download,
  Drum,
  FileMusic,
  Guitar,
  Music,
  Pause,
  Piano,
  Play,
  Plus,
  PlusCircle,
  Redo2,
  Repeat,
  Save,
  Search,
  SkipBack,
  SkipForward,
  Sliders,
  SlidersHorizontal,
  Sparkles,
  Square,
  Target,
  Trash2,
  Undo2,
  Volume2,
  X,
} from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { mutate } from 'swr'

// Pitch helpers
const ROW_HEIGHT = 28 // px

const isBlackKey = (midiNote: number) => {
  const noteInOctave = midiNote % 12
  return [1, 3, 6, 8, 10].includes(noteInOctave) // C#, D#, F#, G#, A#
}

const getNoteName = (midiNote: number) => {
  const names = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
  const octave = Math.floor(midiNote / 12) - 1
  return `${names[midiNote % 12]}${octave}`
}

// Instrument Category & Icon helpers for sidebar modernization
const getInstrumentCategory = (inst: string) => {
  const i = inst.toLowerCase()
  if (
    [
      'acoustic_grand_piano',
      'bright_acoustic_piano',
      'electric_grand_piano',
      'honkytonk_piano',
      'electric_piano_1',
      'electric_piano_2',
      'harpsichord',
      'clavinet',
      'celesta',
    ].includes(i)
  )
    return 'Pianos'
  if (i.includes('guitar') || i.includes('bass')) return 'Guitars'
  if (i.includes('organ') || i.includes('accordion') || i.includes('harmonica')) return 'Organs'
  if (
    [
      'violin',
      'viola',
      'cello',
      'contrabass',
      'tremolo_strings',
      'pizzicato_strings',
      'orchestral_harp',
      'string_ensemble_1',
      'string_ensemble_2',
    ].includes(i)
  )
    return 'Strings'
  if (
    i.includes('trumpet') ||
    i.includes('trombone') ||
    i.includes('tuba') ||
    i.includes('horn') ||
    i.includes('brass') ||
    i.includes('sax') ||
    i.includes('flute') ||
    i.includes('oboe') ||
    i.includes('clarinet') ||
    i.includes('recorder')
  )
    return 'Brass & Winds'
  if (i.includes('lead') || i.includes('pad') || i.includes('fx') || i.includes('synth'))
    return 'Synths'
  return 'Percussion'
}

const getInstrumentIcon = (inst: string) => {
  const cat = getInstrumentCategory(inst)
  switch (cat) {
    case 'Pianos':
      return Piano
    case 'Guitars':
      return Guitar
    case 'Strings':
      return Music
    case 'Brass & Winds':
      return AudioWaveform
    case 'Synths':
      return Sparkles
    case 'Percussion':
      return Drum
    default:
      return Sliders
  }
}

const formatInstrumentLabel = (inst: string) => {
  if (inst === 'drum_machine_909') return 'Roland TR-909 Drum Machine'
  return inst
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (l) => l.toUpperCase())
    .replace(/\bEp\b/gi, 'EP')
    .replace(/\bFx\b/gi, 'FX')
}

const INSTRUMENT_CATEGORIES = [
  'All',
  'Pianos',
  'Guitars',
  'Strings',
  'Brass & Winds',
  'Synths',
  'Percussion',
]

function InstrumentPillSelect({
  value,
  onSelect,
}: {
  value: InstrumentName
  onSelect: (inst: InstrumentName) => void
}) {
  const [isOpen, setIsOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [category, setCategory] = useState('All')
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!isOpen) return
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isOpen])

  const Icon = getInstrumentIcon(value)

  const filteredInstruments = useMemo(() => {
    return gmInstruments.filter((inst) => {
      const matchesSearch = inst
        .replace(/_/g, ' ')
        .toLowerCase()
        .includes(searchQuery.toLowerCase())
      const matchesCat = category === 'All' || getInstrumentCategory(inst) === category
      return matchesSearch && matchesCat
    })
  }, [searchQuery, category])

  return (
    <div className="relative w-full">
      {/* Modern Pill Component */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          setIsOpen(!isOpen)
        }}
        className="group flex w-full cursor-pointer items-center justify-between gap-2 rounded-full border border-white/15 bg-white/10 px-3.5 py-2 text-xs font-semibold text-white shadow-sm transition-all hover:border-white/25 hover:bg-white/15 active:scale-95"
      >
        <div className="flex items-center gap-2 truncate">
          <Icon className="h-3.5 w-3.5 shrink-0 text-[#9ba4ff]" />
          <span className="truncate font-semibold tracking-wide text-white">
            {formatInstrumentLabel(value)}
          </span>
        </div>
        <ChevronDown
          className={`h-3.5 w-3.5 shrink-0 text-white/50 transition-transform duration-200 group-hover:text-white ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>

      {/* Floating Frosted-Glass Panel */}
      {isOpen && (
        <div
          ref={menuRef}
          onClick={(e) => e.stopPropagation()}
          className="animate-in fade-in zoom-in-95 absolute top-full left-0 z-50 mt-2 flex w-72 flex-col gap-2.5 rounded-2xl border border-white/15 bg-[#1c1c1e]/95 p-3 text-white shadow-2xl backdrop-blur-xl"
        >
          {/* Search Bar */}
          <div className="relative">
            <Search className="absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-white/40" />
            <input
              type="text"
              placeholder="Search instruments..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-white/5 py-1.5 pr-3 pl-8 text-xs font-medium text-white placeholder-white/40 transition-all focus:border-[#9ba4ff]/50 focus:bg-white/10 focus:outline-none"
            />
          </div>

          {/* Category Tabs */}
          <div className="no-scrollbar flex items-center gap-1 overflow-x-auto pb-1">
            {INSTRUMENT_CATEGORIES.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setCategory(cat)}
                className={`cursor-pointer rounded-lg px-2 py-1 text-[10.5px] font-bold whitespace-nowrap transition-all ${
                  category === cat
                    ? 'bg-[#9ba4ff] text-[#131313] shadow-sm'
                    : 'bg-white/5 text-white/60 hover:bg-white/10 hover:text-white'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Instrument List */}
          <div className="custom-scrollbar max-h-56 space-y-1 overflow-y-auto pr-1">
            {filteredInstruments.length === 0 ? (
              <div className="py-4 text-center text-xs font-medium text-white/40">
                No instruments found
              </div>
            ) : (
              filteredInstruments.map((inst) => {
                const isSelected = inst === value
                const InstIcon = getInstrumentIcon(inst)
                return (
                  <button
                    key={inst}
                    type="button"
                    onClick={() => {
                      onSelect(inst as InstrumentName)
                      setIsOpen(false)
                    }}
                    className={`flex w-full cursor-pointer items-center justify-between rounded-xl px-3 py-2 text-xs font-semibold transition-all ${
                      isSelected
                        ? 'border border-[#9ba4ff]/30 bg-[#9ba4ff]/20 text-[#9ba4ff]'
                        : 'border border-transparent text-white/80 hover:bg-white/10 hover:text-white'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 truncate">
                      <InstIcon
                        className={`h-3.5 w-3.5 shrink-0 ${isSelected ? 'text-[#9ba4ff]' : 'text-white/40'}`}
                      />
                      <span className="truncate">{formatInstrumentLabel(inst)}</span>
                    </div>
                    {isSelected && <Check className="h-3.5 w-3.5 shrink-0 text-[#9ba4ff]" />}
                  </button>
                )
              })
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// Default BPM & Duration for sketches
const DEFAULT_BPM = 120
const DEFAULT_DURATION = 32 // seconds (8 measures at 120 bpm, 4/4)

export default function Studio() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const id = searchParams.get('id')
  const source = searchParams.get('source') as SongSource | null

  // SWR hook to fetch existing song only when an ID/source is provided
  const { data: loadedSong, isLoading } = useSong(id ?? undefined, source ?? undefined)
  const songMeta = id && source ? useSongMetadata(id, source) : undefined

  // Core state
  const [songName, setSongName] = useState('Untitled Song')
  const [isLooping, setIsLooping] = useState(false)
  const [notes, setNotes] = useState<SongNote[]>([])
  const [tracks, setTracks] = useState<Tracks>({
    0: { name: 'Piano Melody', instrument: 'acoustic_grand_piano', program: 0 },
  })
  const [bpm, setBpm] = useState(DEFAULT_BPM)
  const [activeTrack, setActiveTrack] = useState<number>(0)
  const [selectedNoteIndex, setSelectedNoteIndex] = useState<number | null>(null)
  const [hoveredNoteIndex, setHoveredNoteIndex] = useState<number | null>(null)
  const [clipboardNote, setClipboardNote] = useState<SongNote | null>(null)
  // Playback states
  const [isPlaying, setIsPlaying] = useState(false)
  const [playbackTime, setPlaybackTime] = useState(0)
  const [scrolledTime, setScrolledTime] = useState<number | null>(null)
  const [mutedTracks, setMutedTracks] = useState<Set<number>>(new Set())
  const [soloTracks, setSoloTracks] = useState<Set<number>>(new Set())

  const [isSavedToLibrary, setIsSavedToLibrary] = useState<boolean>(Boolean(id))
  const savedSnapshotRef = useRef<string>('')
  const playbackTimeRef = useRef<number>(0)
  const playbackIntervalRef = useRef<number | null>(null)
  const startTimeRef = useRef<number>(0)
  const lastTimePlayedRef = useRef<number>(0)
  const synthCacheRef = useRef<{ [trackId: number]: Synth }>({})
  const activeNotesMapRef = useRef<Map<string, { note: SongNote; synth: Synth }>>(new Map())
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const pianoScrollRef = useRef<HTMLDivElement>(null)
  const scrollInitializedRef = useRef(false)
  const isDraggingPlayheadRef = useRef(false)
  const justFinishedDragRef = useRef(false)
  const hasManuallyMovedPlayheadRef = useRef(false)

  useEffect(() => {
    if (id) {
      setIsSavedToLibrary(true)
    } else {
      async function checkSavedState() {
        const list = await idb.get<any[]>('UPLOADED_SONGS')
        if (list && list.some((s) => s.id === id)) {
          setIsSavedToLibrary(true)
        }
      }
      checkSavedState()
    }
  }, [id])

  const hasUnsavedChanges = useMemo(() => {
    if (!savedSnapshotRef.current) return false
    const current = JSON.stringify({ notes, tracks, songName, bpm })
    const isNotesOrTracksModified = current !== savedSnapshotRef.current
    const isPlayheadManuallyMoved =
      hasManuallyMovedPlayheadRef.current && Math.abs(playbackTime) > 0.05
    return isNotesOrTracksModified || isPlayheadManuallyMoved
  }, [notes, tracks, songName, bpm, playbackTime])

  const isFullySaved = isSavedToLibrary && !hasUnsavedChanges

  const processNotesAndSave = async (targetId: string) => {
    // If user explicitly dragged playhead (positive or negative), shift notes so current playhead position becomes t=0s
    let notesToProcess = notes
    const timeShift = playbackTimeRef.current || playbackTime
    if (hasManuallyMovedPlayheadRef.current && Math.abs(timeShift) > 0.05) {
      notesToProcess = notes
        .map((n) => ({
          ...n,
          time: n.time - timeShift,
        }))
        .filter((n) => n.time + n.duration > 0)
        .map((n) => ({
          ...n,
          time: Math.max(0, n.time),
          measure: Math.floor((Math.max(0, n.time) * (bpm / 60) * 4) / 16) + 1,
        }))
      setNotes(notesToProcess)
      hasManuallyMovedPlayheadRef.current = false
      seekTo(0)
    }

    const editedSong: Partial<Song> = {
      tracks,
      notes: notesToProcess,
      bpms: [{ time: 0, bpm }],
      timeSignature: { numerator: 4, denominator: 4 },
      keySignature: 'C',
      ppq: 480,
      secondsToTicks: (s) => Math.round(s * 480 * (bpm / 60)),
      ticksToSeconds: (t) => t / (480 * (bpm / 60)),
    }

    const midiBytes = songToMidiBytes(editedSong)
    const parsedSong = parseMidi(midiBytes as any)

    const songToSave = {
      ...parsedSong,
      notes: notesToProcess,
      secondsToTicks: undefined,
      ticksToSeconds: undefined,
    }

    let songWithFingerings = songToSave
    const needsPrediction = notesToProcess.some((n) => typeof n.finger !== 'number')
    if (needsPrediction) {
      try {
        const predicted = await predictSongFingerings(ensureSongFunctions(songToSave as any))
        songWithFingerings = {
          ...predicted,
          secondsToTicks: undefined,
          ticksToSeconds: undefined,
        }
        setNotes(predicted.notes)
      } catch (err) {
        console.error('Failed predicting fingerings during save to library:', err)
      }
    }
    await idb.set(`SONG_DATA_${targetId}`, songWithFingerings)
    persistence.registerCustomSketch(targetId, songName, totalDuration)

    const finalNotes = songWithFingerings.notes || notesToProcess
    savedSnapshotRef.current = JSON.stringify({
      notes: finalNotes,
      tracks,
      songName,
      bpm,
    })
    setIsSavedToLibrary(true)

    return { midiBytes, songWithFingerings }
  }

  const handleSaveToLibrary = async () => {
    const targetId = id || crypto.randomUUID()
    try {
      await processNotesAndSave(targetId)
    } catch (e) {
      console.error('Failed to save to library', e)
      alert('Failed to save to library. Please check console.')
    }
  }

  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [instrumentRange, setInstrumentRange] = useState(midiState.detectedRange)
  useEffect(() => {
    const interval = setInterval(() => {
      if (midiState.detectedRange !== instrumentRange) {
        setInstrumentRange(midiState.detectedRange)
      }
    }, 1000)
    return () => clearInterval(interval)
  }, [instrumentRange])

  // History for Undo/Redo
  const [history, setHistory] = useState<{ notes: SongNote[]; tracks: Tracks }[]>([
    {
      notes: [],
      tracks: { 0: { name: 'Piano Melody', instrument: 'acoustic_grand_piano', program: 0 } },
    },
  ])
  const [historyIndex, setHistoryIndex] = useState(0)

  // Layout states
  const MIN_ZOOM = 16 // minimum px per 16th note
  const MAX_ZOOM = 160 // maximum px per 16th note
  const KEY_TOP_HEIGHT = 150 // px height of piano keyboard (prominent & big)
  const PLAYHEAD_BOTTOM = 80
  const [zoomY, setZoomY] = useState<number>(48)

  const containerRef = useRef<HTMLDivElement>(null)
  const [containerWidth, setContainerWidth] = useState<number>(1000)

  // Track container width changes dynamically (window resize, sidebar toggle)
  useLayoutEffect(() => {
    const el = containerRef.current
    if (!el) return

    const updateWidth = () => {
      if (el.clientWidth > 0) {
        setContainerWidth(el.clientWidth)
      }
    }

    updateWidth()
    const observer = new ResizeObserver(updateWidth)
    observer.observe(el)
    return () => observer.disconnect()
  }, [sidebarOpen])

  // Real piano keyboard layout measurements (matching Play Mode structure & octave adaptation)
  const studioMeasurements = useMemo(() => {
    // 1. Calculate song note range in a single pass
    let songStart = 60
    let songEnd = 72
    if (notes.length > 0) {
      let minN = Infinity
      let maxN = -Infinity
      for (let i = 0; i < notes.length; i++) {
        const n = notes[i].midiNote
        if (n < minN) minN = n
        if (n > maxN) maxN = n
      }
      songStart = minN
      songEnd = maxN
    }

    // 2. Play Mode getKeyboardRange logic: adapt octaves based on hardware MIDI + song range
    let k = 0
    if (instrumentRange) {
      const instStart = instrumentRange.start
      const instEnd = instrumentRange.end

      if (songStart < instStart || songEnd > instEnd) {
        const shiftDown = Math.ceil((instStart - songStart) / 12)
        const shiftUp = Math.ceil((songEnd - instEnd) / 12)

        if (shiftDown > 0 && shiftUp <= 0) {
          k = -shiftDown
        } else if (shiftUp > 0 && shiftDown <= 0) {
          k = shiftUp
        } else {
          const songCenter = (songStart + songEnd) / 2
          const instrumentCenter = (instStart + instEnd) / 2
          k = Math.round((songCenter - instrumentCenter) / 12)
        }
      }
    }

    let displayStart = songStart
    let displayEnd = songEnd

    if (instrumentRange) {
      displayStart = Math.min(songStart, instrumentRange.start + k * 12)
      displayEnd = Math.max(songEnd, instrumentRange.end + k * 12)
    }

    // Snap to nearest C octaves
    let minM = Math.floor(displayStart / 12) * 12
    let maxM = Math.ceil(displayEnd / 12) * 12

    // Ensure minimum of 2 octaves (e.g. C4 to C6) if song is short, or 1 octave minimum
    if (maxM - minM < 24) {
      if (notes.length > 0) {
        minM = Math.max(21, minM - 12)
        maxM = Math.min(108, maxM + 12)
      } else {
        minM = 48 // C3
        maxM = 84 // C6
      }
    }

    const minMidi = Math.max(21, minM)
    const maxMidi = Math.min(108, maxM)

    // 3. Separate white and black key lists in a single loop
    const whiteKeyNotes: number[] = []
    const blackKeyNotes: number[] = []
    for (let i = minMidi; i <= maxMidi; i++) {
      if (isBlackKey(i)) {
        blackKeyNotes.push(i)
      } else {
        whiteKeyNotes.push(i)
      }
    }
    const whiteKeysCount = whiteKeyNotes.length

    // 4. Compute whiteWidth to engulf 100% of containerWidth
    const availableW = Math.max(300, containerWidth)
    const whiteWidth = availableW / Math.max(1, whiteKeysCount)
    const blackWidth = whiteWidth * 0.58
    const offset = 2 / 3 - 0.5
    const blackOffsets: { [note: number]: number } = {
      1: -offset, // C#
      3: +offset, // D#
      6: -offset, // F#
      8: 0, // G#
      10: +offset, // A#
    }

    const rawLanes: { [note: number]: { left: number; width: number } } = {}
    let whiteNotes = 0

    for (let note = minMidi; note <= maxMidi; note++) {
      if (isBlackKey(note)) {
        const whiteMiddle = whiteWidth * whiteNotes
        const off = blackOffsets[note % 12] ?? 0
        const left = whiteMiddle - blackWidth / 2 - 2 + off * blackWidth
        rawLanes[note] = { left, width: blackWidth }
      } else {
        rawLanes[note] = { left: whiteWidth * whiteNotes, width: whiteWidth }
        whiteNotes++
      }
    }

    const lanes: {
      [midiNote: number]: {
        left: number
        width: number
        noteLeft: number
        noteWidth: number
        isBlack: boolean
      }
    } = {}

    for (let note = minMidi; note <= maxMidi; note++) {
      const isB = isBlackKey(note)
      if (isB) {
        const raw = rawLanes[note]
        lanes[note] = {
          left: raw.left,
          width: raw.width,
          noteLeft: raw.left,
          noteWidth: raw.width,
          isBlack: true,
        }
      } else {
        const raw = rawLanes[note]
        const leftBlack = rawLanes[note - 1]
        const rightBlack = rawLanes[note + 1]

        let posX = raw.left
        if (leftBlack && isBlackKey(note - 1)) {
          posX = leftBlack.left + leftBlack.width
        }

        let rightEdge = raw.left + raw.width
        if (rightBlack && isBlackKey(note + 1)) {
          rightEdge = rightBlack.left
        }

        const noteWidth = Math.max(4, rightEdge - posX)
        lanes[note] = {
          left: raw.left,
          width: raw.width,
          noteLeft: posX,
          noteWidth,
          isBlack: false,
        }
      }
    }

    return {
      minMidi,
      maxMidi,
      whiteKeyNotes,
      blackKeyNotes,
      lanes,
      whiteNotes,
      whiteWidth,
      blackWidth,
      totalWidth: availableW,
    }
  }, [notes, instrumentRange, containerWidth])

  const { minMidi, maxMidi, whiteKeyNotes, blackKeyNotes } = studioMeasurements

  const handleWheel = (e: React.WheelEvent) => {
    if (e.ctrlKey) {
      e.preventDefault()
      setZoomY((prev) => {
        const step = -e.deltaY * 0.05
        const newZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, prev + step))
        return newZoom
      })
    }
  }

  // Sync piano horizontal scroll & update scrolledTime for Media Player readout during vertical scroll
  const handleGridScroll = useCallback(() => {
    if (pianoScrollRef.current && scrollContainerRef.current) {
      pianoScrollRef.current.scrollLeft = scrollContainerRef.current.scrollLeft
    }

    if (scrollContainerRef.current && !isPlaying && !isDraggingPlayheadRef.current) {
      const container = scrollContainerRef.current
      const containerH = container.clientHeight
      if (containerH > 0) {
        const factor = (bpm / 60) * 4 * zoomY
        const maxNoteEnd = notes.length > 0 ? Math.max(...notes.map((n) => n.time + n.duration)) : 0
        const computedTotalDur = Math.max(DEFAULT_DURATION, Math.ceil(maxNoteEnd + 4))
        const gridH = Math.ceil(computedTotalDur * factor)
        const playheadY = containerH - PLAYHEAD_BOTTOM
        const currentGridY = container.scrollTop + playheadY
        const currentT = (gridH - currentGridY) / factor
        const cappedT = Math.max(0, Math.min(computedTotalDur, currentT))
        setScrolledTime(cappedT)
      }
    }
  }, [isPlaying, notes, bpm, zoomY, PLAYHEAD_BOTTOM, DEFAULT_DURATION])

  // Set scroll position: center active notes horizontally, and align vertical scroll with the playhead.
  useLayoutEffect(() => {
    if (isLoading) return
    const el = scrollContainerRef.current
    if (!el || el.clientHeight === 0) return
    if (id && notes.length === 0) return
    if (scrollInitializedRef.current) return
    scrollInitializedRef.current = true

    // 1. Horizontal: Center the active notes pitch range on load or zoom
    if (notes.length > 0) {
      const minNote = Math.min(...notes.map((n) => n.midiNote))
      const maxNote = Math.max(...notes.map((n) => n.midiNote))
      const targetMidi = Math.round((minNote + maxNote) / 2)
      const lane = studioMeasurements.lanes[targetMidi]
      const centerX = lane ? lane.noteLeft + lane.noteWidth / 2 : 400
      const containerW = el.clientWidth || el.offsetWidth || 800
      const hOffset = Math.max(0, centerX - containerW / 2)
      el.scrollLeft = hOffset
      if (pianoScrollRef.current) pianoScrollRef.current.scrollLeft = hOffset
    } else {
      const lane = studioMeasurements.lanes[60]
      const hOffset = Math.max(0, (lane ? lane.left : 0) - 200)
      el.scrollLeft = hOffset
      if (pianoScrollRef.current) pianoScrollRef.current.scrollLeft = hOffset
    }

    // 2. Vertical: Position current playback time at the playhead line (PLAYHEAD_BOTTOM px from bottom)
    const maxNoteEnd = notes.length > 0 ? Math.max(...notes.map((n) => n.time + n.duration)) : 0
    const computedTotalDur = Math.max(DEFAULT_DURATION, Math.ceil(maxNoteEnd + 4))
    const gridH = Math.ceil(computedTotalDur * (bpm / 60) * 4) * zoomY
    const containerH = el.clientHeight

    const currentPlayTime = playbackTimeRef.current || 0
    const playheadY = gridH - currentPlayTime * (bpm / 60) * 4 * zoomY
    const targetScrollTop = Math.max(0, playheadY - (containerH - PLAYHEAD_BOTTOM))

    el.scrollTop = targetScrollTop
  }, [isLoading, notes, minMidi, bpm, zoomY])

  // On window resize: keep the scroll offset relative to the bottom constant
  // so the baseline stays aligned.
  useEffect(() => {
    let lastH = 0
    const onResize = () => {
      const el = scrollContainerRef.current
      if (!el) return
      const newH = el.clientHeight
      const diff = newH - lastH
      if (diff !== 0 && lastH !== 0) {
        el.scrollTop = Math.max(0, el.scrollTop - diff)
      }
      lastH = newH
    }
    window.addEventListener('resize', onResize)
    setTimeout(() => {
      if (scrollContainerRef.current) lastH = scrollContainerRef.current.clientHeight
    }, 200)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  // Undo/Redo tracking helper
  const pushHistory = useCallback(
    (newNotes: SongNote[], newTracks: Tracks) => {
      const nextHistory = history.slice(0, historyIndex + 1)
      nextHistory.push({ notes: JSON.parse(JSON.stringify(newNotes)), tracks: { ...newTracks } })
      setHistory(nextHistory)
      setHistoryIndex(nextHistory.length - 1)
    },
    [history, historyIndex],
  )

  // Reset physical MIDI keyboard octave shift on Studio mount
  useEffect(() => {
    midiState.midiOctaveDiff = 0
  }, [])

  // Synchronize synths when tracks mapping changes
  useEffect(() => {
    Object.entries(tracks).forEach(([idStr, t]) => {
      const trackId = Number(idStr)
      const instrument = (t.instrument as InstrumentName) || 'acoustic_grand_piano'
      if (
        !synthCacheRef.current[trackId] ||
        synthCacheRef.current[trackId].getInstrument() !== instrument
      ) {
        synthCacheRef.current[trackId] = getSynthStub(instrument)
      }
    })
  }, [tracks])

  // Load song into local state if editing an existing song
  useEffect(() => {
    if (loadedSong) {
      // Reset scroll so it re-initializes with the real notes after this render
      scrollInitializedRef.current = false
      const initialName = songMeta?.title || 'Untitled Song'
      setSongName(initialName)
      let normalizedTracks = {
        ...(loadedSong.tracks || {
          0: { name: 'Melody', instrument: 'acoustic_grand_piano', program: 0 },
        }),
      }
      let normalizedNotes = [...(loadedSong.notes || [])]

      // Reconcile legacy recorded songs that used track index 1 instead of 0
      if (normalizedTracks[1] && !normalizedTracks[0]) {
        normalizedTracks[0] = normalizedTracks[1]
        delete normalizedTracks[1]
        normalizedNotes = normalizedNotes.map((n) => (n.track === 1 ? { ...n, track: 0 } : n))
      }

      const initialBpm = loadedSong.bpms?.[0]?.bpm || 120
      setNotes(normalizedNotes)
      setTracks(normalizedTracks)
      if (loadedSong.bpms && loadedSong.bpms.length > 0) {
        setBpm(initialBpm)
      }

      savedSnapshotRef.current = JSON.stringify({
        notes: normalizedNotes,
        tracks: normalizedTracks,
        songName: initialName,
        bpm: initialBpm,
      })

      // Initialize history
      const initialHistory = [
        { notes: JSON.parse(JSON.stringify(normalizedNotes)), tracks: { ...normalizedTracks } },
      ]
      setHistory(initialHistory)
      setHistoryIndex(0)
    } else if (!id) {
      // Setup blank sketch history
      const initialNotes: SongNote[] = []
      const initialTracks = {
        0: {
          name: 'Piano Melody',
          instrument: 'acoustic_grand_piano' as InstrumentName,
          program: 0,
        },
      }
      savedSnapshotRef.current = JSON.stringify({
        notes: initialNotes,
        tracks: initialTracks,
        songName: 'Untitled Song',
        bpm: 120,
      })
      setHistory([{ notes: initialNotes, tracks: initialTracks }])
      setHistoryIndex(0)
    }
  }, [loadedSong, id, songMeta])

  // Playback timer scheduler
  const stopAllNotes = useCallback(() => {
    activeNotesMapRef.current.forEach((active) => {
      try {
        active.synth.stopNote(active.note.midiNote)
      } catch (e) {
        console.error(e)
      }
    })
    activeNotesMapRef.current.clear()
  }, [])

  const totalDuration = useMemo(() => {
    if (notes.length === 0) return DEFAULT_DURATION
    const maxTime = Math.max(...notes.map((n) => n.time + n.duration))
    return Math.max(DEFAULT_DURATION, Math.ceil(maxTime + 4))
  }, [notes])

  const tick = useCallback(() => {
    const now = performance.now() / 1000
    let elapsed = now - startTimeRef.current

    // Check for loop end
    if (elapsed >= totalDuration) {
      if (isLooping) {
        startTimeRef.current = now
        lastTimePlayedRef.current = 0
        setPlaybackTime(0)
        playbackTimeRef.current = 0
        stopAllNotes()
        elapsed = 0
      } else {
        setIsPlaying(false)
        startTimeRef.current = now
        lastTimePlayedRef.current = 0
        setPlaybackTime(0)
        playbackTimeRef.current = 0
        stopAllNotes()
        return
      }
    }

    setPlaybackTime(elapsed)
    playbackTimeRef.current = elapsed

    const current = elapsed
    const last = lastTimePlayedRef.current

    notes.forEach((note) => {
      const noteStart = note.time
      const noteEnd = note.time + note.duration
      const noteKey = `${note.track}-${note.midiNote}-${note.time}`

      // Play note
      if (noteStart >= last && noteStart < current) {
        const isMuted = mutedTracks.has(note.track)
        const hasSolo = soloTracks.size > 0
        const isSolo = soloTracks.has(note.track)
        const shouldPlay = hasSolo ? isSolo : !isMuted

        if (shouldPlay) {
          const synth = synthCacheRef.current[note.track]
          if (synth) {
            synth.playNote(note.midiNote, note.velocity || 80)
            activeNotesMapRef.current.set(noteKey, { note, synth })
          }
        }
      }

      // Stop note
      if (activeNotesMapRef.current.has(noteKey) && current >= noteEnd) {
        const active = activeNotesMapRef.current.get(noteKey)
        if (active) {
          active.synth.stopNote(note.midiNote)
          activeNotesMapRef.current.delete(noteKey)
        }
      }
    })

    lastTimePlayedRef.current = current
    playbackIntervalRef.current = requestAnimationFrame(tick)
  }, [notes, totalDuration, mutedTracks, soloTracks, stopAllNotes, isLooping])

  const togglePlayback = useCallback(() => {
    if (isPlaying) {
      setIsPlaying(false)
      if (playbackIntervalRef.current) {
        cancelAnimationFrame(playbackIntervalRef.current)
        playbackIntervalRef.current = null
      }
      stopAllNotes()
    } else {
      setIsPlaying(true)
      startTimeRef.current = performance.now() / 1000 - playbackTime
      lastTimePlayedRef.current = playbackTime
      playbackIntervalRef.current = requestAnimationFrame(tick)
    }
  }, [isPlaying, playbackTime, tick, stopAllNotes])

  const stopPlayback = useCallback(() => {
    setIsPlaying(false)
    if (playbackIntervalRef.current) {
      cancelAnimationFrame(playbackIntervalRef.current)
      playbackIntervalRef.current = null
    }
    stopAllNotes()
    setPlaybackTime(0)
    playbackTimeRef.current = 0
    lastTimePlayedRef.current = 0
  }, [stopAllNotes])

  const seekTo = useCallback(
    (t: number) => {
      const cappedT = Math.max(-10, Math.min(totalDuration, t))
      setPlaybackTime(cappedT)
      playbackTimeRef.current = cappedT
      lastTimePlayedRef.current = cappedT
      if (isPlaying) {
        startTimeRef.current = performance.now() / 1000 - cappedT
      }
      if (scrollContainerRef.current) {
        const containerHeight = scrollContainerRef.current.clientHeight
        const playheadY = containerHeight - PLAYHEAD_BOTTOM
        const factor = (bpm / 60) * 4 * zoomY
        const gridH = Math.ceil(totalDuration * (bpm / 60) * 4) * zoomY
        const noteY = gridH - cappedT * factor
        scrollContainerRef.current.scrollTop = Math.max(0, noteY - playheadY)
      }
    },
    [isPlaying, bpm, zoomY, totalDuration, PLAYHEAD_BOTTOM],
  )

  const handlePlayheadMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation()
    e.preventDefault()
    isDraggingPlayheadRef.current = true
    hasManuallyMovedPlayheadRef.current = true

    const startMouseY = e.clientY
    const initialTime = playbackTimeRef.current
    const factor = (bpm / 60) * 4 * zoomY

    const handleMouseMove = (moveEv: MouseEvent) => {
      if (!isDraggingPlayheadRef.current) return
      const deltaY = moveEv.clientY - startMouseY
      const deltaTime = -deltaY / factor
      const targetTime = initialTime + deltaTime
      seekTo(targetTime)
    }

    const handleMouseUp = () => {
      isDraggingPlayheadRef.current = false
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
  }

  useEffect(() => {
    return () => {
      if (playbackIntervalRef.current) {
        cancelAnimationFrame(playbackIntervalRef.current)
      }
    }
  }, [])

  useEventListener<KeyboardEvent>('keydown', (e) => {
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return

    // Playback
    if (e.code === 'Space') {
      e.preventDefault()
      togglePlayback()
      return
    }

    if (e.key === 'ArrowLeft') {
      e.preventDefault()
      seekTo(0)
      return
    }

    if (e.key === 'ArrowRight') {
      e.preventDefault()
      seekTo(totalDuration)
      return
    }

    // Fingering Overwrite
    if (selectedNoteIndex !== null) {
      if (['1', '2', '3', '4', '5'].includes(e.key)) {
        e.preventDefault()
        const updated = [...notes]
        updated[selectedNoteIndex] = { ...updated[selectedNoteIndex], finger: Number(e.key) }
        setNotes(updated)
        pushHistory(updated, tracks)
        return
      }
      if (e.key === '0') {
        e.preventDefault()
        const updated = [...notes]
        const copy = { ...updated[selectedNoteIndex] }
        delete copy.finger
        updated[selectedNoteIndex] = copy
        setNotes(updated)
        pushHistory(updated, tracks)
        return
      }
    }

    // Delete
    if ((e.key === 'Delete' || e.key === 'Backspace') && selectedNoteIndex !== null) {
      e.preventDefault()
      deleteNote(selectedNoteIndex)
      return
    }

    // Undo / Redo
    if (e.metaKey || e.ctrlKey) {
      const key = e.key.toLowerCase()
      if (key === 'z') {
        e.preventDefault()
        if (e.shiftKey) {
          handleRedo()
        } else {
          handleUndo()
        }
        return
      }
      if (key === 'y') {
        e.preventDefault()
        handleRedo()
        return
      }

      // Copy
      if (key === 'c' && selectedNoteIndex !== null) {
        e.preventDefault()
        setClipboardNote(notes[selectedNoteIndex])
        return
      }

      // Paste
      if (key === 'v' && clipboardNote) {
        e.preventDefault()
        const newNote = { ...clipboardNote, time: playbackTime }
        const updatedNotes = [...notes, newNote]
        setNotes(updatedNotes)
        setSelectedNoteIndex(updatedNotes.length - 1)
        pushHistory(updatedNotes, tracks)
        return
      }
    }
  })

  // Physical MIDI and PC keyboard input support
  useEffect(() => {
    const handleMidiEvent = (e: import('@/types').MidiStateEvent) => {
      const synth = synthCacheRef.current[activeTrack]
      if (!synth) return
      if (e.type === 'down' && e.note !== undefined) {
        synth.playNote(e.note, e.velocity || 80)
      } else if (e.type === 'up' && e.note !== undefined) {
        synth.stopNote(e.note)
      }
    }
    midiState.subscribe(handleMidiEvent)
    return () => midiState.unsubscribe(handleMidiEvent)
  }, [activeTrack])

  // Time & Pixel coordinates mapping
  // Y is INVERTED: time=0 maps to the BOTTOM of the grid, larger time maps to the TOP.
  // This gives "falling notes" behavior: future notes appear at top and fall toward the piano.
  const timeToY = useCallback(
    (t: number) => {
      const factor = (bpm / 60) * 4 * zoomY
      const gridH = Math.ceil(totalDuration * (bpm / 60) * 4) * zoomY
      return gridH - t * factor
    },
    [bpm, zoomY, totalDuration],
  )

  // Convert a duration (delta time) to pixels — no offset, just the linear factor
  const durationToHeight = useCallback(
    (d: number) => {
      return d * (bpm / 60) * 4 * zoomY
    },
    [bpm, zoomY],
  )

  // Auto-scroll during playback: as time increases, scrollTop DECREASES,
  // so the grid scrolls UP and notes appear to FALL DOWNWARD past the fixed playhead.
  useEffect(() => {
    if (!isPlaying || !scrollContainerRef.current) return
    const containerHeight = scrollContainerRef.current.clientHeight
    const playheadY = containerHeight - PLAYHEAD_BOTTOM // playhead is PLAYHEAD_BOTTOM px from bottom
    const factor = (bpm / 60) * 4 * zoomY
    const gridH = Math.ceil(totalDuration * (bpm / 60) * 4) * zoomY
    const noteY = gridH - playbackTime * factor // inverted Y of current time
    scrollContainerRef.current.scrollTop = Math.max(0, noteY - playheadY)
  }, [playbackTime, isPlaying, bpm, zoomY, totalDuration])

  // Inverted yToTime for the falling-notes coordinate system
  const yToTime = useCallback(
    (y: number) => {
      const gridH = Math.ceil(totalDuration * (bpm / 60) * 4) * zoomY
      return (gridH - y) / ((bpm / 60) * 4 * zoomY)
    },
    [bpm, zoomY, totalDuration],
  )

  // Subdivision time helper
  const getSubdivisionTime = useCallback(
    (subdivision: number) => {
      return subdivision * (60 / bpm / 4)
    },
    [bpm],
  )

  // Click key handlers
  const handleKeyMouseDown = (midiNote: number) => {
    const synth = synthCacheRef.current[activeTrack]
    if (synth) {
      synth.playNote(midiNote, 90)
    }
  }

  const handleKeyMouseUp = (midiNote: number) => {
    const synth = synthCacheRef.current[activeTrack]
    if (synth) {
      synth.stopNote(midiNote)
    }
  }

  // Add / Edit / Remove Note operations
  const addNoteAt = (midiNote: number, timeSubdivision: number) => {
    const noteTime = getSubdivisionTime(timeSubdivision)
    const noteDuration = 60 / bpm // default 1 beat duration
    const newNote: SongNote = {
      type: 'note',
      midiNote,
      track: activeTrack,
      time: noteTime,
      duration: noteDuration,
      velocity: 80,
      measure: Math.floor(timeSubdivision / 16) + 1,
    }

    // Play feedback
    const synth = synthCacheRef.current[activeTrack]
    if (synth) {
      synth.playNote(midiNote, 80)
      setTimeout(() => synth.stopNote(midiNote), 200)
    }

    const updatedNotes = [...notes, newNote]
    setNotes(updatedNotes)
    setSelectedNoteIndex(updatedNotes.length - 1)
    pushHistory(updatedNotes, tracks)
  }

  const handleNoteClick = (e: React.MouseEvent, index: number) => {
    e.stopPropagation()
    setSelectedNoteIndex(index)
  }

  const handleNoteDoubleClick = (e: React.MouseEvent, index: number) => {
    e.stopPropagation()
    deleteNote(index)
  }

  const deleteNote = (index: number) => {
    const updatedNotes = notes.filter((_, i) => i !== index)
    setNotes(updatedNotes)
    setSelectedNoteIndex(null)
    pushHistory(updatedNotes, tracks)
  }

  // Drag and Resize handlers
  const dragRef = useRef<{
    noteIndex: number
    startX: number
    startY: number
    startTime: number
    startMidi: number
    resizeMode: 'top' | 'bottom' | 'move'
    startDuration: number
  } | null>(null)

  const handleNoteMouseDown = (
    e: React.MouseEvent,
    index: number,
    resizeMode: 'top' | 'bottom' | 'move' = 'move',
  ) => {
    e.stopPropagation()
    justFinishedDragRef.current = false
    const note = notes[index]
    dragRef.current = {
      noteIndex: index,
      startX: e.clientX,
      startY: e.clientY,
      startTime: note.time,
      startMidi: note.midiNote,
      resizeMode,
      startDuration: note.duration,
    }
    setSelectedNoteIndex(index)

    window.addEventListener('mousemove', handleNoteMouseMove)
    window.addEventListener('mouseup', handleNoteMouseUp)
  }

  const handleNoteMouseMove = (e: MouseEvent) => {
    if (!dragRef.current) return
    const { noteIndex, startX, startY, startTime, startMidi, resizeMode, startDuration } =
      dragRef.current

    const deltaX = e.clientX - startX
    const deltaY = e.clientY - startY

    if (Math.hypot(deltaX, deltaY) > 3) {
      justFinishedDragRef.current = true
    }

    // Grid coordinates: Dragging mouse UPWARDS (deltaY < 0) corresponds to moving toward future time (+deltaTime)
    const deltaSubdivisions = Math.round(deltaY / zoomY)
    const deltaTime = -deltaSubdivisions * (60 / bpm / 4)

    const minSubdivision = 60 / bpm / 4
    const updatedNotes = [...notes]
    const note = { ...updatedNotes[noteIndex] }

    if (resizeMode === 'top') {
      // Dragging TOP handle: Drag UP (deltaTime > 0) -> elongates duration. Drag DOWN (deltaTime < 0) -> shortens duration.
      const newDuration = Math.max(minSubdivision, startDuration + deltaTime)
      note.duration = newDuration
    } else if (resizeMode === 'bottom') {
      // Dragging BOTTOM handle: Drag DOWN (deltaTime < 0) -> starts earlier, elongates duration. Drag UP (deltaTime > 0) -> starts later, shortens.
      const fixedEndTime = startTime + startDuration
      const proposedStartTime = startTime + deltaTime
      const maxStartTime = fixedEndTime - minSubdivision
      const newStartTime = Math.max(0, Math.min(maxStartTime, proposedStartTime))
      note.time = newStartTime
      note.duration = fixedEndTime - newStartTime
      note.measure = Math.floor((newStartTime * (bpm / 60) * 4) / 16) + 1
    } else {
      // Moving entire note body
      const newTime = Math.max(0, startTime + deltaTime)
      const startLane = studioMeasurements.lanes[startMidi]
      const currentX = (startLane ? startLane.noteLeft : 0) + deltaX
      let closestMidi = startMidi
      let minDist = Infinity
      for (let m = minMidi; m <= maxMidi; m++) {
        const lane = studioMeasurements.lanes[m]
        if (lane) {
          const laneCenter = lane.noteLeft + lane.noteWidth / 2
          const dist = Math.abs(currentX - laneCenter)
          if (dist < minDist) {
            minDist = dist
            closestMidi = m
          }
        }
      }
      const newMidi = closestMidi

      // Play audio feedback on pitch change
      if (newMidi !== note.midiNote) {
        const synth = synthCacheRef.current[note.track]
        if (synth) {
          synth.playNote(newMidi, 80)
          setTimeout(() => synth.stopNote(newMidi), 150)
        }
      }

      note.time = newTime
      note.midiNote = newMidi
      note.measure = Math.floor((newTime * (bpm / 60) * 4) / 16) + 1
    }

    updatedNotes[noteIndex] = note
    setNotes(updatedNotes)
  }

  const handleNoteMouseUp = () => {
    if (dragRef.current) {
      pushHistory(notes, tracks)
    }
    dragRef.current = null
    window.removeEventListener('mousemove', handleNoteMouseMove)
    window.removeEventListener('mouseup', handleNoteMouseUp)

    // Keep flag true for 250ms so any trailing click event on grid is ignored
    setTimeout(() => {
      justFinishedDragRef.current = false
    }, 250)
  }

  // Undo / Redo triggers
  const handleUndo = () => {
    if (historyIndex > 0) {
      const prev = history[historyIndex - 1]
      setNotes(prev.notes)
      setTracks(prev.tracks)
      setHistoryIndex(historyIndex - 1)
      setSelectedNoteIndex(null)
    }
  }

  const handleRedo = () => {
    if (historyIndex < history.length - 1) {
      const next = history[historyIndex + 1]
      setNotes(next.notes)
      setTracks(next.tracks)
      setHistoryIndex(historyIndex + 1)
      setSelectedNoteIndex(null)
    }
  }

  // Track panel controls
  const addTrack = () => {
    const trackIds = Object.keys(tracks).map(Number)
    const nextId = trackIds.length > 0 ? Math.max(...trackIds) + 1 : 0
    const newTracks = {
      ...tracks,
      [nextId]: {
        name: `Track ${nextId + 1}`,
        instrument: 'electric_piano_1',
        program: 4,
      },
    }
    setTracks(newTracks)
    setActiveTrack(nextId)
    pushHistory(notes, newTracks)
  }

  const deleteTrack = (trackId: number) => {
    const newTracks = { ...tracks }
    delete newTracks[trackId]

    // Also clear notes for this track
    const newNotes = notes.filter((n) => n.track !== trackId)

    setTracks(newTracks)
    setNotes(newNotes)
    setActiveTrack(Object.keys(newTracks).map(Number)[0] || 0)
    pushHistory(newNotes, newTracks)
  }

  const updateTrackInstrument = (trackId: number, instrument: InstrumentName) => {
    const program = gmInstruments.indexOf(instrument)
    const newTracks = {
      ...tracks,
      [trackId]: {
        ...tracks[trackId],
        instrument,
        program: program !== -1 ? program : 0,
      },
    }
    setTracks(newTracks)
    pushHistory(notes, newTracks)
  }

  const updateTrackName = (trackId: number, name: string) => {
    const newTracks = {
      ...tracks,
      [trackId]: {
        ...tracks[trackId],
        name,
      },
    }
    setTracks(newTracks)
  }

  const toggleMute = (trackId: number) => {
    const newMuted = new Set(mutedTracks)
    if (newMuted.has(trackId)) {
      newMuted.delete(trackId)
    } else {
      newMuted.add(trackId)
      // Remove solo if muted
      const newSolo = new Set(soloTracks)
      newSolo.delete(trackId)
      setSoloTracks(newSolo)
    }
    setMutedTracks(newMuted)
  }

  const toggleSolo = (trackId: number) => {
    const newSolo = new Set(soloTracks)
    if (newSolo.has(trackId)) {
      newSolo.delete(trackId)
    } else {
      newSolo.add(trackId)
      // Unmute if soloed
      const newMuted = new Set(mutedTracks)
      newMuted.delete(trackId)
      setMutedTracks(newMuted)
    }
    setSoloTracks(newSolo)
  }

  // Save changes and return to Practice/Play mode
  const handleSaveAndPractice = async (practiceTrackId?: number) => {
    stopPlayback()

    const targetId = id || crypto.randomUUID()
    const targetSource = source || 'upload'

    try {
      const { midiBytes, songWithFingerings } = await processNotesAndSave(targetId)
      const base64Data = bytesToBase64(midiBytes)

      // Store in caching layer
      persistence.saveEditedMidi(targetId, base64Data)

      // Clear old settings so play mode correctly re-evaluates the new track structures
      persistence.clearPersistedSongSettings(targetId)

      const parsedSong = parseMidi(midiBytes as any)
      const songWithFunctions = ensureSongFunctions({
        ...parsedSong,
        notes: songWithFingerings.notes,
      } as Song)

      mutate([targetId, targetSource], songWithFunctions, { revalidate: false })

      // Redirect
      const queryParams = new URLSearchParams()
      queryParams.set('id', targetId)
      queryParams.set('source', targetSource)
      if (practiceTrackId !== undefined) {
        queryParams.set('practiceTrackId', String(practiceTrackId))
      }
      navigate(`/play?${queryParams.toString()}`)
    } catch (e) {
      console.error('Failed to compile midi bytes', e)
      alert('Error saving song. Please check console.')
    }
  }

  // Download MIDI file (.mid)
  const handleDownloadMIDI = () => {
    const editedSong: Partial<Song> = {
      tracks,
      notes,
      bpms: [{ time: 0, bpm }],
      timeSignature: { numerator: 4, denominator: 4 },
      keySignature: 'C',
      ppq: 480,
    }

    try {
      const midiBytes = songToMidiBytes(editedSong)
      const blob = new Blob([midiBytes as any], { type: 'audio/midi' })
      const link = document.createElement('a')
      link.href = URL.createObjectURL(blob)
      link.download = `${songName.toLowerCase().replace(/\s+/g, '_')}.mid`
      link.click()
    } catch (e) {
      console.error(e)
      alert('Error generating MIDI file.')
    }
  }

  // Preset sketch templates
  const applyTemplate = (type: 'simple' | 'duet' | 'sketch') => {
    let t: Tracks = {}
    let n: SongNote[] = []
    if (type === 'simple') {
      t = { 0: { name: 'Piano', instrument: 'acoustic_grand_piano', program: 0 } }
    } else if (type === 'duet') {
      t = {
        0: { name: 'Melody (Synth)', instrument: 'lead_1_square', program: 80 },
        1: { name: 'Bassline', instrument: 'electric_bass_finger', program: 33 },
      }
    } else if (type === 'sketch') {
      t = {
        0: { name: 'EP Keyboard', instrument: 'electric_piano_1', program: 4 },
        1: { name: 'Lead Guitar', instrument: 'electric_guitar_clean', program: 27 },
      }
    }
    setTracks(t)
    setNotes(n)
    setActiveTrack(0)
    setHistory([{ notes: n, tracks: t }])
    setHistoryIndex(0)
  }

  const totalGridWidth = useMemo(
    () => studioMeasurements.totalWidth,
    [studioMeasurements.totalWidth],
  )
  const totalGridHeight = useMemo(() => {
    const totalSubdivisions = Math.ceil(totalDuration * (bpm / 60) * 4)
    return totalSubdivisions * zoomY + PLAYHEAD_BOTTOM
  }, [totalDuration, bpm, zoomY])

  // CSS variables for background repeating grid lines & vertical lanes matching note thickness
  const gridBackgroundStyle = useMemo(() => {
    const laneStops: string[] = []
    for (let m = minMidi; m <= maxMidi; m++) {
      const lane = studioMeasurements.lanes[m]
      if (!lane) continue
      const isBlack = lane.isBlack
      const color = isBlack ? 'rgba(0, 0, 0, 0.45)' : 'rgba(255, 255, 255, 0.025)'
      const startX = isBlack ? lane.left : lane.noteLeft
      const endX = isBlack ? lane.left + lane.width : lane.noteLeft + lane.noteWidth
      laneStops.push(
        `rgba(255, 255, 255, 0.05) ${startX}px, ${color} ${startX + 1}px, ${color} ${endX - 1}px, rgba(255, 255, 255, 0.05) ${endX}px`,
      )
    }
    const lanesGradient = `linear-gradient(90deg, ${laneStops.join(', ')})`

    return {
      '--zoomY': `${zoomY}px`,
      backgroundImage: `
        repeating-linear-gradient(180deg, rgba(229, 226, 225, 0.03) 0px, rgba(229, 226, 225, 0.03) 1px, transparent 1px, transparent var(--zoomY)),
        repeating-linear-gradient(180deg, rgba(229, 226, 225, 0.08) 0px, rgba(229, 226, 225, 0.08) 1px, transparent 1px, transparent calc(var(--zoomY) * 4)),
        repeating-linear-gradient(180deg, rgba(208, 188, 255, 0.25) 0px, rgba(208, 188, 255, 0.25) 2px, transparent 2px, transparent calc(var(--zoomY) * 16)),
        ${lanesGradient}
      `,
      backgroundSize: `100% auto, 100% auto, 100% auto, ${studioMeasurements.totalWidth}px auto`,
    } as React.CSSProperties
  }, [zoomY, minMidi, maxMidi, studioMeasurements])

  // Selected note details
  const selectedNote = selectedNoteIndex !== null ? notes[selectedNoteIndex] : null

  return (
    <div
      style={{
        height: '100vh',
        width: '100vw',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
      }}
      className="bg-[#131313] font-sans text-[#e5e2e1] select-none"
    >
      {/* Studio Header (Fully Adaptive DAW Layout) */}
      <header className="custom-scrollbar z-30 flex h-auto min-h-[140px] w-full shrink-0 flex-wrap items-center justify-between gap-4 border-b border-[#353534]/50 bg-[#131313] px-6 py-2.5 shadow-md lg:flex-nowrap">
        {/* 1. Left Zone: Enlarged Track Identity ON TOP, Media Player DIRECTLY UNDERNEATH */}
        <div className="flex min-w-[320px] flex-1 items-center">
          <div className="flex h-32 w-full flex-col justify-between py-0.5">
            {/* Top Row: Enlarged Back Button, Loomo Logo & Track Name */}
            <div className="flex items-center gap-4">
              <button
                onClick={() => {
                  stopPlayback()
                  navigate(-1)
                }}
                className="flex shrink-0 cursor-pointer items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-sm font-bold text-[#9ba4ff] shadow-sm transition-all hover:bg-white/10 active:scale-95"
              >
                <ArrowLeft className="h-4 w-4" />
                <span>Back</span>
              </button>

              <div className="h-5 w-[1px] shrink-0 bg-[#353534]" />

              <div className="flex min-w-0 flex-1 items-center gap-3.5">
                <Link
                  to="/"
                  onClick={() => stopPlayback()}
                  className="group mr-1 flex shrink-0 items-center gap-2.5"
                >
                  <Logo
                    height={40}
                    width={60}
                    className="h-10 w-[60px] shadow-[0_0_22px_rgba(108,121,240,0.55)]"
                  />
                  <span className="cursor-pointer text-3xl font-black tracking-tight text-white transition-all group-hover:text-[#9ba4ff]">
                    loomo
                  </span>
                </Link>
                <span className="shrink-0 text-2xl font-light text-white/30">/</span>
                <input
                  type="text"
                  value={songName}
                  onChange={(e) => setSongName(e.target.value)}
                  className="max-w-[280px] min-w-[120px] flex-1 bg-transparent text-2xl font-black tracking-tight text-white transition-all focus:border-b-2 focus:border-[#9ba4ff] focus:outline-none"
                  style={{
                    width: `${Math.max(10, songName.length + 1)}ch`,
                  }}
                />
              </div>
            </div>

            {/* Bottom Row: Media Player Transport Controls (Adaptive Layout) */}
            <div className="flex w-fit max-w-full items-center gap-4 overflow-x-auto rounded-2xl border border-white/10 bg-white/5 px-4 py-2 shadow-md backdrop-blur-md">
              <div className="flex shrink-0 items-center gap-2">
                <button
                  onClick={() => seekTo(0)}
                  title="Skip to Beginning"
                  className="flex h-8.5 w-8.5 cursor-pointer items-center justify-center rounded-xl bg-white/5 text-white/80 transition-all hover:bg-white/10 hover:text-white"
                >
                  <SkipBack className="h-4 w-4" />
                </button>
                <button
                  onClick={togglePlayback}
                  className={`flex h-8.5 w-8.5 cursor-pointer items-center justify-center rounded-xl transition-all ${
                    isPlaying
                      ? 'bg-[#9ba4ff] text-[#131313]'
                      : 'bg-white/5 text-white hover:bg-white/10'
                  }`}
                >
                  {isPlaying ? (
                    <Pause className="h-4 w-4 fill-current" />
                  ) : (
                    <Play className="ml-0.5 h-4 w-4 fill-current" />
                  )}
                </button>
                <button
                  onClick={stopPlayback}
                  className="flex h-8.5 w-8.5 cursor-pointer items-center justify-center rounded-xl bg-white/5 text-white/80 transition-all hover:bg-white/10 hover:text-white"
                >
                  <Square className="h-4 w-4 fill-current" />
                </button>
                <button
                  onClick={() => seekTo(totalDuration)}
                  title="Skip to End"
                  className="flex h-8.5 w-8.5 cursor-pointer items-center justify-center rounded-xl bg-white/5 text-white/80 transition-all hover:bg-white/10 hover:text-white"
                >
                  <SkipForward className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setIsLooping(!isLooping)}
                  title="Toggle Loop"
                  className={`flex h-8.5 w-8.5 cursor-pointer items-center justify-center rounded-xl transition-all ${
                    isLooping
                      ? 'bg-[#9ba4ff]/20 text-[#9ba4ff]'
                      : 'bg-white/5 text-white/80 hover:bg-white/10'
                  }`}
                >
                  <Repeat className="h-4 w-4" />
                </button>
              </div>

              <div className="h-5 w-[1px] shrink-0 bg-white/15" />

              <div className="flex shrink-0 items-center gap-2 text-sm font-semibold text-white">
                <span className="font-semibold text-white/70">BPM:</span>
                <input
                  type="number"
                  value={bpm}
                  min={40}
                  max={280}
                  onChange={(e) => setBpm(Number(e.target.value))}
                  className="w-14 rounded-lg border border-white/10 bg-white/5 py-1 text-center font-mono text-sm font-bold text-[#c0c7ff] focus:outline-none"
                />
              </div>

              <div className="h-5 w-[1px] shrink-0 bg-white/15" />

              <div className="shrink-0 font-mono text-sm font-bold text-[#c0c7ff] tabular-nums">
                {(isPlaying || isDraggingPlayheadRef.current || hasManuallyMovedPlayheadRef.current
                  ? playbackTime
                  : (scrolledTime ?? playbackTime)
                ).toFixed(2)}
                s / {totalDuration}s
              </div>
            </div>
          </div>
        </div>

        {/* 2. Center Section: Vertical Pitch Bend & Dynamically Resizing Visual EQ */}
        <div className="my-auto flex max-w-[560px] min-w-[280px] flex-1 items-center gap-3">
          {/* Pitch Bend Module */}
          <div className="flex h-32 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-[#16161d] px-3 py-2 shadow-xl backdrop-blur-md">
            <TouchPitchBend />
          </div>

          {/* Visual EQ Adapts Dynamically */}
          <VisualEQ className="w-full min-w-0 flex-1" />
        </div>

        {/* 4. Center-Right & Right Section: Discrete Knobs & Faders Modules + Stacked Actions */}
        <div className="flex shrink-0 items-center gap-4">
          {/* Hardware Control Matrix (Separate Knobs & Faders Panels) */}
          <StudioEffectsBar />

          <div className="h-32 w-[1px] bg-[#353534]/60" />

          {/* Action Buttons Block */}
          <div className="flex items-center gap-3">
            {/* Unified Block: Resized "Save" Button ON TOP, Undo/Redo Pill DIRECTLY UNDERNEATH */}
            <div className="flex w-28 flex-col justify-center gap-2">
              {/* Primary File Management Button (Enlarged Text & Icon) */}
              <button
                onClick={handleSaveToLibrary}
                className={`flex h-9 w-full items-center justify-center gap-2 rounded-xl border px-3 text-sm font-bold transition-all ${
                  isFullySaved
                    ? 'cursor-default border-white/15 bg-white/5 font-semibold text-white/50'
                    : 'cursor-pointer border-emerald-400 bg-emerald-600 font-bold text-white shadow-[0_0_16px_rgba(16,185,129,0.45)] active:scale-95'
                }`}
                disabled={isFullySaved}
              >
                <Save className={`h-5 w-5 ${isFullySaved ? 'text-white/40' : 'text-white'}`} />
                <span>{isFullySaved ? 'Saved' : 'Save'}</span>
              </button>

              {/* Secondary Timeline Action Pill (Enlarged Icons) */}
              <div className="flex h-9 w-full items-center gap-1 rounded-xl border border-white/10 bg-white/5 p-1">
                <button
                  onClick={handleUndo}
                  disabled={historyIndex <= 0}
                  title="Undo"
                  className="flex flex-1 cursor-pointer items-center justify-center rounded-lg py-1 text-white transition-colors hover:bg-white/10 disabled:opacity-30 disabled:hover:bg-transparent"
                >
                  <Undo2 className="h-5 w-5" />
                </button>
                <button
                  onClick={handleRedo}
                  disabled={historyIndex >= history.length - 1}
                  title="Redo"
                  className="flex flex-1 cursor-pointer items-center justify-center rounded-lg py-1 text-white transition-colors hover:bg-white/10 disabled:opacity-30 disabled:hover:bg-transparent"
                >
                  <Redo2 className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Export MIDI Button (Enlarged Icon & Text) */}
            <button
              onClick={handleDownloadMIDI}
              className="flex h-[78px] cursor-pointer items-center justify-center gap-2 rounded-2xl border border-white/15 bg-white/5 px-4 py-3.5 text-sm font-bold text-white shadow-sm transition-all hover:bg-white/10"
            >
              <Download className="h-6 w-6 text-[#cbc3d7]" />
              <span className="hidden xl:inline">Export</span>
            </button>

            {/* Play Button (Enlarged Icon & Text) */}
            <button
              onClick={() => handleSaveAndPractice()}
              className="flex h-[78px] cursor-pointer items-center justify-center gap-2.5 rounded-2xl bg-[#6c79f0] px-5 py-3.5 text-base font-extrabold text-white shadow-[0_0_20px_rgba(108,121,240,0.5)] transition-all hover:bg-[#8591ff] active:scale-95"
            >
              <Play className="h-6 w-6 fill-current" />
              <span>Play</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Studio Work Area */}
      <div
        style={{
          display: 'flex',
          flex: 1,
          overflow: 'hidden',
          position: 'relative',
          minHeight: 0,
        }}
      >
        {/* Left Track Manager (Modernized Instrument Sidebar) */}
        <AnimatePresence initial={false}>
          {sidebarOpen && (
            <motion.aside
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 280, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              className="z-30 flex h-full flex-col overflow-hidden border-r border-[#353534]/50 bg-[#171717] select-none"
            >
              <div className="flex items-center justify-between border-b border-[#353534]/40 px-4 py-3.5">
                <span className="text-xs font-bold tracking-wider text-white uppercase">
                  Tracks
                </span>
                <button
                  onClick={addTrack}
                  className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-[#9ba4ff]/20 bg-[#9ba4ff]/10 px-2.5 py-1 text-xs font-bold text-[#9ba4ff] transition-all hover:bg-[#9ba4ff]/20 hover:text-[#8591ff]"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Add</span>
                </button>
              </div>

              {/* Scrollable Track list */}
              <div className="custom-scrollbar flex-1 space-y-3 overflow-y-auto p-4">
                {Object.entries(tracks).map(([idStr, track]) => {
                  const trackId = Number(idStr)
                  const isActive = activeTrack === trackId
                  const isMuted = mutedTracks.has(trackId)
                  const isSolo = soloTracks.has(trackId)

                  return (
                    <div
                      key={trackId}
                      onClick={() => setActiveTrack(trackId)}
                      className={`cursor-pointer rounded-2xl border p-3.5 transition-all select-none ${
                        isActive
                          ? 'border-[#9ba4ff] bg-[#202025] opacity-100 shadow-[0_0_20px_rgba(155,164,255,0.2)] ring-1 ring-[#9ba4ff]/60'
                          : 'border-white/5 bg-white/[0.03] opacity-55 hover:border-white/15 hover:bg-white/5 hover:opacity-85'
                      }`}
                    >
                      <div className="mb-3 flex items-center justify-between">
                        <input
                          type="text"
                          value={track.name || ''}
                          onClick={(e) => e.stopPropagation()}
                          onChange={(e) => updateTrackName(trackId, e.target.value)}
                          className="w-3/4 bg-transparent text-sm font-bold tracking-wide text-white focus:border-b focus:border-[#9ba4ff] focus:outline-none"
                        />
                        {Object.keys(tracks).length > 1 && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              deleteTrack(trackId)
                            }}
                            className="cursor-pointer rounded-lg p-1 text-red-400/75 transition-colors hover:bg-red-500/10 hover:text-red-400"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>

                      {/* Modernized Instrument Pill Component */}
                      <div className="mb-3">
                        <InstrumentPillSelect
                          value={(track.instrument as InstrumentName) || 'acoustic_grand_piano'}
                          onSelect={(inst) => updateTrackInstrument(trackId, inst)}
                        />
                      </div>

                      {/* Mute/Solo/Play controls - Modernized 3-column equal grid layout with high-readability font sizing */}
                      <div className="grid w-full grid-cols-3 gap-1.5 border-t border-white/10 pt-2.5">
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            toggleMute(trackId)
                          }}
                          className={`flex w-full cursor-pointer items-center justify-center rounded-xl border py-2 text-xs font-extrabold tracking-wide transition-all sm:text-[13px] ${
                            isMuted
                              ? 'border-red-500/40 bg-red-500/20 text-red-400 shadow-[0_0_12px_rgba(239,68,68,0.25)]'
                              : 'border-white/15 bg-white/10 text-white/80 hover:bg-white/20 hover:text-white'
                          }`}
                        >
                          Mute
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            toggleSolo(trackId)
                          }}
                          className={`flex w-full cursor-pointer items-center justify-center rounded-xl border py-2 text-xs font-extrabold tracking-wide transition-all sm:text-[13px] ${
                            isSolo
                              ? 'border-yellow-500/40 bg-yellow-500/20 text-yellow-400 shadow-[0_0_12px_rgba(234,179,8,0.25)]'
                              : 'border-white/15 bg-white/10 text-white/80 hover:bg-white/20 hover:text-white'
                          }`}
                        >
                          Solo
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            handleSaveAndPractice(trackId)
                          }}
                          title="Play this Track"
                          className="flex w-full cursor-pointer items-center justify-center rounded-xl border border-[#8591ff] bg-[#6c79f0] py-2 text-xs font-extrabold tracking-wide text-white shadow-[0_0_15px_rgba(108,121,240,0.35)] transition-all hover:bg-[#8591ff] active:scale-95 sm:text-[13px]"
                        >
                          Play
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Preset sketch templates */}
              {notes.length === 0 && (
                <div className="space-y-3 border-t border-[#353534]/30 bg-[#131313]/50 p-4">
                  <span className="text-[10px] font-bold tracking-wider text-white/60 uppercase">
                    Presets Sketches
                  </span>
                  <div className="grid grid-cols-3 gap-1">
                    <button
                      onClick={() => applyTemplate('simple')}
                      className="cursor-pointer rounded-lg border border-white/10 bg-white/5 p-1.5 text-center text-[10px] font-semibold text-white transition-colors hover:bg-white/10"
                    >
                      Solo Piano
                    </button>
                    <button
                      onClick={() => applyTemplate('duet')}
                      className="cursor-pointer rounded-lg border border-white/10 bg-white/5 p-1.5 text-center text-[10px] font-semibold text-white transition-colors hover:bg-white/10"
                    >
                      Synth/Bass
                    </button>
                    <button
                      onClick={() => applyTemplate('sketch')}
                      className="cursor-pointer rounded-lg border border-white/10 bg-white/5 p-1.5 text-center text-[10px] font-semibold text-white transition-colors hover:bg-white/10"
                    >
                      EP/Guitar
                    </button>
                  </div>
                </div>
              )}
            </motion.aside>
          )}
        </AnimatePresence>

        {/* Sidebar Toggle Handle */}
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="absolute top-1/2 left-[280px] z-40 flex h-16 w-3.5 -translate-y-1/2 cursor-pointer items-center justify-center rounded-r-lg border border-l-0 border-[#353534]/50 bg-[#171717] text-[#cbc3d7] hover:bg-[#202020]"
          style={{ left: sidebarOpen ? '280px' : '0px' }}
        >
          <SlidersHorizontal className="h-2 w-2 rotate-90" />
        </button>

        {/* Right panel — timeline + grid + piano */}
        <div
          ref={containerRef}
          style={{ position: 'relative', flex: 1, overflow: 'hidden', background: '#1a1a1a' }}
        >
          {/* Timeline bar — pinned to top */}
          <div
            style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 36 }}
            className="z-20 flex items-center justify-between border-b border-[#353534]/50 bg-[#131313] px-5 text-xs font-semibold select-none"
          >
            <span className="text-xs font-bold tracking-wider text-white/70 uppercase">
              Timeline
            </span>
            <div className="flex items-center gap-3">
              <span className="font-medium text-white/70">Zoom:</span>
              <div className="flex rounded-lg border border-white/10 bg-white/5 p-0.5">
                {[32, 48, 64, 96].map((z) => (
                  <button
                    key={z}
                    onClick={() => setZoomY(z)}
                    className={`cursor-pointer rounded-md px-2.5 py-0.5 text-xs font-bold transition-all ${
                      zoomY === z
                        ? 'bg-[#9ba4ff] text-[#131313] shadow-sm'
                        : 'text-white/60 hover:text-white'
                    }`}
                  >
                    {z === 32 ? 'S' : z === 48 ? 'M' : z === 64 ? 'L' : 'XL'}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Grid viewport */}
          <div
            style={{
              position: 'absolute',
              top: 36,
              bottom: selectedNote ? KEY_TOP_HEIGHT + 80 : KEY_TOP_HEIGHT,
              left: 0,
              right: 0,
              overflow: 'hidden',
            }}
          >
            {/* Interactive Playhead line & time handle */}
            <div
              onMouseDown={handlePlayheadMouseDown}
              onClick={(e) => e.stopPropagation()}
              title="Click or drag to seek time"
              className="group pointer-events-auto absolute right-0 left-0 z-[60] flex h-6 cursor-ns-resize items-center select-none"
              style={{ bottom: PLAYHEAD_BOTTOM - 12 }}
            >
              <div className="h-[3px] w-full bg-[#9ba4ff] shadow-[0_0_12px_#9ba4ff] transition-all group-hover:h-[4px] group-hover:bg-[#b8c0ff]" />
              <div className="pointer-events-none absolute left-4 rounded-full border border-white/40 bg-[#9ba4ff] px-2.5 py-0.5 text-[11px] font-black tracking-wider text-[#131313] shadow-xl transition-all group-hover:scale-110">
                {playbackTime.toFixed(2)}s
              </div>
            </div>

            {/* Scrollable note grid */}
            <div
              style={{ width: '100%', height: '100%', overflow: 'auto' }}
              ref={scrollContainerRef}
              onWheel={handleWheel}
              onScroll={handleGridScroll}
            >
              {/* Grid canvas with alternating black/white key vertical lanes */}
              <div
                onClick={(e) => {
                  if (justFinishedDragRef.current) {
                    e.stopPropagation()
                    return
                  }
                  const rect = e.currentTarget.getBoundingClientRect()
                  const clickX = e.clientX - rect.left
                  const clickY = e.clientY - rect.top
                  const gridH = Math.ceil(totalDuration * (bpm / 60) * 4) * zoomY
                  const timeSubdivision = Math.floor((gridH - clickY) / zoomY)

                  let noteMidi = minMidi
                  // Check black key lanes first (since they overlap on top)
                  for (let m = maxMidi; m >= minMidi; m--) {
                    const lane = studioMeasurements.lanes[m]
                    if (lane && lane.isBlack) {
                      if (clickX >= lane.noteLeft && clickX <= lane.noteLeft + lane.noteWidth) {
                        noteMidi = m
                        break
                      }
                    }
                  }
                  if (noteMidi === minMidi) {
                    for (let m = minMidi; m <= maxMidi; m++) {
                      const lane = studioMeasurements.lanes[m]
                      if (lane && !lane.isBlack) {
                        if (clickX >= lane.noteLeft && clickX <= lane.noteLeft + lane.noteWidth) {
                          noteMidi = m
                          break
                        }
                      }
                    }
                  }
                  addNoteAt(noteMidi, timeSubdivision)
                }}
                className="relative cursor-crosshair bg-[#131313] select-none"
                style={{
                  ...gridBackgroundStyle,
                  width: `${totalGridWidth}px`,
                  height: `${totalGridHeight}px`,
                }}
              >
                {notes.map((note, index) => {
                  const isSelected = selectedNoteIndex === index
                  const isNoteActive = note.track === activeTrack
                  const isMuted = mutedTracks.has(note.track)
                  const hasSolo = soloTracks.size > 0
                  const isSolo = soloTracks.has(note.track)
                  const isVisible = hasSolo ? isSolo : !isMuted
                  if (!isVisible) return null

                  const lane = studioMeasurements.lanes[note.midiNote]
                  const left = lane ? (lane.isBlack ? lane.left + 2 : lane.noteLeft + 1) : 0
                  const width = lane ? (lane.isBlack ? lane.width - 4 : lane.noteWidth - 2) : 36
                  const top = timeToY(note.time + note.duration)
                  const height = Math.max(22, durationToHeight(note.duration))
                  const velocityFactor = (note.velocity || 80) / 127

                  const noteName = getNoteName(note.midiNote)
                  const badgeFontSize = Math.max(10, Math.min(18, Math.floor(width * 0.52)))

                  return (
                    <div
                      key={index}
                      onMouseDown={(e) => handleNoteMouseDown(e, index, 'move')}
                      onClick={(e) => handleNoteClick(e, index)}
                      onDoubleClick={(e) => handleNoteDoubleClick(e, index)}
                      onMouseEnter={() => setHoveredNoteIndex(index)}
                      onMouseLeave={() => setHoveredNoteIndex(null)}
                      className={`absolute cursor-move overflow-hidden rounded-2xl border transition-shadow select-none ${
                        isSelected
                          ? 'z-10 border-white bg-[#9ba4ff] text-[#131313] shadow-[0_0_20px_rgba(155,164,255,0.9)]'
                          : isNoteActive
                            ? 'border-[#9ba4ff]/60 bg-[#6c79f0] text-white shadow-[0_0_12px_rgba(108,121,240,0.4)]'
                            : 'border-white/20 bg-white/30 text-white'
                      }`}
                      style={{
                        left: `${left}px`,
                        width: `${width}px`,
                        top: `${top}px`,
                        height: `${height}px`,
                        opacity: isSelected ? 1 : 0.5 + velocityFactor * 0.5,
                      }}
                    >
                      {hoveredNoteIndex === index && (
                        <div className="pointer-events-none absolute -top-9 left-1/2 z-30 -translate-x-1/2 rounded-lg border border-white/20 bg-black px-2.5 py-0.5 text-xs font-black whitespace-nowrap text-white shadow-xl">
                          {note.finger ?? '—'}
                        </div>
                      )}

                      {/* Perfectly centered note text */}
                      <div className="pointer-events-none absolute inset-0 z-0 flex items-center justify-center px-0.5">
                        <span
                          style={{ fontSize: `${badgeFontSize}px` }}
                          className={`max-w-full overflow-hidden text-center leading-none font-black tracking-wide whitespace-nowrap ${
                            isSelected
                              ? 'text-[#131313] drop-shadow-[0_1px_1px_rgba(255,255,255,0.6)]'
                              : 'text-white drop-shadow-[0_1.5px_3px_rgba(0,0,0,0.95)]'
                          }`}
                        >
                          {noteName}
                        </span>
                      </div>

                      {isSelected && note.finger !== undefined && (
                        <span className="absolute right-1 bottom-1 z-10 rounded-full border border-white/20 bg-black/70 px-1.5 py-0.5 text-[11px] leading-none font-black">
                          {note.finger}
                        </span>
                      )}

                      {/* Top Duration Resize Handle */}
                      <div
                        onMouseDown={(e) => handleNoteMouseDown(e, index, 'top')}
                        title="Drag top edge to adjust duration"
                        className="group/top absolute top-0 left-0 z-20 flex h-3.5 w-full cursor-ns-resize items-center justify-center hover:bg-white/30"
                      >
                        <div className="h-[2px] w-5 rounded-full bg-white/40 shadow-sm transition-all group-hover/top:bg-white" />
                      </div>

                      {/* Bottom Duration Resize Handle */}
                      <div
                        onMouseDown={(e) => handleNoteMouseDown(e, index, 'bottom')}
                        title="Drag bottom edge to adjust duration"
                        className="group/bot absolute bottom-0 left-0 z-20 flex h-3.5 w-full cursor-ns-resize items-center justify-center hover:bg-white/30"
                      >
                        <div className="h-[2px] w-5 rounded-full bg-white/40 shadow-sm transition-all group-hover/bot:bg-white" />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>

          {/* Note details panel */}
          {selectedNote && (
            <div
              style={{
                position: 'absolute',
                bottom: KEY_TOP_HEIGHT,
                left: 0,
                right: 0,
                height: 80,
              }}
              className="z-20 flex items-center justify-between border-t border-[#353534]/50 bg-[#171717] px-6"
            >
              <div className="flex items-center gap-6">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <span className="font-medium text-[#cbc3d7]/70">Pitch:</span>
                  <span className="text-base font-bold text-[#9ba4ff]">
                    {getNoteName(selectedNote.midiNote)}
                  </span>
                </div>
                <div className="h-6 w-[1px] bg-[#353534]" />
                <div className="flex items-center gap-3 text-sm font-semibold">
                  <span className="font-medium text-[#cbc3d7]/70">Velocity:</span>
                  <input
                    type="range"
                    min={1}
                    max={127}
                    value={selectedNote.velocity || 80}
                    onChange={(e) => {
                      const updated = [...notes]
                      updated[selectedNoteIndex!] = {
                        ...selectedNote,
                        velocity: Number(e.target.value),
                      }
                      setNotes(updated)
                      pushHistory(updated, tracks)
                    }}
                    className="w-32 cursor-pointer accent-[#9ba4ff]"
                  />
                  <span className="w-6 font-mono text-sm font-bold text-[#9ba4ff]">
                    {selectedNote.velocity || 80}
                  </span>
                </div>
                <div className="h-6 w-[1px] bg-[#353534]" />
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <span className="font-medium text-[#cbc3d7]/70">Duration:</span>
                  <span className="font-mono text-sm font-bold text-[#9ba4ff]">
                    {selectedNote.duration.toFixed(2)}s
                  </span>
                </div>
              </div>
              <button
                onClick={() => deleteNote(selectedNoteIndex!)}
                className="flex cursor-pointer items-center gap-1.5 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-2 text-xs font-bold text-red-400 transition-all hover:bg-red-500/20 hover:text-red-300 active:scale-95"
              >
                <Trash2 className="h-4 w-4" />
                <span>Delete Note</span>
              </button>
            </div>
          )}

          {/* Piano keys — pinned to bottom, matching Play Mode structure */}
          <div
            style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: KEY_TOP_HEIGHT }}
            className="overflow-hidden border-t border-[#353534] bg-[#1a1a1e]"
            ref={pianoScrollRef}
          >
            <div
              className="relative"
              style={{ width: `${studioMeasurements.totalWidth}px`, height: '100%' }}
            >
              {/* White keys rendered first */}
              {whiteKeyNotes.map((key) => {
                const lane = studioMeasurements.lanes[key]
                if (!lane) return null
                const name = getNoteName(key)
                const isC = name.startsWith('C') && !name.includes('#')
                const keyFontSize = Math.max(
                  9,
                  Math.min(isC ? 20 : 16, Math.floor(lane.width * 0.42)),
                )
                return (
                  <div
                    key={key}
                    onMouseDown={() => handleKeyMouseDown(key)}
                    onMouseUp={() => handleKeyMouseUp(key)}
                    onMouseLeave={() => handleKeyMouseUp(key)}
                    className="absolute top-0 flex cursor-pointer flex-col justify-end rounded-b-xl border-r border-[#d4cfc5]/40 bg-gradient-to-b from-[#ffffff] via-[#faf8f2] to-[#e6e2d3] px-1 pb-3 shadow-[inset_0_-6px_12px_rgba(0,0,0,0.06),inset_0_1px_1px_rgba(255,255,255,0.9)] transition-all select-none active:bg-[#e0d6ff]"
                    style={{
                      left: `${lane.left}px`,
                      width: `${lane.width}px`,
                      height: '100%',
                    }}
                  >
                    <span
                      style={{ fontSize: `${keyFontSize}px` }}
                      className={`w-full overflow-hidden text-center font-black tracking-tight whitespace-nowrap uppercase ${isC ? 'text-[#131313]' : 'text-[#131313]'}`}
                    >
                      {isC ? name : name.replace(/\d+/, '')}
                    </span>
                  </div>
                )
              })}

              {/* Black keys rendered on top with note labels */}
              {blackKeyNotes.map((key) => {
                const lane = studioMeasurements.lanes[key]
                if (!lane) return null
                const blackHeight = Math.round(KEY_TOP_HEIGHT * 0.65)
                const name = getNoteName(key)
                const isCSharp = name.startsWith('C#')
                const keyFontSize = Math.max(
                  8,
                  Math.min(isCSharp ? 14 : 12, Math.floor(lane.width * 0.42)),
                )
                return (
                  <div
                    key={key}
                    onMouseDown={() => handleKeyMouseDown(key)}
                    onMouseUp={() => handleKeyMouseUp(key)}
                    onMouseLeave={() => handleKeyMouseUp(key)}
                    className="absolute top-0 z-10 flex cursor-pointer flex-col items-center justify-end rounded-b-lg border-x border-b border-black/90 bg-gradient-to-b from-[#3a3a3a] via-[#1a1a1a] to-[#080808] px-0.5 pb-2 shadow-[0_8px_16px_rgba(0,0,0,0.6),inset_0_-4px_8px_rgba(255,255,255,0.12)] transition-all select-none active:bg-[#505055]"
                    style={{
                      left: `${lane.left}px`,
                      width: `${lane.width}px`,
                      height: `${blackHeight}px`,
                    }}
                  >
                    <span
                      style={{ fontSize: `${keyFontSize}px` }}
                      className={`w-full overflow-hidden text-center font-black tracking-tighter whitespace-nowrap uppercase ${isCSharp ? 'text-white' : 'text-white/95'}`}
                    >
                      {isCSharp ? name : name.replace(/\d+/, '')}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
