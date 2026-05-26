import { NextRequest, NextResponse } from 'next/server'
import sql from '@/lib/db'
import { getUser } from '@/lib/auth'

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = getUser(request)
  if (!user) {
    return NextResponse.json({ error: 'Неавторизовано' }, { status: 401 })
  }

  try {
    const { word, definition_en, example_en, translation_uk, example_uk } = await request.json()

    // Verify ownership via join
    const [existing] = await sql`
      SELECT c.id FROM cards c
      JOIN decks d ON d.id = c.deck_id
      WHERE c.id = ${params.id} AND d.user_id = ${user.userId}
    `

    if (!existing) {
      return NextResponse.json({ error: 'Картка не знайдена' }, { status: 404 })
    }

    const [card] = await sql`
      UPDATE cards
      SET
        word = COALESCE(${word?.trim() ?? null}, word),
        definition_en = COALESCE(${definition_en?.trim() ?? null}, definition_en),
        example_en = COALESCE(${example_en?.trim() ?? null}, example_en),
        translation_uk = COALESCE(${translation_uk?.trim() ?? null}, translation_uk),
        example_uk = COALESCE(${example_uk?.trim() ?? null}, example_uk)
      WHERE id = ${params.id}
      RETURNING id, deck_id, word, definition_en, example_en, translation_uk, example_uk, created_at
    `

    return NextResponse.json(card)
  } catch (error) {
    console.error('PUT /api/cards/[id] error:', error)
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
      DELETE FROM cards c
      USING decks d
      WHERE c.deck_id = d.id
        AND c.id = ${params.id}
        AND d.user_id = ${user.userId}
    `

    if (result.count === 0) {
      return NextResponse.json({ error: 'Картка не знайдена' }, { status: 404 })
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('DELETE /api/cards/[id] error:', error)
    return NextResponse.json({ error: 'Внутрішня помилка сервера' }, { status: 500 })
  }
}
