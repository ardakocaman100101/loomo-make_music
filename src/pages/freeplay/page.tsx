import midiState, { useRecordMidi } from '@/features/midi'
import { parseMidi } from '@/features/parsers'
import { initialize, registerCustomSketch } from '@/features/persist/persistence'
import { SongVisualizer } from '@/features/SongVisualization'
import { InstrumentName, useSynth } from '@/features/synth'
import { useLazyStableRef } from '@/hooks'
import { StartRecord, StopRecord } from '@/icons'
import { MidiModal } from '@/pages/play/components/MidiModal'
import { MidiStateEvent, SongConfig } from '@/types'
import * as idb from 'idb-keyval'
import { ZoomIn, ZoomOut } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import TopBar from './components/TopBar'
import FreePlayer from './utils/free-player'

export default function FreePlay() {
  const navigate = useNavigate()
  const [instrumentName, setInstrumentName] = useState<InstrumentName>('acoustic_grand_piano')
  const synthState = useSynth(instrumentName)
  const freePlayer = useLazyStableRef(() => new FreePlayer())
  const [isMidiModalOpen, setMidiModal] = useState(false)
  const { isRecording, startRecording, stopRecording } = useRecordMidi(midiState)

  const ppsScales = [0.5, 0.75, 1.0, 1.5, 2.0, 3.0, 4.0]
  const [scaleIndex, setScaleIndex] = useState(2) // Default to 1.0 (index 2)

  const handleRecordToggle = useCallback(async () => {
    if (!isRecording) {
      freePlayer.start()
      startRecording()
    } else {
      freePlayer.stop()
      const midiBytes = stopRecording()
      if (midiBytes !== null && midiBytes.length > 0) {
        try {
          const parsedSong = parseMidi(midiBytes as any)
          const songId = `recorded_${Date.now()}`
          const songTitle = `Practice Recording ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`

          // Save parsed song data directly to IndexedDB SONG_DATA_${id}
          const songToSave = {
            ...parsedSong,
            secondsToTicks: undefined,
            ticksToSeconds: undefined,
          }
          await idb.set(`SONG_DATA_${songId}`, songToSave)

          // Seamless transition to Studio without registering to the library
          navigate(`/studio?id=${songId}&source=upload`)
        } catch (err) {
          console.error('Error packaging recorded MIDI:', err)
          alert('Error packaging recorded performance.')
        }
      }
    }
  }, [isRecording, startRecording, stopRecording, freePlayer, navigate])

  const handleNoteDown = useCallback(
    (note: number, velocity: number = 80) => {
      if (note !== undefined) {
        synthState.synth.playNote(note, velocity)
      }
      freePlayer.addNote(note, velocity)
    },
    [freePlayer, synthState.synth],
  )

  const handleNoteUp = useCallback(
    (note: number) => {
      if (note !== undefined) {
        synthState.synth.stopNote(note)
      }
      freePlayer.releaseNote(note)
    },
    [freePlayer, synthState.synth],
  )

  useEffect(() => {
    const handleMidiStateEvent = (e: MidiStateEvent) => {
      // If it comes from drum pads (MIDI channel 10 / index 9)
      if (e.channel === 9) {
        if (e.type === 'down' && e.note !== undefined) {
          console.log(`[Pad Mapping] Drum pad pressed: note = ${e.note}, velocity = ${e.velocity}`)
          // Map 7th pad (note 42 on Akai MPK Mini Bank A, note 47 on Arturia/Novation defaultSnare, or 48) to toggle recording
          if (e.note === 42 || e.note === 47 || e.note === 48 || e.note === 46) {
            handleRecordToggle()
          }
        }
        return // Do not pass drum pad messages to normal piano lane sounds
      }

      if (e.type === 'up') {
        if (e.note !== undefined) {
          handleNoteUp(e.note)
        }
      } else if (e.type === 'down') {
        if (e.note !== undefined) {
          handleNoteDown(e.note, e.velocity)
        }
      }
    }
    midiState.subscribe(handleMidiStateEvent)
    return () => {
      midiState.unsubscribe(handleMidiStateEvent)
    }
  }, [handleNoteDown, handleNoteUp, handleRecordToggle])

  return (
    <>
      <title>Practice Mode</title>
      <div
        className="flex h-screen w-screen flex-col bg-[#16182c] outline-none"
        {...midiState.getListenerProps()}
        autoFocus
      >
        <TopBar
          onClickBack={() => {
            freePlayer.stop()
            navigate(-1)
          }}
          onClickHome={() => {
            freePlayer.stop()
          }}
          onClickMidi={(e) => {
            e.stopPropagation()
            setMidiModal(!isMidiModalOpen)
          }}
        />
        <MidiModal isOpen={isMidiModalOpen} onClose={() => setMidiModal(false)} />

        {/* Floating Zoom Controls (Left Side, like Play Mode) */}
        <div className="pointer-events-auto absolute top-[40%] left-6 z-30 flex -translate-y-1/2 flex-col gap-4 select-none">
          <div className="flex w-[52px] flex-col justify-between overflow-hidden rounded-[20px] border border-white/5 bg-black/45 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.15),0_8px_32px_0_rgba(0,0,0,0.37)] backdrop-blur-xl">
            <button
              className="flex cursor-pointer items-center justify-center border-0 bg-transparent p-3.5 text-white/70 transition hover:bg-white/5 hover:text-white"
              onClick={() => setScaleIndex((i) => Math.min(ppsScales.length - 1, i + 1))}
              title="Zoom In"
            >
              <ZoomIn className="h-5 w-5" />
            </button>
            <div className="h-[1px] w-full bg-white/10" />
            <button
              className="flex cursor-pointer items-center justify-center border-0 bg-transparent p-3.5 text-white/70 transition hover:bg-white/5 hover:text-white"
              onClick={() => setScaleIndex((i) => Math.max(0, i - 1))}
              title="Zoom Out"
            >
              <ZoomOut className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Floating Record Toggle Button (Right Side, side of the last note lane's right) */}
        <div className="pointer-events-auto absolute top-[40%] right-6 z-30 flex -translate-y-1/2 flex-col gap-4 select-none">
          <button
            onClick={handleRecordToggle}
            className="flex h-14 w-14 cursor-pointer items-center justify-center rounded-full border border-white/5 bg-black/45 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.15),0_8px_32px_0_rgba(0,0,0,0.37)] backdrop-blur-xl transition-all hover:bg-white/5 active:scale-95"
            title={isRecording ? 'Stop Recording' : 'Start Recording'}
          >
            {isRecording ? (
              <StopRecord
                size={28}
                className="animate-pulse text-red-500 transition-colors hover:text-red-400"
              />
            ) : (
              <StartRecord size={28} className="text-white/70 transition-colors hover:text-white" />
            )}
          </button>
        </div>

        <div className="relative grow">
          <SongVisualizer
            song={freePlayer.song}
            config={{ visualization: 'reverse-waterfall', noteLabels: 'none' } as SongConfig}
            hand="both"
            handSettings={{ 1: { hand: 'right', practice: false } }}
            getTime={() => freePlayer.getTime()}
            constrictView={false}
            ppsScale={ppsScales[scaleIndex]}
          />
        </div>
      </div>
    </>
  )
}
