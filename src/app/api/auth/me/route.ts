import { NextRequest, NextResponse } from 'next/server'
import { getUser } from '@/lib/auth'

export async function GET(request: NextRequest) {
  const user = getUser(request)
  if (!user) {
    return NextResponse.json({ error: 'Неавторизовано' }, { status: 401 })
  }
  return NextResponse.json({ userId: user.userId, email: user.email })
}
