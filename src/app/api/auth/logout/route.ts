import { NextResponse } from 'next/server'
import { COOKIE_NAME, USER_INFO_COOKIE } from '@/lib/auth'

export async function POST() {
  const response = NextResponse.json({ ok: true })
  response.cookies.delete(COOKIE_NAME)
  response.cookies.delete(USER_INFO_COOKIE)
  return response
}
