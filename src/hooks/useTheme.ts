import { atom, useAtom } from 'jotai'
import { useEffect } from 'react'

const THEME_STORAGE_KEY = 'loomo_theme_dark'

function getInitialTheme(): boolean {
  if (typeof window === 'undefined') return true
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY)
    if (stored !== null) {
      return stored === 'true'
    }
  } catch (e) {
    // ignore
  }
  return true
}

export const isDarkModeAtom = atom<boolean>(getInitialTheme())

/**
 * Global theme hook that persists dark/light mode across page navigations within the session.
 * Automatically synchronizes `document.documentElement` and `document.body` classes.
 */
export function useTheme() {
  const [isDarkMode, setIsDarkMode] = useAtom(isDarkModeAtom)

  useEffect(() => {
    try {
      localStorage.setItem(THEME_STORAGE_KEY, String(isDarkMode))
    } catch (e) {
      // ignore
    }

    if (isDarkMode) {
      document.documentElement.classList.add('dark')
      document.body.classList.add('bg-[#101223]', 'text-[#F4F5F8]')
      document.body.classList.remove('bg-[#F6F7FB]', 'text-[#24273A]')
    } else {
      document.documentElement.classList.remove('dark')
      document.body.classList.remove('bg-[#101223]', 'text-[#F4F5F8]')
      document.body.classList.add('bg-[#F6F7FB]', 'text-[#24273A]')
    }
  }, [isDarkMode])

  return [isDarkMode, setIsDarkMode] as const
}
