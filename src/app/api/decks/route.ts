import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { decks, cards } from '@/lib/schema'
import { eq, desc, sql } from 'drizzle-orm'
import { getUser } from '@/lib/auth'

export async function GET(request: NextRequest) {
  const user = getUser(request)
  if (!user) return NextResponse.json({ error: 'Неавторизовано' }, { status: 401 })

  try {
    const rows = await db
      .select({
        id: decks.id,
        user_id: decks.user_id,
        name: decks.name,
        folder_id: decks.folder_id,
        share_token: decks.share_token,
        created_at: decks.created_at,
        card_count: sql<number>`count(${cards.id})::int`,
      })
      .from(decks)
      .leftJoin(cards, eq(cards.deck_id, decks.id))
      .where(eq(decks.user_id, user.userId))
      .groupBy(decks.id)
      .orderBy(desc(decks.created_at))

    return NextResponse.json(rows)
  } catch (error) {
    console.error('GET /api/decks error:', error)
    return NextResponse.json({ error: 'Внутрішня помилка сервера' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const user = getUser(request)
  if (!user) return NextResponse.json({ error: 'Неавторизовано' }, { status: 401 })

  try {
    const { name, folder_id = null } = await request.json()

    if (!name?.trim()) {
      return NextResponse.json({ error: 'Назва колоди обовʼязкова' }, { status: 400 })
    }

    const [deck] = await db
      .insert(decks)
      .values({ user_id: user.userId, name: name.trim(), folder_id })
      .returning()

    return NextResponse.json({ ...deck, card_count: 0 }, { status: 201 })
  } catch (error) {
    console.error('POST /api/decks error:', error)
    return NextResponse.json({ error: 'Внутрішня помилка сервера' }, { status: 500 })
  }
}
