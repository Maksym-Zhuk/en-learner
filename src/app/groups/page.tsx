'use client'

import { useState, useEffect, FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import Navbar from '@/components/Navbar'
import { useToast } from '@/components/ToastProvider'

interface Group {
  id: string
  name: string
  emoji: string
  description: string
  member_count: number
  shared_count: number
  is_owner: boolean
}

const EMOJIS = ['👥', '🚀', '📚', '🎯', '🏆', '💼', '🌍', '🧠']

export default function GroupsPage() {
  const router = useRouter()
  const { showToast } = useToast()
  const [groups, setGroups] = useState<Group[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState({ name: '', emoji: '👥', description: '' })

  useEffect(() => {
    fetch('/api/groups')
      .then(async (res) => {
        if (res.status === 401) { router.push('/login'); return }
        setGroups(await res.json())
      })
      .catch(() => showToast('Помилка завантаження', 'error'))
      .finally(() => setLoading(false))
  }, [])

  async function handleCreate(e: FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) return
    try {
      const res = await fetch('/api/groups', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) { showToast(data.error || 'Помилка', 'error'); return }
      setGroups((p) => [data, ...p])
      setForm({ name: '', emoji: '👥', description: '' })
      setCreating(false)
      showToast(`Групу "${data.name}" створено!`, 'success')
    } catch { showToast('Помилка мережі', 'error') }
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1 px-6 py-6 pb-16 max-w-[1100px] w-full mx-auto [animation:fadeIn_280ms_ease]">
        <div className="flex items-end justify-between mb-7 gap-4">
          <div>
            <h1 className="m-0 text-[28px] font-semibold tracking-[-0.01em]">Групи</h1>
            <p className="mt-1 text-text-secondary text-[13px]">Спільне навчання — діліться колодами й папками з іншими.</p>
          </div>
          <button className="inline-flex items-center justify-center gap-2 h-10 px-4 bg-accent text-white rounded-[10px] text-[13px] font-medium cursor-pointer transition-all hover:bg-accent-hover hover:-translate-y-px" onClick={() => setCreating((v) => !v)}>
            <i className="ti ti-plus" /> Створити групу
          </button>
        </div>

        {creating && (
          <form onSubmit={handleCreate} className="bg-bg-surface border border-bg-subtle rounded-[10px] px-5 py-[18px] mb-4">
            <div className="grid grid-cols-8 gap-1.5 mb-4">
              {EMOJIS.map((em) => (
                <button type="button" key={em}
                  className={`appearance-none border rounded-[6px] h-10 text-[22px] cursor-pointer transition-all hover:bg-bg-subtle hover:-translate-y-px ${form.emoji === em ? 'bg-[rgba(16,185,129,0.15)] border-accent shadow-[0_0_0_1px_theme(colors.accent)]' : 'bg-bg-elevated border-bg-subtle'}`}
                  onClick={() => setForm({ ...form, emoji: em })}>{em}</button>
              ))}
            </div>
            <div className="relative mb-4">
              <input className="w-full h-[52px] bg-bg-elevated border border-bg-subtle rounded-[10px] text-text-primary text-[15px] px-4 outline-none transition-all focus:border-accent placeholder-transparent peer"
                placeholder=" " value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} autoFocus />
              <label className="absolute left-4 top-4 text-text-muted text-[15px] pointer-events-none transition-all peer-focus:top-[7px] peer-focus:text-[11px] peer-focus:text-accent peer-[:not(:placeholder-shown)]:top-[7px] peer-[:not(:placeholder-shown)]:text-[11px] peer-[:not(:placeholder-shown)]:text-accent">Назва групи</label>
            </div>
            <div className="relative mb-4">
              <input className="w-full h-[52px] bg-bg-elevated border border-bg-subtle rounded-[10px] text-text-primary text-[15px] px-4 outline-none transition-all focus:border-accent placeholder-transparent peer"
                placeholder=" " value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
              <label className="absolute left-4 top-4 text-text-muted text-[15px] pointer-events-none transition-all peer-focus:top-[7px] peer-focus:text-[11px] peer-focus:text-accent peer-[:not(:placeholder-shown)]:top-[7px] peer-[:not(:placeholder-shown)]:text-[11px] peer-[:not(:placeholder-shown)]:text-accent">Опис (необов&apos;язково)</label>
            </div>
            <div className="flex items-center justify-between gap-3 pt-4 mt-4 border-t border-bg-subtle">
              <button type="button" className="inline-flex items-center justify-center gap-2 h-10 px-4 bg-transparent border border-bg-subtle text-text-primary rounded-[10px] text-[13px] font-medium cursor-pointer transition-all hover:bg-bg-elevated" onClick={() => setCreating(false)}>Скасувати</button>
              <button type="submit" className="inline-flex items-center justify-center gap-2 h-10 px-4 bg-accent text-white rounded-[10px] text-[13px] font-medium cursor-pointer transition-all hover:bg-accent-hover disabled:opacity-60 disabled:cursor-not-allowed" disabled={!form.name.trim()}>Створити</button>
            </div>
          </form>
        )}

        {loading ? (
          <div className="bg-bg-surface border border-bg-subtle rounded-[10px] px-5 py-[18px] mb-4">
            <div className="h-[22px] bg-gradient-to-r from-bg-subtle via-[rgba(16,185,129,0.1)] to-bg-subtle bg-[size:200%_100%] rounded mb-3.5 [animation:shimmer_1.4s_linear_infinite] w-1/2" />
            <div className="h-3 bg-gradient-to-r from-bg-subtle via-[rgba(16,185,129,0.1)] to-bg-subtle bg-[size:200%_100%] rounded mb-2 [animation:shimmer_1.4s_linear_infinite] w-[90%]" />
          </div>
        ) : groups.length === 0 ? (
          <div className="bg-bg-surface border border-dashed border-bg-subtle rounded-[16px] px-6 py-12 text-center">
            <div className="text-[40px] mb-2">👥</div>
            <h3 className="m-0 mb-1.5 text-[18px] font-medium">Груп ще немає</h3>
            <p className="m-0 mb-5 text-text-secondary text-[13px]">Створіть групу, щоб ділитися колодами й навчатися разом.</p>
            <button className="inline-flex items-center justify-center gap-2 h-10 px-4 bg-accent text-white rounded-[10px] text-[13px] font-medium cursor-pointer transition-all hover:bg-accent-hover" onClick={() => setCreating(true)}><i className="ti ti-plus" /> Створити групу</button>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4 max-md:grid-cols-1">
            {groups.map((g) => (
              <article key={g.id} className="bg-bg-surface border border-bg-subtle rounded-[10px] p-5 cursor-pointer transition-all flex flex-col gap-3 no-underline text-inherit hover:-translate-y-[3px] hover:border-accent hover:shadow-[0_4px_16px_rgba(0,0,0,0.4)]" onClick={() => router.push(`/group/${g.id}`)}>
                <div className="flex items-center gap-3.5">
                  <div className="w-12 h-12 rounded-[10px] bg-bg-elevated inline-flex items-center justify-center text-2xl shrink-0">{g.emoji}</div>
                  <div>
                    <h3 className="m-0 text-[18px] font-medium tracking-[-0.005em]">{g.name}</h3>
                    <div className="text-text-muted text-[11px] mt-0.5">{g.member_count} учасників{g.is_owner ? ' · ви власник' : ''}</div>
                  </div>
                </div>
                {g.description && <p className="text-text-secondary text-[13px] m-0 leading-relaxed">{g.description}</p>}
                <div className="flex items-center justify-between pt-3 border-t border-bg-subtle">
                  <span className="text-text-muted text-[11px] inline-flex items-center gap-1"><i className="ti ti-stack-2 text-[13px]" /> {g.shared_count} спільних</span>
                  <span className="text-accent text-[11px] inline-flex items-center gap-1.5"><i className="ti ti-arrow-right text-[13px]" /> Відкрити</span>
                </div>
              </article>
            ))}
            <article className="bg-bg-surface border border-dashed border-bg-subtle rounded-[10px] p-5 cursor-pointer transition-all flex flex-col items-center justify-center gap-3 text-center hover:border-accent hover:bg-bg-surface" onClick={() => setCreating(true)}>
              <div className="w-12 h-12 rounded-[10px] bg-[rgba(16,185,129,0.15)] text-accent inline-flex items-center justify-center"><i className="ti ti-plus text-[22px]" /></div>
              <h3 className="m-0 text-[15px] font-medium">Нова група</h3>
            </article>
          </div>
        )}
      </main>
    </div>
  )
}
