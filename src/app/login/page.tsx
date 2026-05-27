'use client'

import { useState, FormEvent, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { useToast } from '@/components/ToastProvider'

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const next = searchParams.get('next')
  const { showToast } = useToast()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      const data = await res.json()
      if (!res.ok) {
        showToast(data.error || 'Помилка входу', 'error')
        return
      }
      showToast('Ласкаво просимо!', 'success')
      router.push(next || '/home')
      router.refresh()
    } catch {
      showToast('Помилка мережі', 'error')
    } finally {
      setLoading(false)
    }
  }

  const registerHref = next ? `/register?next=${encodeURIComponent(next)}` : '/register'

  return (
    <>
      <div className="bg-grid" />
      <section className="relative min-h-screen flex items-center justify-center px-6 py-12">
        <div className="relative w-full max-w-[480px] bg-bg-surface border border-bg-subtle rounded-[24px] px-9 py-10 shadow-[0_12px_40px_rgba(0,0,0,0.5)]">
          <div className="inline-flex items-center gap-2.5 text-text-primary font-semibold text-[18px] tracking-[-0.01em] justify-center w-full mb-2">
            <span className="w-7 h-7 rounded-lg bg-gradient-to-br from-accent to-accent-hover inline-flex items-center justify-center text-white text-sm font-semibold"><span>en</span></span>
            <span>en-learner</span>
          </div>
          <div className="text-text-muted text-[13px] text-center mb-7">Вивчай англійську — слово за словом.</div>

          <div className="grid grid-cols-2 bg-bg-elevated border border-bg-subtle rounded-full p-1 relative mb-7">
            <div className="absolute top-1 left-1 w-[calc(50%-4px)] h-[calc(100%-8px)] bg-accent rounded-full transition-transform duration-240 shadow-[0_4px_12px_rgba(16,185,129,0.4)] z-0" />
            <button className="relative z-10 bg-transparent border-none text-white font-[inherit] text-[13px] font-medium h-9 cursor-pointer transition-colors" type="button">Увійти</button>
            <button className="relative z-10 bg-transparent border-none text-text-secondary font-[inherit] text-[13px] font-medium h-9 cursor-pointer transition-colors" type="button" onClick={() => router.push(registerHref)}>Зареєструватись</button>
          </div>

          <form onSubmit={handleSubmit} autoComplete="off">
            <div className="relative mb-4">
              <input
                className="w-full h-[52px] bg-bg-elevated border border-bg-subtle rounded-[10px] text-text-primary text-[15px] px-4 pt-[18px] pb-1.5 pl-11 outline-none transition-all focus:border-accent placeholder-transparent peer"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder=" "
                required
                autoComplete="email"
              />
              <label className="absolute left-11 top-4 text-text-muted text-[15px] pointer-events-none transition-all peer-focus:top-[7px] peer-focus:text-[11px] peer-focus:text-accent peer-[:not(:placeholder-shown)]:top-[7px] peer-[:not(:placeholder-shown)]:text-[11px] peer-[:not(:placeholder-shown)]:text-accent">Електронна пошта</label>
              <i className="ti ti-mail absolute left-4 top-1/2 -translate-y-1/2 text-text-muted text-lg pointer-events-none transition-colors peer-focus:text-accent" />
            </div>
            <div className="relative mb-4">
              <input
                className="w-full h-[52px] bg-bg-elevated border border-bg-subtle rounded-[10px] text-text-primary text-[15px] px-4 pt-[18px] pb-1.5 pl-11 outline-none transition-all focus:border-accent placeholder-transparent peer"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder=" "
                required
                autoComplete="current-password"
              />
              <label className="absolute left-11 top-4 text-text-muted text-[15px] pointer-events-none transition-all peer-focus:top-[7px] peer-focus:text-[11px] peer-focus:text-accent peer-[:not(:placeholder-shown)]:top-[7px] peer-[:not(:placeholder-shown)]:text-[11px] peer-[:not(:placeholder-shown)]:text-accent">Пароль</label>
              <i className="ti ti-lock absolute left-4 top-1/2 -translate-y-1/2 text-text-muted text-lg pointer-events-none transition-colors peer-focus:text-accent" />
            </div>

            <button type="submit" className="inline-flex items-center justify-center gap-2 h-12 px-5 text-[15px] w-full bg-accent text-white rounded-[10px] font-medium cursor-pointer transition-all hover:bg-accent-hover hover:-translate-y-px" disabled={loading}>
              {loading ? 'Вхід…' : 'Увійти'}
            </button>
          </form>

          <p className="text-text-muted text-[13px] text-center" style={{ marginTop: 20, marginBottom: 0 }}>
            Немає акаунту? <Link href={registerHref} className="text-accent">Зареєструватися</Link>
          </p>
        </div>
      </section>
    </>
  )
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  )
}
