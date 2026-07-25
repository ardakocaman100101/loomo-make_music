import { EQBandState, getAudioEffectsBus } from '@/features/synth/effects-bus'
import React, { useCallback, useEffect, useRef, useState } from 'react'

interface VisualEQProps {
  className?: string
}

const MIN_FREQ = 20
const MAX_FREQ = 20000
const MIN_GAIN = -24
const MAX_GAIN = 24

function freqToX(freq: number, width: number): number {
  const logMin = Math.log10(MIN_FREQ)
  const logMax = Math.log10(MAX_FREQ)
  const logFreq = Math.log10(Math.max(MIN_FREQ, Math.min(MAX_FREQ, freq)))
  return ((logFreq - logMin) / (logMax - logMin)) * width
}

function xToFreq(x: number, width: number): number {
  const logMin = Math.log10(MIN_FREQ)
  const logMax = Math.log10(MAX_FREQ)
  const ratio = Math.max(0, Math.min(1, x / width))
  return Math.pow(10, logMin + ratio * (logMax - logMin))
}

function gainToY(gain: number, height: number): number {
  const ratio = (gain - MIN_GAIN) / (MAX_GAIN - MIN_GAIN)
  return height * (1 - ratio)
}

function yToGain(y: number, height: number): number {
  const ratio = 1 - Math.max(0, Math.min(1, y / height))
  return MIN_GAIN + ratio * (MAX_GAIN - MIN_GAIN)
}

