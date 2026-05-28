import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { decks, cards } from '@/lib/schema'
import { eq, desc } from 'drizzle-orm'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params

  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  if (!UUID_RE.test(token)) {
    return NextResponse.json({ error: 'Колоду не знайдено або доступ закрито' }, { status: 404 })
  }

  try {
    const [deck] = await db
      .select({ id: decks.id, name: decks.name, emoji: decks.emoji, created_at: decks.created_at })
      .from(decks)
      .where(eq(decks.share_token, token))
      .limit(1)

    if (!deck) return NextResponse.json({ error: 'Колоду не знайдено або доступ закрито' }, { status: 404 })

    const deckCards = await db
      .select()
      .from(cards)
      .where(eq(cards.deck_id, deck.id))
      .orderBy(desc(cards.created_at))

    return NextResponse.json({ deck, cards: deckCards })
  } catch (error) {
    console.error('GET /api/s/[token] error:', error)
    return NextResponse.json({ error: 'Внутрішня помилка сервера' }, { status: 500 })
  }
}
