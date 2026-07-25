import { Tooltip } from '@/components'
import { VolumeSliderButton } from '@/features/controls'
import { Logo, Midi } from '@/icons'
import { isMobile } from '@/utils'
import clsx from 'clsx'
import { ArrowLeft, BarChart2 } from 'lucide-react'
import { MouseEvent, PropsWithChildren } from 'react'
import { Link } from 'react-router'

type ButtonProps = PropsWithChildren<{
  tooltip: string
  isActive?: boolean
  onClick?: (e: MouseEvent<any>) => void
  className?: string
}>

export function ButtonWithTooltip({
  tooltip,
  children,
  isActive,
  onClick,
  className,
}: ButtonProps) {
  return (
    <Tooltip label={tooltip}>
      <button
        className={clsx(
          'group flex items-center justify-center rounded-md p-2 transition hover:bg-white/10 active:bg-white/20',
          isActive ? 'text-purple-primary' : 'text-white/70 hover:text-white',
          className,
        )}
        onClick={onClick}
      >
        {children}
      </button>
    </Tooltip>
  )
}

type TopBarProps = {
  title?: string
  onClickBack: () => void
  onClickMidi: (e: MouseEvent<any>) => void
  onClickStats: (e: MouseEvent<any>) => void
  statsVisible: boolean
}

export default function TopBar({
  onClickBack,
  onClickMidi,
  onClickStats,
  statsVisible,
}: TopBarProps) {
  return (
    <div className="fixed top-0 left-0 z-[100] flex h-[78px] w-full items-center border-b border-white/5 bg-[#131313]/20 px-6 shadow-[0_8px_32px_rgba(0,0,0,0.37)] backdrop-blur-3xl select-none">
      {/* Left side: Back button */}
      <div className="flex items-center">
        <ButtonWithTooltip tooltip="Back" onClick={onClickBack}>
          <ArrowLeft size={32} className="cursor-pointer" />
        </ButtonWithTooltip>
      </div>

      {/* Center: Absolute centered Loomo Identity */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
        <Link to="/" onClick={onClickBack} className="group flex items-center gap-3">
          <Logo
            height={42}
            width={77}
            className="h-10.5 w-[77px] cursor-pointer shadow-[0_0_15px_rgba(160,120,255,0.3)] transition-all group-hover:scale-105"
          />
          <span className="cursor-pointer text-3xl font-black tracking-tighter text-[#e5e2e1] transition-all group-hover:text-[#d0bcff] sm:text-4xl">
            loomo
          </span>
        </Link>
      </div>

      {/* Right side: MIDI Device, Volume, Stats Toggles */}
      <div className="ml-auto flex items-center gap-6">
        <ButtonWithTooltip tooltip="Choose a MIDI device" onClick={onClickMidi}>
          <Midi size={32} />
        </ButtonWithTooltip>

        {!isMobile() && (
          <div className="relative z-[100]">
            <VolumeSliderButton />
          </div>
        )}

        <ButtonWithTooltip
          tooltip={statsVisible ? 'Hide Stats' : 'Show Stats'}
          onClick={onClickStats}
        >
          <BarChart2
            size={32}
            className={statsVisible ? 'text-white' : 'text-white/40 hover:text-white'}
          />
        </ButtonWithTooltip>
      </div>
    </div>
  )
}
