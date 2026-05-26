'use client'

import { useState, FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useToast } from '@/components/ToastProvider'

export default function LoginPage() {
  const router = useRouter()
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
      router.push('/home')
      router.refresh()
    } catch {
      showToast('Помилка мережі', 'error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card animate-scaleIn">
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>📚</div>
          <h1 className="auth-title">Вхід до EN Learner</h1>
          <p className="auth-subtitle">Продовжте вивчення англійської</p>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="field">
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder=" "
              required
              autoComplete="email"
            />
            <label htmlFor="email">Електронна пошта</label>
          </div>

          <div className="field">
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder=" "
              required
              autoComplete="current-password"
            />
            <label htmlFor="password">Пароль</label>
          </div>

          <button
            type="submit"
            className="btn-primary"
            disabled={loading}
          >
            {loading ? <span className="spinner" /> : null}
            {loading ? 'Вхід...' : 'Увійти'}
          </button>
        </form>

        <p className="auth-footer">
          Немає акаунту?{' '}
          <Link href="/register">Зареєструватися</Link>
        </p>
      </div>
    </div>
  )
}
