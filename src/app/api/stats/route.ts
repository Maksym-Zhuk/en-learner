import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { sql } from 'drizzle-orm'
import { getUser } from '@/lib/auth'

export async function GET(request: NextRequest) {
  const user = getUser(request)
  if (!user) return NextResponse.json({ error: 'Неавторизовано' }, { status: 401 })

  const uid = user.userId

  try {
    const [totals] = await db.execute(sql`
      SELECT
        (SELECT COUNT(*)::int FROM cards c JOIN decks d ON d.id = c.deck_id WHERE d.user_id = ${uid}) AS word_count,
        (SELECT COUNT(*)::int FROM study_sessions WHERE user_id = ${uid}) AS session_count,
        (SELECT COALESCE(SUM(correct),0)::int FROM study_sessions WHERE user_id = ${uid}) AS total_correct,
        (SELECT COALESCE(SUM(total),0)::int FROM study_sessions WHERE user_id = ${uid}) AS total_answered
    `) as unknown as { word_count: number; session_count: number; total_correct: number; total_answered: number }[]

    // per-day answered, last 14 days
    const perDay = await db.execute(sql`
      SELECT to_char(d.day, 'YYYY-MM-DD') AS day,
             COALESCE(SUM(s.total), 0)::int AS answered
      FROM generate_series(CURRENT_DATE - INTERVAL '13 days', CURRENT_DATE, INTERVAL '1 day') AS d(day)
      LEFT JOIN study_sessions s
        ON s.user_id = ${uid} AND date_trunc('day', s.created_at) = d.day
      GROUP BY d.day ORDER BY d.day
    `) as unknown as { day: string; answered: number }[]

    // accuracy by mode
    const byMode = await db.execute(sql`
      SELECT mode,
             COALESCE(SUM(correct),0)::int AS correct,
             COALESCE(SUM(total),0)::int AS total
      FROM study_sessions WHERE user_id = ${uid}
      GROUP BY mode
    `) as unknown as { mode: string; correct: number; total: number }[]

    // heatmap, last 84 days
    const heatmap = await db.execute(sql`
      SELECT to_char(d.day, 'YYYY-MM-DD') AS day,
             COALESCE(SUM(s.total), 0)::int AS answered
      FROM generate_series(CURRENT_DATE - INTERVAL '83 days', CURRENT_DATE, INTERVAL '1 day') AS d(day)
      LEFT JOIN study_sessions s
        ON s.user_id = ${uid} AND date_trunc('day', s.created_at) = d.day
      GROUP BY d.day ORDER BY d.day
    `) as unknown as { day: string; answered: number }[]

    // top decks by sessions
    const topDecks = await db.execute(sql`
      SELECT d.id, d.name,
             COUNT(s.id)::int AS sessions,
             (SELECT COUNT(*)::int FROM cards c WHERE c.deck_id = d.id) AS word_count
      FROM decks d
      LEFT JOIN study_sessions s ON s.deck_id = d.id
      WHERE d.user_id = ${uid}
      GROUP BY d.id, d.name
      ORDER BY sessions DESC, word_count DESC
      LIMIT 5
    `) as unknown as { id: string; name: string; sessions: number; word_count: number }[]

    // streak: distinct active days, count back from today/yesterday
    const days = await db.execute(sql`
      SELECT DISTINCT to_char(date_trunc('day', created_at), 'YYYY-MM-DD') AS day
      FROM study_sessions WHERE user_id = ${uid}
      ORDER BY day DESC
    `) as unknown as { day: string }[]

    const daySet = new Set(days.map((d) => d.day))
    let streak = 0
    const cursor = new Date()
    // allow streak to count if studied today or yesterday
    const todayStr = cursor.toISOString().slice(0, 10)
    if (!daySet.has(todayStr)) cursor.setDate(cursor.getDate() - 1)
    while (daySet.has(cursor.toISOString().slice(0, 10))) {
      streak++
      cursor.setDate(cursor.getDate() - 1)
    }

    // longest streak ever: walk sorted-ascending distinct days
    const sortedDays = [...daySet].sort()
    let bestStreak = 0
    let run = 0
    let prev: Date | null = null
    for (const ds of sortedDays) {
      const d = new Date(ds + 'T00:00:00Z')
      if (prev && (d.getTime() - prev.getTime()) === 86400000) run++
      else run = 1
      if (run > bestStreak) bestStreak = run
      prev = d
    }

    // weekly trend: answered in last 7 days vs the 7 days before that
    const [trend] = await db.execute(sql`
      SELECT
        COALESCE(SUM(total) FILTER (WHERE created_at >= CURRENT_DATE - INTERVAL '6 days'), 0)::int AS last7,
        COALESCE(SUM(total) FILTER (WHERE created_at >= CURRENT_DATE - INTERVAL '13 days' AND created_at < CURRENT_DATE - INTERVAL '6 days'), 0)::int AS prev7
      FROM study_sessions WHERE user_id = ${uid}
    `) as unknown as { last7: number; prev7: number }[]

    // recent sessions
    const recentSessions = await db.execute(sql`
      SELECT s.id, s.mode, s.correct, s.total,
             to_char(s.created_at, 'YYYY-MM-DD') AS day,
             COALESCE(d.name, 'Видалена колода') AS deck_name
      FROM study_sessions s
      LEFT JOIN decks d ON d.id = s.deck_id
      WHERE s.user_id = ${uid}
      ORDER BY s.created_at DESC
      LIMIT 8
    `) as unknown as { id: string; mode: string; correct: number; total: number; day: string; deck_name: string }[]

    const t = totals
    const accuracy = t.total_answered > 0 ? Math.round((t.total_correct / t.total_answered) * 100) : 0
    const avgSession = t.session_count > 0 ? Math.round(t.total_answered / t.session_count) : 0
    const weeklyDelta = trend.prev7 > 0
      ? Math.round(((trend.last7 - trend.prev7) / trend.prev7) * 100)
      : (trend.last7 > 0 ? 100 : 0)

    return NextResponse.json({
      wordCount: t.word_count,
      sessionCount: t.session_count,
      totalAnswered: t.total_answered,
      accuracy,
      streak,
      bestStreak,
      avgSession,
      last7: trend.last7,
      prev7: trend.prev7,
      weeklyDelta,
      perDay,
      byMode,
      heatmap,
      topDecks,
      recentSessions,
    })
  } catch (error) {
    console.error('GET /api/stats error:', error)
    return NextResponse.json({ error: 'Внутрішня помилка сервера' }, { status: 500 })
  }
}
