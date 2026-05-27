import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { groups } from '@/lib/schema'
import { eq, and, sql } from 'drizzle-orm'
import { getUser } from '@/lib/auth'

async function membership(groupId: string, userId: string) {
  const rows = (await db.execute(sql`
    SELECT role FROM group_members WHERE group_id = ${groupId} AND user_id = ${userId} LIMIT 1
  `)) as unknown as { role: string }[]
  return rows[0]?.role ?? null
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = getUser(request)
  if (!user) return NextResponse.json({ error: 'Неавторизовано' }, { status: 401 })
  const { id } = await params

  try {
    const role = await membership(id, user.userId)
    if (!role) return NextResponse.json({ error: 'Немає доступу' }, { status: 403 })

    const [group] = await db.select().from(groups).where(eq(groups.id, id)).limit(1)
    if (!group) return NextResponse.json({ error: 'Групу не знайдено' }, { status: 404 })

    const members = await db.execute(sql`
      SELECT m.id, m.role, m.user_id, u.email
      FROM group_members m JOIN users u ON u.id = m.user_id
      WHERE m.group_id = ${id}
      ORDER BY (m.role = 'owner') DESC, m.created_at ASC
    `)

    const shares = await db.execute(sql`
      SELECT s.id, s.deck_id, s.folder_id, d.name AS deck_name, f.name AS folder_name
      FROM group_shares s
      LEFT JOIN decks d ON d.id = s.deck_id
      LEFT JOIN folders f ON f.id = s.folder_id
      WHERE s.group_id = ${id}
      ORDER BY s.created_at DESC
    `)

    const invitations = await db.execute(sql`
      SELECT id, email, role, token FROM group_invitations WHERE group_id = ${id} ORDER BY created_at DESC
    `)

    return NextResponse.json({ ...group, myRole: role, myUserId: user.userId, members, shares, invitations })
  } catch (error) {
    console.error('GET /api/groups/[id] error:', error)
    return NextResponse.json({ error: 'Внутрішня помилка сервера' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = getUser(request)
  if (!user) return NextResponse.json({ error: 'Неавторизовано' }, { status: 401 })
  const { id } = await params

  try {
    const body = await request.json()
    const updates: { name?: string; emoji?: string; description?: string } = {}
    if (typeof body.name === 'string') {
      if (!body.name.trim()) return NextResponse.json({ error: 'Назва групи обовʼязкова' }, { status: 400 })
      updates.name = body.name.trim()
    }
    if (typeof body.emoji === 'string' && body.emoji.trim()) updates.emoji = body.emoji.trim()
    if (typeof body.description === 'string') updates.description = body.description.trim()
    if (Object.keys(updates).length === 0) return NextResponse.json({ error: 'Немає змін' }, { status: 400 })

    const [group] = await db
      .update(groups)
      .set(updates)
      .where(and(eq(groups.id, id), eq(groups.owner_id, user.userId)))
      .returning()
    if (!group) return NextResponse.json({ error: 'Групу не знайдено або немає прав' }, { status: 404 })
    return NextResponse.json(group)
  } catch (error) {
    console.error('PATCH /api/groups/[id] error:', error)
    return NextResponse.json({ error: 'Внутрішня помилка сервера' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = getUser(request)
  if (!user) return NextResponse.json({ error: 'Неавторизовано' }, { status: 401 })
  const { id } = await params

  try {
    const deleted = await db
      .delete(groups)
      .where(and(eq(groups.id, id), eq(groups.owner_id, user.userId)))
      .returning({ id: groups.id })
    if (!deleted.length) return NextResponse.json({ error: 'Групу не знайдено' }, { status: 404 })
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('DELETE /api/groups/[id] error:', error)
    return NextResponse.json({ error: 'Внутрішня помилка сервера' }, { status: 500 })
  }
}
