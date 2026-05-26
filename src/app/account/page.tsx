'use client'

import { useState, useEffect, FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import Navbar from '@/components/Navbar'
import { useToast } from '@/components/ToastProvider'

interface Profile {
  id: string
  email: string
  created_at: string
  deck_count: number
  card_count: number
  folder_count: number
}

export default function AccountPage() {
  const router = useRouter()
  const { showToast } = useToast()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [changingPassword, setChangingPassword] = useState(false)

  useEffect(() => {
    fetch('/api/auth/me')
      .then(async (res) => {
        if (res.status === 401) { router.push('/login'); return }
        setProfile(await res.json())
      })
      .catch(() => showToast('Помилка завантаження', 'error'))
      .finally(() => setLoading(false))
  }, [])

  async function handleChangePassword(e: FormEvent) {
    e.preventDefault()
    if (newPassword !== confirmPassword) {
      showToast('Паролі не збігаються', 'error')
      return
    }
    setChangingPassword(true)
    try {
      const res = await fetch('/api/auth/me', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }),
      })
      const data = await res.json()
      if (!res.ok) {
        showToast(data.error || 'Помилка зміни пароля', 'error')
        return
      }
      showToast('Пароль змінено!', 'success')
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
    } catch {
      showToast('Помилка мережі', 'error')
    } finally {
      setChangingPassword(false)
    }
  }

  function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString('uk-UA', {
      day: 'numeric', month: 'long', year: 'numeric',
    })
  }

  if (loading) {
    return (
      <>
        <Navbar />
        <div className="page-container" style={{ display: 'flex', justifyContent: 'center', paddingTop: '4rem' }}>
          <span className="spinner-lg" />
        </div>
      </>
    )
  }

  if (!profile) return null

  return (
    <>
      <Navbar />
      <div className="page-container" style={{ maxWidth: '680px' }}>
        <h1 className="section-title" style={{ fontSize: '1.5rem', marginBottom: '2rem' }}>
          👤 Мій акаунт
        </h1>

        {/* Profile info */}
        <div className="account-card">
          <div className="account-avatar">
            {profile.email[0].toUpperCase()}
          </div>
          <div>
            <p className="account-email">{profile.email}</p>
            <p className="account-since">Зареєстровано {formatDate(profile.created_at)}</p>
          </div>
        </div>

        {/* Stats */}
        <div className="account-stats">
          <div className="account-stat">
            <span className="account-stat-value">{profile.deck_count}</span>
            <span className="account-stat-label">Колод</span>
          </div>
          <div className="account-stat">
            <span className="account-stat-value">{profile.card_count}</span>
            <span className="account-stat-label">Карток</span>
          </div>
          <div className="account-stat">
            <span className="account-stat-value">{profile.folder_count}</span>
            <span className="account-stat-label">Папок</span>
          </div>
        </div>

        <div className="divider" />

        {/* Change password */}
        <h2 className="section-title" style={{ fontSize: '1.125rem', marginBottom: '1.25rem' }}>
          🔐 Змінити пароль
        </h2>

        <form onSubmit={handleChangePassword} style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
          <div className="field">
            <input
              id="current-password"
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder=" "
              required
              autoComplete="current-password"
            />
            <label htmlFor="current-password">Поточний пароль</label>
          </div>

          <div className="field">
            <input
              id="new-password"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder=" "
              required
              autoComplete="new-password"
            />
            <label htmlFor="new-password">Новий пароль</label>
          </div>

          <div className="field">
            <input
              id="confirm-password"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder=" "
              required
              autoComplete="new-password"
            />
            <label htmlFor="confirm-password">Підтвердіть новий пароль</label>
          </div>

          <button
            type="submit"
            className="btn-primary"
            disabled={changingPassword || !currentPassword || !newPassword || !confirmPassword}
          >
            {changingPassword ? <span className="spinner" /> : null}
            {changingPassword ? 'Зберігаємо...' : 'Змінити пароль'}
          </button>
        </form>
      </div>
    </>
  )
}
