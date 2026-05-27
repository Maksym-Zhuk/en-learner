'use client'

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { useToast } from './ToastProvider'
import { USER_INFO_COOKIE } from '@/lib/auth-constants'
import LookupModal from './LookupModal'

function getCookieValue(name: string): string | null {
  if (typeof document === 'undefined') return null
  const match = document.cookie.match(new RegExp('(?:^|; )' + name + '=([^;]*)'))
  return match ? decodeURIComponent(match[1]) : null
}

function initials(email: string): string {
  const base = email.split('@')[0] || email
  return base.slice(0, 2).toUpperCase()
}

export default function Navbar() {
  const router = useRouter()
  const pathname = usePathname()
  const { showToast } = useToast()
  const [email, setEmail] = useState<string | null>(null)
  const [modalOpen, setModalOpen] = useState(false)

  useEffect(() => {
    const raw = getCookieValue(USER_INFO_COOKIE)
    if (raw) {
      try {
        setEmail(JSON.parse(raw).email)
      } catch {
        // ignore
      }
    }
  }, [])

  function openModal() {
    if (!modalOpen) setModalOpen(true)
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement).tagName
      if (e.key === '/' && tag !== 'INPUT' && tag !== 'TEXTAREA' && !e.metaKey && !e.ctrlKey) {
        e.preventDefault()
        openModal()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modalOpen])

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    showToast('Ви вийшли з акаунту', 'info')
    router.push('/login')
    router.refresh()
  }

  const isActive = (prefix: string) =>
    pathname === prefix || (prefix !== '/home' && pathname.startsWith(prefix))

  return (
    <>
      <nav className="sticky top-0 z-50 flex items-center justify-between px-7 py-3.5 border-b border-bg-subtle bg-[rgba(15,17,23,0.7)] backdrop-blur-[12px]">
        <div className="flex items-center gap-7">
          <Link href="/home" className="inline-flex items-center gap-2.5 text-text-primary font-semibold text-[18px] tracking-[-0.01em]">
            <span className="w-7 h-7 rounded-lg bg-gradient-to-br from-accent to-accent-hover inline-flex items-center justify-center text-white text-sm font-semibold"><span>en</span></span>
            <span>en-learner</span>
          </Link>
          <div className="flex items-center gap-1">
            <Link href="/home" className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[10px] text-[13px] font-medium transition-all hover:text-text-primary hover:bg-bg-elevated ${isActive('/home') ? 'text-accent bg-[rgba(16,185,129,0.15)]' : 'text-text-secondary'}`}>
              <i className="ti ti-cards" /><span>Колоди</span>
            </Link>
            <Link href="/stats" className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[10px] text-[13px] font-medium transition-all hover:text-text-primary hover:bg-bg-elevated ${isActive('/stats') ? 'text-accent bg-[rgba(16,185,129,0.15)]' : 'text-text-secondary'}`}>
              <i className="ti ti-chart-line" /><span>Статистика</span>
            </Link>
            <Link href="/groups" className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[10px] text-[13px] font-medium transition-all hover:text-text-primary hover:bg-bg-elevated ${(isActive('/groups') || isActive('/group')) ? 'text-accent bg-[rgba(16,185,129,0.15)]' : 'text-text-secondary'}`}>
              <i className="ti ti-users-group" /><span>Групи</span>
            </Link>
          </div>
        </div>

        <div className="flex-1 flex justify-center max-md:hidden">
          <div className="flex items-center gap-2 bg-bg-elevated border border-bg-subtle rounded-[10px] px-3 py-1.5 text-text-muted text-[13px] transition-all cursor-text min-w-[260px] max-w-[360px] w-full hover:border-accent" onClick={openModal}>
            <i className="ti ti-search" />
            <input
              className="flex-1 bg-transparent border-none outline-none text-text-muted text-[13px] cursor-text min-w-0 pointer-events-none placeholder:text-text-muted"
              placeholder="Пошук слова…"
              readOnly
              onClick={openModal}
            />
            <kbd>/</kbd>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {email && (
            <Link href="/account" className="inline-flex items-center justify-center w-9 h-9 rounded-full bg-gradient-to-br from-accent to-teal-500 text-white font-semibold text-[13px] cursor-pointer" title={email}>
              {initials(email)}
            </Link>
          )}
          <button className="inline-flex items-center justify-center w-10 h-10 bg-bg-elevated text-text-secondary rounded-[10px] cursor-pointer transition-all hover:text-text-primary hover:bg-bg-subtle" onClick={handleLogout} title="Вийти">
            <i className="ti ti-logout" />
          </button>
        </div>
      </nav>

      <LookupModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
      />
    </>
  )
}
