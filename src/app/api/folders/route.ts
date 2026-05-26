import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { folders } from '@/lib/schema'
import { eq, asc } from 'drizzle-orm'
import { getUser } from '@/lib/auth'

export async function GET(request: NextRequest) {
  const user = getUser(request)
  if (!user) return NextResponse.json({ error: 'Неавторизовано' }, { status: 401 })

  try {
    const rows = await db
      .select()
      .from(folders)
      .where(eq(folders.user_id, user.userId))
      .orderBy(asc(folders.created_at))

    return NextResponse.json(rows)
  } catch (error) {
    console.error('GET /api/folders error:', error)
    return NextResponse.json({ error: 'Внутрішня помилка сервера' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const user = getUser(request)
  if (!user) return NextResponse.json({ error: 'Неавторизовано' }, { status: 401 })

  try {
    const { name } = await request.json()

    if (!name?.trim()) {
      return NextResponse.json({ error: 'Назва папки обовʼязкова' }, { status: 400 })
    }

    const [folder] = await db
      .insert(folders)
      .values({ user_id: user.userId, name: name.trim() })
      .returning()

    return NextResponse.json(folder, { status: 201 })
  } catch (error) {
    console.error('POST /api/folders error:', error)
    return NextResponse.json({ error: 'Внутрішня помилка сервера' }, { status: 500 })
  }
}
