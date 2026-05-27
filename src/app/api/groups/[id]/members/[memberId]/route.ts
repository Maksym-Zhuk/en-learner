import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { sql } from 'drizzle-orm'
import { getUser } from '@/lib/auth'

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; memberId: string }> },
) {
  const user = getUser(request)
  if (!user) return NextResponse.json({ error: 'Неавторизовано' }, { status: 401 })
  const { id, memberId } = await params

  try {
    const myRows = (await db.execute(sql`
      SELECT role FROM group_members WHERE group_id = ${id} AND user_id = ${user.userId} LIMIT 1
    `)) as unknown as { role: string }[]
    const myRole = myRows[0]?.role
    if (myRole !== 'owner' && myRole !== 'editor') {
      return NextResponse.json({ error: 'Недостатньо прав' }, { status: 403 })
    }

    const targetRows = (await db.execute(sql`
      SELECT role, user_id FROM group_members WHERE id = ${memberId} AND group_id = ${id} LIMIT 1
    `)) as unknown as { role: string; user_id: string }[]
    if (!targetRows.length) return NextResponse.json({ error: 'Учасника не знайдено' }, { status: 404 })
    const target = targetRows[0]

    if (target.role === 'owner') {
      return NextResponse.json({ error: 'Власника групи не можна видалити' }, { status: 403 })
    }
    if (myRole === 'editor' && target.role === 'editor') {
      return NextResponse.json({ error: 'Редактор не може видалити іншого редактора' }, { status: 403 })
    }
    if (target.user_id === user.userId) {
      return NextResponse.json({ error: 'Не можна видалити себе' }, { status: 403 })
    }

    await db.execute(sql`DELETE FROM group_members WHERE id = ${memberId} AND group_id = ${id}`)
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('DELETE /api/groups/[id]/members/[memberId] error:', error)
    return NextResponse.json({ error: 'Внутрішня помилка сервера' }, { status: 500 })
  }
}
