import React, { useRef } from 'react'

interface VerticalFaderProps {
  label: string
  value: number // Current value
  min: number
  max: number
  step?: number
  displayValue: string // Formatted readout e.g. "90%"
  onChange: (val: number) => void
  className?: string
}

export const VerticalFader: React.FC<VerticalFaderProps> = ({
  label,
  value,
  min,
  max,
  step = 0.01,
  displayValue,
  onChange,
  className = '',
}) => {
  const isDraggingRef = useRef<boolean>(false)
  const trackRef = useRef<HTMLDivElement>(null)

  const normalized = Math.max(0, Math.min(1, (value - min) / (max - min)))
  const thumbBottomPercent = normalized * 100

  const updateFromPointer = (clientY: number) => {
    if (!trackRef.current) return
    const rect = trackRef.current.getBoundingClientRect()
    const height = rect.height
    const relativeY = clientY - rect.top
    const clampedY = Math.max(0, Math.min(height, relativeY))

    // Bottom = min, Top = max
    const norm = 1 - clampedY / height
    let newVal = min + norm * (max - min)
    if (step) {
      newVal = Math.round(newVal / step) * step
    }
    onChange(Math.max(min, Math.min(max, newVal)))
  }

  const handlePointerDown = (e: React.PointerEvent) => {
    isDraggingRef.current = true
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
    updateFromPointer(e.clientY)
  }

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDraggingRef.current) return
    updateFromPointer(e.clientY)
  }

  const handlePointerUp = (e: React.PointerEvent) => {
    isDraggingRef.current = false
    try {
      ;(e.target as HTMLElement).releasePointerCapture(e.pointerId)
    } catch {}
  }

  return (
    <div className={`flex flex-col items-center select-none ${className}`}>
      {/* Component Label (Level 3: Component Label) */}
      <span className="mb-0.5 max-w-[65px] truncate text-center text-[10px] font-semibold tracking-wide text-white/70 uppercase">
        {label}
      </span>

      {/* Track & Thumb */}
      <div
        ref={trackRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        className="group relative h-20 w-5 cursor-ns-resize touch-none overflow-hidden rounded-lg border border-white/15 bg-gradient-to-b from-[#181824] via-[#101018] to-[#181824] p-0.5 shadow-inner"
      >
        {/* Filled Level Glow Gradient */}
        <div
          className="absolute right-0.5 bottom-0 left-0.5 rounded-b-md bg-gradient-to-t from-[#6c79f0]/40 to-[#9ba4ff]/60 transition-all"
          style={{ height: `${thumbBottomPercent}%` }}
        />

        {/* Fader Handle / Cap */}
        <div
          className="absolute right-0 left-0 -mb-1.5 flex h-3 items-center justify-center rounded border border-white/90 bg-[#9ba4ff] shadow-[0_0_8px_#9ba4ff] transition-all group-hover:scale-105 active:scale-95"
          style={{ bottom: `${thumbBottomPercent}%` }}
        >
          {/* Horizontal Grip Line */}
          <div className="h-[1.5px] w-3 rounded-full bg-[#131313]" />
        </div>
      </div>

      {/* Dynamic Readout (Level 2: Input Value) */}
      <span className="mt-0.5 max-w-[65px] truncate text-center font-mono text-xs font-bold tracking-tight text-[#c0c7ff]">
        {displayValue}
      </span>
    </div>
  )
}
