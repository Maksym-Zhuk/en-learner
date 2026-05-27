import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { groupInvitations } from '@/lib/schema'
import { sql } from 'drizzle-orm'
import { getUser } from '@/lib/auth'
import { sendInviteEmail } from '@/lib/email'

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = getUser(request)
  if (!user) return NextResponse.json({ error: 'Неавторизовано' }, { status: 401 })
  const { id } = await params

  try {
    const mine = (await db.execute(sql`
      SELECT role FROM group_members WHERE group_id = ${id} AND user_id = ${user.userId} LIMIT 1
    `)) as unknown as { role: string }[]
    const role = mine[0]?.role
    if (role !== 'owner' && role !== 'editor') {
      return NextResponse.json({ error: 'Лише власник або редактор може запрошувати' }, { status: 403 })
    }

    const body = await request.json()
    const email = String(body.email || '').trim().toLowerCase()
    const inviteRole = body.role === 'editor' ? 'editor' : 'viewer'
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: 'Невірний формат email' }, { status: 400 })
    }

    const existing = (await db.execute(sql`SELECT id FROM users WHERE email = ${email} LIMIT 1`)) as unknown as { id: string }[]

    if (existing.length) {
      const userId = existing[0].id
      const already = (await db.execute(sql`
        SELECT 1 FROM group_members WHERE group_id = ${id} AND user_id = ${userId} LIMIT 1
      `)) as unknown as unknown[]
      if (already.length) return NextResponse.json({ error: 'Користувач уже в групі' }, { status: 409 })
      const alreadyInvited = (await db.execute(sql`
        SELECT 1 FROM group_invitations WHERE group_id = ${id} AND email = ${email} LIMIT 1
      `)) as unknown as unknown[]
      if (alreadyInvited.length) return NextResponse.json({ error: 'Запрошення вже надіслано' }, { status: 409 })
    }

    const [inv] = await db
      .insert(groupInvitations)
      .values({ group_id: id, email, role: inviteRole })
      .returning({ token: groupInvitations.token })

    const [grp] = (await db.execute(sql`
      SELECT name, emoji FROM groups WHERE id = ${id} LIMIT 1
    `)) as unknown as { name: string; emoji: string }[]

    const inviteUrl = `${request.nextUrl.origin}/invite/${inv.token}`
    const emailed = await sendInviteEmail({
      to: email,
      groupName: grp?.name ?? 'Група',
      emoji: grp?.emoji ?? '👥',
      inviteUrl,
      role: inviteRole,
    })

    return NextResponse.json({ invited: true, email, token: inv.token, emailed })
  } catch (error) {
    console.error('POST /api/groups/[id]/invite error:', error)
    return NextResponse.json({ error: 'Внутрішня помилка сервера' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = getUser(request)
  if (!user) return NextResponse.json({ error: 'Неавторизовано' }, { status: 401 })
  const { id } = await params

  try {
    const mine = (await db.execute(sql`
      SELECT role FROM group_members WHERE group_id = ${id} AND user_id = ${user.userId} LIMIT 1
    `)) as unknown as { role: string }[]
    const role = mine[0]?.role
    if (role !== 'owner' && role !== 'editor') {
      return NextResponse.json({ error: 'Недостатньо прав' }, { status: 403 })
    }

    const body = await request.json()
    const inviteId = String(body.invitation_id || '')
    if (!inviteId) return NextResponse.json({ error: 'invitation_id обовʼязковий' }, { status: 400 })

    const deleted = (await db.execute(sql`
      DELETE FROM group_invitations WHERE id = ${inviteId} AND group_id = ${id} RETURNING id
    `)) as unknown as { id: string }[]
    if (!deleted.length) return NextResponse.json({ error: 'Запрошення не знайдено' }, { status: 404 })

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('DELETE /api/groups/[id]/invite error:', error)
    return NextResponse.json({ error: 'Внутрішня помилка сервера' }, { status: 500 })
  }
}
