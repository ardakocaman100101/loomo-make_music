import { VolumeSliderButton } from '@/features/controls'
import { Logo, Midi } from '@/icons'
import { ButtonWithTooltip } from '@/pages/play/components/TopBar'
import { ArrowLeft } from 'lucide-react'
import { MouseEvent } from 'react'
import { Link } from 'react-router'

type TopBarProps = {
  onClickBack: () => void
  onClickMidi: (e: MouseEvent<any>) => void
}

export default function TopBar({ onClickBack, onClickMidi }: TopBarProps) {
  return (
    <div className="fixed top-0 left-0 z-40 flex h-[78px] w-full items-center border-b border-white/5 bg-[#131313]/20 px-6 shadow-[0_8px_32px_rgba(0,0,0,0.37)] backdrop-blur-3xl select-none">
      {/* Left side: Back button */}
      <div className="flex items-center">
        <ButtonWithTooltip tooltip="Back" onClick={onClickBack}>
          <ArrowLeft size={32} className="cursor-pointer text-white/70 hover:text-white" />
        </ButtonWithTooltip>
      </div>

      {/* Center: Absolute centered loomo Identity */}
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

      {/* Right side: MIDI Device, Volume */}
      <div className="ml-auto flex items-center gap-6">
        <ButtonWithTooltip tooltip="Choose a MIDI device" onClick={onClickMidi}>
          <Midi size={32} />
        </ButtonWithTooltip>

        <VolumeSliderButton />
      </div>
    </div>
  )
}
