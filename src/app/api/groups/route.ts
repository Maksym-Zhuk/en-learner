import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { groups, groupMembers } from '@/lib/schema'
import { sql } from 'drizzle-orm'
import { getUser } from '@/lib/auth'

export async function GET(request: NextRequest) {
  const user = getUser(request)
  if (!user) return NextResponse.json({ error: 'Неавторизовано' }, { status: 401 })

  try {
    const rows = await db.execute(sql`
      SELECT g.id, g.name, g.emoji, g.description, g.owner_id, g.created_at,
        (SELECT COUNT(*)::int FROM group_members m WHERE m.group_id = g.id) AS member_count,
        (SELECT COUNT(*)::int FROM group_shares s WHERE s.group_id = g.id) AS shared_count,
        (g.owner_id = ${user.userId}) AS is_owner
      FROM groups g
      WHERE g.owner_id = ${user.userId}
         OR EXISTS (SELECT 1 FROM group_members m WHERE m.group_id = g.id AND m.user_id = ${user.userId})
      ORDER BY g.created_at DESC
    `)
    return NextResponse.json(rows)
  } catch (error) {
    console.error('GET /api/groups error:', error)
    return NextResponse.json({ error: 'Внутрішня помилка сервера' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const user = getUser(request)
  if (!user) return NextResponse.json({ error: 'Неавторизовано' }, { status: 401 })

  try {
    const { name, emoji = '👥', description = '' } = await request.json()
    if (!name?.trim()) return NextResponse.json({ error: 'Назва групи обовʼязкова' }, { status: 400 })

    const [group] = await db
      .insert(groups)
      .values({ owner_id: user.userId, name: name.trim(), emoji, description: description.trim() })
      .returning()

    await db.insert(groupMembers).values({ group_id: group.id, user_id: user.userId, role: 'owner' })

    return NextResponse.json({ ...group, member_count: 1, shared_count: 0, is_owner: true }, { status: 201 })
  } catch (error) {
    console.error('POST /api/groups error:', error)
    return NextResponse.json({ error: 'Внутрішня помилка сервера' }, { status: 500 })
  }
}
