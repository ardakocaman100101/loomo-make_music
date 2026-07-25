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
        <div className="relative flex h-[50px] w-full cursor-grab items-center justify-center">
          <div className="z-10 flex items-baseline gap-2.5 select-none">
            <span className="text-[17px] font-black tracking-[0.18em] text-[#6c79f0] uppercase">
              Score
            </span>
            <span className="text-[20px] font-black text-white">{accuracy}%</span>
          </div>
        </div>
      }
    >
      <div className="flex w-full flex-col gap-1.5 p-0.5">
        {/* Row 1: Early (Yellow) & Perfect (Green) */}
        <div className="grid grid-cols-2 gap-1.5">
          <div className="flex min-w-0 flex-col items-center rounded-xl border border-white/5 bg-white/5 px-2 py-1.5">
            <span className="text-center text-[9px] font-bold tracking-wider text-yellow-400/90 select-none">
              EARLY
            </span>
            <span className="mt-1 text-xl leading-none font-bold text-yellow-400">{early}</span>
          </div>
          <div className="flex min-w-0 flex-col items-center rounded-xl border border-white/5 bg-white/5 px-2 py-1.5">
            <span className="text-center text-[9px] font-bold tracking-wider text-green-400/90 select-none">
              PERFECT
            </span>
            <span className="mt-1 text-xl leading-none font-bold text-green-400">{perfect}</span>
          </div>
        </div>

        {/* Row 2: Late (Blue) & Miss (Red) */}
        <div className="grid grid-cols-2 gap-1.5">
          <div className="flex min-w-0 flex-col items-center rounded-xl border border-white/5 bg-white/5 px-2 py-1.5">
            <span className="text-center text-[9px] font-bold tracking-wider text-purple-400/90 select-none">
              LATE
            </span>
            <span className="mt-1 text-xl leading-none font-bold text-purple-400">{late}</span>
          </div>
          <div className="flex min-w-0 flex-col items-center rounded-xl border border-white/5 bg-white/5 px-2 py-1.5">
            <span className="text-center text-[9px] font-bold tracking-wider text-red-500/90 select-none">
              MISS
            </span>
            <span className="mt-1 text-xl leading-none font-bold text-red-500">{miss}</span>
          </div>
        </div>
      </div>
    </MovablePopup>
  )
}
