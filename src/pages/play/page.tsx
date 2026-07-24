import { SongScrubBar } from '@/features/controls'
import { useSong } from '@/features/data'
import { useSongMetadata } from '@/features/data/library'
import midiState, { initializeMidi } from '@/features/midi'
import { requiresPermissionAtom, scanFolders } from '@/features/persist/persistence'
import { usePlayer } from '@/features/player'
import { getHandSettings, getSongSettings, SongVisualizer } from '@/features/SongVisualization'
import {
  useEventListener,
  useLazyStableRef,
  useOnUnmount,
  usePlayerState,
  useRAFLoop,
  useSongSettings,
  useWakeLock,
} from '@/hooks'
import { MidiStateEvent, SongSource } from '@/types'
import { formatTime } from '@/utils'
import clsx from 'clsx'
import { useAtomValue } from 'jotai'
import {
  AlertCircle,
  ArrowLeft,
  RefreshCw,
  ZoomIn,
  ZoomOut,
  SkipBack,
  SkipForward,
  Repeat,
  Target,
  Play,
  Pause,
  Loader2,
} from 'lucide-react'
import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { TopBar, TrackHUD } from './components'
import { ButtonWithTooltip } from './components/TopBar'
import { MidiModal } from './components/MidiModal'
import { StatsPopup } from './components/StatsPopup'

function RequiresPermissionPrompt({
  onGrantPermission,
  onGoBack,
}: {
  onGrantPermission: () => void
  onGoBack: () => void
}) {
  return (
    <div className="flex h-screen items-center justify-center bg-gray-50">
      <div className="mx-auto max-w-md rounded-lg bg-white p-6 shadow-lg">
        <div className="mb-4 flex items-center gap-3">
          <AlertCircle className="h-6 w-6 text-orange-500" />
          <h2 className="text-lg font-medium text-gray-900">Permission Required</h2>
        </div>
        <p className="mb-6 text-sm text-gray-600">
          We need permission to access your music files. Please grant access to continue playing
          this song.
        </p>
        <div className="flex gap-3">
          <button
            onClick={onGoBack}
            className="flex items-center gap-2 rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
          >
            <ArrowLeft className="h-4 w-4" />
            Go Back
          </button>
          <button
            onClick={onGrantPermission}
            className="flex items-center gap-2 rounded-md bg-black px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-gray-800"
          >
            <RefreshCw className="h-4 w-4" />
            Grant Permission
          </button>
        </div>
      </div>
    </div>
  )
}

function SongNotFound({ songTitle, onGoBack }: { songTitle?: string; onGoBack: () => void }) {
  return (
    <div className="flex h-screen items-center justify-center bg-gray-50">
      <div className="mx-auto max-w-md rounded-lg bg-white p-6 text-center shadow-lg">
        <div className="mb-4">
          <AlertCircle className="mx-auto h-12 w-12 text-red-500" />
        </div>
        <h2 className="mb-2 text-lg font-medium text-gray-900">Song Not Found</h2>
        {songTitle && (
          <p className="mb-4 text-sm text-gray-600">
            Could not load "{songTitle}". The file may have been moved or deleted.
          </p>
        )}
        <p className="mb-6 text-sm text-gray-500">
          Please check that the file still exists or try selecting a different song. It may also be
          that Sightread lost access to your local files. If that's the case, please re-scan
          directories in the "Manage Folders" menu.
        </p>
        <button
          onClick={onGoBack}
          className="mx-auto flex cursor-pointer items-center gap-2 rounded-md bg-black px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-gray-800"
        >
          <ArrowLeft className="h-4 w-4" />
          Go Back to Song List
        </button>
      </div>
    </div>
  )
}