export const VisualEQ: React.FC<VisualEQProps> = ({ className = '' }) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [eqState, setEqState] = useState<{
    low: EQBandState
    mid: EQBandState
    high: EQBandState
  }>({
    low: { freq: 80, gain: 0, Q: 1.0 },
    mid: { freq: 1000, gain: 0, Q: 1.0 },
    high: { freq: 8000, gain: 0, Q: 1.0 },
  })

  const [activeBand, setActiveBand] = useState<'low' | 'mid' | 'high' | null>(null)
  const [hoveredBand, setHoveredBand] = useState<'low' | 'mid' | 'high' | null>(null)
  const isDraggingRef = useRef<boolean>(false)

  // Subscribe to audio engine state updates
  useEffect(() => {
    const bus = getAudioEffectsBus()
    const unsubscribe = bus.subscribe((state) => {
      if (!isDraggingRef.current) {
        setEqState({
          low: { ...state.eqLow },
          mid: { ...state.eqMid },
          high: { ...state.eqHigh },
        })
      }
    })
    return () => unsubscribe()
  }, [])

  // Draw smooth parametric EQ curve on canvas
  const drawEQ = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const width = canvas.width
    const height = canvas.height

    ctx.clearRect(0, 0, width, height)

    // Background Grid
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)'
    ctx.lineWidth = 1

    // Horizontal 0dB line
    const zeroY = gainToY(0, height)
    ctx.beginPath()
    ctx.moveTo(0, zeroY)
    ctx.lineTo(width, zeroY)
    ctx.stroke()

    // Vertical octave grid lines
    const gridFreqs = [100, 500, 1000, 5000, 10000]
    gridFreqs.forEach((f) => {
      const gx = freqToX(f, width)
      ctx.beginPath()
      ctx.moveTo(gx, 0)
      ctx.lineTo(gx, height)
      ctx.stroke()
    })

    // Compute frequency response across 120 points
    const pointsCount = 120
    const points: { x: number; y: number }[] = []

    for (let i = 0; i <= pointsCount; i++) {
      const px = (i / pointsCount) * width
      const f = xToFreq(px, width)

      // Lowshelf gain approximation
      const fLowRatio = f / eqState.low.freq
      const gainLow = eqState.low.gain / (1 + Math.pow(fLowRatio, 2 * eqState.low.Q))

      // Peaking filter gain approximation
      const logRatioMid = Math.log2(f / eqState.mid.freq)
      const bandwidthMid = 1 / Math.max(0.2, eqState.mid.Q)
      const gainMid = eqState.mid.gain * Math.exp(-Math.pow(logRatioMid / bandwidthMid, 2))

      // Highshelf gain approximation
      const fHighRatio = eqState.high.freq / f
      const gainHigh = eqState.high.gain / (1 + Math.pow(fHighRatio, 2 * eqState.high.Q))

      const totalGain = Math.max(MIN_GAIN, Math.min(MAX_GAIN, gainLow + gainMid + gainHigh))
      const py = gainToY(totalGain, height)
      points.push({ x: px, y: py })
    }

    // Draw Filled Gradient under curve
    const gradient = ctx.createLinearGradient(0, 0, 0, height)
    gradient.addColorStop(0, 'rgba(155, 164, 255, 0.35)')
    gradient.addColorStop(0.5, 'rgba(108, 121, 240, 0.15)')
    gradient.addColorStop(1, 'rgba(108, 121, 240, 0.0)')

    ctx.fillStyle = gradient
    ctx.beginPath()
    ctx.moveTo(0, height)
    points.forEach((p, idx) => {
      if (idx === 0) ctx.lineTo(p.x, p.y)
      else ctx.lineTo(p.x, p.y)
    })
    ctx.lineTo(width, height)
    ctx.closePath()
    ctx.fill()

    // Draw Smooth EQ Path Line
    ctx.strokeStyle = '#9ba4ff'
    ctx.lineWidth = 2.5
    ctx.beginPath()
    points.forEach((p, idx) => {
      if (idx === 0) ctx.moveTo(p.x, p.y)
      else ctx.lineTo(p.x, p.y)
    })
    ctx.stroke()

    // Draw 3 Interactive Bands (Low, Mid, High)
    const bands: { band: 'low' | 'mid' | 'high'; label: string; data: EQBandState }[] = [
      { band: 'low', label: 'L', data: eqState.low },
      { band: 'mid', label: 'M', data: eqState.mid },
      { band: 'high', label: 'H', data: eqState.high },
    ]

    bands.forEach(({ band, label, data }) => {
      const nx = freqToX(data.freq, width)
      const ny = gainToY(data.gain, height)
      const isSelected = activeBand === band || hoveredBand === band

      // Node Outer Glow Ring
      if (isSelected) {
        ctx.beginPath()
        ctx.arc(nx, ny, 10, 0, Math.PI * 2)
        ctx.fillStyle = 'rgba(155, 164, 255, 0.3)'
        ctx.fill()
      }

      // Node Circle
      ctx.beginPath()
      ctx.arc(nx, ny, 6, 0, Math.PI * 2)
      ctx.fillStyle = isSelected ? '#ffffff' : '#9ba4ff'
      ctx.fill()
      ctx.strokeStyle = '#131313'
      ctx.lineWidth = 1.5
      ctx.stroke()

      // Node Label
      ctx.fillStyle = '#ffffff'
      ctx.font = 'bold 9px sans-serif'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(label, nx, ny - 13)
    })
  }, [eqState, activeBand, hoveredBand])

  // Dynamic canvas resize observer to adapt seamlessly when window resizes
  useEffect(() => {
    if (!containerRef.current) return
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (canvasRef.current && entry.contentRect.width > 0) {
          canvasRef.current.width = Math.floor(entry.contentRect.width)
          drawEQ()
        }
      }
    })
    observer.observe(containerRef.current)
    return () => observer.disconnect()
  }, [drawEQ])

  useEffect(() => {
    drawEQ()
  }, [drawEQ])

  // Mouse & Touch interaction handlers
  const getPointerPos = (e: React.PointerEvent) => {
    const canvas = canvasRef.current
    if (!canvas) return { x: 0, y: 0 }
    const rect = canvas.getBoundingClientRect()
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    }
  }

  const findNearestBand = (x: number, y: number): 'low' | 'mid' | 'high' | null => {
    const canvas = canvasRef.current
    if (!canvas) return null
    const width = canvas.width
    const height = canvas.height

    const bands: { band: 'low' | 'mid' | 'high'; data: EQBandState }[] = [
      { band: 'low', data: eqState.low },
      { band: 'mid', data: eqState.mid },
      { band: 'high', data: eqState.high },
    ]

    for (const { band, data } of bands) {
      const nx = freqToX(data.freq, width)
      const ny = gainToY(data.gain, height)
      const dist = Math.hypot(x - nx, y - ny)
      if (dist < 18) {
        return band
      }
    }
    return null
  }

  const handlePointerDown = (e: React.PointerEvent) => {
    const { x, y } = getPointerPos(e)
    const band = findNearestBand(x, y)
    if (band) {
      setActiveBand(band)
      isDraggingRef.current = true
      ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
      updateNodeParams(band, x, y)
    }
  }

  const updateNodeParams = (band: 'low' | 'mid' | 'high', x: number, y: number) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const freq = xToFreq(x, canvas.width)
    const gain = yToGain(y, canvas.height)

    setEqState((prev) => {
      const updated = {
        ...prev,
        [band]: { ...prev[band], freq: Math.round(freq), gain: Math.round(gain * 10) / 10 },
      }
      return updated
    })

    getAudioEffectsBus().setEqBand(band, { freq, gain })
  }

  const handlePointerMove = (e: React.PointerEvent) => {
    const { x, y } = getPointerPos(e)
    if (isDraggingRef.current && activeBand) {
      updateNodeParams(activeBand, x, y)
    } else {
      const nearest = findNearestBand(x, y)
      setHoveredBand(nearest)
    }
  }

  const handlePointerUp = (e: React.PointerEvent) => {
    isDraggingRef.current = false
    setActiveBand(null)
    try {
      ;(e.target as HTMLElement).releasePointerCapture(e.pointerId)
    } catch {}
  }

  // Mouse wheel to adjust Q-factor (Width)
  const handleWheel = (e: React.WheelEvent) => {
    const band = hoveredBand || activeBand || 'mid'
    e.preventDefault()
    e.stopPropagation()

    const currentQ = eqState[band].Q
    const delta = -e.deltaY * 0.005
    const newQ = Math.max(0.1, Math.min(10, currentQ + delta))

    setEqState((prev) => ({
      ...prev,
      [band]: { ...prev[band], Q: Math.round(newQ * 10) / 10 },
    }))

    getAudioEffectsBus().setEqBand(band, { Q: newQ })
  }

  const currentDisplayBand = hoveredBand || activeBand || 'mid'
  const currentBandData = eqState[currentDisplayBand]

  return (
    <div className={`flex w-full flex-col items-center select-none ${className}`}>
      <div className="mb-1.5 flex w-full items-center justify-between px-1.5">
        <span className="text-xs font-bold tracking-wider text-white/90 uppercase">Visual EQ</span>
        <span className="font-mono text-xs font-bold tracking-tight text-[#c0c7ff]">
          {currentDisplayBand.toUpperCase()}: {Math.round(currentBandData.freq)}Hz |{' '}
          {currentBandData.gain > 0
            ? `+${currentBandData.gain.toFixed(1)}`
            : currentBandData.gain.toFixed(1)}
          dB | Q:{currentBandData.Q.toFixed(1)}
        </span>
      </div>

      <div
        ref={containerRef}
        className="relative w-full overflow-hidden rounded-xl border border-white/10 bg-[#111116] p-1.5 shadow-lg"
      >
        <canvas
          ref={canvasRef}
          height={76}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          onWheel={handleWheel}
          className="block w-full cursor-crosshair touch-none rounded-lg"
        />
      </div>
    </div>
  )
}
