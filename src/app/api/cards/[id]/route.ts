import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { cards, decks } from '@/lib/schema'
import { eq, and } from 'drizzle-orm'
import { getUser } from '@/lib/auth'

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = getUser(request)
  if (!user) return NextResponse.json({ error: 'Неавторизовано' }, { status: 401 })

  const { id } = await params

  try {
    const [existing] = await db
      .select({ id: cards.id })
      .from(cards)
      .innerJoin(decks, eq(decks.id, cards.deck_id))
      .where(and(eq(cards.id, id), eq(decks.user_id, user.userId)))
      .limit(1)

    if (!existing) return NextResponse.json({ error: 'Картка не знайдена' }, { status: 404 })

    const body = await request.json()
    const updates: Partial<typeof cards.$inferInsert> = {}
    if (body.word?.trim())           updates.word = body.word.trim()
    if (body.definition_en?.trim())  updates.definition_en = body.definition_en.trim()
    if (body.example_en !== undefined)   updates.example_en = (body.example_en || '').trim()
    if (body.translation_uk?.trim()) updates.translation_uk = body.translation_uk.trim()
    if (body.example_uk !== undefined)   updates.example_uk = (body.example_uk || '').trim()

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'Немає полів для оновлення' }, { status: 400 })
    }

    const [card] = await db
      .update(cards)
      .set(updates)
      .where(eq(cards.id, id))
      .returning()

    return NextResponse.json(card)
  } catch (error) {
    console.error('PUT /api/cards/[id] error:', error)
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
    const [existing] = await db
      .select({ id: cards.id })
      .from(cards)
      .innerJoin(decks, eq(decks.id, cards.deck_id))
      .where(and(eq(cards.id, id), eq(decks.user_id, user.userId)))
      .limit(1)

    if (!existing) return NextResponse.json({ error: 'Картка не знайдена' }, { status: 404 })

    await db.delete(cards).where(eq(cards.id, id))

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('DELETE /api/cards/[id] error:', error)
    return NextResponse.json({ error: 'Внутрішня помилка сервера' }, { status: 500 })
  }
}
