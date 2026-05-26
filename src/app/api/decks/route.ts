import { NextRequest, NextResponse } from 'next/server'
import sql from '@/lib/db'
import { getUser } from '@/lib/auth'

export async function GET(request: NextRequest) {
  const user = getUser(request)
  if (!user) {
    return NextResponse.json({ error: 'Неавторизовано' }, { status: 401 })
  }

  try {
    const decks = await sql`
      SELECT d.id, d.user_id, d.name, d.created_at,
             COUNT(c.id)::int AS card_count
      FROM decks d
      LEFT JOIN cards c ON c.deck_id = d.id
      WHERE d.user_id = ${user.userId}
      GROUP BY d.id
      ORDER BY d.created_at DESC
    `
    return NextResponse.json(decks)
  } catch (error) {
    console.error('GET /api/decks error:', error)
    return NextResponse.json({ error: 'Внутрішня помилка сервера' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const user = getUser(request)
  if (!user) {
    return NextResponse.json({ error: 'Неавторизовано' }, { status: 401 })
  }

  try {
    const { name } = await request.json()

    if (!name || !name.trim()) {
      return NextResponse.json({ error: 'Назва колоди обовʼязкова' }, { status: 400 })
    }

    const [deck] = await sql`
      INSERT INTO decks (user_id, name)
      VALUES (${user.userId}, ${name.trim()})
      RETURNING id, user_id, name, created_at
    `

    return NextResponse.json({ ...deck, card_count: 0 }, { status: 201 })
  } catch (error) {
    console.error('POST /api/decks error:', error)
    return NextResponse.json({ error: 'Внутрішня помилка сервера' }, { status: 500 })
  }
}
