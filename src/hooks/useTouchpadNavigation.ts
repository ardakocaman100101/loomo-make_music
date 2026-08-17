import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router'

interface TouchpadNavigationOptions {
  enabled?: boolean
  wheelThreshold?: number
  touchThreshold?: number
  cooldownMs?: number
}

/**
 * Hook to support common touchpad & mouse gestures for back/forward navigation:
 * - Two-finger horizontal swipe on trackpad (wheel deltaX)
 * - Mouse navigation buttons (button 3 for back, button 4 for forward)
 * - Touchscreen horizontal edge swipes
 */
export function useTouchpadNavigation({
  enabled = true,
  wheelThreshold = 120,
  touchThreshold = 80,
  cooldownMs = 600,
}: TouchpadNavigationOptions = {}) {
  const navigate = useNavigate()
  const accumulatedX = useRef(0)
  const accumulatedY = useRef(0)
  const lastResetTime = useRef(0)
  const lastNavigatedTime = useRef(0)
  const touchStartPos = useRef<{ x: number; y: number; time: number } | null>(null)

  useEffect(() => {
    if (!enabled || typeof window === 'undefined') return

    // Checks if the target element or its ancestors have active horizontal scroll
    const isInsideHorizontalScrollContainer = (
      target: EventTarget | null,
      direction: 'left' | 'right',
    ): boolean => {
      let el = target as HTMLElement | null
      while (el && el !== document.body && el !== document.documentElement) {
        const style = window.getComputedStyle(el)
        const overflowX = style.overflowX
        const isScrollable =
          (overflowX === 'auto' || overflowX === 'scroll') && el.scrollWidth > el.clientWidth + 2

        if (isScrollable) {
          if (direction === 'right' && el.scrollLeft > 2) {
            return true
          }
          if (direction === 'left' && el.scrollLeft < el.scrollWidth - el.clientWidth - 2) {
            return true
          }
        }
        el = el.parentElement
      }
      return false
    }

    const handleWheel = (e: WheelEvent) => {
      // Ignore pinch-to-zoom (ctrlKey) or vertical-dominant scroll
      if (e.ctrlKey || e.metaKey || e.altKey) return

      const now = Date.now()

      // Reset accumulator after pause in gestures (200ms)
      if (now - lastResetTime.current > 200) {
        accumulatedX.current = 0
        accumulatedY.current = 0
      }
      lastResetTime.current = now

      accumulatedX.current += e.deltaX
      accumulatedY.current += Math.abs(e.deltaY)

      // Only navigate if horizontal movement is dominant
      if (accumulatedY.current > Math.abs(accumulatedX.current) * 0.7) {
        return
      }

      if (now - lastNavigatedTime.current < cooldownMs) {
        return
      }

      // Swipe Right (deltaX < 0) -> Go Back
      if (accumulatedX.current <= -wheelThreshold) {
        if (!isInsideHorizontalScrollContainer(e.target, 'right')) {
          lastNavigatedTime.current = now
          accumulatedX.current = 0
          accumulatedY.current = 0
          navigate(-1)
        }
      }
      // Swipe Left (deltaX > 0) -> Go Forward
      else if (accumulatedX.current >= wheelThreshold) {
        if (!isInsideHorizontalScrollContainer(e.target, 'left')) {
          lastNavigatedTime.current = now
          accumulatedX.current = 0
          accumulatedY.current = 0
          navigate(1)
        }
      }
    }

    // Mouse back/forward button handling (Button 3 = Back, Button 4 = Forward)
    const handleMouseUp = (e: MouseEvent) => {
      const now = Date.now()
      if (now - lastNavigatedTime.current < cooldownMs) return

      if (e.button === 3) {
        e.preventDefault()
        lastNavigatedTime.current = now
        navigate(-1)
      } else if (e.button === 4) {
        e.preventDefault()
        lastNavigatedTime.current = now
        navigate(1)
      }
    }

    // Touch screen swipe handling
    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 1) {
        touchStartPos.current = {
          x: e.touches[0].clientX,
          y: e.touches[0].clientY,
          time: Date.now(),
        }
      } else {
        touchStartPos.current = null
      }
    }

    const handleTouchEnd = (e: TouchEvent) => {
      if (!touchStartPos.current) return
      const start = touchStartPos.current
      touchStartPos.current = null

      if (e.changedTouches.length === 0) return
      const endX = e.changedTouches[0].clientX
      const endY = e.changedTouches[0].clientY
      const deltaX = endX - start.x
      const deltaY = endY - start.y
      const elapsed = Date.now() - start.time

      // Must be a fast and horizontal swipe (within 400ms)
      if (elapsed > 400 || Math.abs(deltaY) > Math.abs(deltaX) * 0.6) return

      const now = Date.now()
      if (now - lastNavigatedTime.current < cooldownMs) return

      if (deltaX > touchThreshold) {
        if (!isInsideHorizontalScrollContainer(e.target, 'right')) {
          lastNavigatedTime.current = now
          navigate(-1)
        }
      } else if (deltaX < -touchThreshold) {
        if (!isInsideHorizontalScrollContainer(e.target, 'left')) {
          lastNavigatedTime.current = now
          navigate(1)
        }
      }
    }

    window.addEventListener('wheel', handleWheel, { passive: true })
    window.addEventListener('mouseup', handleMouseUp)
    window.addEventListener('auxclick', handleMouseUp)
    window.addEventListener('touchstart', handleTouchStart, { passive: true })
    window.addEventListener('touchend', handleTouchEnd, { passive: true })

    return () => {
      window.removeEventListener('wheel', handleWheel)
      window.removeEventListener('mouseup', handleMouseUp)
      window.removeEventListener('auxclick', handleMouseUp)
      window.removeEventListener('touchstart', handleTouchStart)
      window.removeEventListener('touchend', handleTouchEnd)
    }
  }, [enabled, wheelThreshold, touchThreshold, cooldownMs, navigate])
}
