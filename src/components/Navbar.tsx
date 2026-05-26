'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useToast } from './ToastProvider'
import { USER_INFO_COOKIE } from '@/lib/auth'

function getCookieValue(name: string): string | null {
  if (typeof document === 'undefined') return null
  const match = document.cookie.match(new RegExp('(?:^|; )' + name + '=([^;]*)'))
  return match ? decodeURIComponent(match[1]) : null
}

export default function Navbar() {
  const router = useRouter()
  const { showToast } = useToast()
  const [email, setEmail] = useState<string | null>(null)

  useEffect(() => {
    const raw = getCookieValue(USER_INFO_COOKIE)
    if (raw) {
      try {
        const info = JSON.parse(raw)
        setEmail(info.email)
      } catch {
        // ignore
      }
    }
  }, [])

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    showToast('Ви вийшли з акаунту', 'info')
    router.push('/login')
    router.refresh()
  }

  return (
    <nav className="navbar">
      <Link href="/home" className="navbar-logo" style={{ textDecoration: 'none' }}>
        📚 <span>EN</span>Learner
      </Link>

      <div className="navbar-right">
        {email && (
          <span className="navbar-email">{email}</span>
        )}
        <button className="btn-ghost" onClick={handleLogout} style={{ fontSize: '0.8125rem' }}>
          Вийти
        </button>
      </div>
    </nav>
  )
}
