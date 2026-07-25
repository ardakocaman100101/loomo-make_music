import { getAudioEffectsBus } from '@/features/synth/effects-bus'
import React, { useCallback, useEffect, useRef, useState } from 'react'

interface TouchPitchBendProps {
  className?: string
}

export const TouchPitchBend: React.FC<TouchPitchBendProps> = ({ className = '' }) => {
  const [pitchBend, setPitchBend] = useState<number>(0)
  const isDraggingRef = useRef<boolean>(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const animFrameRef = useRef<number | null>(null)

  useEffect(() => {
    const bus = getAudioEffectsBus()
    const unsubscribe = bus.subscribe((state) => {
      if (!isDraggingRef.current) {
        setPitchBend(state.pitchBend)
      }
    })
    return () => unsubscribe()
  }, [])

  const updatePitchFromPointer = useCallback((clientY: number) => {
    if (!containerRef.current) return
    const rect = containerRef.current.getBoundingClientRect()
    const height = rect.height
    const relativeY = clientY - rect.top
    const clampedY = Math.max(0, Math.min(height, relativeY))

    // Top = +12 semitones, Center = 0, Bottom = -12 semitones
    const normalized = 1 - (clampedY / height) * 2 // +1 (top) to -1 (bottom)
    const semitones = normalized * 12

    setPitchBend(semitones)
    getAudioEffectsBus().setPitchBend(semitones)
  }, [])

  const handlePointerDown = (e: React.PointerEvent) => {
    isDraggingRef.current = true
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
    updatePitchFromPointer(e.clientY)
  }

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDraggingRef.current) return
    updatePitchFromPointer(e.clientY)
  }

  const springToCenter = useCallback(() => {
    isDraggingRef.current = false
    let current = getAudioEffectsBus().getState().pitchBend

    const animate = () => {
      current *= 0.75 // Smooth spring damper decay
      if (Math.abs(current) < 0.05) {
        current = 0
        setPitchBend(0)
        getAudioEffectsBus().setPitchBend(0)
        animFrameRef.current = null
      } else {
        setPitchBend(current)
        getAudioEffectsBus().setPitchBend(current)
        animFrameRef.current = requestAnimationFrame(animate)
      }
    }

    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current)
    }
    animFrameRef.current = requestAnimationFrame(animate)
  }, [])

  const handlePointerUp = (e: React.PointerEvent) => {
    try {
      ;(e.target as HTMLElement).releasePointerCapture(e.pointerId)
    } catch {}
    springToCenter()
  }

  // Thumb position percentage: +12 st -> 0% top, 0 -> 50%, -12 st -> 100% top
  const thumbPercent = Math.max(0, Math.min(100, (1 - (pitchBend / 12 + 1) / 2) * 100))

  return (
    <div className={`flex h-full flex-col items-center select-none ${className}`}>
      {/* Expressive Vertical Spring Slider */}
      <div
        ref={containerRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        className="relative w-6 flex-1 cursor-ns-resize touch-none overflow-hidden rounded-xl border border-white/15 bg-gradient-to-b from-[#181824] via-[#101018] to-[#181824] p-1 shadow-inner"
      >
        {/* Zero Center Line */}
        <div className="absolute top-1/2 right-0 left-0 h-[1.5px] -translate-y-1/2 bg-[#9ba4ff]/40" />

        {/* Dynamic Glow Range Line */}
        <div
          className="absolute right-1 left-1 rounded-sm bg-[#9ba4ff]/35 backdrop-blur-sm transition-all"
          style={{
            top: pitchBend >= 0 ? `${thumbPercent}%` : '50%',
            height: `${Math.abs(thumbPercent - 50)}%`,
          }}
        />

        {/* Pitch Thumb Handle */}
        <div
          className="absolute right-0.5 left-0.5 -mt-1.5 h-3 rounded border border-white/90 bg-[#9ba4ff] shadow-[0_0_10px_#9ba4ff] transition-transform active:scale-95"
          style={{ top: `${thumbPercent}%` }}
        />
      </div>

      {/* Readout */}
      <span className="mt-1 text-center font-mono text-xs font-bold tracking-tight text-[#c0c7ff]">
        {pitchBend > 0 ? `+${pitchBend.toFixed(1)}` : pitchBend.toFixed(1)} st
      </span>
    </div>
  )
}
