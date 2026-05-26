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
    // Verify ownership
    const [deck] = await sql`SELECT id FROM decks WHERE id = ${params.id} AND user_id = ${user.userId}`
    if (!deck) {
      return NextResponse.json({ error: 'Колода не знайдена' }, { status: 404 })
    }

    const cards = await sql`
      SELECT id, deck_id, word, definition_en, example_en, translation_uk, example_uk, created_at
      FROM cards
      WHERE deck_id = ${params.id}
      ORDER BY created_at DESC
    `

    return NextResponse.json(cards)
  } catch (error) {
    console.error('GET /api/decks/[id]/cards error:', error)
    return NextResponse.json({ error: 'Внутрішня помилка сервера' }, { status: 500 })
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = getUser(request)
  if (!user) {
    return NextResponse.json({ error: 'Неавторизовано' }, { status: 401 })
  }

  try {
    // Verify ownership
    const [deck] = await sql`SELECT id FROM decks WHERE id = ${params.id} AND user_id = ${user.userId}`
    if (!deck) {
      return NextResponse.json({ error: 'Колода не знайдена' }, { status: 404 })
    }

    const { word, definition_en, example_en, translation_uk, example_uk } = await request.json()

    if (!word || !definition_en || !translation_uk) {
      return NextResponse.json({ error: 'word, definition_en та translation_uk обовʼязкові' }, { status: 400 })
    }

    const [card] = await sql`
      INSERT INTO cards (deck_id, word, definition_en, example_en, translation_uk, example_uk)
      VALUES (
        ${params.id},
        ${word.trim()},
        ${definition_en.trim()},
        ${(example_en || '').trim()},
        ${translation_uk.trim()},
        ${(example_uk || '').trim()}
      )
      RETURNING id, deck_id, word, definition_en, example_en, translation_uk, example_uk, created_at
    `

    return NextResponse.json(card, { status: 201 })
  } catch (error) {
    console.error('POST /api/decks/[id]/cards error:', error)
    return NextResponse.json({ error: 'Внутрішня помилка сервера' }, { status: 500 })
  }
}
