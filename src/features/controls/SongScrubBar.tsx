import { usePlayer } from '@/features/player'
import { useEventListener, useRAFLoop } from '@/hooks'
import { Song } from '@/types'
import { clamp, formatTime } from '@/utils'
import clsx from 'clsx'
import { useAtomValue } from 'jotai'
import { useCallback, useRef, useState } from 'react'

const CAPTURE_OPT = { capture: true }

export default function SongScrubBar({
  setRange = () => {},
  onSeek = () => {},
  onClick = () => {},
  rangeSelection,
}: {
  rangeSelection?: undefined | { start: number; end: number }
  setRange?: any
  onSeek?: any
  height?: number
  onClick?: any
}) {
  const [pointerOver, setPointerOver] = useState(false)
  const divRef = useRef<HTMLDivElement>(null)
  const playheadRef = useRef<HTMLDivElement>(null)
  const timeSpanRef = useRef<HTMLSpanElement>(null)
  const measureSpanRef = useRef<HTMLSpanElement>(null)
  const toolTipRef = useRef<HTMLDivElement>(null)
  const rangeRef = useRef<HTMLDivElement>(null)
  const player = usePlayer()
  const isDraggingL = useRef(false)
  const isDraggingR = useRef(false)
  const song: Song | null = useAtomValue(player.song)
  const progressBarRef = useRef<HTMLDivElement>(null)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const isScrubbing = useRef<boolean>(false)

  const getProgress = useCallback((e: MouseEvent) => {
    const rect = progressBarRef.current?.getBoundingClientRect()
    if (!rect || rect.width === 0) return 0
    return clamp((e.clientX - rect.left) / rect.width, { min: 0, max: 1 })
  }, [])

  useRAFLoop(() => {
    if (!divRef.current || !progressBarRef.current) {
      return
    }
    const duration = player.getDuration()
    if (duration === 0) return
    const progress = player.getTime() / duration
    const barWidth = progressBarRef.current.offsetWidth

    divRef.current.style.transform = `scaleX(${progress})`
    if (playheadRef.current) {
      playheadRef.current.style.transform = `translateX(${progress * barWidth}px)`
    }
    if (rangeRef.current && rangeSelection) {
      let start = rangeSelection.start
      let end = rangeSelection.end
      if (end < start) {
        ;[start, end] = [end, start]
        isDraggingL.current = !isDraggingL.current
        isDraggingR.current = !isDraggingR.current
      }
      rangeRef.current.style.left = (start / duration) * barWidth + 'px'
      rangeRef.current.style.width = ((end - start) / duration) * barWidth + 'px'
    }
  })

  const seekPlayer = useCallback(
    (e: MouseEvent) => {
      const progress = getProgress(e)
      const songTime = progress * player.getDuration()
      onSeek()
      player.seek(songTime)
    },
    [player, getProgress, onSeek],
  )

  let wasPlaying = useRef(false)
  useEventListener<PointerEvent>('pointerdown', (e) => {
    const target = e.target as HTMLElement
    if (progressBarRef.current?.contains(target) && !isDraggingL.current && !isDraggingR.current) {
      isScrubbing.current = true

      if (player.isPlaying()) {
        wasPlaying.current = true
        player.pause()
      }

      seekPlayer(e)
    }
  })

  useEventListener<PointerEvent>(
    'pointerup',
    (e) => {
      const target = e.target as HTMLElement
      const completedAction = isDraggingL.current || isDraggingR.current || isScrubbing.current
      const minorMissclick = wrapperRef.current?.contains(target)
      if (completedAction || minorMissclick) {
        e.stopPropagation()
      }
      isDraggingL.current = false
      isDraggingR.current = false
      isScrubbing.current = false

      if (wasPlaying.current) {
        wasPlaying.current = false
        player.play()
      }
    },
    undefined,
    CAPTURE_OPT,
  )

  useEventListener<PointerEvent>('pointermove', (e) => {
    const progress = getProgress(e)
    const songTime = progress * player.getDuration()
    if ((isDraggingL.current || isDraggingR.current) && rangeSelection) {
      if (isDraggingL.current) {
        rangeSelection.start = songTime
      } else {
        rangeSelection.end = songTime
      }
      setRange(rangeSelection)
    } else if (isScrubbing.current) {
      seekPlayer(e)
    }
  })

  return (
    <div
      className="group relative flex h-[12px] w-full touch-none items-center justify-center select-none"
      onClick={onClick}
      ref={wrapperRef}
      onPointerMove={(e: React.MouseEvent) => {
        if (
          !player.getSong() ||
          !measureSpanRef.current ||
          !timeSpanRef.current ||
          !toolTipRef.current ||
          !progressBarRef.current
        ) {
          return
        }

        const rect = progressBarRef.current.getBoundingClientRect()
        const progress = clamp((e.clientX - rect.left) / rect.width, { min: 0, max: 1 })
        const songTime = progress * player.getDuration()
        const measure = player.getMeasureForTime(songTime)

        toolTipRef.current.style.left = `${clamp(e.clientX - rect.left - 45, {
          min: 0,
          max: rect.width - 90,
        })}px`
        measureSpanRef.current.innerText = String(measure?.number)
        timeSpanRef.current.innerText = formatTime(player.getRealTimeDuration(0, songTime))
      }}
      onPointerOver={() => setPointerOver(true)}
      onPointerOut={() => setPointerOver(false)}
    >
      <div
        className={clsx(
          pointerOver ? 'flex' : 'hidden',
          'absolute z-30 min-w-max items-center justify-between gap-4',
          '-top-2 rounded-lg border border-white/10 bg-black/95 px-3 py-1.5 text-xs text-white shadow-xl',
          '-translate-y-full transition-all duration-150',
        )}
        ref={toolTipRef}
      >
        <span>
          Time: <span className="font-mono text-[#6c79f0]" ref={timeSpanRef} />
        </span>
        <span className="h-3 w-[1px] bg-white/10" />
        <span>
          Measure: <span className="font-mono text-[#6c79f0]" ref={measureSpanRef} />
        </span>
      </div>

      <div
        ref={progressBarRef}
        className="relative h-[6px] w-full cursor-pointer overflow-visible rounded-full bg-white/10"
      >
        {/* Played track */}
        <div
          ref={divRef}
          className="pointer-events-none absolute top-0 left-0 h-full origin-left rounded-full bg-[#6c79f0]"
          style={{ width: '100%', transform: 'scaleX(0)' }}
        />

        {/* Playhead handle */}
        <div
          ref={playheadRef}
          className="pointer-events-none absolute top-1/2 left-0 -mt-2.25 -ml-2.25 h-4.5 w-4.5 rounded-full bg-white opacity-0 shadow-[0_0_10px_rgba(255,255,255,0.9)] transition-opacity duration-200 group-hover:opacity-100"
        />

        {rangeSelection && (
          <div ref={rangeRef} className="pointer-events-none absolute flex h-full items-center">
            <div className="bg-purple-dark/40 absolute h-4 w-[calc(100%-10px)]" />
            <div
              className="bg-purple-dark/90 pointer-events-auto absolute left-0 h-4 w-4 -translate-x-1/2 cursor-pointer rounded-full transition hover:bg-[#6c79f0]"
              onPointerEnter={() => setPointerOver(true)}
              onPointerLeave={() => setPointerOver(false)}
              onPointerDown={() => (isDraggingL.current = true)}
            />
            <div
              className="bg-purple-dark/90 pointer-events-auto absolute right-0 h-4 w-4 translate-x-1/2 cursor-pointer rounded-full transition hover:bg-[#6c79f0]"
              onPointerDown={() => (isDraggingR.current = true)}
              onPointerEnter={() => setPointerOver(true)}
              onPointerLeave={() => setPointerOver(false)}
            />
          </div>
        )}
      </div>
    </div>
  )
}
