import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { groupShares } from '@/lib/schema'
import { sql } from 'drizzle-orm'
import { getUser } from '@/lib/auth'

async function role(groupId: string, userId: string) {
  const rows = (await db.execute(sql`
    SELECT role FROM group_members WHERE group_id = ${groupId} AND user_id = ${userId} LIMIT 1
  `)) as unknown as { role: string }[]
  return rows[0]?.role ?? null
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = getUser(request)
  if (!user) return NextResponse.json({ error: 'Неавторизовано' }, { status: 401 })
  const { id } = await params

  try {
    const r = await role(id, user.userId)
    if (r !== 'owner' && r !== 'editor') return NextResponse.json({ error: 'Немає прав' }, { status: 403 })

    const { deck_id = null, folder_id = null } = await request.json()
    if (!deck_id && !folder_id) return NextResponse.json({ error: 'Оберіть колоду або папку' }, { status: 400 })

    // verify ownership of the shared resource
    if (deck_id) {
      const own = (await db.execute(sql`SELECT 1 FROM decks WHERE id = ${deck_id} AND user_id = ${user.userId} LIMIT 1`)) as unknown as unknown[]
      if (!own.length) return NextResponse.json({ error: 'Колода не знайдена' }, { status: 404 })
    }
    if (folder_id) {
      const own = (await db.execute(sql`SELECT 1 FROM folders WHERE id = ${folder_id} AND user_id = ${user.userId} LIMIT 1`)) as unknown as unknown[]
      if (!own.length) return NextResponse.json({ error: 'Папка не знайдена' }, { status: 404 })
    }

    const [row] = await db.insert(groupShares).values({ group_id: id, deck_id, folder_id }).returning()
    return NextResponse.json(row, { status: 201 })
  } catch (error) {
    console.error('POST /api/groups/[id]/share error:', error)
    return NextResponse.json({ error: 'Внутрішня помилка сервера' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = getUser(request)
  if (!user) return NextResponse.json({ error: 'Неавторизовано' }, { status: 401 })
  const { id } = await params

  try {
    const r = await role(id, user.userId)
    if (r !== 'owner' && r !== 'editor') return NextResponse.json({ error: 'Немає прав' }, { status: 403 })

    const { share_id } = await request.json()
    if (!share_id) return NextResponse.json({ error: 'share_id обовʼязковий' }, { status: 400 })
    await db.execute(sql`DELETE FROM group_shares WHERE id = ${share_id} AND group_id = ${id}`)
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('DELETE /api/groups/[id]/share error:', error)
    return NextResponse.json({ error: 'Внутрішня помилка сервера' }, { status: 500 })
  }
}
