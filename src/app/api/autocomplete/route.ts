import { NextRequest, NextResponse } from 'next/server'
import { getUser } from '@/lib/auth'

export async function GET(request: NextRequest) {
  const user = getUser(request)
  if (!user) return NextResponse.json([], { status: 401 })

  const q = request.nextUrl.searchParams.get('q')?.trim()
  if (!q || q.length < 2) return NextResponse.json([])

  try {
    const res = await fetch(
      `https://api.datamuse.com/sug?s=${encodeURIComponent(q)}&max=8`,
      { signal: AbortSignal.timeout(3000) }
    )
    if (!res.ok) return NextResponse.json([])
    const data = await res.json()
    return NextResponse.json((data as { word: string }[]).map((item) => item.word))
  } catch {
    return NextResponse.json([])
  }
}
