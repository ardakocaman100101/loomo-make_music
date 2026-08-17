#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js'
import pg from 'pg'

const { Pool } = pg

const DATABASE_URL =
  process.env.DATABASE_URL || 'postgres://loomo:loomo_dev_password@localhost:5432/loomo_db'

const pool = new Pool({
  connectionString: DATABASE_URL,
})

const server = new Server(
  {
    name: 'loomo-postgres-mcp',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  },
)

// List available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'save_song',
        description: 'Insert or update a song record, its associated tracks, and tags in PostgreSQL',
        inputSchema: {
          type: 'object',
          properties: {
            id: { type: 'string', description: 'Unique song ID' },
            title: { type: 'string', description: 'Song title' },
            artist: { type: 'string', description: 'Artist name' },
            source: { type: 'string', description: 'Source (e.g. local, upload, sketch)' },
            duration: { type: 'number', description: 'Duration in seconds' },
            bpm: { type: 'number', description: 'Tempo BPM' },
            file_path: { type: 'string', description: 'Path to MIDI/audio file on disk' },
            metadata: { type: 'object', description: 'Additional JSON metadata' },
            tracks: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  track_index: { type: 'number' },
                  name: { type: 'string' },
                  instrument: { type: 'string' },
                  program: { type: 'number' },
                  hand: { type: 'string' },
                },
                required: ['track_index', 'name'],
              },
            },
            tags: {
              type: 'array',
              items: { type: 'string' },
            },
          },
          required: ['id', 'title'],
        },
      },
      {
        name: 'record_session',
        description: 'Record a user practice session with hit metrics and duration scores',
        inputSchema: {
          type: 'object',
          properties: {
            session_id: { type: 'string', description: 'Unique session identifier' },
            song_id: { type: 'string', description: 'Song ID played' },
            user_id: { type: 'string', description: 'Optional User UUID' },
            timestamp: { type: 'number', description: 'Epoch millisecond timestamp' },
            total_score: { type: 'number', description: 'Total score achieved' },
            accuracy: { type: 'number', description: 'Overall percentage accuracy' },
            streak_max: { type: 'number', description: 'Maximum streak of notes' },
            hit_metrics: {
              type: 'object',
              properties: {
                perfect: { type: 'number' },
                early: { type: 'number' },
                late: { type: 'number' },
                missed: { type: 'number' },
                error: { type: 'number' },
              },
              required: ['perfect', 'early', 'late', 'missed', 'error'],
            },
            duration_metrics: {
              type: 'object',
              properties: {
                duration_held: { type: 'number' },
                average_duration_score: { type: 'number' },
              },
              required: ['duration_held', 'average_duration_score'],
            },
          },
          required: ['session_id', 'song_id', 'timestamp', 'accuracy', 'hit_metrics', 'duration_metrics'],
        },
      },
      {
        name: 'update_song_tags',
        description: 'Update the list of tags attached to a song (max 5 tags, max 25 chars each)',
        inputSchema: {
          type: 'object',
          properties: {
            song_id: { type: 'string', description: 'Target song ID' },
            tags: {
              type: 'array',
              items: { type: 'string' },
              description: 'Array of tag strings',
            },
          },
          required: ['song_id', 'tags'],
        },
      },
      {
        name: 'query_readonly_sql',
        description: 'Execute a read-only SELECT SQL query for analytical inspection and telemetry reports',
        inputSchema: {
          type: 'object',
          properties: {
            sql: { type: 'string', description: 'SQL SELECT query string' },
            params: {
              type: 'array',
              items: {},
              description: 'Optional query parameters',
            },
          },
          required: ['sql'],
        },
      },
    ],
  }
})

