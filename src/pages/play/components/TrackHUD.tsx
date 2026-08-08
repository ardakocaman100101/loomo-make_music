import { LeftHand, RightHand } from '@/icons'
import { Song, SongConfig } from '@/types'
import { formatInstrumentName } from '@/utils'
import clsx from 'clsx'
import { Eye, Volume2, VolumeX } from 'lucide-react'
import React, { useRef } from 'react'

type TrackHUDProps = {
  song: Song
  config: SongConfig
  onToggleMute: (trackId: number) => void
  onSolo?: (trackId: number) => void
  onTogglePractice: (trackId: number) => void
  onSoloPractice?: (trackId: number) => void
  onSelectHand?: (trackId: number, hand: 'left' | 'right' | 'none') => void
}

export default function TrackHUD({
  song,
  config,
  onToggleMute,
  onTogglePractice,
  onSoloPractice,
  onSelectHand,
}: Omit<TrackHUDProps, 'onSolo'>) {
  const clickTimerRef = useRef<Record<number, ReturnType<typeof setTimeout>>>({})

  const handleEyeClick = (id: number) => {
    if (clickTimerRef.current[id]) {
      clearTimeout(clickTimerRef.current[id])
      delete clickTimerRef.current[id]
      if (onSoloPractice) {
        onSoloPractice(id)
      } else {
        onTogglePractice(id)
      }
    } else {
      clickTimerRef.current[id] = setTimeout(() => {
        delete clickTimerRef.current[id]
        onTogglePractice(id)
      }, 220)
    }
  }

  const tracks = Object.entries(song.tracks).filter(([_, t]) =>
    song.notes.some((n) => n.track === Number(_)),
  )

  if (tracks.length <= 1) return null

  return (
    <div className="pointer-events-auto flex max-h-[50vh] w-[260px] flex-col gap-2 overflow-y-auto rounded-[20px] border border-white/5 bg-black/45 p-3 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.15),0_8px_32px_0_rgba(0,0,0,0.37)] backdrop-blur-xl">
      <div className="mb-3 text-center text-[12px] font-black tracking-[0.18em] text-[#6c79f0] uppercase select-none">
        TRACKS
      </div>
      {tracks.map(([idStr, track]) => {
        const id = Number(idStr)
        const settings = config.tracks[id]
        const isMuted = !settings?.sound
        const noteCount = song.notes.filter((n) => n.track === id).length

        return (
          <div
            key={id}
            className={clsx(
              'group flex flex-col gap-1 rounded-xl p-2 transition-all hover:bg-white/5',
              isMuted ? 'opacity-45' : 'opacity-100',
            )}
          >
            <div className="flex items-center justify-between">
              <span
                className="max-w-[110px] truncate text-xs font-bold text-white"
                title={track.name}
              >
                {track.name || formatInstrumentName(settings?.instrument || track.instrument)}
              </span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => onSelectHand?.(id, 'left')}
                  className={clsx(
                    'rounded border-0 bg-transparent p-1 transition select-none',
                    settings?.hand === 'left' ? 'text-[#6c79f0]' : 'text-white/35 hover:text-white',
                  )}
                  title="Assign Left Hand & Calculate Fingering"
                >
                  <LeftHand height={15} width={15} fill="currentColor" />
                </button>
                <button
                  onClick={() => onSelectHand?.(id, 'right')}
                  className={clsx(
                    'rounded border-0 bg-transparent p-1 transition select-none',
                    settings?.hand === 'right' ? 'text-[#6c79f0]' : 'text-white/35 hover:text-white',
                  )}
                  title="Assign Right Hand & Calculate Fingering"
                >
                  <RightHand height={15} width={15} fill="currentColor" />
                </button>
                <button
                  onClick={() => handleEyeClick(id)}
                  className={clsx(
                    'rounded border-0 bg-transparent p-1 transition select-none',
                    settings?.practice ? 'text-[#6c79f0]' : 'text-white/35 hover:text-white',
                  )}
                  title="Toggle note appearance (Double click to show only this track)"
                >
                  <Eye size={15} />
                </button>
                <button
                  onClick={() => onToggleMute(id)}
                  className="border-0 bg-transparent p-1 text-white/35 transition select-none hover:text-white"
                  title={isMuted ? 'Unmute track' : 'Mute track'}
                >
                  {isMuted ? <VolumeX size={15} /> : <Volume2 size={15} />}
                </button>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-1 flex-1 overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full bg-purple-500/50"
                  style={{ width: `${Math.min(100, (noteCount / song.notes.length) * 500)}%` }}
                />
              </div>
              <span className="text-[8px] text-white/30">{noteCount}n</span>
            </div>
          </div>
        )
      })}
    </div>
  )
}

