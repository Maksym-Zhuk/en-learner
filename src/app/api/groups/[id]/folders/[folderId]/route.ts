import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { sql } from 'drizzle-orm'
import { getUser } from '@/lib/auth'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; folderId: string }> },
) {
  const user = getUser(request)
  if (!user) return NextResponse.json({ error: 'Неавторизовано' }, { status: 401 })
  const { id: groupId, folderId } = await params

  try {
    const member = (await db.execute(sql`
      SELECT role FROM group_members WHERE group_id = ${groupId} AND user_id = ${user.userId} LIMIT 1
    `)) as unknown as { role: string }[]
    if (!member.length) return NextResponse.json({ error: 'Немає доступу' }, { status: 403 })

    const shared = (await db.execute(sql`
      SELECT 1 FROM group_shares WHERE group_id = ${groupId} AND folder_id = ${folderId} LIMIT 1
    `)) as unknown as unknown[]
    if (!shared.length) return NextResponse.json({ error: 'Папку не знайдено в групі' }, { status: 404 })

    const folderRows = (await db.execute(sql`
      SELECT id, name FROM folders WHERE id = ${folderId} LIMIT 1
    `)) as unknown as { id: string; name: string }[]
    if (!folderRows.length) return NextResponse.json({ error: 'Папку не знайдено' }, { status: 404 })

    const decks = (await db.execute(sql`
      SELECT d.id, d.name, d.folder_id, d.user_id, d.share_token, d.created_at,
             COUNT(c.id)::int AS card_count
      FROM decks d
      LEFT JOIN cards c ON c.deck_id = d.id
      WHERE d.folder_id = ${folderId}
      GROUP BY d.id
      ORDER BY d.created_at ASC
    `)) as unknown as { id: string; name: string; card_count: number }[]

    return NextResponse.json({ folder: folderRows[0], decks })
  } catch (error) {
    console.error('GET /api/groups/[id]/folders/[folderId] error:', error)
    return NextResponse.json({ error: 'Внутрішня помилка сервера' }, { status: 500 })
  }
}
