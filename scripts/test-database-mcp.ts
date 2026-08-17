import pg from 'pg'

const { Pool } = pg

const DATABASE_URL =
  process.env.DATABASE_URL || 'postgres://loomo:loomo_dev_password@localhost:5432/loomo_db'

async function runTests() {
  console.log('--- 1. Testing PostgreSQL Connection ---')
  const pool = new Pool({ connectionString: DATABASE_URL })
  const client = await pool.connect()
  console.log('Connected to PostgreSQL successfully.')

  try {
    console.log('\n--- 2. Verifying Schema Tables ---')
    const tablesRes = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name;
    `)
    const tables = tablesRes.rows.map((r) => r.table_name)
    console.log('Tables found in database:', tables)

    const expectedTables = [
      'users',
      'songs',
      'song_tracks',
      'song_tags',
      'practice_sessions',
      'session_hit_metrics',
      'session_duration_metrics',
    ]

    for (const expected of expectedTables) {
      if (tables.includes(expected)) {
        console.log(`  ✓ Table '${expected}' exists`)
      } else {
        throw new Error(`Missing expected table: ${expected}`)
      }
    }

    console.log('\n--- 3. Testing Song & Tracks & Tags Insertion ---')
    const testSongId = 'test_bohemian_rhapsody'
    await client.query(`
      INSERT INTO songs (id, title, artist, source, duration, bpm, file_path, metadata)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title;
    `, [
      testSongId,
      'Bohemian Rhapsody',
      'Queen',
      'upload',
      354.2,
      72,
      '/uploads/bohemian_rhapsody',
      JSON.stringify({ difficulty: 3, verified: true }),
    ])

    // Insert tracks
    await client.query(`
      INSERT INTO song_tracks (song_id, track_index, name, instrument, program, hand)
      VALUES 
        ($1, 0, 'Piano Melody', 'acoustic_grand_piano', 0, 'right'),
        ($1, 1, 'Bass Guitar', 'electric_bass_finger', 33, 'left')
      ON CONFLICT (song_id, track_index) DO NOTHING;
    `, [testSongId])

    // Insert tags
    await client.query(`
      INSERT INTO song_tags (song_id, tag)
      VALUES 
        ($1, 'Covers'),
        ($1, 'Pop'),
        ($1, 'Classical')
      ON CONFLICT (song_id, tag) DO NOTHING;
    `, [testSongId])
    console.log('  ✓ Song, tracks, and tags inserted successfully.')

    console.log('\n--- 4. Testing Practice Telemetry Recording ---')
    const testSessionId = `test_session_${Date.now()}`
    const timestamp = Date.now()

    await client.query(`
      INSERT INTO practice_sessions (id, song_id, timestamp, total_score, accuracy, streak_max)
      VALUES ($1, $2, $3, $4, $5, $6);
    `, [testSessionId, testSongId, timestamp, 9850, 94.5, 42])

    await client.query(`
      INSERT INTO session_hit_metrics (session_id, perfect, early, late, missed, error)
      VALUES ($1, 85, 8, 4, 2, 1);
    `, [testSessionId])

    await client.query(`
      INSERT INTO session_duration_metrics (session_id, duration_held, average_duration_score)
      VALUES ($1, 1420, 0.92);
    `, [testSessionId])
    console.log('  ✓ Practice session & telemetry inserted successfully.')

    console.log('\n--- 5. Testing Analytical Telemetry Query (Read-Only SQL) ---')
    const telemetryRes = await client.query(`
      SELECT 
        s.id AS song_id,
        s.title,
        ps.id AS session_id,
        ps.accuracy,
        ps.streak_max,
        h.perfect,
        h.missed,
        d.average_duration_score,
        COALESCE(array_agg(t.tag) FILTER (WHERE t.tag IS NOT NULL), '{}') AS tags
      FROM practice_sessions ps
      JOIN songs s ON s.id = ps.song_id
      LEFT JOIN session_hit_metrics h ON h.session_id = ps.id
      LEFT JOIN session_duration_metrics d ON d.session_id = ps.id
      LEFT JOIN song_tags t ON t.song_id = s.id
      WHERE s.id = $1
      GROUP BY s.id, s.title, ps.id, ps.accuracy, ps.streak_max, h.perfect, h.missed, d.average_duration_score;
    `, [testSongId])

    console.log('Queried telemetry report:');
    console.log(JSON.stringify(telemetryRes.rows, null, 2))

    console.log('\n✅ All Database Setup & Telemetry Tests Passed Successfully!')
  } finally {
    client.release()
    await pool.end()
  }
}

runTests().catch((err) => {
  console.error('❌ Test failed:', err)
  process.exit(1)
})
