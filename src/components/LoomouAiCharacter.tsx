import { cn } from '@/utils'
import React from 'react'

interface LoomouAiCharacterProps {
  message?: string
  isLoading?: boolean
  size?: 'sm' | 'md' | 'lg'
  className?: string
  isDarkMode?: boolean
}

export function LoomouAiCharacter({
  message,
  isLoading = false,
  size = 'md',
  className,
  isDarkMode = false,
}: LoomouAiCharacterProps) {
  const containerSizes = {
    sm: 'w-24 h-16 sm:w-28 sm:h-20',
    md: 'w-32 h-22 sm:w-36 sm:h-26',
    lg: 'w-40 h-28 sm:w-48 sm:h-34',
  }[size]

  return (
    <div className={cn('flex flex-row items-center gap-3 w-full', className)}>
      {/* 35% Animated loomou AI Character Container */}
      <div className="relative w-[32%] sm:w-[35%] shrink-0 flex items-center justify-center">
        {/* Animated Character Image (100% Transparent, No Background, No Blinking) */}
        <div className="relative w-full max-w-[125px] aspect-[540/330] flex items-center justify-center">
          <img
            src="/loomou_animation.webp"
            alt="loomou AI character"
            className="h-full w-full object-contain select-none pointer-events-none drop-shadow-[0_0_16px_rgba(108,121,240,0.45)]"
            draggable={false}
          />
        </div>
      </div>

      {/* Emerging Speech-Bubble Chatbox */}
      <div
        className={cn(
          'relative flex-1 rounded-2xl border p-3 sm:p-3.5 shadow-md transition-all duration-300 w-full',
          isDarkMode
            ? 'border-white/10 bg-[#16182c]/90 text-white shadow-[0_10px_30px_rgba(0,0,0,0.5)]'
            : 'border-[#6c79f0]/20 bg-white/95 text-gray-900 shadow-[0_8px_25px_rgba(108,121,240,0.1)]',
        )}
      >
        {/* Speech-Bubble Caret Pointer (Left on desktop, Top on mobile) */}
        <div
          className={cn(
            'hidden sm:block absolute top-1/2 -left-2 -translate-y-1/2 w-0 h-0 border-y-[6px] border-y-transparent border-r-[8px]',
            isDarkMode ? 'border-r-[#16182c]' : 'border-r-white',
          )}
        />
        <div
          className={cn(
            'sm:hidden absolute -top-2 left-1/2 -translate-x-1/2 w-0 h-0 border-x-[6px] border-x-transparent border-b-[8px]',
            isDarkMode ? 'border-b-[#16182c]' : 'border-b-white',
          )}
        />

        {/* Message Content */}
        {isLoading ? (
          <div className="flex h-5 w-full animate-pulse items-center gap-2 rounded-xl py-1">
            <div className="h-2.5 w-3/4 rounded-full bg-[#6c79f0]/40" />
            <div className="h-2.5 w-1/4 rounded-full bg-[#6c79f0]/20" />
          </div>
        ) : (
          <p className="text-xs sm:text-[13px] font-semibold leading-relaxed">
            {message || 'Listen closely to the rhythm and keep your fingers relaxed on the keys.'}
          </p>
        )}
      </div>
    </div>
  )
}
