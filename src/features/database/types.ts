export interface DbUser {
  id: string
  username: string
  email?: string
  created_at?: string
  updated_at?: string
}

export interface DbSong {
  id: string
  user_id?: string
  title: string
  artist?: string
  source?: string
  duration?: number
  bpm?: number
  file_path?: string
  metadata?: Record<string, any>
  created_at?: string
  updated_at?: string
}

export interface DbSongTrack {
  id?: number
  song_id: string
  track_index: number
  name: string
  instrument?: string
  program?: number
  hand?: 'left' | 'right' | 'both' | 'none'
}

export interface DbSongTag {
  id?: number
  song_id: string
  tag: string
  created_at?: string
}

export interface DbPracticeSession {
  id: string
  song_id: string
  user_id?: string
  timestamp: number
  total_score: number
  accuracy: number
  streak_max: number
  created_at?: string
}

export interface DbHitMetrics {
  session_id: string
  perfect: number
  early: number
  late: number
  missed: number
  error: number
}

export interface DbDurationMetrics {
  session_id: string
  duration_held: number
  average_duration_score: number
}

export interface PracticeSessionPayload {
  session: DbPracticeSession
  hitMetrics: DbHitMetrics
  durationMetrics: DbDurationMetrics
  songDetails?: {
    title: string
    artist?: string
    tags?: string[]
  }
}
