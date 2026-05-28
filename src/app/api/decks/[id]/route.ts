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
        emoji: decks.emoji,
        folder_id: decks.folder_id,
        share_token: decks.share_token,
        created_at: decks.created_at,
        card_count: sql<number>`count(${cards.id})::int`,
      })
      .from(decks)
      .leftJoin(cards, eq(cards.deck_id, decks.id))
      .where(and(eq(decks.id, id), eq(decks.user_id, user.userId)))
      .groupBy(decks.id)

    if (deck) return NextResponse.json({ ...deck, readonly: false })

    // Check if accessible via group membership (deck shared directly or via folder)
    const shared = (await db.execute(sql`
      SELECT d.id, d.user_id, d.name, d.emoji, d.folder_id, d.share_token, d.created_at,
             COUNT(c.id)::int AS card_count
      FROM decks d
      LEFT JOIN cards c ON c.deck_id = d.id
      WHERE d.id = ${id} AND (
        EXISTS (
          SELECT 1 FROM group_shares gs
          JOIN group_members gm ON gm.group_id = gs.group_id
          WHERE gs.deck_id = d.id AND gm.user_id = ${user.userId}
        ) OR EXISTS (
          SELECT 1 FROM group_shares gs
          JOIN group_members gm ON gm.group_id = gs.group_id
          WHERE gs.folder_id = d.folder_id AND d.folder_id IS NOT NULL AND gm.user_id = ${user.userId}
        )
      )
      GROUP BY d.id
      LIMIT 1
    `)) as unknown as Record<string, unknown>[]

    if (!shared.length) return NextResponse.json({ error: 'Колода не знайдена' }, { status: 404 })
    return NextResponse.json({ ...shared[0], readonly: true })
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
    const patch: Record<string, unknown> = {}
    if ('folder_id' in body) patch.folder_id = body.folder_id ?? null
    if (typeof body.name === 'string' && body.name.trim()) patch.name = body.name.trim()
    if (typeof body.emoji === 'string' && body.emoji.trim()) patch.emoji = body.emoji.trim()

    if (Object.keys(patch).length === 0)
      return NextResponse.json({ error: 'Немає полів для оновлення' }, { status: 400 })

    const [deck] = await db
      .update(decks)
      .set(patch)
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
