import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { COOKIE_NAME, verifyToken } from '@/lib/auth'

export default function RootPage() {
  const cookieStore = cookies()
  const token = cookieStore.get(COOKIE_NAME)?.value

  if (token && verifyToken(token)) {
    redirect('/home')
  }

  redirect('/login')
}
