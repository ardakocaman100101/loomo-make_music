import MovablePopup from '@/components/MovablePopup'
import { usePlayer } from '@/features/player'
import { BarChart2 } from '@/icons'
import { useAtomValue } from 'jotai'

export function StatsPopup({}) {
  const player = usePlayer()

  const accuracy = useAtomValue(player.score.accuracy)
  const perfect = useAtomValue(player.score.perfect)
  const early = useAtomValue(player.score.early)
  const late = useAtomValue(player.score.late)
  const miss = useAtomValue(player.score.miss)

  return (
    <MovablePopup
      initialPosition={{ x: '100%', y: 90 }}
      header={
        <div className="relative flex h-full w-full cursor-grab items-center justify-center">
          <div className="z-10 flex items-baseline gap-2 select-none sm:gap-2.5">
            <span className="text-xs font-black tracking-[0.18em] text-[#6c79f0] uppercase sm:text-sm lg:text-[17px]">
              Score
            </span>
            <span className="text-sm font-black text-white sm:text-base lg:text-[20px]">{accuracy}%</span>
          </div>
        </div>
      }
    >
      <div className="flex w-full flex-col gap-1 p-0.5 sm:gap-1.5">
        {/* Row 1: Early (Yellow) & Perfect (Green) */}
        <div className="grid grid-cols-2 gap-1 sm:gap-1.5">
          <div className="flex min-w-0 flex-col items-center rounded-lg border border-white/5 bg-white/5 px-1.5 py-1 sm:rounded-xl sm:px-2 sm:py-1.5">
            <span className="text-center text-[8px] font-bold tracking-wider text-yellow-400/90 select-none sm:text-[9px]">
              EARLY
            </span>
            <span className="mt-0.5 text-sm font-bold text-yellow-400 leading-none sm:mt-1 sm:text-lg lg:text-xl">{early}</span>
          </div>
          <div className="flex min-w-0 flex-col items-center rounded-lg border border-white/5 bg-white/5 px-1.5 py-1 sm:rounded-xl sm:px-2 sm:py-1.5">
            <span className="text-center text-[8px] font-bold tracking-wider text-green-400/90 select-none sm:text-[9px]">
              PERFECT
            </span>
            <span className="mt-0.5 text-sm font-bold text-green-400 leading-none sm:mt-1 sm:text-lg lg:text-xl">{perfect}</span>
          </div>
        </div>

        {/* Row 2: Late (Blue) & Miss (Red) */}
        <div className="grid grid-cols-2 gap-1 sm:gap-1.5">
          <div className="flex min-w-0 flex-col items-center rounded-lg border border-white/5 bg-white/5 px-1.5 py-1 sm:rounded-xl sm:px-2 sm:py-1.5">
            <span className="text-center text-[8px] font-bold tracking-wider text-purple-400/90 select-none sm:text-[9px]">
              LATE
            </span>
            <span className="mt-0.5 text-sm font-bold text-purple-400 leading-none sm:mt-1 sm:text-lg lg:text-xl">{late}</span>
          </div>
          <div className="flex min-w-0 flex-col items-center rounded-lg border border-white/5 bg-white/5 px-1.5 py-1 sm:rounded-xl sm:px-2 sm:py-1.5">
            <span className="text-center text-[8px] font-bold tracking-wider text-red-500/90 select-none sm:text-[9px]">
              MISS
            </span>
            <span className="mt-0.5 text-sm font-bold text-red-500 leading-none sm:mt-1 sm:text-lg lg:text-xl">{miss}</span>
          </div>
        </div>
      </div>
    </MovablePopup>
  )
}
