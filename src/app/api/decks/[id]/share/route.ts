import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { decks } from '@/lib/schema'
import { eq, and } from 'drizzle-orm'
import { getUser } from '@/lib/auth'
import { randomUUID } from 'crypto'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = getUser(request)
  if (!user) return NextResponse.json({ error: 'Неавторизовано' }, { status: 401 })

  const { id } = await params

  try {
    const token = randomUUID()

    const [deck] = await db
      .update(decks)
      .set({ share_token: token })
      .where(and(eq(decks.id, id), eq(decks.user_id, user.userId)))
      .returning({ share_token: decks.share_token })

    if (!deck) return NextResponse.json({ error: 'Колода не знайдена' }, { status: 404 })

    return NextResponse.json({ share_token: deck.share_token })
  } catch (error) {
    console.error('POST /api/decks/[id]/share error:', error)
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
    const [deck] = await db
      .update(decks)
      .set({ share_token: null })
      .where(and(eq(decks.id, id), eq(decks.user_id, user.userId)))
      .returning({ id: decks.id })

    if (!deck) return NextResponse.json({ error: 'Колода не знайдена' }, { status: 404 })

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('DELETE /api/decks/[id]/share error:', error)
    return NextResponse.json({ error: 'Внутрішня помилка сервера' }, { status: 500 })
  }
}
