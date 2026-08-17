import { usePlayer } from '@/features/player'
import { useAtomValue } from 'jotai'
import { useMemo } from 'react'

type PlayerStateHookReturn = {
  canPlay: boolean
  playing: boolean
  paused: boolean
  countingDown: boolean
  count: number | null
}

export default function usePlayerState(): PlayerStateHookReturn {
  const player = usePlayer()
  const state = useAtomValue(player.state)
  const countdown = useAtomValue(player.countdown)

  return useMemo(() => {
    return {
      canPlay: state !== 'CannotPlay',
      playing: state === 'Playing' || countdown !== null,
      paused: state === 'Paused' && countdown === null,
      countingDown: countdown !== null,
      count: countdown,
    }
  }, [state, countdown])
}