export default function PlaySongPage() {
  const [searchParams, _setSearchParams] = useSearchParams()
  const navigate = useNavigate()
  let { source, id, recording }: { source: SongSource; id: string; recording?: string } =
    Object.fromEntries(searchParams) as any

  // If source or id is messed up, redirect to the homepage
  if (!source || !id) {
    navigate('/', { replace: true })
    return null
  }
  id = decodeURIComponent(id)

  const player = usePlayer()
  const [isMidiModalOpen, setMidiModal] = useState(false)
  const [statsVisible, setStatsVisible] = useState(true)
  const ppsScales = [0.5, 0.75, 1.0, 1.5, 2.0, 3.0, 4.0]
  const [scaleIndex, setScaleIndex] = useState(3)

  const elapsedRef = useRef<HTMLSpanElement>(null)
  useRAFLoop(() => {
    if (elapsedRef.current && song) {
      const time = player.getRealTimeDuration(0, player.getTime())
      const total = player.getRealTimeDuration(0, song.duration)
      elapsedRef.current.innerText = `${formatTime(time)} / ${formatTime(total)}`
    }
  })

  const currentBpm = useAtomValue(player.currentBpm)
  const bpmModifier = useAtomValue(player.bpmModifier)

  const handleDecreaseBpm10 = React.useCallback(() => {
    const newBpm = Math.max(20, currentBpm - 10)
    const newModifier = bpmModifier * (newBpm / currentBpm)
    player.store.set(player.bpmModifier, Math.round(newModifier * 100) / 100)
    const backingTrack = player.getSong()?.backing
    if (backingTrack) {
      backingTrack.playbackRate = newModifier
    }
  }, [currentBpm, bpmModifier, player])

  const handleIncreaseBpm10 = React.useCallback(() => {
    const newBpm = Math.min(300, currentBpm + 10)
    const newModifier = bpmModifier * (newBpm / currentBpm)
    player.store.set(player.bpmModifier, Math.round(newModifier * 100) / 100)
    const backingTrack = player.getSong()?.backing
    if (backingTrack) {
      backingTrack.playbackRate = newModifier
    }
  }, [currentBpm, bpmModifier, player])

  const handleBpmInputChange = React.useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value, 10)
    if (!isNaN(val) && val >= 20 && val <= 300) {
      const newModifier = bpmModifier * (val / currentBpm)
      player.store.set(player.bpmModifier, Math.round(newModifier * 100) / 100)
      const backingTrack = player.getSong()?.backing
      if (backingTrack) {
        backingTrack.playbackRate = newModifier
      }
    }
  }, [currentBpm, bpmModifier, player])

  const handleWheel = React.useCallback((e: React.WheelEvent) => {
    if (e.ctrlKey) {
      e.preventDefault()
      setScaleIndex((i) => e.deltaY < 0 ? Math.min(ppsScales.length - 1, i + 1) : Math.max(0, i - 1))
    }
  }, [ppsScales.length])
  const playerState = usePlayerState()
  const instrumentVolume = useAtomValue(player.instrumentVolume)
  let { data: song, error, isLoading, mutate } = useSong(id, source)
  let songMeta = useSongMetadata(id, source)
  const range = useAtomValue(player.getRange())
  const selectedRange = useMemo(
    () => (range ? { start: range[0], end: range[1] } : undefined),
    [range],
  )
  const isLooping = !!range
  const requiresPermission = useAtomValue(requiresPermissionAtom)
  const songLoop = useAtomValue(player.songLoop)

  const [songConfig, setSongConfig] = useSongSettings(id)
  const isRecording = !!recording
  useWakeLock()

  // Make sure MIDI is active and initialized on mount
  useEffect(() => {
    initializeMidi()
  }, [])

  const hand =
    songConfig.left && songConfig.right
      ? 'both'
      : songConfig.left
        ? 'left'
        : songConfig.right
          ? 'right'
          : 'none'

  // Hack for updating player when config changes.
  // Maybe move to the onChange? Or is this chill.
  const { waiting, left, right } = songConfig
  useEffect(() => {
    player.setWait(waiting)
    if (left && right) {
      player.setHand('both')
    } else {
      player.setHand(left ? 'left' : 'right')
    }
  }, [waiting, left, right, player])

  useEffect(() => {
    if (!song) return
    player.trackConfigs = songConfig.tracks
    Object.entries(songConfig.tracks).forEach(([id, settings]) => {
      player.setTrackVolume(Number(id), settings.sound ? 1 : 0)
    })
  }, [songConfig.tracks, player, song])

  useOnUnmount(() => player.stop())

  useEffect(() => {
    if (!song) return
    // TODO: handle invalid song. Pipe up not-found midi for 400s etc.
    let config = getSongSettings(id, song)

    const practiceTrackIdParam = searchParams.get('practiceTrackId')
    if (practiceTrackIdParam !== null) {
      const practiceTrackId = Number(practiceTrackIdParam)
      if (!isNaN(practiceTrackId)) {
        const updatedTracks = { ...config.tracks }
        Object.keys(updatedTracks).forEach((trackIdStr) => {
          const trackId = Number(trackIdStr)
          const isTarget = trackId === practiceTrackId
          updatedTracks[trackId] = {
            ...updatedTracks[trackId],
            practice: isTarget,
            sound: isTarget,
          }
        })
        config = {
          ...config,
          tracks: updatedTracks,
        }
      }
    }

    setSongConfig(config)
    player.setSong(song, config)

    // Auto-enable progressive learning if the song title indicates it
    if (songMeta?.title?.startsWith('Progressive:')) {
      player.store.set(player.progressiveMode, true)
      player.store.set(player.completedTracks, new Set<number>())

      const tracks = Object.keys(song.tracks).map(Number).sort((a, b) => a - b)
      if (tracks.length > 0) {
        player.setupProgressiveRegion_(tracks[0])
      }
    } else {
      player.store.set(player.progressiveMode, false)
    }
  }, [song, setSongConfig, id, player, songMeta?.title, searchParams])

  useEventListener<KeyboardEvent>('keydown', (evt: KeyboardEvent) => {
    if (evt.code === 'Space') {
      evt.preventDefault()
      player.toggle()
    } else if (evt.shiftKey && evt.code === 'Comma') {
      player.seekToPreviousMeasure()
    } else if (evt.shiftKey && evt.code === 'Period') {
      player.seekToNextMeasure()
    } else if (evt.code === 'Comma') {
      player.seek(player.currentSongTime - 16 / 1000)
    } else if (evt.code === 'Period') {
      player.seek(player.currentSongTime + 16 / 1000)
    } else if (evt.code === 'ArrowLeft') {
      evt.preventDefault()
      player.restart()
    } else if (evt.code === 'ArrowRight') {
      evt.preventDefault()
      player.seek(player.getDuration())
    }
  })

  const handleToggleMute = React.useCallback(
    (trackId: number) => {
      setSongConfig((prev) => {
        const current = prev.tracks[trackId]
        return {
          ...prev,
          tracks: {
            ...prev.tracks,
            [trackId]: { ...current, sound: !current.sound },
          },
        }
      })
    },
    [setSongConfig],
  )

  const handleSolo = React.useCallback(
    (trackId: number) => {
      setSongConfig((prev) => {
        const newTracks = { ...prev.tracks }
        Object.keys(newTracks).forEach((id) => {
          const numericId = Number(id)
          newTracks[numericId] = {
            ...newTracks[numericId],
            sound: numericId === trackId,
          }
        })
        return { ...prev, tracks: newTracks }
      })
    },
    [setSongConfig],
  )

  const handleTogglePractice = React.useCallback(
    (trackId: number) => {
      setSongConfig((prev) => {
        const current = prev.tracks[trackId]
        return {
          ...prev,
          tracks: {
            ...prev.tracks,
            [trackId]: { ...current, practice: !current.practice },
          },
        }
      })
    },
    [setSongConfig],
  )

  useOnUnmount(() => player.stop())

  useEffect(() => {
    const handleMidiEvent = ({ type, note, velocity, cc, value }: MidiStateEvent) => {
      console.log('PlayPage handleMidiEvent', type, note, velocity)
      if (type === 'down' && note !== undefined) {
        player.playUserNote(note, velocity!)
      } else if (type === 'up' && note !== undefined) {
        player.stopUserNote(note)
      } else if (type === 'cc') {
        // Knob 1 (CC 74): Volume
        if (cc === 74) {
          player.setVolume(value! / 127)
        }
        // Transport: Stop (CC 113) / Play (CC 115)
        if (cc === 115 && value! > 0) {
          player.toggle()
        }
        if (cc === 113 && value! > 0) {
          player.restart()
        }
        // Custom: Pad 1-8 (mapped to CC 20-27) -> Mute Tracks
        if (cc! >= 20 && cc! <= 27 && value! > 0) {
          const trackIds = Object.keys(songConfig.tracks)
          const targetId = Number(trackIds[cc! - 20])
          if (!isNaN(targetId)) {
            handleToggleMute(targetId)
          }
        }
        // Custom: CC 28 -> Toggle Wait
        if (cc === 28 && value! > 0) {
          setSongConfig((prev) => ({ ...prev, waiting: !prev.waiting }))
        }
      }
    }

    midiState.subscribe(handleMidiEvent)
    return () => midiState.unsubscribe(handleMidiEvent)
  }, [player, handleToggleMute, songConfig.tracks, setSongConfig])

  const handleLoopingToggle = (enable: boolean) => {
    if (!enable) {
      player.setRange(undefined)
      return
    } else {
      const duration = player.getDuration()
      const tenth = duration / 10
      player.setRange({
        start: duration / 2 - tenth,
        end: duration / 2 + tenth,
      })
    }
  }

  // Handle permission required for local files
  if (source === 'local' && requiresPermission) {
    return (
      <RequiresPermissionPrompt
        onGrantPermission={async () => {
          await scanFolders()
          mutate()
        }}
        onGoBack={() => {
          player.stop()
          navigate('/songs')
        }}
      />
    )
  }

  // Handle song not found
  if (error || (source === 'local' && !song && !isLoading)) {
    return (
      <SongNotFound
        songTitle={songMeta?.title}
        onGoBack={() => {
          player.stop()
          navigate('/songs')
        }}
      />
    )
  }

  return (
    <>
      <title>Playing</title>
      <div
        className={clsx(
          // Enable fixed to remove all scrolling.
          'fixed',
          'flex h-screen max-h-screen max-w-screen flex-col outline-none',
        )}
        {...midiState.getListenerProps()}
        autoFocus
      >
        {!isRecording && (
          <>
            <TopBar
              title={songMeta?.title}
              onClickBack={() => {
                player.stop()
                navigate(-1)
              }}
              onClickMidi={(e) => {
                e.stopPropagation()
                setMidiModal(!isMidiModalOpen)
              }}
              onClickStats={(e) => {
                setStatsVisible(!statsVisible)
              }}
              statsVisible={statsVisible}
            />
            <MidiModal isOpen={isMidiModalOpen} onClose={() => setMidiModal(false)} />
            
            {/* Relocated Bottom Control Bar (Full Width, Anchored) */}
            <div className="fixed bottom-0 left-0 w-full h-[60px] z-40 bg-[#131313]/70 backdrop-blur-xl border-t border-[#6c79f0]/40 flex items-center justify-between px-6 select-none shadow-[0_-8px_32px_rgba(0,0,0,0.37),inset_0_1px_0_0_rgba(108,121,240,0.35)] pointer-events-auto">
              {/* Scrub Bar at the top edge, spanning full width */}
              <div className="absolute top-0 left-0 w-full transform -translate-y-1/2">
                <SongScrubBar
                  rangeSelection={selectedRange}
                  setRange={(range: any) => player.setRange(range)}
                />
              </div>

              {/* Left Section: Time display */}
              <div className="flex items-center">
                <span ref={elapsedRef} className="text-xs font-mono text-white/60 tracking-wider" />
              </div>

              {/* Center Section: Playback Controls */}
              <div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-6">
                <ButtonWithTooltip tooltip="Restart">
                  <SkipBack size={20} className="text-white/70 hover:text-white transition-colors duration-200" onClick={() => player.restart()} />
                </ButtonWithTooltip>

                <button
                  className="flex items-center justify-center rounded-full p-2.5 bg-[#6c79f0] hover:bg-[#9ba4ff] active:scale-95 transition-all text-black shadow-[0_0_15px_rgba(108,121,240,0.4)]"
                  onClick={() => player.toggle()}
                >
                  {!playerState.canPlay ? (
                    <Loader2 className="w-5 h-5 animate-spin text-black" />
                  ) : playerState.playing ? (
                    <Pause className="w-5 h-5 fill-black text-black" />
                  ) : (
                    <Play className="w-5 h-5 fill-black text-black translate-x-[1px]" />
                  )}
                </button>

                <ButtonWithTooltip tooltip="Skip to End">
                  <SkipForward size={20} className="text-white/70 hover:text-white transition-colors duration-200" onClick={() => player.seek(player.getDuration())} />
                </ButtonWithTooltip>

                <ButtonWithTooltip tooltip="Toggle Loop" isActive={songLoop} onClick={() => player.store.set(player.songLoop, !songLoop)}>
                  <Repeat size={20} className="transition-colors duration-200" />
                </ButtonWithTooltip>

                <ButtonWithTooltip tooltip="Wait Mode" isActive={waiting} onClick={() => setSongConfig({ ...songConfig, waiting: !waiting })}>
                  <Target size={20} className="transition-colors duration-200" />
                </ButtonWithTooltip>
              </div>

              {/* Right Section: Empty / Balancer */}
              <div className="w-20" />
            </div>

            {statsVisible && <StatsPopup />}
            <div className="absolute left-4 top-20 z-30 flex flex-col gap-4 pointer-events-auto">
              <div className="flex items-stretch gap-3">
                {/* BPM Ticket */}
                <div className="flex flex-col justify-between rounded-[20px] bg-black/45 backdrop-blur-xl shadow-[inset_0_1px_0_0_rgba(255,255,255,0.15),0_8px_32px_0_rgba(0,0,0,0.37)] border border-white/5 p-3 w-[168px]">
                  <span className="text-[12px] font-black uppercase tracking-[0.18em] text-[#6c79f0] text-center mb-1.5 select-none">TEMPO (BPM)</span>
                  <div className="flex items-center justify-between gap-1">
                    <button
                      className="cursor-pointer text-white/50 hover:text-white font-light text-2xl w-8 h-8 flex items-center justify-center transition select-none bg-transparent border-0"
                      onClick={handleDecreaseBpm10}
                    >
                      −
                    </button>
                    <input
                      type="number"
                      value={Math.round(currentBpm)}
                      onChange={handleBpmInputChange}
                      className="bg-transparent text-white font-bold text-center text-lg w-14 outline-none border-0 focus:ring-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    />
                    <button
                      className="cursor-pointer text-white/50 hover:text-white font-light text-2xl w-8 h-8 flex items-center justify-center transition select-none bg-transparent border-0"
                      onClick={handleIncreaseBpm10}
                    >
                      +
                    </button>
                  </div>
                </div>

                {/* Merged Zoom Controls */}
                <div className="flex flex-col rounded-[20px] bg-black/45 backdrop-blur-xl shadow-[inset_0_1px_0_0_rgba(255,255,255,0.15),0_8px_32px_0_rgba(0,0,0,0.37)] border border-white/5 overflow-hidden w-[52px] justify-between">
                  <button
                    className="cursor-pointer flex-1 p-2 text-white/70 hover:text-white transition hover:bg-white/5 flex items-center justify-center border-0 bg-transparent"
                    onClick={() => setScaleIndex(i => Math.min(ppsScales.length - 1, i + 1))}
                    title="Zoom In"
                  >
                    <ZoomIn className="h-5 w-5" />
                  </button>
                  <div className="h-[1px] bg-white/10 w-full" />
                  <button
                    className="cursor-pointer flex-1 p-2 text-white/70 hover:text-white transition hover:bg-white/5 flex items-center justify-center border-0 bg-transparent"
                    onClick={() => setScaleIndex(i => Math.max(0, i - 1))}
                    title="Zoom Out"
                  >
                    <ZoomOut className="h-5 w-5" />
                  </button>
                </div>
              </div>

              {/* Tracks (Instruments) Box */}
              {song && (
                <TrackHUD
                  song={song}
                  config={songConfig}
                  onToggleMute={handleToggleMute}
                  onTogglePractice={handleTogglePractice}
                />
              )}
            </div>
          </>
        )}
        <div
          className={clsx(
            'fixed top-0 left-0 -z-10 h-[100vh] w-screen',
            'h-[100dvh]!',
            songConfig.visualization === 'sheet' ? 'bg-white' : 'bg-[#2e2e2e]',
          )}
          onWheel={handleWheel}
        >
          <SongVisualizer
            song={song}
            config={songConfig}
            hand={hand}
            handSettings={getHandSettings(songConfig)}
            selectedRange={selectedRange}
            getTime={() => player.getTime()}
            enableTouchscroll={songConfig.visualization === 'falling-notes'}
            ppsScale={ppsScales[scaleIndex]}
          />
        </div>
      </div>
    </>
  )
}
