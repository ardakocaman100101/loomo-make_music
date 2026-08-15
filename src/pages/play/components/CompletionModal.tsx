import { CoachingPayload, generateAICoachingAdvice } from '@/features/ai/coaching'
import { usePlayer } from '@/features/player'
import { sessionScoreHistory } from '@/features/player/scoring'
import { detectPracticeSegmentAsync, PracticeSegment } from '@/features/theory/practice-detector'
import { formatTime } from '@/utils'
import { useAtomValue } from 'jotai'
import { Loader2, RotateCcw, Sparkles, Star, Target, Trophy, X } from 'lucide-react'
import React, { useEffect, useState } from 'react'

type CompletionModalProps = {
  isOpen: boolean
  onClose: () => void
  onReplay: () => void
  onPracticeRecommended?: (segment: PracticeSegment) => void
}

export default function CompletionModal({
  isOpen,
  onClose,
  onReplay,
  onPracticeRecommended,
}: CompletionModalProps) {
  const player = usePlayer()
  const song = player.getSong()

  const [isCalculating, setIsCalculating] = useState(true)
  const [recommendedSegment, setRecommendedSegment] = useState<PracticeSegment | null>(null)

  const [isAiLoading, setIsAiLoading] = useState(true)
  const [aiFeedback, setAiFeedback] = useState<string | null>(null)
  const [displayedAiText, setDisplayedAiText] = useState('')

  // Typewriter effect when aiFeedback arrives
  useEffect(() => {
    if (!aiFeedback) {
      setDisplayedAiText('')
      return
    }

    setDisplayedAiText('')
    let idx = 0
    const timer = setInterval(() => {
      idx++
      setDisplayedAiText(aiFeedback.slice(0, idx))
      if (idx >= aiFeedback.length) {
        clearInterval(timer)
      }
    }, 20)

    return () => clearInterval(timer)
  }, [aiFeedback])

  const accuracy = useAtomValue(player.score.accuracy)
  const perfect = useAtomValue(player.score.perfect)
  const early = useAtomValue(player.score.early)
  const late = useAtomValue(player.score.late)
  const miss = useAtomValue(player.score.miss)
  const streak = useAtomValue(player.score.streak)

  // 1. Independent Practice Segment Detection Effect
  useEffect(() => {
    if (!isOpen || !song || !player) {
      setIsCalculating(true)
      setRecommendedSegment(null)
      return
    }

    const abortController = new AbortController()
    setIsCalculating(true)

    const songDuration = player.getDuration()
    detectPracticeSegmentAsync(song.notes, songDuration, abortController.signal)
      .then((segment) => {
        if (!abortController.signal.aborted) {
          setRecommendedSegment(segment)
          setIsCalculating(false)
        }
      })
      .catch((err) => {
        if (!abortController.signal.aborted) {
          console.error('Failed to detect practice segment:', err)
          setIsCalculating(false)
        }
      })

    return () => {
      // Instantly stop background calculation if user closes or dismisses modal
      abortController.abort()
    }
  }, [isOpen, song, player])

  // 2. Independent AI Coaching Generation Effect
  useEffect(() => {
    if (!isOpen || !song || !player) {
      setIsAiLoading(true)
      setAiFeedback(null)
      return
    }

    const aiAbortController = new AbortController()
    setIsAiLoading(true)

    const songId = (song as any).id || (song as any).meta?.id || 'current_song'
    const historyRecords = sessionScoreHistory.getRecordsForSong(songId)

    // Calculate played note duration metrics for payload
    const playedNotes = song.notes.filter((n) => n.durationScore !== undefined)
    const currentDurationScore =
      playedNotes.length > 0
        ? Math.round(
            (playedNotes.reduce((acc, n) => acc + (n.durationScore || 0), 0) / playedNotes.length) *
              100,
          )
        : 0

    let totalTG = 0
    let totalTY = 0
    let totalTP = 0
    let totalTR = 0

    if (playedNotes.length > 0) {
      playedNotes.forEach((n) => {
        if (n.userPressStart !== undefined) {
          const tS = n.time
          const tE = n.time + n.duration
          const t1 = n.userPressStart
          const t2 = n.userPressEnd ?? (n.time + n.duration)

          totalTY += Math.max(0, tS - t1)
          totalTP += Math.max(0, t1 - tS)
          totalTR += Math.abs(t2 - tE)
          totalTG += Math.max(0, Math.min(t2, tE) - Math.max(t1, tS))
        }
      })
    }

    const grandTotalDuration = totalTG + totalTY + totalTP + totalTR
    const totalCount = Math.max(1, perfect + early + late + miss)
    const pctG = grandTotalDuration > 0 ? Math.round((totalTG / grandTotalDuration) * 100) : Math.round((perfect / totalCount) * 100)
    const pctY = grandTotalDuration > 0 ? Math.round((totalTY / grandTotalDuration) * 100) : Math.round((early / totalCount) * 100)
    const pctP = grandTotalDuration > 0 ? Math.round((totalTP / grandTotalDuration) * 100) : Math.round((late / totalCount) * 100)
    const pctR = grandTotalDuration > 0 ? Math.round((totalTR / grandTotalDuration) * 100) : Math.round((miss / totalCount) * 100)

    const payload: CoachingPayload = {
      sessionMeta: {
        songTitle: (song as any).title || (song as any).meta?.title || 'Unknown Song',
        difficulty: (song as any).difficulty || (song as any).meta?.difficulty || 'Medium',
        duration: Math.round(player.getDuration()),
        keySignature: String(song.keySignature || 'C'),
        timeSignature: song.timeSignature || { numerator: 4, denominator: 4 },
        bpm: Math.round(typeof player.currentBpm === 'number' ? player.currentBpm : 120),
        playbackSpeed: (player as any).getPlaybackSpeed ? (player as any).getPlaybackSpeed() : 1.0,
        activeTracks: Object.keys(song.tracks || {}).length > 1 ? 'Multiple Tracks' : 'Solo Track',
      },
      hitMetrics: {
        accuracy,
        streak,
        perfect,
        early,
        late,
        miss,
      },
      durationBreakdown: {
        durationScore: currentDurationScore,
        pctG,
        pctY,
        pctP,
        pctR,
      },
      history: {
        attemptCount: historyRecords.length + 1,
        durationScoreTrend: [
          ...historyRecords.map((r) => Math.round(r.averageDurationScore * 100)),
          currentDurationScore,
        ].slice(-6),
      },
    }

    generateAICoachingAdvice(payload, aiAbortController.signal)
      .then((advice) => {
        if (!aiAbortController.signal.aborted) {
          setAiFeedback(advice)
          setIsAiLoading(false)
        }
      })
      .catch((err) => {
        if (!aiAbortController.signal.aborted) {
          console.error('Failed generating AI coaching advice:', err)
          setIsAiLoading(false)
        }
      })

    return () => {
      // Instantly cancel AI feedback generation if modal is closed
      aiAbortController.abort()
    }
  }, [isOpen, song, player, accuracy, perfect, early, late, miss, streak])

  if (!isOpen || !song) return null

  const songId = (song as any).id || (song as any).meta?.id || 'current_song'

  // Get session history records for this song
  const historyRecords = sessionScoreHistory.getRecordsForSong(songId)

  // Calculate average duration score for current run
  const playedNotes = song.notes.filter((n) => n.durationScore !== undefined)
  const currentDurationScore =
    playedNotes.length > 0
      ? Math.round(
          (playedNotes.reduce((acc, n) => acc + (n.durationScore || 0), 0) / playedNotes.length) *
            100,
        )
      : 0

  // Calculate composite duration metrics (tG, tY, tP, tR) across played notes
  let totalTG = 0
  let totalTY = 0
  let totalTP = 0
  let totalTR = 0

  if (playedNotes.length > 0) {
    playedNotes.forEach((n) => {
      if (n.userPressStart !== undefined) {
        const tS = n.time
        const tE = n.time + n.duration
        const t1 = n.userPressStart
        const t2 = n.userPressEnd ?? (n.time + n.duration)

        const tY = Math.max(0, tS - t1)
        const tP = Math.max(0, t1 - tS)
        const tR = Math.abs(t2 - tE)
        const tG = Math.max(0, Math.min(t2, tE) - Math.max(t1, tS))

        totalTG += tG
        totalTY += tY
        totalTP += tP
        totalTR += tR
      }
    })
  }

  const grandTotalDuration = totalTG + totalTY + totalTP + totalTR
  const totalCount = Math.max(1, perfect + early + late + miss)
  const pctG = grandTotalDuration > 0 ? (totalTG / grandTotalDuration) * 100 : (perfect / totalCount) * 100
  const pctY = grandTotalDuration > 0 ? (totalTY / grandTotalDuration) * 100 : (early / totalCount) * 100
  const pctP = grandTotalDuration > 0 ? (totalTP / grandTotalDuration) * 100 : (late / totalCount) * 100
  const pctR = grandTotalDuration > 0 ? (totalTR / grandTotalDuration) * 100 : (miss / totalCount) * 100

  const history = historyRecords.length > 0 ? historyRecords : []
  const maxDurationScore =
    history.length > 0
      ? Math.max(...history.map((h) => Math.round(h.averageDurationScore * 100)), currentDurationScore)
      : currentDurationScore

  // Prepare Point Graph data coordinates
  const displayHistory = (history.length > 0 ? history : [{ averageDurationScore: currentDurationScore / 100, timestamp: Date.now() }]).slice(-6)
  const chartPoints = displayHistory.map((rec, idx, arr) => {
    const val = Math.round(rec.averageDurationScore * 100)
    const count = arr.length
    const x = count === 1 ? 200 : 30 + (idx * 340) / (count - 1)
    const y = 58 - (val / 100) * 36
    const isPeak = val >= maxDurationScore && val > 0
    return { x, y, val, isPeak }
  })

  // SVG Line path & Gradient Area path
  const linePathD = chartPoints.reduce((acc, pt, i) => `${acc} ${i === 0 ? 'M' : 'L'} ${pt.x} ${pt.y}`, '')
  const firstPt = chartPoints[0]
  const lastPt = chartPoints[chartPoints.length - 1]
  const areaPathD = `${linePathD} L ${lastPt.x} 68 L ${firstPt.x} 68 Z`

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-md animate-in fade-in duration-300">
      {/* Modal Container: Flex Column with Always Visible Footer */}
      <div className="relative flex max-h-[85vh] w-[80vw] max-w-[620px] flex-col justify-between overflow-hidden rounded-[30px] bg-[#e1e5ee]/95 p-5 text-gray-900 shadow-[0_25px_70px_-15px_rgba(108,121,240,0.35)] backdrop-blur-2xl border border-white/80">
        
        {/* 1. Header (Fixed Top) */}
        <div className="relative flex w-full shrink-0 items-center justify-center border-b border-gray-200/80 pb-2.5">
          <div className="flex items-center gap-2.5 select-none">
            <Trophy className="h-7 w-7 text-[#6c79f0]" strokeWidth={2.4} />
            <h2 className="text-2xl font-black tracking-tight text-gray-900">
              Scoreboard
            </h2>
          </div>
          <button
            onClick={onClose}
            className="absolute right-0 top-0 flex h-9 w-9 cursor-pointer items-center justify-center rounded-full bg-gray-200/80 text-gray-500 transition hover:bg-gray-300 hover:text-gray-900"
            title="Close and Revert"
          >
            <X size={20} />
          </button>
        </div>

        {/* 2. Content Body (Flexible Fit) */}
        <div className="my-auto flex flex-1 flex-col justify-between gap-2.5 py-2">
          
          {/* Dual Score Cards: HIT SCORE vs DURATION SCORE */}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col items-center justify-center rounded-2xl bg-indigo-100/70 py-2.5 px-3 text-center shadow-xs">
              <span className="text-sm font-extrabold tracking-[0.14em] text-[#6c79f0] select-none">
                HIT SCORE
              </span>
              <span className="mt-0.5 text-4xl font-black tracking-tight text-indigo-950">
                {accuracy}%
              </span>
            </div>

            <div className="flex flex-col items-center justify-center rounded-2xl bg-purple-100/70 py-2.5 px-3 text-center shadow-xs">
              <span className="text-sm font-extrabold tracking-[0.14em] text-purple-600 select-none">
                DURATION SCORE
              </span>
              <span className="mt-0.5 text-4xl font-black tracking-tight text-purple-950">
                {currentDurationScore}%
              </span>
            </div>
          </div>

          {/* AI Teacher Feedback Card */}
          <div className="flex flex-col rounded-2xl border border-indigo-200/80 bg-gradient-to-r from-indigo-500/10 via-purple-500/10 to-pink-500/10 p-3 shadow-xs">
            <div className="mb-1 flex items-center gap-1.5 select-none">
              <Sparkles className="h-4 w-4 text-[#6c79f0]" />
              <span className="text-xs font-black tracking-wider text-[#6c79f0] uppercase">
                AI Coach Advice
              </span>
            </div>
            {isAiLoading ? (
              <div className="flex h-7 w-full animate-pulse items-center gap-2 rounded-xl bg-gray-300/40 px-2.5">
                <div className="h-2 w-3/4 rounded-full bg-gray-400/50" />
                <div className="h-2 w-1/4 rounded-full bg-gray-400/30" />
              </div>
            ) : (
              <p className="text-xs font-extrabold leading-relaxed text-gray-800">
                {displayedAiText}
                {displayedAiText.length < (aiFeedback?.length ?? 0) && (
                  <span className="ml-0.5 inline-block h-3 w-0.5 animate-pulse bg-[#6c79f0] align-middle" />
                )}
              </p>
            )}
          </div>

          {/* Continuous Duration Score Pill Bar */}
          <div className="flex flex-col rounded-2xl bg-gray-200/50 p-2">
            <span className="mb-1 text-xs font-extrabold tracking-[0.12em] text-gray-600 uppercase select-none px-1">
              DURATION SEGMENT BREAKDOWN
            </span>

            {/* Extra Thick Pill Bar (h-7 / 28px) */}
            <div className="flex h-7 w-full overflow-hidden rounded-full bg-gray-300/80 p-0.5 shadow-inner">
              {pctG > 0 && (
                <div
                  className="flex h-full items-center justify-center rounded-l-full bg-green-500 text-xs font-black text-white transition-all duration-500"
                  style={{ width: `${pctG}%` }}
                  title={`Correct Hold (tG): ${Math.round(pctG)}%`}
                >
                  {pctG >= 12 && `${Math.round(pctG)}%`}
                </div>
              )}
              {pctY > 0 && (
                <div
                  className="flex h-full items-center justify-center bg-amber-400 text-xs font-black text-amber-950 transition-all duration-500"
                  style={{ width: `${pctY}%` }}
                  title={`Early Press (tY): ${Math.round(pctY)}%`}
                >
                  {pctY >= 12 && `${Math.round(pctY)}%`}
                </div>
              )}
              {pctP > 0 && (
                <div
                  className="flex h-full items-center justify-center bg-purple-500 text-xs font-black text-white transition-all duration-500"
                  style={{ width: `${pctP}%` }}
                  title={`Late Press (tP): ${Math.round(pctP)}%`}
                >
                  {pctP >= 12 && `${Math.round(pctP)}%`}
                </div>
              )}
              {pctR > 0 && (
                <div
                  className="flex h-full items-center justify-center rounded-r-full bg-rose-500 text-xs font-black text-white transition-all duration-500"
                  style={{ width: `${pctR}%` }}
                  title={`Release Error (tR): ${Math.round(pctR)}%`}
                >
                  {pctR >= 12 && `${Math.round(pctR)}%`}
                </div>
              )}
            </div>
          </div>

          {/* 5 Soft Widget Containers */}
          <div className="grid grid-cols-5 gap-2">
            <div className="flex flex-col items-center justify-center rounded-2xl bg-green-500/15 px-1 py-2 text-center">
              <span className="text-[11px] font-extrabold tracking-[0.1em] text-green-800 select-none">
                PERFECT
              </span>
              <span className="mt-0.5 text-2xl font-black text-green-900">{perfect}</span>
            </div>

            <div className="flex flex-col items-center justify-center rounded-2xl bg-amber-500/15 px-1 py-2 text-center">
              <span className="text-[11px] font-extrabold tracking-[0.1em] text-amber-800 select-none">
                EARLY
              </span>
              <span className="mt-0.5 text-2xl font-black text-amber-900">{early}</span>
            </div>

            <div className="flex flex-col items-center justify-center rounded-2xl bg-purple-500/15 px-1 py-2 text-center">
              <span className="text-[11px] font-extrabold tracking-[0.1em] text-purple-800 select-none">
                LATE
              </span>
              <span className="mt-0.5 text-2xl font-black text-purple-900">{late}</span>
            </div>

            <div className="flex flex-col items-center justify-center rounded-2xl bg-rose-500/15 px-1 py-2 text-center">
              <span className="text-[11px] font-extrabold tracking-[0.1em] text-rose-800 select-none">
                MISS
              </span>
              <span className="mt-0.5 text-2xl font-black text-rose-900">{miss}</span>
            </div>

            <div className="flex flex-col items-center justify-center rounded-2xl bg-indigo-500/15 px-1 py-2 text-center">
              <span className="text-[11px] font-extrabold tracking-[0.1em] text-indigo-800 select-none">
                STREAK
              </span>
              <span className="mt-0.5 text-2xl font-black text-indigo-900">{streak}</span>
            </div>
          </div>

          {/* Modern loomo Point Graph Session Duration History */}
          <div className="flex flex-col rounded-2xl bg-gray-200/50 p-2.5 shadow-inner">
            <div className="mb-1 flex items-center justify-between">
              <span className="text-[11px] font-extrabold tracking-[0.12em] text-gray-600 select-none">
                SESSION DURATION HISTORY
              </span>
              
              {/* Best Metadata Pill */}
              <div className="flex items-center gap-1.5 rounded-full bg-amber-400/20 px-2.5 py-0.5 text-[11px] font-extrabold text-amber-800">
                <Star size={11} className="fill-amber-500 text-amber-500" />
                <span>BEST: {maxDurationScore}%</span>
              </div>
            </div>

            {/* SVG Point Graph with Dashed Lines & loomo Bright Gradient Fill */}
            <div className="relative h-20 w-full">
              <svg className="h-full w-full overflow-visible" viewBox="0 0 400 75" preserveAspectRatio="none">
                <defs>
                  {/* Bright loomo Gradient Fill under connecting lines */}
                  <linearGradient id="loomoAreaGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#6c79f0" stopOpacity="0.45" />
                    <stop offset="100%" stopColor="#6c79f0" stopOpacity="0.02" />
                  </linearGradient>
                </defs>

                {/* Bright loomo Fill under connecting line */}
                <path d={areaPathD} fill="url(#loomoAreaGradient)" />

                {/* Vertical Dashed Drop Lines under each point */}
                {chartPoints.map((pt, i) => (
                  <line
                    key={`dash-${i}`}
                    x1={pt.x}
                    y1={pt.y}
                    x2={pt.x}
                    y2="68"
                    stroke="#6c79f0"
                    strokeWidth="1.5"
                    strokeDasharray="3 3"
                    opacity="0.35"
                  />
                ))}

                {/* Dashed Connecting Line between scores */}
                {chartPoints.length > 1 && (
                  <path
                    d={linePathD}
                    fill="none"
                    stroke="#6c79f0"
                    strokeWidth="2.8"
                    strokeDasharray="6 4"
                  />
                )}

                {/* Glowing Data Point Circles & Score Labels */}
                {chartPoints.map((pt, i) => (
                  <g key={`pt-${i}`}>
                    {/* Score Text above point */}
                    <text
                      x={pt.x}
                      y={pt.y - 7}
                      textAnchor="middle"
                      className="fill-gray-900 text-[10px] font-black"
                    >
                      {pt.val}%
                    </text>

                    {/* Point Circle */}
                    <circle
                      cx={pt.x}
                      cy={pt.y}
                      r={pt.isPeak ? '5.5' : '4.5'}
                      fill={pt.isPeak ? '#f59e0b' : '#6c79f0'}
                      stroke="#ffffff"
                      strokeWidth="2"
                      className="transition-all duration-300"
                    />
                  </g>
                ))}
              </svg>
            </div>
          </div>
        </div>

        {/* 3. Footer Controls: Practice Recommended Part & Replay */}
        <div className="flex shrink-0 items-center justify-between gap-3 border-t border-gray-200/80 pt-3">
          <button
            disabled={isCalculating || !recommendedSegment}
            onClick={() => {
              if (recommendedSegment && onPracticeRecommended) {
                onPracticeRecommended(recommendedSegment)
              }
            }}
            className="flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#6c79f0] to-purple-600 px-4 py-2.5 text-xs font-extrabold text-white shadow-md shadow-[#6c79f0]/25 transition hover:scale-[1.02] active:scale-95 disabled:cursor-not-allowed disabled:opacity-75 sm:text-sm"
          >
            {isCalculating ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin text-white" />
                <span>Detecting Practice Part...</span>
              </>
            ) : (
              <>
                <Target className="h-4 w-4 text-white" />
                <span>
                  Practice Recommended Part (
                  {formatTime(recommendedSegment?.start ?? 0)} -{' '}
                  {formatTime(recommendedSegment?.end ?? 0)})
                </span>
              </>
            )}
          </button>
          <button
            onClick={onReplay}
            className="flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-2xl bg-gray-200/80 text-gray-700 transition hover:bg-gray-300 hover:text-gray-900 active:scale-95"
            title="Replay Song"
          >
            <RotateCcw size={18} />
          </button>
        </div>

      </div>
    </div>
  )
}
