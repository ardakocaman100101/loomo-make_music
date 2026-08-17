'use client'

import { ChevronDown, ChevronUp } from '@/icons'
import React, { ReactNode, useEffect, useRef, useState } from 'react'

type PercentOrPx = number | `${number}%`

type MovablePopupProps = {
  initialPosition?: { x: PercentOrPx; y: PercentOrPx }
  header: ReactNode
  children: ReactNode
}

function resolvePosition(value: PercentOrPx, axis: 'x' | 'y', popupW: number, popupH: number) {
  const size = axis === 'x' ? window.innerWidth : window.innerHeight
  const popupSize = axis === 'x' ? popupW : popupH
  const margin = 16
  if (typeof value === 'number') {
    return Math.max(margin, Math.min(value, size - popupSize - margin))
  }
  const percent = parseFloat(value) / 100
  if (percent >= 0.99) {
    return Math.max(margin, size - popupSize - margin)
  }
  const pos = size * percent - popupSize / 2
  return Math.max(margin, Math.min(pos, size - popupSize - margin))
}

export default function MovablePopup({
  initialPosition = { x: 0, y: 0 },
  header,
  children,
}: MovablePopupProps) {
  const [expanded, setExpanded] = useState(true)
  const [position, setPosition] = useState({ x: 0, y: 0 })

  const popupRef = useRef<HTMLDivElement>(null)
  const dragging = useRef(false)
  const hasUserDraggedRef = useRef(false)
  const offset = useRef({ x: 0, y: 0 })

  useEffect(() => {
    if (!popupRef.current) return
    const popupW = popupRef.current.offsetWidth
    const popupH = popupRef.current.offsetHeight
    setPosition({
      x: resolvePosition(initialPosition.x, 'x', popupW, popupH),
      y: resolvePosition(initialPosition.y, 'y', popupW, popupH),
    })
  }, [])

  useEffect(() => {
    function enforceBounds() {
      if (!popupRef.current) return
      const popupW = popupRef.current.offsetWidth
      const popupH = popupRef.current.offsetHeight

      if (!hasUserDraggedRef.current) {
        // If not manually dragged, recalculate from initial anchor (e.g. right docked)
        setPosition({
          x: resolvePosition(initialPosition.x, 'x', popupW, popupH),
          y: resolvePosition(initialPosition.y, 'y', popupW, popupH),
        })
      } else {
        // If manually dragged, clamp within screen margins
        const margin = 16
        setPosition((prev) => ({
          x: Math.max(margin, Math.min(prev.x, window.innerWidth - popupW - margin)),
          y: Math.max(margin, Math.min(prev.y, window.innerHeight - popupH - margin)),
        }))
      }
    }
    window.addEventListener('resize', enforceBounds)
    return () => window.removeEventListener('resize', enforceBounds)
  }, [initialPosition.x, initialPosition.y])

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!popupRef.current) return
    dragging.current = true
    hasUserDraggedRef.current = true
    const rect = popupRef.current.getBoundingClientRect()
    offset.current = { x: e.clientX - rect.left, y: e.clientY - rect.top }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
  }

  const handleMouseMove = (e: MouseEvent) => {
    if (!dragging.current || !popupRef.current) return
    const popup = popupRef.current
    const margin = 16
    const newX = Math.max(
      margin,
      Math.min(e.clientX - offset.current.x, window.innerWidth - popup.offsetWidth - margin),
    )
    const newY = Math.max(
      margin,
      Math.min(e.clientY - offset.current.y, window.innerHeight - popup.offsetHeight - margin),
    )
    popup.style.transform = `translate(${newX}px, ${newY}px)`
  }

  const handleMouseUp = () => {
    if (!dragging.current || !popupRef.current) return
    dragging.current = false
    const rect = popupRef.current.getBoundingClientRect()
    setPosition({ x: rect.left, y: rect.top })

    document.removeEventListener('mousemove', handleMouseMove)
    document.removeEventListener('mouseup', handleMouseUp)
  }

  return (
    <div
      ref={popupRef}
      className={`fixed z-50 w-[220px] cursor-grab rounded-2xl border border-white/5 bg-black/25 text-white shadow-[inset_0_1px_0_0_rgba(255,255,255,0.15),0_8px_32px_0_rgba(0,0,0,0.37)] backdrop-blur-xl select-none transition-[width] duration-200 sm:w-[250px] lg:w-[280px] lg:rounded-[20px]`}
      style={{ transform: `translate(${position.x}px, ${position.y}px)` }}
      onMouseDown={handleMouseDown}
    >
      <div className="relative flex w-full flex-col overflow-hidden">
        <div className="relative flex h-[42px] w-full cursor-grab items-center justify-between border-b border-white/5 px-3 sm:h-[46px] sm:px-3.5 lg:h-[50px] lg:px-4">
          {header}
        </div>

        <div className="p-2.5 text-xs sm:p-3 sm:text-sm lg:p-4">{children}</div>
      </div>
    </div>
  )
}
