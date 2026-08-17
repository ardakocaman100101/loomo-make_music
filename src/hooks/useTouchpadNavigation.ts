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
 * - Visual edge chevron indicator on navigation gesture threshold
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
  const indicatorRef = useRef<HTMLDivElement | null>(null)
  const hideTimeoutRef = useRef<any>(null)

  useEffect(() => {
    if (!enabled || typeof window === 'undefined') return

    // Create & mount lightweight visual edge indicator element
    let indicator = document.getElementById('loomo-touchpad-indicator') as HTMLDivElement | null
    if (!indicator) {
      indicator = document.createElement('div')
      indicator.id = 'loomo-touchpad-indicator'
      indicator.style.position = 'fixed'
      indicator.style.top = '50%'
      indicator.style.zIndex = '99999'
      indicator.style.pointerEvents = 'none'
      indicator.style.display = 'none'
      indicator.style.alignItems = 'center'
      indicator.style.justifyContent = 'center'
      indicator.style.width = '44px'
      indicator.style.height = '44px'
      indicator.style.borderRadius = '9999px'
      indicator.style.transition = 'opacity 160ms ease-out, transform 160ms ease-out, background 160ms ease-out, border 160ms ease-out, box-shadow 160ms ease-out'
      document.body.appendChild(indicator)
    }
    indicatorRef.current = indicator

    const showIndicator = (direction: 'back' | 'forward', progress: number, active: boolean) => {
      if (!indicatorRef.current) return
      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current)
        hideTimeoutRef.current = null
      }

      const el = indicatorRef.current
      el.style.display = 'flex'
      el.style.opacity = String(Math.min(1, progress * 1.25))

      if (direction === 'back') {
        el.style.left = `${16 + progress * 8}px`
        el.style.right = 'auto'
        el.style.transform = `translateY(-50%) scale(${0.85 + progress * 0.25})`
        el.innerHTML = `
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="${active ? '#FFFFFF' : '#8C49F4'}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="15 18 9 12 15 6"></polyline>
          </svg>
        `
      } else {
        el.style.right = `${16 + progress * 8}px`
        el.style.left = 'auto'
        el.style.transform = `translateY(-50%) scale(${0.85 + progress * 0.25})`
        el.innerHTML = `
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="${active ? '#FFFFFF' : '#8C49F4'}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="9 18 15 12 9 6"></polyline>
          </svg>
        `
      }

      el.style.background = active ? 'rgba(140, 73, 244, 0.45)' : 'rgba(16, 18, 35, 0.85)'
      el.style.backdropFilter = 'blur(12px)'
      el.style.border = `1.5px solid ${active ? '#8C49F4' : 'rgba(140, 73, 244, 0.4)'}`
      el.style.boxShadow = active
        ? '0 0 24px rgba(140, 73, 244, 0.75)'
        : '0 4px 16px rgba(0, 0, 0, 0.4)'
    }

    const hideIndicator = (delayMs = 200) => {
      if (!indicatorRef.current) return
      if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current)

      hideTimeoutRef.current = setTimeout(() => {
        if (indicatorRef.current) {
          indicatorRef.current.style.opacity = '0'
          setTimeout(() => {
            if (indicatorRef.current && indicatorRef.current.style.opacity === '0') {
              indicatorRef.current.style.display = 'none'
            }
          }, 160)
        }
      }, delayMs)
    }

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
        hideIndicator(0)
      }
      lastResetTime.current = now

      accumulatedX.current += e.deltaX
      accumulatedY.current += Math.abs(e.deltaY)

      // Only navigate if horizontal movement is dominant
      if (accumulatedY.current > Math.abs(accumulatedX.current) * 0.7) {
        hideIndicator(0)
        return
      }

      const absX = Math.abs(accumulatedX.current)

      // Render edge chevron feedback during swipe
      if (accumulatedX.current < -15) {
        if (!isInsideHorizontalScrollContainer(e.target, 'right')) {
          const progress = Math.min(1, absX / wheelThreshold)
          showIndicator('back', progress, progress >= 1)
        }
      } else if (accumulatedX.current > 15) {
        if (!isInsideHorizontalScrollContainer(e.target, 'left')) {
          const progress = Math.min(1, absX / wheelThreshold)
          showIndicator('forward', progress, progress >= 1)
        }
      } else {
        hideIndicator(100)
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
          showIndicator('back', 1, true)
          hideIndicator(250)
          navigate(-1)
        }
      }
      // Swipe Left (deltaX > 0) -> Go Forward
      else if (accumulatedX.current >= wheelThreshold) {
        if (!isInsideHorizontalScrollContainer(e.target, 'left')) {
          lastNavigatedTime.current = now
          accumulatedX.current = 0
          accumulatedY.current = 0
          showIndicator('forward', 1, true)
          hideIndicator(250)
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
        showIndicator('back', 1, true)
        hideIndicator(250)
        navigate(-1)
      } else if (e.button === 4) {
        e.preventDefault()
        lastNavigatedTime.current = now
        showIndicator('forward', 1, true)
        hideIndicator(250)
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
        hideIndicator(0)
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
      if (elapsed > 400 || Math.abs(deltaY) > Math.abs(deltaX) * 0.6) {
        hideIndicator(0)
        return
      }

      const now = Date.now()
      if (now - lastNavigatedTime.current < cooldownMs) return

      if (deltaX > touchThreshold) {
        if (!isInsideHorizontalScrollContainer(e.target, 'right')) {
          lastNavigatedTime.current = now
          showIndicator('back', 1, true)
          hideIndicator(250)
          navigate(-1)
        }
      } else if (deltaX < -touchThreshold) {
        if (!isInsideHorizontalScrollContainer(e.target, 'left')) {
          lastNavigatedTime.current = now
          showIndicator('forward', 1, true)
          hideIndicator(250)
          navigate(1)
        }
      } else {
        hideIndicator(0)
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
      if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current)
      if (indicatorRef.current && indicatorRef.current.parentNode) {
        indicatorRef.current.parentNode.removeChild(indicatorRef.current)
      }
    }
  }, [enabled, wheelThreshold, touchThreshold, cooldownMs, navigate])
}
