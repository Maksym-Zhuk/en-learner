'use client'

import { useState, FormEvent, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { useToast } from '@/components/ToastProvider'
import { useLocale } from '@/lib/i18n'

function RegisterForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const next = searchParams.get('next')
  const { showToast } = useToast()
  const { t } = useLocale()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (password.length < 8) {
      showToast(t('register.minPassword'), 'error')
      return
    }
    setLoading(true)
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      const data = await res.json()
      if (!res.ok) {
        showToast(data.error || t('register.error'), 'error')
        return
      }
      showToast(t('register.created'), 'success')
      router.push(next || '/home')
      router.refresh()
    } catch {
      showToast(t('common.networkError'), 'error')
    } finally {
      setLoading(false)
    }
  }

  const loginHref = next ? `/login?next=${encodeURIComponent(next)}` : '/login'

  return (
    <>
      <div className="bg-grid" />
      <section className="relative min-h-screen flex items-center justify-center px-6 py-12">
        <div className="relative w-full max-w-[480px] bg-bg-surface border border-bg-subtle rounded-[24px] px-9 py-10 shadow-[0_12px_40px_rgba(0,0,0,0.5)]">
          <div className="inline-flex items-center gap-2.5 text-text-primary font-semibold text-[18px] tracking-[-0.01em] justify-center w-full mb-2">
            <span className="w-7 h-7 rounded-lg bg-gradient-to-br from-accent to-accent-hover inline-flex items-center justify-center text-white text-sm font-semibold"><span>en</span></span>
            <span>en-learner</span>
          </div>
          <div className="text-text-muted text-[13px] text-center mb-7">{t('register.tagline')}</div>

          <div className="grid grid-cols-2 bg-bg-elevated border border-bg-subtle rounded-full p-1 relative mb-7">
            <div className="absolute top-1 left-1 w-[calc(50%-4px)] h-[calc(100%-8px)] bg-accent rounded-full transition-transform duration-240 shadow-[0_4px_12px_rgba(16,185,129,0.4)] z-0 translate-x-full" />
            <button className="relative z-10 bg-transparent border-none text-text-secondary font-[inherit] text-[13px] font-medium h-9 cursor-pointer transition-colors" type="button" onClick={() => router.push(loginHref)}>{t('register.signIn')}</button>
            <button className="relative z-10 bg-transparent border-none text-white font-[inherit] text-[13px] font-medium h-9 cursor-pointer transition-colors" type="button">{t('register.register')}</button>
          </div>

          <form onSubmit={handleSubmit} autoComplete="off">
            <div className="relative mb-4">
              <input
                id="register-email"
                className="w-full h-[52px] bg-bg-elevated border border-bg-subtle rounded-[10px] text-text-primary text-[15px] px-4 pt-[18px] pb-1.5 pl-11 outline-none transition-all focus:border-accent placeholder-transparent peer"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder=" "
                required
                autoComplete="email"
              />
              <label htmlFor="register-email" className="absolute left-11 top-4 text-text-muted text-[15px] pointer-events-none transition-all peer-focus:top-[7px] peer-focus:text-[11px] peer-focus:text-accent peer-[:not(:placeholder-shown)]:top-[7px] peer-[:not(:placeholder-shown)]:text-[11px] peer-[:not(:placeholder-shown)]:text-accent">{t('register.email')}</label>
              <i className="ti ti-mail absolute left-4 top-1/2 -translate-y-1/2 text-text-muted text-lg pointer-events-none transition-colors peer-focus:text-accent" />
            </div>
            <div className="relative mb-4">
              <input
                id="register-password"
                className="w-full h-[52px] bg-bg-elevated border border-bg-subtle rounded-[10px] text-text-primary text-[15px] px-4 pt-[18px] pb-1.5 pl-11 outline-none transition-all focus:border-accent placeholder-transparent peer"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder=" "
                required
                autoComplete="new-password"
              />
              <label htmlFor="register-password" className="absolute left-11 top-4 text-text-muted text-[15px] pointer-events-none transition-all peer-focus:top-[7px] peer-focus:text-[11px] peer-focus:text-accent peer-[:not(:placeholder-shown)]:top-[7px] peer-[:not(:placeholder-shown)]:text-[11px] peer-[:not(:placeholder-shown)]:text-accent">{t('register.password')}</label>
              <i className="ti ti-lock absolute left-4 top-1/2 -translate-y-1/2 text-text-muted text-lg pointer-events-none transition-colors peer-focus:text-accent" />
            </div>

            <button type="submit" className="inline-flex items-center justify-center gap-2 h-12 px-5 text-[15px] w-full bg-accent text-white rounded-[10px] font-medium cursor-pointer transition-all hover:bg-accent-hover hover:-translate-y-px" disabled={loading}>
              {loading ? t('register.submitting') : t('register.submit')}
            </button>
          </form>

          <p className="text-text-muted text-[13px] text-center" style={{ marginTop: 20, marginBottom: 0 }}>
            {t('register.hasAccount')} <Link href={loginHref} className="text-accent">{t('register.loginLink')}</Link>
          </p>
        </div>
      </section>
    </>
  )
}

export default function RegisterPage() {
  return (
    <Suspense>
      <RegisterForm />
    </Suspense>
  )
}
