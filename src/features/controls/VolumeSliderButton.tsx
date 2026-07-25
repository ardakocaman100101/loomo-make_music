import { Dropdown, Slider } from '@/components'
import { Volume2, VolumeX } from '@/icons'
import { useAtomValue } from 'jotai'
import { usePlayer } from '../player'

export function VolumeSliderButton() {
  const player = usePlayer()
  const volume = useAtomValue(player.volume)
  const instrumentVolume = useAtomValue(player.instrumentVolume)

  const isSoundOff = volume === 0 && instrumentVolume === 0
  const toggleVolume = () => {
    if (isSoundOff) {
      player.setVolume(1)
      player.setInstrumentVolume(1)
    } else {
      player.setVolume(0)
      player.setInstrumentVolume(0)
    }
  }

  return (
    <Dropdown
      target={
        <div className="cursor-pointer text-white" onClick={toggleVolume}>
          {isSoundOff ? <VolumeX size={24} /> : <Volume2 size={24} />}
        </div>
      }
      openOn="hover"
    >
      <div className="relative z-[100] flex h-48 w-32 flex-row justify-around rounded-lg border border-gray-200 bg-white p-3 shadow-2xl select-none">
        {/* Left slider: Guide volume */}
        <div className="flex h-full flex-col items-center gap-1.5">
          <span className="text-[10px] font-bold tracking-wider text-gray-400 uppercase">
            Guide
          </span>
          <div className="flex-1 py-1">
            <Slider
              orientation="vertical"
              min={0}
              max={1}
              step={0.01}
              value={[volume]}
              onValueChange={(val) => player.setVolume(val[0])}
              // Clicks to the volume slider shouldn't close other modal-like windows
              onClick={(e) => e.stopPropagation()}
            />
          </div>
          <span className="text-center text-xs font-semibold text-black">
            {Math.round(volume * 100)}%
          </span>
        </div>

        {/* Vertical separator line */}
        <div className="h-full w-[1px] self-stretch bg-gray-100" />

        {/* Right slider: Instrument volume */}
        <div className="flex h-full flex-col items-center gap-1.5">
          <span className="text-[10px] font-bold tracking-wider text-gray-400 uppercase">Keys</span>
          <div className="flex-1 py-1">
            <Slider
              orientation="vertical"
              min={0}
              max={1}
              step={0.01}
              value={[instrumentVolume]}
              onValueChange={(val) => player.setInstrumentVolume(val[0])}
              onClick={(e) => e.stopPropagation()}
            />
          </div>
          <span className="text-center text-xs font-semibold text-black">
            {Math.round(instrumentVolume * 100)}%
          </span>
        </div>
      </div>
    </Dropdown>
  )
}
