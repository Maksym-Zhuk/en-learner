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
    return new Date(iso).toLocaleDateString('uk-UA', { day: 'numeric', month: 'long', year: 'numeric' })
  }

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col">
        <Navbar />
        <main className="flex-1 px-6 py-6 pb-16 max-w-[1100px] w-full mx-auto [animation:fadeIn_280ms_ease]" style={{ display: 'flex', justifyContent: 'center', paddingTop: 64 }}>
          <div className="h-[22px] bg-gradient-to-r from-bg-subtle via-[rgba(16,185,129,0.1)] to-bg-subtle bg-[size:200%_100%] rounded mb-3.5 [animation:shimmer_1.4s_linear_infinite] w-1/2" style={{ maxWidth: 300 }} />
        </main>
      </div>
    )
  }

  if (!profile) return null

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1 px-6 py-6 pb-16 w-full mx-auto [animation:fadeIn_280ms_ease]" style={{ maxWidth: 680 }}>
        <div className="flex items-center justify-between my-6 mb-4">
          <div>
            <h1 className="text-[24px] font-semibold text-text-primary">Мій акаунт</h1>
            <p className="text-text-secondary text-[13px] mt-1">Зареєстровано {formatDate(profile.created_at)}</p>
          </div>
          <div className="inline-flex items-center justify-center w-9 h-9 rounded-full bg-gradient-to-br from-accent to-teal-500 text-white font-semibold text-[13px]">{profile.email[0].toUpperCase()}</div>
        </div>

        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="bg-bg-surface border border-bg-subtle rounded-[10px] px-4 py-3.5">
            <div className="text-[11px] text-text-muted uppercase tracking-[0.08em] mb-1"><i className="ti ti-stack-2" /> Колоди</div>
            <div className="text-[28px] font-semibold text-text-primary">{profile.deck_count}</div>
          </div>
          <div className="bg-bg-surface border border-bg-subtle rounded-[10px] px-4 py-3.5">
            <div className="text-[11px] text-text-muted uppercase tracking-[0.08em] mb-1"><i className="ti ti-cards" /> Картки</div>
            <div className="text-[28px] font-semibold text-text-primary">{profile.card_count}</div>
          </div>
          <div className="bg-bg-surface border border-bg-subtle rounded-[10px] px-4 py-3.5">
            <div className="text-[11px] text-text-muted uppercase tracking-[0.08em] mb-1"><i className="ti ti-folder" /> Папки</div>
            <div className="text-[28px] font-semibold text-text-primary">{profile.folder_count}</div>
          </div>
        </div>

        <div className="flex items-center justify-between my-6 mb-4">
          <h2 className="text-[18px] font-medium m-0">Змінити пароль</h2>
        </div>

        <div className="mb-6">
          <form onSubmit={handleChangePassword}>
            <div className="relative mb-4">
              <input className="w-full h-[52px] bg-bg-elevated border border-bg-subtle rounded-[10px] text-text-primary text-[15px] px-4 pt-[18px] pb-1.5 pl-11 outline-none transition-all focus:border-accent placeholder-transparent peer" type="password" value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)} placeholder=" " required
                autoComplete="current-password" />
              <label className="absolute left-11 top-4 text-text-muted text-[15px] pointer-events-none transition-all peer-focus:top-[7px] peer-focus:text-[11px] peer-focus:text-accent peer-[:not(:placeholder-shown)]:top-[7px] peer-[:not(:placeholder-shown)]:text-[11px] peer-[:not(:placeholder-shown)]:text-accent">Поточний пароль</label>
              <i className="ti ti-lock absolute left-4 top-1/2 -translate-y-1/2 text-text-muted text-lg pointer-events-none transition-colors peer-focus:text-accent" />
            </div>
            <div className="relative mb-4">
              <input className="w-full h-[52px] bg-bg-elevated border border-bg-subtle rounded-[10px] text-text-primary text-[15px] px-4 pt-[18px] pb-1.5 pl-11 outline-none transition-all focus:border-accent placeholder-transparent peer" type="password" value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)} placeholder=" " required
                autoComplete="new-password" />
              <label className="absolute left-11 top-4 text-text-muted text-[15px] pointer-events-none transition-all peer-focus:top-[7px] peer-focus:text-[11px] peer-focus:text-accent peer-[:not(:placeholder-shown)]:top-[7px] peer-[:not(:placeholder-shown)]:text-[11px] peer-[:not(:placeholder-shown)]:text-accent">Новий пароль</label>
              <i className="ti ti-lock absolute left-4 top-1/2 -translate-y-1/2 text-text-muted text-lg pointer-events-none transition-colors peer-focus:text-accent" />
            </div>
            <div className="relative mb-4">
              <input className="w-full h-[52px] bg-bg-elevated border border-bg-subtle rounded-[10px] text-text-primary text-[15px] px-4 pt-[18px] pb-1.5 pl-11 outline-none transition-all focus:border-accent placeholder-transparent peer" type="password" value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)} placeholder=" " required
                autoComplete="new-password" />
              <label className="absolute left-11 top-4 text-text-muted text-[15px] pointer-events-none transition-all peer-focus:top-[7px] peer-focus:text-[11px] peer-focus:text-accent peer-[:not(:placeholder-shown)]:top-[7px] peer-[:not(:placeholder-shown)]:text-[11px] peer-[:not(:placeholder-shown)]:text-accent">Підтвердіть новий пароль</label>
              <i className="ti ti-lock absolute left-4 top-1/2 -translate-y-1/2 text-text-muted text-lg pointer-events-none transition-colors peer-focus:text-accent" />
            </div>
            <button type="submit" className="inline-flex items-center justify-center gap-2 h-10 px-4 bg-accent text-white rounded-[10px] text-[13px] font-medium cursor-pointer transition-all hover:bg-accent-hover hover:-translate-y-px"
              disabled={changingPassword || !currentPassword || !newPassword || !confirmPassword}>
              {changingPassword ? 'Зберігаємо…' : 'Змінити пароль'}
            </button>
          </form>
        </div>
      </main>
    </div>
  )
}
