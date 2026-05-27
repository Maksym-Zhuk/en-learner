import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { studySessions } from '@/lib/schema'
import { getUser } from '@/lib/auth'

export async function POST(request: NextRequest) {
  const user = getUser(request)
  if (!user) return NextResponse.json({ error: 'Неавторизовано' }, { status: 401 })

  try {
    const { deck_id = null, mode, correct = 0, total = 0 } = await request.json()
    if (!mode || typeof total !== 'number' || total < 0) {
      return NextResponse.json({ error: 'mode та total обовʼязкові' }, { status: 400 })
    }

    const [row] = await db
      .insert(studySessions)
      .values({
        user_id: user.userId,
        deck_id,
        mode: String(mode),
        correct: Math.max(0, Math.min(Number(correct) || 0, total)),
        total,
      })
      .returning({ id: studySessions.id })

    return NextResponse.json(row, { status: 201 })
  } catch (error) {
    console.error('POST /api/sessions error:', error)
    return NextResponse.json({ error: 'Внутрішня помилка сервера' }, { status: 500 })
  }
}
