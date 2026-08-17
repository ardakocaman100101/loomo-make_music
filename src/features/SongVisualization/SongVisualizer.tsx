import { Canvas } from '@/components'
import midiState from '@/features/midi'
import * as touchscroll from '@/features/SongVisualization/touchscroll'
import { useSize } from '@/hooks'
import { Hand, HandSettings, Song, SongConfig } from '@/types'
import { LegacyRef, useEffect, useMemo, useRef } from 'react'
import { usePlayer } from '../player'
import { GivenState, render } from './canvas-renderer'
import { waitForImages } from './images'
import { getOptimalPps, PIXELS_PER_SECOND as pps } from './utils'

type CanvasRendererProps = {
  song: Song | undefined
  config: SongConfig
  hand: Hand
  handSettings: HandSettings
  getTime: () => number
  constrictView?: boolean
  selectedRange?: { start: number; end: number }
  enableTouchscroll?: boolean
  game?: boolean
  zoomMode?: number
  ppsScale?: number
}

function CanvasRenderer({
  song,
  config,
  hand,
  handSettings,
  selectedRange,
  getTime,
  constrictView = true,
  enableTouchscroll = false,
  game = false,
  zoomMode,
  ppsScale,
}: CanvasRendererProps) {
  const isReady = useRef(false)
  const { width, height, measureRef } = useSize()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const player = usePlayer()

  useEffect(() => {
    waitForImages().then(() => (isReady.current = true))
  })

  useEffect(() => {
    if (song) {
      midiState.anchorToSong(song)
    }
  }, [song])

  const effectivePps = useMemo(() => {
    const computedPps = getOptimalPps(song, pps)
    return computedPps * (ppsScale ?? 1)
  }, [song, ppsScale])

  const canvasRect: DOMRect = useMemo(() => {
    return canvasRef.current?.getBoundingClientRect() ?? {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [width, height]) as DOMRect

  function renderCanvas(ctx: CanvasRenderingContext2D, { width, height }: any) {
    if (!song || !isReady.current) {
      return
    }

    const state: GivenState = {
      time: getTime(),
      visualization: config.visualization,
      noteLabels: config.noteLabels,
      coloredNotes: config.coloredNotes,
      windowWidth: width,
      height,
      pps: effectivePps,
      hands: handSettings,
      hand,
      ctx,
      items: song.items,
      constrictView: !!constrictView,
      keySignature: config.keySignature ?? song.keySignature,
      timeSignature: song.timeSignature,
      canvasRect,
      selectedRange,
      game,
      zoomMode,
      player,
    }
    render(state)
  }

  const pointerDownPos = useRef<{ x: number; y: number } | null>(null)

  return (
    <div
      className="absolute h-full w-full touch-none"
      ref={measureRef}
      onPointerMove={(e) => enableTouchscroll && touchscroll.handleMove(player, e.nativeEvent)}
      onPointerDown={(e) => {
        pointerDownPos.current = { x: e.clientX, y: e.clientY }
        if (enableTouchscroll) {
          touchscroll.handleDown(player, e.nativeEvent, canvasRect)
        }
      }}
      onPointerUp={(e) => {
        if (enableTouchscroll) {
          touchscroll.handleUp(player, e.nativeEvent)
        }
        if (pointerDownPos.current) {
          const dist = Math.hypot(
            e.clientX - pointerDownPos.current.x,
            e.clientY - pointerDownPos.current.y,
          )
          if (dist < 6 && player.store.get(player.range) !== null) {
            player.setRange(undefined)
          }
        }
      }}
    >
      <Canvas ref={canvasRef as LegacyRef<HTMLCanvasElement>} render={renderCanvas} />
    </div>
  )
}

export default CanvasRenderer
