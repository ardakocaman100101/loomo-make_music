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
    <div className="pointer-events-auto flex max-h-[45vh] w-[210px] flex-col gap-1.5 overflow-y-auto rounded-2xl border border-white/5 bg-black/45 p-2.5 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.15),0_8px_32px_0_rgba(0,0,0,0.37)] backdrop-blur-xl transition-all duration-200 sm:w-[230px] lg:max-h-[50vh] lg:w-[260px] lg:gap-2 lg:rounded-[20px] lg:p-3">
      <div className="mb-2 text-center text-[10px] font-black tracking-[0.18em] text-[#6c79f0] uppercase select-none sm:mb-2.5 sm:text-[11px] lg:mb-3 lg:text-[12px]">
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
              'group flex flex-col gap-0.5 rounded-xl p-1.5 transition-all hover:bg-white/5 sm:gap-1 sm:p-2',
              isMuted ? 'opacity-45' : 'opacity-100',
            )}
          >
            <div className="flex items-center justify-between">
              <span
                className="max-w-[90px] truncate text-[11px] font-bold text-white sm:max-w-[100px] lg:max-w-[110px] lg:text-xs"
                title={track.name}
              >
                {track.name || formatInstrumentName(settings?.instrument || track.instrument)}
              </span>
              <div className="flex items-center gap-0.5 sm:gap-1">
                <button
                  onClick={() => onSelectHand?.(id, 'left')}
                  className={clsx(
                    'rounded border-0 bg-transparent p-0.5 transition select-none sm:p-1',
                    settings?.hand === 'left' ? 'text-[#6c79f0]' : 'text-white/35 hover:text-white',
                  )}
                  title="Assign Left Hand & Calculate Fingering"
                >
                  <LeftHand height={13} width={13} fill="currentColor" className="sm:h-[15px] sm:w-[15px]" />
                </button>
                <button
                  onClick={() => onSelectHand?.(id, 'right')}
                  className={clsx(
                    'rounded border-0 bg-transparent p-0.5 transition select-none sm:p-1',
                    settings?.hand === 'right' ? 'text-[#6c79f0]' : 'text-white/35 hover:text-white',
                  )}
                  title="Assign Right Hand & Calculate Fingering"
                >
                  <RightHand height={13} width={13} fill="currentColor" className="sm:h-[15px] sm:w-[15px]" />
                </button>
                <button
                  onClick={() => handleEyeClick(id)}
                  className={clsx(
                    'rounded border-0 bg-transparent p-0.5 transition select-none sm:p-1',
                    settings?.practice ? 'text-[#6c79f0]' : 'text-white/35 hover:text-white',
                  )}
                  title="Toggle note appearance (Double click to show only this track)"
                >
                  <Eye size={13} className="sm:h-[15px] sm:w-[15px]" />
                </button>
                <button
                  onClick={() => onToggleMute(id)}
                  className="border-0 bg-transparent p-0.5 text-white/35 transition select-none hover:text-white sm:p-1"
                  title={isMuted ? 'Unmute track' : 'Mute track'}
                >
                  {isMuted ? (
                    <VolumeX size={13} className="sm:h-[15px] sm:w-[15px]" />
                  ) : (
                    <Volume2 size={13} className="sm:h-[15px] sm:w-[15px]" />
                  )}
                </button>
              </div>
            </div>
            <div className="flex items-center gap-1.5 sm:gap-2">
              <div className="h-1 flex-1 overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full bg-purple-500/50"
                  style={{ width: `${Math.min(100, (noteCount / song.notes.length) * 500)}%` }}
                />
              </div>
              <span className="text-[7px] text-white/30 sm:text-[8px]">{noteCount}n</span>
            </div>
          </div>
        )
      })}
    </div>
  )
}

