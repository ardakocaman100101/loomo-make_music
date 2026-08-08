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
  const dimLeftRef = useRef<HTMLDivElement>(null)
  const dimRightRef = useRef<HTMLDivElement>(null)

  const player = usePlayer()
  const isDraggingL = useRef(false)
  const isDraggingR = useRef(false)
  const isDraggingHandle = useRef(false)
  const justFinishedDrag = useRef(false)
  const song: Song | null = useAtomValue(player.song)
  const progressBarRef = useRef<HTMLDivElement>(null)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const isScrubbing = useRef<boolean>(false)
  const clickTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  const getProgress = useCallback((e: MouseEvent | React.MouseEvent) => {
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

    if (rangeSelection) {
      let start = Math.min(rangeSelection.start, rangeSelection.end)
      let end = Math.max(rangeSelection.start, rangeSelection.end)

      const startPx = (start / duration) * barWidth
      const endPx = (end / duration) * barWidth

      if (rangeRef.current) {
        rangeRef.current.style.left = startPx + 'px'
        rangeRef.current.style.width = endPx - startPx + 'px'
      }
      if (dimLeftRef.current) {
        dimLeftRef.current.style.width = startPx + 'px'
      }
      if (dimRightRef.current) {
        dimRightRef.current.style.width = barWidth - endPx + 'px'
      }
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
    if (
      progressBarRef.current?.contains(target) &&
      !isDraggingL.current &&
      !isDraggingR.current &&
      !isDraggingHandle.current
    ) {
      if (player.isPlaying()) {
        wasPlaying.current = true
        player.pause()
      }
    }
  })

  useEventListener<PointerEvent>(
    'pointerup',
    (e) => {
      const target = e.target as HTMLElement
      const wasHandleDragging =
        isDraggingL.current || isDraggingR.current || isDraggingHandle.current
      const minorMissclick = wrapperRef.current?.contains(target)

      if (wasHandleDragging || minorMissclick) {
        e.stopPropagation()
      }

      if (wasHandleDragging) {
        justFinishedDrag.current = true
        setTimeout(() => {
          justFinishedDrag.current = false
        }, 150)
        if (rangeSelection) {
          player.seek(Math.min(rangeSelection.start, rangeSelection.end))
        }
      }

      isDraggingL.current = false
      isDraggingR.current = false
      isDraggingHandle.current = false
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
      let currentStart = rangeSelection.start
      let currentEnd = rangeSelection.end

      if (isDraggingL.current) {
        currentStart = songTime
      } else {
        currentEnd = songTime
      }

      // Handle dragging handle past each other
      if (isDraggingL.current && currentStart > currentEnd) {
        isDraggingL.current = false
        isDraggingR.current = true
      } else if (isDraggingR.current && currentEnd < currentStart) {
        isDraggingR.current = false
        isDraggingL.current = true
      }

      const newStart = Math.min(currentStart, currentEnd)
      const newEnd = Math.max(currentStart, currentEnd)

      // Playhead follows the start anchor timestamp in real-time
      player.seek(newStart)

      setRange({
        start: newStart,
        end: newEnd,
      })
    } else if (e.buttons === 1 && progressBarRef.current?.contains(e.target as HTMLElement)) {
      isScrubbing.current = true
      seekPlayer(e)
    }
  })

  const handleBarClick = (e: React.MouseEvent) => {
    if (
      isDraggingL.current ||
      isDraggingR.current ||
      isDraggingHandle.current ||
      justFinishedDrag.current
    ) {
      return
    }

    const progress = getProgress(e)
    const songTime = progress * player.getDuration()
    const duration = player.getDuration()
    if (duration <= 0) return

    if (e.detail === 1) {
      // Single click (with short timeout to allow double-click to cancel)
      clickTimeoutRef.current = setTimeout(() => {
        if (rangeSelection) {
          const start = Math.min(rangeSelection.start, rangeSelection.end)
          const end = Math.max(rangeSelection.start, rangeSelection.end)
          if (songTime >= start && songTime <= end) {
            // Click inside range -> Seek playhead without clearing range
            player.seek(songTime)
          } else {
            // Click outside range -> Clear practice range
            setRange(undefined)
          }
        } else {
          // Standard scrub seek
          player.seek(songTime)
        }
      }, 200)
    } else if (e.detail >= 2) {
      // Double click -> Enter Practice Mode
      if (clickTimeoutRef.current) {
        clearTimeout(clickTimeoutRef.current)
        clickTimeoutRef.current = null
      }

      const defaultRangeLen = duration / 4 // Default range is a quarter of the song duration
      let start = songTime - defaultRangeLen / 2
      let end = songTime + defaultRangeLen / 2

      if (start < 0) {
        start = 0
        end = defaultRangeLen
      } else if (end > duration) {
        end = duration
        start = Math.max(0, duration - defaultRangeLen)
      }

      setRange({ start, end })
      player.pause()
      player.seek(start)
    }
  }

  return (
    <div
      className="group relative flex h-[14px] w-full touch-none items-center justify-center select-none"
      onClick={(e) => {
        onClick(e)
        handleBarClick(e)
      }}
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
        {/* Inactive region dimming overlays */}
        {rangeSelection && (
          <>
            <div
              ref={dimLeftRef}
              className="pointer-events-none absolute top-0 left-0 z-10 h-full rounded-l-full bg-black/75 transition-all"
            />
            <div
              ref={dimRightRef}
              className="pointer-events-none absolute top-0 right-0 z-10 h-full rounded-r-full bg-black/75 transition-all"
            />
          </>
        )}

        {/* Played track */}
        <div
          ref={divRef}
          className="pointer-events-none absolute top-0 left-0 h-full origin-left rounded-full bg-[#6c79f0]"
          style={{ width: '100%', transform: 'scaleX(0)' }}
        />

        {/* Playhead handle */}
        <div
          ref={playheadRef}
          className="pointer-events-none absolute top-1/2 left-0 z-20 -mt-2.25 -ml-2.25 h-4.5 w-4.5 rounded-full bg-white opacity-0 shadow-[0_0_10px_rgba(255,255,255,0.9)] transition-opacity duration-200 group-hover:opacity-100"
        />

        {rangeSelection && (
          <div ref={rangeRef} className="pointer-events-none absolute z-20 flex h-full items-center">
            <div className="absolute h-4.5 w-full rounded-sm border border-[#818cf8]/60 bg-[#6c79f0]/30 shadow-[0_0_12px_rgba(108,121,240,0.4)]" />
            <div
              className="pointer-events-auto absolute left-0 h-4.5 w-4.5 -translate-x-1/2 cursor-ew-resize rounded-full border-2 border-white bg-[#6c79f0] shadow-[0_0_8px_rgba(255,255,255,0.8)] transition hover:scale-125 hover:bg-[#818cf8]"
              onPointerEnter={() => setPointerOver(true)}
              onPointerLeave={() => setPointerOver(false)}
              onPointerDown={(e) => {
                e.stopPropagation()
                isDraggingL.current = true
                isDraggingHandle.current = true
                justFinishedDrag.current = true
              }}
            />
            <div
              className="pointer-events-auto absolute right-0 h-4.5 w-4.5 translate-x-1/2 cursor-ew-resize rounded-full border-2 border-white bg-[#6c79f0] shadow-[0_0_8px_rgba(255,255,255,0.8)] transition hover:scale-125 hover:bg-[#818cf8]"
              onPointerDown={(e) => {
                e.stopPropagation()
                isDraggingR.current = true
                isDraggingHandle.current = true
                justFinishedDrag.current = true
              }}
              onPointerEnter={() => setPointerOver(true)}
              onPointerLeave={() => setPointerOver(false)}
            />
          </div>
        )}
      </div>
    </div>
  )
}

