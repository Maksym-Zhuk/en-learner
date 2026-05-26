import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { folders } from '@/lib/schema'
import { eq, and } from 'drizzle-orm'
import { getUser } from '@/lib/auth'

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = getUser(request)
  if (!user) return NextResponse.json({ error: 'Неавторизовано' }, { status: 401 })

  const { id } = await params

  try {
    const deleted = await db
      .delete(folders)
      .where(and(eq(folders.id, id), eq(folders.user_id, user.userId)))
      .returning({ id: folders.id })

    if (!deleted.length) return NextResponse.json({ error: 'Папку не знайдено' }, { status: 404 })

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('DELETE /api/folders/[id] error:', error)
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
    const { name } = await request.json()

    if (!name?.trim()) {
      return NextResponse.json({ error: 'Назва папки обовʼязкова' }, { status: 400 })
    }

    const [folder] = await db
      .update(folders)
      .set({ name: name.trim() })
      .where(and(eq(folders.id, id), eq(folders.user_id, user.userId)))
      .returning()

    if (!folder) return NextResponse.json({ error: 'Папку не знайдено' }, { status: 404 })

    return NextResponse.json(folder)
  } catch (error) {
    console.error('PATCH /api/folders/[id] error:', error)
    return NextResponse.json({ error: 'Внутрішня помилка сервера' }, { status: 500 })
  }
}
