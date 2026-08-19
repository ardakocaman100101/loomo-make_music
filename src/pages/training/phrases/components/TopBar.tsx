import { VolumeSliderButton } from '@/features/controls'
import { ArrowLeft, Midi } from '@/icons'
import { ButtonWithTooltip } from '@/pages/play/components/TopBar'
import { isMobile } from '@/utils'
import { MouseEvent } from 'react'
import { Link } from 'react-router'

type TopBarProps = {
  onClickMidi: (e: MouseEvent<any>) => void
}

export default function TopBar({ onClickMidi }: TopBarProps) {
  return (
    <div className="flex h-[50px] min-h-[50px] w-full items-center gap-4 bg-[#292929] px-8 text-2xl text-white transition">
      <ButtonWithTooltip tooltip="Back">
        <Link to="/">
          <ArrowLeft size={24} />
        </Link>
      </ButtonWithTooltip>
      <div className="ml-auto flex items-center gap-3">
        {!isMobile() && <VolumeSliderButton />}
      </div>
    </div>
  )
}
