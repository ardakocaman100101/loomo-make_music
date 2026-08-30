import React, { useCallback, useEffect, useRef, useState } from 'react'
import { motion } from 'motion/react'
import { Compass, Crosshair, Maximize2, Move, Navigation, Sparkles, X, ZoomIn, ZoomOut } from '@/icons'
import type { SongNote } from '@/types'
import { TouchPitchBend } from './TouchPitchBend'

interface StudioTouchPanelProps {
  scrollContainerRef: React.RefObject<HTMLDivElement | null>
  pianoScrollRef: React.RefObject<HTMLDivElement | null>
  notes: SongNote[]
  minMidi: number
  maxMidi: number
  totalDuration: number
  bpm: number
  zoomY: number
  setZoomY: (zoom: number | ((prev: number) => number)) => void
  playbackTime: number
  seekTo: (time: number) => void
  isOpen: boolean
  onClose: () => void
  onCenterNotes?: () => void
}

export const StudioTouchPanel: React.FC<StudioTouchPanelProps> = ({
  scrollContainerRef,
  pianoScrollRef,
  notes,
  minMidi,
  maxMidi,
  totalDuration,
  bpm,
  zoomY,
  setZoomY,
  playbackTime,
  seekTo,
  isOpen,
  onClose,
  onCenterNotes,
}) => {
  const padRef = useRef<HTMLDivElement>(null)
  const isDraggingPadRef = useRef(false)
  const [viewportRect, setViewportRect] = useState<{
    left: number
    top: number
    width: number
    height: number
  }>({ left: 0, top: 0, width: 100, height: 100 })

  const [activeTab, setActiveTab] = useState<'pan' | 'pitch'>('pan')

  // Update mini viewport indicator on scroll/resize
  const updateViewport = useCallback(() => {
    const el = scrollContainerRef.current
    const pad = padRef.current
    if (!el || !pad) return

    const scrollW = el.scrollWidth || 1
    const scrollH = el.scrollHeight || 1
    const clientW = el.clientWidth || 1
    const clientH = el.clientHeight || 1

    const padW = pad.clientWidth || 180
    const padH = pad.clientHeight || 110

    const vLeft = (el.scrollLeft / scrollW) * padW
    const vTop = (el.scrollTop / scrollH) * padH
    const vWidth = Math.max(16, (clientW / scrollW) * padW)
    const vHeight = Math.max(16, (clientH / scrollH) * padH)

    setViewportRect({
      left: Math.max(0, Math.min(padW - vWidth, vLeft)),
      top: Math.max(0, Math.min(padH - vHeight, vTop)),
      width: Math.min(padW, vWidth),
      height: Math.min(padH, vHeight),
    })
  }, [scrollContainerRef])

  useEffect(() => {
    const el = scrollContainerRef.current
    if (!el) return

    updateViewport()
    el.addEventListener('scroll', updateViewport, { passive: true })
    window.addEventListener('resize', updateViewport, { passive: true })
    return () => {
      el.removeEventListener('scroll', updateViewport)
      window.removeEventListener('resize', updateViewport)
    }
  }, [scrollContainerRef, updateViewport, zoomY, notes.length])

  // Handle pointer navigation on 2D touch surface
  const handlePointerNav = useCallback(
    (clientX: number, clientY: number) => {
      const pad = padRef.current
      const el = scrollContainerRef.current
      if (!pad || !el) return

      const rect = pad.getBoundingClientRect()
      const relX = Math.max(0, Math.min(rect.width, clientX - rect.left))
      const relY = Math.max(0, Math.min(rect.height, clientY - rect.top))

      const normX = relX / rect.width
      const normY = relY / rect.height

      const maxScrollLeft = el.scrollWidth - el.clientWidth
      const maxScrollTop = el.scrollHeight - el.clientHeight

      const targetLeft = Math.max(0, Math.min(maxScrollLeft, normX * el.scrollWidth - el.clientWidth / 2))
      const targetTop = Math.max(0, Math.min(maxScrollTop, normY * el.scrollHeight - el.clientHeight / 2))

      el.scrollLeft = targetLeft
      el.scrollTop = targetTop

      if (pianoScrollRef.current) {
        pianoScrollRef.current.scrollLeft = targetLeft
      }

      updateViewport()
    },
    [scrollContainerRef, pianoScrollRef, updateViewport]
  )

  const handlePointerDown = (e: React.PointerEvent) => {
    isDraggingPadRef.current = true
    try {
      ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
    } catch {}
    handlePointerNav(e.clientX, e.clientY)
  }

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDraggingPadRef.current) return
    handlePointerNav(e.clientX, e.clientY)
  }

  const handlePointerUp = (e: React.PointerEvent) => {
    isDraggingPadRef.current = false
    try {
      ;(e.target as HTMLElement).releasePointerCapture(e.pointerId)
    } catch {}
  }

  // Playhead vertical position in the minimap
  const factor = (bpm / 60) * 4 * zoomY
  const totalGridHeight = Math.ceil(totalDuration * factor) || 1
  const playheadYInGrid = totalGridHeight - playbackTime * factor
  const playheadRatio = Math.max(0, Math.min(1, playheadYInGrid / totalGridHeight))

  if (!isOpen) return null

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.92, y: 15 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.92, y: 15 }}
      transition={{ duration: 0.15 }}
      data-no-touchpad-nav="true"
      className="absolute bottom-24 right-6 z-[100] flex w-[280px] flex-col gap-2.5 rounded-2xl border border-white/15 bg-[#14141e]/95 p-3.5 shadow-[0_20px_50px_rgba(0,0,0,0.85)] backdrop-blur-2xl select-none"
    >
      {/* Header bar */}
      <div className="flex items-center justify-between border-b border-white/10 pb-2">
        <div className="flex items-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-[#9ba4ff]/20 text-[#9ba4ff]">
            <Move className="h-3.5 w-3.5" />
          </div>
          <span className="text-xs font-black tracking-wider text-white uppercase">
            Touch Panel
          </span>
        </div>

        {/* Tab Pills */}
        <div className="flex items-center gap-1">
          <div className="flex rounded-lg border border-white/10 bg-white/5 p-0.5">
            <button
              onClick={() => setActiveTab('pan')}
              className={`cursor-pointer rounded px-2 py-0.5 text-[10px] font-bold transition-all ${
                activeTab === 'pan'
                  ? 'bg-[#9ba4ff] text-[#131313]'
                  : 'text-white/60 hover:text-white'
              }`}
            >
              2D Pan
            </button>
            <button
              onClick={() => setActiveTab('pitch')}
              className={`cursor-pointer rounded px-2 py-0.5 text-[10px] font-bold transition-all ${
                activeTab === 'pitch'
                  ? 'bg-[#9ba4ff] text-[#131313]'
                  : 'text-white/60 hover:text-white'
              }`}
            >
              Pitch Bend
            </button>
          </div>

          <button
            onClick={onClose}
            className="cursor-pointer rounded-lg p-1 text-white/50 transition-colors hover:bg-white/10 hover:text-white"
            title="Close Touch Panel"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {activeTab === 'pan' ? (
        <>
          {/* 2D Touchpad / Minimap Surface */}
          <div
            ref={padRef}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            className="group relative h-32 w-full cursor-grab overflow-hidden rounded-xl border border-white/15 bg-gradient-to-b from-[#0e0e16] to-[#171722] shadow-inner active:cursor-grabbing touch-none"
          >
            {/* Background Grid Lines */}
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(155,164,255,0.08)_0%,transparent_70%)]" />
            <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:16px_16px]" />

            {/* Note density dots preview */}
            <svg className="absolute inset-0 h-full w-full opacity-60">
              {notes.slice(0, 150).map((n, i) => {
                const midiRange = Math.max(1, maxMidi - minMidi)
                const nx = ((n.midiNote - minMidi) / midiRange) * 100
                const ny = (1 - (n.time / (totalDuration || 1))) * 100
                return (
                  <circle
                    key={i}
                    cx={`${nx}%`}
                    cy={`${ny}%`}
                    r="1.5"
                    fill="#9ba4ff"
                    opacity="0.7"
                  />
                )
              })}
            </svg>

            {/* Playhead horizontal line across minimap */}
            <div
              className="pointer-events-none absolute left-0 right-0 h-[1.5px] bg-[#9ba4ff] shadow-[0_0_8px_#9ba4ff]"
              style={{ top: `${playheadRatio * 100}%` }}
            />

            {/* Glowing 2D Viewport Box */}
            <div
              className="pointer-events-none absolute rounded-md border-2 border-[#9ba4ff] bg-[#9ba4ff]/20 shadow-[0_0_15px_rgba(155,164,255,0.35)] transition-all"
              style={{
                left: viewportRect.left,
                top: viewportRect.top,
                width: viewportRect.width,
                height: viewportRect.height,
              }}
            >
              <div className="flex h-full w-full items-center justify-center">
                <Crosshair className="h-3 w-3 text-[#c0c7ff]/60" />
              </div>
            </div>

            {/* Hint overlay */}
            <div className="pointer-events-none absolute bottom-1.5 left-2 flex items-center gap-1 text-[9px] font-bold text-white/40">
              <span>Swipe/Drag in 2D to pan</span>
            </div>
          </div>

          {/* Quick action bar */}
          <div className="flex items-center justify-between pt-0.5">
            <div className="flex items-center gap-1.5">
              <button
                onClick={onCenterNotes}
                className="flex cursor-pointer items-center gap-1 rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-[11px] font-semibold text-white/80 transition-all hover:bg-white/10 hover:text-white active:scale-95"
                title="Center viewport on active notes"
              >
                <Crosshair className="h-3 w-3 text-[#9ba4ff]" />
                <span>Center</span>
              </button>

              <button
                onClick={() => {
                  const el = scrollContainerRef.current
                  if (!el) return
                  const factor = (bpm / 60) * 4 * zoomY
                  const totalH = Math.ceil(totalDuration * factor)
                  const playheadY = totalH - playbackTime * factor
                  el.scrollTop = Math.max(0, playheadY - (el.clientHeight - 80))
                  updateViewport()
                }}
                className="flex cursor-pointer items-center gap-1 rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-[11px] font-semibold text-white/80 transition-all hover:bg-white/10 hover:text-white active:scale-95"
                title="Jump viewport to playhead"
              >
                <Navigation className="h-3 w-3 text-[#9ba4ff]" />
                <span>Playhead</span>
              </button>
            </div>

            {/* Zoom Adjustments */}
            <div className="flex items-center gap-1 rounded-lg border border-white/10 bg-white/5 p-0.5">
              <button
                onClick={() => setZoomY((z) => Math.max(24, Math.round(z * 0.8)))}
                className="flex h-6 w-6 cursor-pointer items-center justify-center rounded text-white/70 hover:bg-white/10 hover:text-white"
                title="Zoom Out"
              >
                <ZoomOut className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => setZoomY((z) => Math.min(128, Math.round(z * 1.25)))}
                className="flex h-6 w-6 cursor-pointer items-center justify-center rounded text-white/70 hover:bg-white/10 hover:text-white"
                title="Zoom In"
              >
                <ZoomIn className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </>
      ) : (
        /* Expressive Pitch Bend Tab */
        <div className="flex h-36 w-full items-center justify-center rounded-xl border border-white/10 bg-[#0e0e16] p-2">
          <TouchPitchBend className="h-full w-24" />
        </div>
      )}
    </motion.div>
  )
}
