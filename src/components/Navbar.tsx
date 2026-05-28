'use client'

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { useToast } from './ToastProvider'
import { USER_INFO_COOKIE } from '@/lib/auth-constants'
import LookupModal from './LookupModal'
import { useLocale } from '@/lib/i18n'

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
  const { locale, setLocale, t } = useLocale()
  const [email, setEmail] = useState<string | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

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
    setMobileMenuOpen(false)
  }, [pathname])

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
    showToast(t('nav.loggedOut'), 'info')
    router.push('/login')
    router.refresh()
  }

  const isActive = (prefix: string) =>
    pathname === prefix || (prefix !== '/home' && pathname.startsWith(prefix))

  return (
    <>
      <nav className="sticky top-0 z-50 border-b border-bg-subtle bg-[rgba(15,17,23,0.7)] backdrop-blur-[12px]">
        <div className="flex items-center justify-between px-7 max-md:px-4 py-3.5">
          <div className="flex items-center gap-7">
            <Link href="/home" className="inline-flex items-center gap-2.5 text-text-primary font-semibold text-[18px] tracking-[-0.01em]">
              <span className="w-7 h-7 rounded-lg bg-gradient-to-br from-accent to-accent-hover inline-flex items-center justify-center text-white text-sm font-semibold"><span>en</span></span>
              <span>en-learner</span>
            </Link>
            <div className="hidden md:flex items-center gap-1">
              <Link href="/home" className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[10px] text-[13px] font-medium transition-all hover:text-text-primary hover:bg-bg-elevated ${isActive('/home') ? 'text-accent bg-[rgba(16,185,129,0.15)]' : 'text-text-secondary'}`}>
                <i className="ti ti-cards" /><span>{t('nav.decks')}</span>
              </Link>
              <Link href="/stats" className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[10px] text-[13px] font-medium transition-all hover:text-text-primary hover:bg-bg-elevated ${isActive('/stats') ? 'text-accent bg-[rgba(16,185,129,0.15)]' : 'text-text-secondary'}`}>
                <i className="ti ti-chart-line" /><span>{t('nav.stats')}</span>
              </Link>
              <Link href="/groups" className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[10px] text-[13px] font-medium transition-all hover:text-text-primary hover:bg-bg-elevated ${(isActive('/groups') || isActive('/group')) ? 'text-accent bg-[rgba(16,185,129,0.15)]' : 'text-text-secondary'}`}>
                <i className="ti ti-users-group" /><span>{t('nav.groups')}</span>
              </Link>
            </div>
          </div>

          <div className="flex-1 flex justify-center max-md:hidden">
            <div className="flex items-center gap-2 bg-bg-elevated border border-bg-subtle rounded-[10px] px-3 py-1.5 text-text-muted text-[13px] transition-all cursor-text min-w-[260px] max-w-[360px] w-full hover:border-accent" onClick={openModal}>
              <i className="ti ti-search" />
              <input
                className="flex-1 bg-transparent border-none outline-none text-text-muted text-[13px] cursor-text min-w-0 pointer-events-none placeholder:text-text-muted"
                placeholder={t('nav.searchPlaceholder')}
                readOnly
                onClick={openModal}
              />
              <kbd>/</kbd>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              className="inline-flex items-center justify-center w-9 h-9 bg-bg-elevated text-text-secondary rounded-[10px] cursor-pointer transition-all hover:text-text-primary hover:bg-bg-subtle text-[12px] font-semibold"
              onClick={() => setLocale(locale === 'en' ? 'uk' : 'en')}
              title={locale === 'en' ? 'Switch to Ukrainian' : 'Switch to English'}
            >
              {locale === 'en' ? 'UK' : 'EN'}
            </button>
            {email && (
              <Link href="/account" className="inline-flex items-center justify-center w-9 h-9 rounded-full bg-gradient-to-br from-accent to-teal-500 text-white font-semibold text-[13px] cursor-pointer md:flex" title={email}>
                {initials(email)}
              </Link>
            )}
            <button className="hidden md:inline-flex items-center justify-center w-10 h-10 bg-bg-elevated text-text-secondary rounded-[10px] cursor-pointer transition-all hover:text-text-primary hover:bg-bg-subtle" onClick={handleLogout} title={t('nav.logout')}>
              <i className="ti ti-logout" />
            </button>
            <button
              className="md:hidden inline-flex items-center justify-center w-10 h-10 bg-bg-elevated text-text-secondary rounded-[10px] cursor-pointer transition-all hover:text-text-primary hover:bg-bg-subtle"
              onClick={() => setMobileMenuOpen(o => !o)}
              aria-label="Menu"
            >
              <i className={`ti ${mobileMenuOpen ? 'ti-x' : 'ti-menu-2'}`} />
            </button>
          </div>
        </div>

        {mobileMenuOpen && (
          <div className="md:hidden border-t border-bg-subtle bg-[rgba(15,17,23,0.95)] backdrop-blur-[12px] px-4 py-3 flex flex-col gap-1">
            <Link href="/home" className={`flex items-center gap-2 px-3 py-2.5 rounded-[10px] text-[14px] font-medium transition-all hover:text-text-primary hover:bg-bg-elevated ${isActive('/home') ? 'text-accent bg-[rgba(16,185,129,0.15)]' : 'text-text-secondary'}`}>
              <i className="ti ti-cards" /><span>{t('nav.decks')}</span>
            </Link>
            <Link href="/stats" className={`flex items-center gap-2 px-3 py-2.5 rounded-[10px] text-[14px] font-medium transition-all hover:text-text-primary hover:bg-bg-elevated ${isActive('/stats') ? 'text-accent bg-[rgba(16,185,129,0.15)]' : 'text-text-secondary'}`}>
              <i className="ti ti-chart-line" /><span>{t('nav.stats')}</span>
            </Link>
            <Link href="/groups" className={`flex items-center gap-2 px-3 py-2.5 rounded-[10px] text-[14px] font-medium transition-all hover:text-text-primary hover:bg-bg-elevated ${(isActive('/groups') || isActive('/group')) ? 'text-accent bg-[rgba(16,185,129,0.15)]' : 'text-text-secondary'}`}>
              <i className="ti ti-users-group" /><span>{t('nav.groups')}</span>
            </Link>
            <div className="mt-2 flex items-center gap-2 bg-bg-elevated border border-bg-subtle rounded-[10px] px-3 py-2 text-text-muted text-[13px] cursor-text hover:border-accent" onClick={openModal}>
              <i className="ti ti-search" />
              <span className="flex-1 text-text-muted">{t('nav.searchPlaceholder')}</span>
            </div>
            <div className="mt-1 pt-2 border-t border-bg-subtle flex items-center justify-between">
              {email && (
                <Link href="/account" className="flex items-center gap-2 px-3 py-2 rounded-[10px] text-[14px] font-medium text-text-secondary hover:text-text-primary hover:bg-bg-elevated transition-all">
                  <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-gradient-to-br from-accent to-teal-500 text-white font-semibold text-[11px]">{initials(email)}</span>
                  <span>{email}</span>
                </Link>
              )}
              <button className="inline-flex items-center gap-2 px-3 py-2 rounded-[10px] text-[14px] font-medium text-text-secondary hover:text-text-primary hover:bg-bg-elevated transition-all cursor-pointer" onClick={handleLogout}>
                <i className="ti ti-logout" /><span>{t('nav.logout')}</span>
              </button>
            </div>
          </div>
        )}
      </nav>

      <LookupModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
      />
    </>
  )
}
