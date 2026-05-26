import { NextRequest, NextResponse } from 'next/server'
import sql from '@/lib/db'
import { getUser } from '@/lib/auth'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = getUser(request)
  if (!user) {
    return NextResponse.json({ error: 'Неавторизовано' }, { status: 401 })
  }

  try {
    const [deck] = await sql`
      SELECT d.id, d.user_id, d.name, d.created_at,
             COUNT(c.id)::int AS card_count
      FROM decks d
      LEFT JOIN cards c ON c.deck_id = d.id
      WHERE d.id = ${params.id} AND d.user_id = ${user.userId}
      GROUP BY d.id
    `

    if (!deck) {
      return NextResponse.json({ error: 'Колода не знайдена' }, { status: 404 })
    }

    return NextResponse.json(deck)
  } catch (error) {
    console.error('GET /api/decks/[id] error:', error)
    return NextResponse.json({ error: 'Внутрішня помилка сервера' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = getUser(request)
  if (!user) {
    return NextResponse.json({ error: 'Неавторизовано' }, { status: 401 })
  }

  try {
    const result = await sql`
      DELETE FROM decks WHERE id = ${params.id} AND user_id = ${user.userId}
    `

    if (result.count === 0) {
      return NextResponse.json({ error: 'Колода не знайдена' }, { status: 404 })
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('DELETE /api/decks/[id] error:', error)
    return NextResponse.json({ error: 'Внутрішня помилка сервера' }, { status: 500 })
  }
}