// Call Tool handler
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params

  const client = await pool.connect()
  try {
    if (name === 'save_song') {
      const { id, title, artist, source, duration, bpm, file_path, metadata, tracks, tags } = args as any

      await client.query('BEGIN')

      // 1. Upsert song
      await client.query(
        `INSERT INTO songs (id, title, artist, source, duration, bpm, file_path, metadata, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
         ON CONFLICT (id) DO UPDATE SET
           title = EXCLUDED.title,
           artist = EXCLUDED.artist,
           source = EXCLUDED.source,
           duration = EXCLUDED.duration,
           bpm = EXCLUDED.bpm,
           file_path = EXCLUDED.file_path,
           metadata = EXCLUDED.metadata,
           updated_at = NOW()`,
        [id, title, artist || null, source || 'local', duration || 0, bpm || 120, file_path || null, JSON.stringify(metadata || {})],
      )

      // 2. Upsert tracks if provided
      if (Array.isArray(tracks)) {
        await client.query('DELETE FROM song_tracks WHERE song_id = $1', [id])
        for (const t of tracks) {
          await client.query(
            `INSERT INTO song_tracks (song_id, track_index, name, instrument, program, hand)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [id, t.track_index, t.name, t.instrument || 'acoustic_grand_piano', t.program || 0, t.hand || 'none'],
          )
        }
      }

      // 3. Upsert tags if provided
      if (Array.isArray(tags)) {
        await client.query('DELETE FROM song_tags WHERE song_id = $1', [id])
        for (const tag of tags.slice(0, 5)) {
          const cleanTag = String(tag).trim().slice(0, 25)
          if (cleanTag) {
            await client.query(
              `INSERT INTO song_tags (song_id, tag) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
              [id, cleanTag],
            )
          }
        }
      }

      await client.query('COMMIT')

      return {
        content: [{ type: 'text', text: `Successfully saved song ${id} (${title}) with tracks and tags.` }],
      }
    }

    if (name === 'record_session') {
      const { session_id, song_id, user_id, timestamp, total_score, accuracy, streak_max, hit_metrics, duration_metrics } = args as any

      await client.query('BEGIN')

      // 1. Insert session
      await client.query(
        `INSERT INTO practice_sessions (id, song_id, user_id, timestamp, total_score, accuracy, streak_max)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (id) DO NOTHING`,
        [session_id, song_id, user_id || null, timestamp, total_score || 0, accuracy, streak_max || 0],
      )

      // 2. Insert hit metrics
      await client.query(
        `INSERT INTO session_hit_metrics (session_id, perfect, early, late, missed, error)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (session_id) DO NOTHING`,
        [session_id, hit_metrics.perfect || 0, hit_metrics.early || 0, hit_metrics.late || 0, hit_metrics.missed || 0, hit_metrics.error || 0],
      )

      // 3. Insert duration metrics
      await client.query(
        `INSERT INTO session_duration_metrics (session_id, duration_held, average_duration_score)
         VALUES ($1, $2, $3)
         ON CONFLICT (session_id) DO NOTHING`,
        [session_id, duration_metrics.duration_held || 0, duration_metrics.average_duration_score || 0],
      )

      await client.query('COMMIT')

      return {
        content: [{ type: 'text', text: `Recorded practice session ${session_id} for song ${song_id} (Accuracy: ${accuracy}%).` }],
      }
    }

    if (name === 'update_song_tags') {
      const { song_id, tags } = args as any

      await client.query('BEGIN')
      await client.query('DELETE FROM song_tags WHERE song_id = $1', [song_id])

      const cleanTags = (Array.isArray(tags) ? tags : []).slice(0, 5)
      for (const t of cleanTags) {
        const clean = String(t).trim().slice(0, 25)
        if (clean) {
          await client.query('INSERT INTO song_tags (song_id, tag) VALUES ($1, $2) ON CONFLICT DO NOTHING', [song_id, clean])
        }
      }
      await client.query('COMMIT')

      return {
        content: [{ type: 'text', text: `Updated tags for song ${song_id}: ${cleanTags.join(', ')}` }],
      }
    }

    if (name === 'query_readonly_sql') {
      const { sql, params } = args as any

      // Sanitize SQL to ensure read-only
      const normalized = sql.trim().toLowerCase()
      const isSelect = normalized.startsWith('select') || normalized.startsWith('with') || normalized.startsWith('explain')
      const hasMutationKeywords = /\b(insert|update|delete|drop|alter|truncate|create|grant|revoke|comment)\b/i.test(sql)

      if (!isSelect || hasMutationKeywords) {
        throw new Error('Security Error: query_readonly_sql only permits read-only SELECT / EXPLAIN queries.')
      }

      await client.query('SET TRANSACTION READ ONLY')
      const result = await client.query(sql, params || [])

      return {
        content: [{ type: 'text', text: JSON.stringify({ rowCount: result.rowCount, rows: result.rows }, null, 2) }],
      }
    }

    throw new Error(`Unknown tool: ${name}`)
  } catch (err: any) {
    await client.query('ROLLBACK').catch(() => {})
    return {
      isError: true,
      content: [{ type: 'text', text: `Error: ${err.message}` }],
    }
  } finally {
    client.release()
  }
})

async function main() {
  const transport = new StdioServerTransport()
  await server.connect(transport)
  console.error('loomo PostgreSQL MCP server running on stdio.')
}

main().catch((err) => {
  console.error('Fatal MCP Server error:', err)
  process.exit(1)
})
