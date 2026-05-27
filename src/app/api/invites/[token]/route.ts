import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { groupMembers } from '@/lib/schema'
import { sql } from 'drizzle-orm'
import { getUser } from '@/lib/auth'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// GET: preview the invitation (group name + role)
export async function GET(_request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  if (!UUID_RE.test(token)) return NextResponse.json({ error: 'Запрошення не знайдено' }, { status: 404 })

  const rows = (await db.execute(sql`
    SELECT i.email, i.role, g.name AS group_name, g.emoji
    FROM group_invitations i JOIN groups g ON g.id = i.group_id
    WHERE i.token = ${token} LIMIT 1
  `)) as unknown as { email: string; role: string; group_name: string; emoji: string }[]

  if (!rows.length) return NextResponse.json({ error: 'Запрошення не знайдено' }, { status: 404 })
  return NextResponse.json(rows[0])
}

// POST: accept invitation as the logged-in user
export async function POST(request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const user = getUser(request)
  if (!user) return NextResponse.json({ error: 'Неавторизовано' }, { status: 401 })
  const { token } = await params
  if (!UUID_RE.test(token)) return NextResponse.json({ error: 'Запрошення не знайдено' }, { status: 404 })

  try {
    const rows = (await db.execute(sql`
      SELECT id, group_id, role FROM group_invitations WHERE token = ${token} LIMIT 1
    `)) as unknown as { id: string; group_id: string; role: string }[]
    if (!rows.length) return NextResponse.json({ error: 'Запрошення не знайдено' }, { status: 404 })
    const inv = rows[0]

    const already = (await db.execute(sql`
      SELECT 1 FROM group_members WHERE group_id = ${inv.group_id} AND user_id = ${user.userId} LIMIT 1
    `)) as unknown as unknown[]
    if (!already.length) {
      await db.insert(groupMembers).values({ group_id: inv.group_id, user_id: user.userId, role: inv.role })
    }
    await db.execute(sql`DELETE FROM group_invitations WHERE id = ${inv.id}`)

    return NextResponse.json({ ok: true, group_id: inv.group_id })
  } catch (error) {
    console.error('POST /api/invites/[token] error:', error)
    return NextResponse.json({ error: 'Внутрішня помилка сервера' }, { status: 500 })
  }
}
