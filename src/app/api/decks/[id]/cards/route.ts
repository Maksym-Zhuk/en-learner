import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { decks, cards } from '@/lib/schema'
import { eq, and, desc, sql } from 'drizzle-orm'
import { getUser } from '@/lib/auth'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = getUser(request)
  if (!user) return NextResponse.json({ error: 'Неавторизовано' }, { status: 401 })

  const { id } = await params

  try {
    const [owned] = await db
      .select({ id: decks.id })
      .from(decks)
      .where(and(eq(decks.id, id), eq(decks.user_id, user.userId)))
      .limit(1)

    if (!owned) {
      // Allow access via group membership
      const access = (await db.execute(sql`
        SELECT 1 FROM decks d
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
        LIMIT 1
      `)) as unknown as unknown[]
      if (!access.length) return NextResponse.json({ error: 'Колода не знайдена' }, { status: 404 })
    }

    const rows = await db
      .select()
      .from(cards)
      .where(eq(cards.deck_id, id))
      .orderBy(desc(cards.created_at))

    return NextResponse.json(rows)
  } catch (error) {
    console.error('GET /api/decks/[id]/cards error:', error)
    return NextResponse.json({ error: 'Внутрішня помилка сервера' }, { status: 500 })
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = getUser(request)
  if (!user) return NextResponse.json({ error: 'Неавторизовано' }, { status: 401 })

  const { id } = await params

  try {
    const [deck] = await db
      .select({ id: decks.id })
      .from(decks)
      .where(and(eq(decks.id, id), eq(decks.user_id, user.userId)))
      .limit(1)

    if (!deck) return NextResponse.json({ error: 'Колода не знайдена' }, { status: 404 })

    const { word, definition_en, example_en, translation_uk, example_uk } = await request.json()

    if (!word || !definition_en || !translation_uk) {
      return NextResponse.json(
        { error: 'word, definition_en та translation_uk обовʼязкові' },
        { status: 400 }
      )
    }

    const [card] = await db
      .insert(cards)
      .values({
        deck_id: id,
        word: word.trim(),
        definition_en: definition_en.trim(),
        example_en: (example_en || '').trim(),
        translation_uk: translation_uk.trim(),
        example_uk: (example_uk || '').trim(),
      })
      .returning()

    return NextResponse.json(card, { status: 201 })
  } catch (error) {
    console.error('POST /api/decks/[id]/cards error:', error)
    return NextResponse.json({ error: 'Внутрішня помилка сервера' }, { status: 500 })
  }
}
