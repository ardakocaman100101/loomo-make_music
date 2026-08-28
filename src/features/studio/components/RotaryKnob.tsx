import React, { useRef } from 'react'

interface RotaryKnobProps {
  label: string
  value: number // Current value
  min: number
  max: number
  step?: number
  displayValue: string // Formatted string readout e.g. "12.5 kHz"
  onChange: (val: number) => void
  className?: string
}

export const RotaryKnob: React.FC<RotaryKnobProps> = ({
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
  const startYRef = useRef<number>(0)
  const startValRef = useRef<number>(value)

  // Angle mapping: -135deg (min) to +135deg (max) => Total 270 degree sweep
  const normalized = Math.max(0, Math.min(1, (value - min) / (max - min)))
  const angle = -135 + normalized * 270

  const handlePointerDown = (e: React.PointerEvent) => {
    isDraggingRef.current = true
    startYRef.current = e.clientY
    startValRef.current = value
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
  }

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDraggingRef.current) return
    const deltaY = startYRef.current - e.clientY // Drag UP = increase, Drag DOWN = decrease
    const range = max - min
    const sensitivity = range / 150 // 150px full drag range

    let newVal = startValRef.current + deltaY * sensitivity
    newVal = Math.max(min, Math.min(max, newVal))
    if (step) {
      newVal = Math.round(newVal / step) * step
    }
    onChange(newVal)
  }

  const handlePointerUp = (e: React.PointerEvent) => {
    isDraggingRef.current = false
    try {
      ;(e.target as HTMLElement).releasePointerCapture(e.pointerId)
    } catch {}
  }

  // SVG Arc calculation for visual knob glow ring
  const radius = 16
  const strokeWidth = 3
  const circumference = 2 * Math.PI * radius
  const arcLength = (270 / 360) * circumference
  const strokeDashoffset = arcLength * (1 - normalized)

  return (
    <div className={`flex w-[68px] min-w-[68px] shrink-0 flex-col items-center select-none ${className}`}>
      {/* Knob Label (Level 3: Component Label) */}
      <span className="mb-0.5 w-full truncate text-center text-[10px] font-semibold tracking-wide text-white/70 uppercase">
        {label}
      </span>

      {/* Rotary Dial */}
      <div
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        className="group relative flex h-10 w-10 cursor-ns-resize touch-none items-center justify-center"
      >
        {/* SVG Track & Glow Arc */}
        <svg className="pointer-events-none h-10 w-10 -rotate-90" viewBox="0 0 40 40">
          {/* Background Track Arc */}
          <circle
            cx="20"
            cy="20"
            r={radius}
            fill="none"
            stroke="rgba(255, 255, 255, 0.12)"
            strokeWidth={strokeWidth}
            strokeDasharray={`${arcLength} ${circumference}`}
            strokeLinecap="round"
          />
          {/* Active Glow Arc */}
          <circle
            cx="20"
            cy="20"
            r={radius}
            fill="none"
            stroke="#9ba4ff"
            strokeWidth={strokeWidth}
            strokeDasharray={`${arcLength} ${circumference}`}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            style={{
              transition: isDraggingRef.current ? 'none' : 'stroke-dashoffset 0.1s ease-out',
            }}
          />
        </svg>

        {/* Rotary Center Cap */}
        <div
          className="absolute flex h-7 w-7 items-center justify-center rounded-full border border-white/20 bg-gradient-to-b from-[#2a2a35] to-[#14141c] shadow-md transition-transform group-hover:scale-105 active:scale-95"
          style={{ transform: `rotate(${angle}deg)` }}
        >
          {/* Pointer Notch Line */}
          <div className="h-2.5 w-0.5 -translate-y-1.5 rounded-full bg-[#9ba4ff] shadow-[0_0_6px_#9ba4ff]" />
        </div>
      </div>

      {/* Real-time Value Readout (Level 2: Input Value) */}
      <span className="mt-0.5 max-w-[75px] truncate text-center font-mono text-xs font-bold tracking-tight text-[#c0c7ff]">
        {displayValue}
      </span>
    </div>
  )
}
