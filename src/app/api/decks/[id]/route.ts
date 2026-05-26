import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { decks, cards } from '@/lib/schema'
import { eq, and, sql } from 'drizzle-orm'
import { getUser } from '@/lib/auth'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = getUser(request)
  if (!user) return NextResponse.json({ error: 'Неавторизовано' }, { status: 401 })

  const { id } = await params

  try {
    const [deck] = await db
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
      .where(and(eq(decks.id, id), eq(decks.user_id, user.userId)))
      .groupBy(decks.id)

    if (!deck) return NextResponse.json({ error: 'Колода не знайдена' }, { status: 404 })

    return NextResponse.json(deck)
  } catch (error) {
    console.error('GET /api/decks/[id] error:', error)
    return NextResponse.json({ error: 'Внутрішня помилка сервера' }, { status: 500 })
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = getUser(request)
  if (!user) return NextResponse.json({ error: 'Неавторизовано' }, { status: 401 })

  const { id } = await params

  try {
    const body = await request.json()
    const folderId: string | null = body.folder_id ?? null

    const [deck] = await db
      .update(decks)
      .set({ folder_id: folderId })
      .where(and(eq(decks.id, id), eq(decks.user_id, user.userId)))
      .returning()

    if (!deck) return NextResponse.json({ error: 'Колода не знайдена' }, { status: 404 })

    return NextResponse.json(deck)
  } catch (error) {
    console.error('PATCH /api/decks/[id] error:', error)
    return NextResponse.json({ error: 'Внутрішня помилка сервера' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = getUser(request)
  if (!user) return NextResponse.json({ error: 'Неавторизовано' }, { status: 401 })

  const { id } = await params

  try {
    const deleted = await db
      .delete(decks)
      .where(and(eq(decks.id, id), eq(decks.user_id, user.userId)))
      .returning({ id: decks.id })

    if (!deleted.length) return NextResponse.json({ error: 'Колода не знайдена' }, { status: 404 })

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('DELETE /api/decks/[id] error:', error)
    return NextResponse.json({ error: 'Внутрішня помилка сервера' }, { status: 500 })
  }
}
