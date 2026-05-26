import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { db } from '@/lib/db'
import { users, decks, cards, folders } from '@/lib/schema'
import { eq, sql } from 'drizzle-orm'
import { getUser } from '@/lib/auth'

export async function GET(request: NextRequest) {
  const user = getUser(request)
  if (!user) return NextResponse.json({ error: 'Неавторизовано' }, { status: 401 })

  try {
    const [profile] = await db
      .select({ id: users.id, email: users.email, created_at: users.created_at })
      .from(users)
      .where(eq(users.id, user.userId))
      .limit(1)

    if (!profile) return NextResponse.json({ error: 'Користувача не знайдено' }, { status: 404 })

    const [stats] = await db
      .select({
        deck_count: sql<number>`(SELECT COUNT(*)::int FROM decks WHERE user_id = ${user.userId})`,
        card_count: sql<number>`(SELECT COUNT(*)::int FROM cards c JOIN decks d ON d.id = c.deck_id WHERE d.user_id = ${user.userId})`,
        folder_count: sql<number>`(SELECT COUNT(*)::int FROM folders WHERE user_id = ${user.userId})`,
      })
      .from(users)
      .where(eq(users.id, user.userId))
      .limit(1)

    return NextResponse.json({ ...profile, ...stats })
  } catch (error) {
    console.error('GET /api/auth/me error:', error)
    return NextResponse.json({ error: 'Внутрішня помилка сервера' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  const user = getUser(request)
  if (!user) return NextResponse.json({ error: 'Неавторизовано' }, { status: 401 })

  try {
    const { current_password, new_password } = await request.json()

    if (!current_password || !new_password) {
      return NextResponse.json({ error: 'Поточний і новий паролі обовʼязкові' }, { status: 400 })
    }

    if (new_password.length < 8) {
      return NextResponse.json({ error: 'Новий пароль має містити мінімум 8 символів' }, { status: 400 })
    }

    const [row] = await db
      .select({ password_hash: users.password_hash })
      .from(users)
      .where(eq(users.id, user.userId))
      .limit(1)

    if (!row) return NextResponse.json({ error: 'Користувача не знайдено' }, { status: 404 })

    const valid = await bcrypt.compare(current_password, row.password_hash)
    if (!valid) {
      return NextResponse.json({ error: 'Невірний поточний пароль' }, { status: 400 })
    }

    const hash = await bcrypt.hash(new_password, 12)
    await db.update(users).set({ password_hash: hash }).where(eq(users.id, user.userId))

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('PUT /api/auth/me error:', error)
    return NextResponse.json({ error: 'Внутрішня помилка сервера' }, { status: 500 })
  }
}
