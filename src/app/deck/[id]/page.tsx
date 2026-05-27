'use client'

import { useState, useEffect, FormEvent } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Navbar from '@/components/Navbar'
import { useToast } from '@/components/ToastProvider'
import ShareToGroupModal from '@/components/ShareToGroupModal'
import { Card, DeckWithCount } from '@/lib/types'

const BTN = 'inline-flex items-center justify-center gap-2 h-10 px-4 rounded-md text-[13px] font-medium border border-transparent cursor-pointer transition-all duration-200 whitespace-nowrap select-none'
const BTN_PRIMARY = `${BTN} bg-accent text-white hover:bg-accent-hover shadow-[0_1px_0_rgba(255,255,255,0.08)_inset,0_1px_3px_rgba(0,0,0,0.3)] disabled:opacity-50 disabled:cursor-not-allowed`
const BTN_GHOST = `${BTN} border-bg-subtle text-text-primary hover:bg-bg-elevated`
const BTN_ICON = 'inline-flex items-center justify-center w-10 h-10 rounded-md bg-bg-elevated text-text-secondary cursor-pointer transition-all duration-200 hover:text-text-primary hover:bg-bg-subtle border border-transparent'

const MODE_ICON_BG: Record<string, string> = {
  '': 'bg-[rgba(16,185,129,0.15)] text-accent',
  success: 'bg-[rgba(34,197,94,0.15)] text-success',
  warn: 'bg-[rgba(245,158,11,0.12)] text-warning',
  danger: 'bg-[rgba(239,68,68,0.12)] text-danger',
}

export default function DeckPage() {
  const router = useRouter()
  const params = useParams()
  const deckId = params.id as string
  const { showToast } = useToast()

  const [deck, setDeck] = useState<(DeckWithCount & { readonly?: boolean }) | null>(null)
  const [cards, setCards] = useState<Card[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<Card | null>(null)
  const [shareOpen, setShareOpen] = useState(false)

  useEffect(() => { fetchData() }, [deckId])

  async function fetchData() {
    setLoading(true)
    try {
      const [deckRes, cardsRes] = await Promise.all([
        fetch(`/api/decks/${deckId}`),
        fetch(`/api/decks/${deckId}/cards`),
      ])
      if (deckRes.status === 401 || cardsRes.status === 401) { router.push('/login'); return }
      if (!deckRes.ok) { showToast('Колода не знайдена', 'error'); router.push('/home'); return }
      setDeck(await deckRes.json())
      setCards(await cardsRes.json())
    } catch {
      showToast('Помилка завантаження', 'error')
    } finally {
      setLoading(false)
    }
  }

  async function handleDeleteCard(id: string) {
    try {
      const res = await fetch(`/api/cards/${id}`, { method: 'DELETE' })
      if (!res.ok) { showToast('Помилка видалення', 'error'); return }
      setCards((p) => p.filter((c) => c.id !== id))
      setDeck((p) => p ? { ...p, card_count: p.card_count - 1 } : p)
      showToast('Картку видалено', 'info')
    } catch { showToast('Помилка мережі', 'error') }
  }

  async function handleShare() {
    if (!deck) return
    try {
      if (deck.share_token) {
        await navigator.clipboard.writeText(`${window.location.origin}/s/${deck.share_token}`)
        showToast('Посилання скопійовано!', 'success')
      } else {
        const res = await fetch(`/api/decks/${deckId}/share`, { method: 'POST' })
        const data = await res.json()
        if (!res.ok) { showToast(data.error || 'Помилка', 'error'); return }
        setDeck((p) => p ? { ...p, share_token: data.share_token } : p)
        await navigator.clipboard.writeText(`${window.location.origin}/s/${data.share_token}`)
        showToast('Посилання створено і скопійовано!', 'success')
      }
    } catch { showToast('Помилка мережі', 'error') }
  }

  async function handleUnshare() {
    if (!deck?.share_token) return
    if (!confirm('Закрити доступ до колоди?')) return
    try {
      await fetch(`/api/decks/${deckId}/share`, { method: 'DELETE' })
      setDeck((p) => p ? { ...p, share_token: null } : p)
      showToast('Доступ закрито', 'info')
    } catch { showToast('Помилка мережі', 'error') }
  }

  if (loading) {
    return (
      <div className="flex flex-col min-h-screen">
        <Navbar />
        <main className="max-w-[1100px] flex-1 w-full mx-auto px-6 pt-6 pb-16">
          <div className="h-8 w-1/2 rounded bg-bg-elevated animate-pulse mb-3" />
          <div className="h-4 w-1/3 rounded bg-bg-elevated animate-pulse" />
        </main>
      </div>
    )
  }
  if (!deck) return null

  const modes = [
    { mode: 'study', cls: '', icon: 'ti-cards', title: 'Картки', desc: 'Класичні картки з перевертанням.' },
    { mode: 'quiz/multiple', cls: 'success', icon: 'ti-list-check', title: 'Вибір', desc: 'Обери правильну відповідь із чотирьох.' },
    { mode: 'quiz/write', cls: 'warn', icon: 'ti-pencil', title: 'Написання', desc: 'Введи переклад вручну.' },
    { mode: 'quiz/match', cls: 'danger', icon: 'ti-arrows-shuffle', title: 'Пари', desc: "З'єднай слова з перекладами." },
  ]

  return (
    <div className="flex flex-col min-h-screen">
      <Navbar />
      <main className="max-w-[1100px] flex-1 w-full mx-auto px-6 pt-6 pb-16">
        <div className="flex items-center gap-2 text-text-secondary text-[13px] mb-5">
          <a className="cursor-pointer hover:text-text-primary inline-flex items-center gap-1" onClick={() => router.push('/home')}><i className="ti ti-home" /> Мої колоди</a>
          <i className="ti ti-chevron-right" />
          <span className="text-text-primary">{deck.name}</span>
        </div>

        <div className="bg-bg-surface border border-bg-subtle rounded-lg flex items-start gap-5 mb-6 p-6 relative overflow-hidden max-sm:flex-col">
          <div className="text-[40px] leading-none">📘</div>
          <div className="flex-1">
            <h1 className="text-[28px] font-semibold m-0 tracking-[-0.01em]">{deck.name}</h1>
            <div className="text-text-secondary text-[13px] mt-1">{cards.length} {cards.length === 1 ? 'слово' : 'слів'}</div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {!deck.readonly && (
              <>
                <button className={BTN_ICON} onClick={() => setShareOpen(true)} title="Додати до групи"><i className="ti ti-users-group" /></button>
                <button className={BTN_ICON} onClick={handleShare} title={deck.share_token ? 'Скопіювати посилання' : 'Поділитися'}>
                  <i className="ti ti-share" />
                </button>
                {deck.share_token && (
                  <button className={BTN_ICON} onClick={handleUnshare} title="Закрити доступ"><i className="ti ti-lock" /></button>
                )}
              </>
            )}
            {cards.length > 0 && (
              <button className={BTN_PRIMARY} onClick={() => router.push(`/deck/${deckId}/study`)}>
                <i className="ti ti-player-play" /> Вчити
              </button>
            )}
          </div>
        </div>

        {cards.length > 0 && (
          <>
            <div className="flex justify-between items-center my-4"><h2 className="text-lg font-medium m-0">Режими навчання</h2></div>
            <div className="grid grid-cols-4 gap-3 mb-7 max-md:grid-cols-2 max-sm:grid-cols-1">
              {modes.map((m) => {
                const disabled = m.mode === 'quiz/multiple' && cards.length < 4
                return (
                  <button key={m.mode}
                    className={`group/tile bg-bg-surface border border-bg-subtle rounded-md cursor-pointer transition-all duration-200 text-left flex flex-col gap-2.5 p-[18px] relative overflow-hidden hover:-translate-y-0.5 hover:border-accent hover:shadow-[0_4px_16px_rgba(0,0,0,0.4)] ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                    onClick={() => { if (disabled) { showToast('Потрібно мінімум 4 картки', 'error'); return } router.push(`/deck/${deckId}/${m.mode}`) }}>
                    <div className={`inline-flex items-center justify-center w-9 h-9 rounded-sm ${MODE_ICON_BG[m.cls]}`}><i className={`ti ${m.icon} text-xl`} /></div>
                    <div className="text-[15px] font-medium text-text-primary">{m.title}</div>
                    <div className="text-text-secondary text-[11px] leading-relaxed">{m.desc}</div>
                    <i className="ti ti-arrow-right absolute bottom-3.5 right-3.5 text-text-muted opacity-0 transition-all duration-200 group-hover/tile:opacity-100 group-hover/tile:text-accent" />
                  </button>
                )
              })}
            </div>
          </>
        )}

        <div className="flex justify-between items-center my-4">
          <h2 className="text-lg font-medium m-0">Слова <span className="text-text-muted font-normal">· {cards.length}</span></h2>
          {!deck.readonly && (
            <div className="flex gap-2">
              <button className={BTN_GHOST} onClick={() => router.push(`/lookup?deckId=${deckId}`)}><i className="ti ti-plus" /> Додати слово</button>
            </div>
          )}
        </div>

        {cards.length === 0 ? (
          <div className="bg-bg-surface border border-dashed border-bg-subtle rounded-lg text-center py-12 px-6">
            <div className="text-[40px] mb-2">🃏</div>
            <h3 className="text-lg font-medium m-0">Карток ще немає</h3>
            {!deck.readonly && (
              <>
                <p className="text-text-secondary text-[13px] mt-1 mb-4">Додайте слова через пошук визначення й перекладу.</p>
                <button className={`${BTN_PRIMARY} mx-auto`} onClick={() => router.push(`/lookup?deckId=${deckId}`)}><i className="ti ti-search" /> Знайти слова</button>
              </>
            )}
          </div>
        ) : (
          <div className="bg-bg-surface border border-bg-subtle rounded-md overflow-hidden">
            <table className="w-full border-collapse text-[13px]">
              <thead>
                <tr className="text-left text-text-muted text-[11px] uppercase tracking-wide">
                  <th className="py-3 px-4 font-medium">Англійською</th>
                  <th className="py-3 px-4 font-medium">Українською</th>
                  <th className="py-3 px-4 font-medium max-md:hidden">Визначення</th>
                  {!deck.readonly && <th className="py-3 px-4 w-20" />}
                </tr>
              </thead>
              <tbody>
                {cards.map((c) => (
                  <tr key={c.id} className="border-t border-bg-subtle hover:bg-bg-elevated/40">
                    <td className="py-2.5 px-4 font-medium text-text-primary">{c.word}</td>
                    <td className="py-2.5 px-4 text-accent">{c.translation_uk}</td>
                    <td className="py-2.5 px-4 text-text-muted text-[11px] max-md:hidden">{c.definition_en}</td>
                    {!deck.readonly && (
                      <td className="py-2.5 px-4">
                        <div className="flex gap-1 justify-end">
                          <button className="inline-flex items-center justify-center w-8 h-8 rounded-md text-text-muted hover:text-text-primary hover:bg-bg-subtle transition-all" onClick={() => setEditing(c)} title="Редагувати"><i className="ti ti-pencil text-sm" /></button>
                          <button className="inline-flex items-center justify-center w-8 h-8 rounded-md text-text-muted hover:text-danger hover:bg-bg-subtle transition-all" onClick={() => handleDeleteCard(c.id)} title="Видалити"><i className="ti ti-trash text-sm" /></button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>

      {!deck.readonly && (
        <button className="fixed bottom-7 right-7 z-40 inline-flex items-center justify-center w-14 h-14 rounded-full bg-accent text-white border-0 cursor-pointer transition-all duration-200 hover:bg-accent-hover hover:scale-105 shadow-[0_12px_32px_rgba(16,185,129,0.45),inset_0_0_0_1px_rgba(255,255,255,0.08)]" onClick={() => router.push(`/lookup?deckId=${deckId}`)} title="Знайти слово"><i className="ti ti-search text-xl" /></button>
      )}

      <ShareToGroupModal open={shareOpen} onClose={() => setShareOpen(false)} kind="deck" id={deckId} name={deck.name} />

      {editing && (
        <EditWordModal
          card={editing}
          onClose={() => setEditing(null)}
          onSaved={(updated) => { setCards((p) => p.map((c) => c.id === updated.id ? updated : c)); setEditing(null) }}
        />
      )}
    </div>
  )
}

function EditWordModal({ card, onClose, onSaved }: { card: Card; onClose: () => void; onSaved: (c: Card) => void }) {
  const { showToast } = useToast()
  const [form, setForm] = useState({
    word: card.word, definition_en: card.definition_en, example_en: card.example_en,
    translation_uk: card.translation_uk, example_uk: card.example_uk,
  })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  async function handleSave(e: FormEvent) {
    e.preventDefault()
    if (!form.word.trim() || !form.definition_en.trim() || !form.translation_uk.trim()) {
      showToast('Слово, визначення та переклад обовʼязкові', 'error'); return
    }
    setSaving(true)
    try {
      const res = await fetch(`/api/cards/${card.id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) { showToast(data.error || 'Помилка збереження', 'error'); return }
      showToast('Картку оновлено', 'success')
      onSaved(data)
    } catch { showToast('Помилка мережі', 'error') } finally { setSaving(false) }
  }

  const fieldCls = 'w-full h-11 bg-bg-base border border-bg-subtle rounded-md text-text-primary text-[14px] px-3 outline-none transition-all duration-200 focus:border-accent focus:shadow-[0_0_0_3px_rgba(16,185,129,0.15)]'
  const labelCls = 'block text-[11px] text-text-secondary mb-1.5 font-medium'

  return (
    <div className="fixed inset-0 bg-[rgba(15,17,23,0.65)] backdrop-blur-[8px] flex items-start justify-center pt-20 px-6 pb-6 z-[100] [animation:fadeIn_200ms_ease-out]" onClick={onClose}>
      <div className="relative w-full max-w-[600px] bg-bg-surface border border-bg-subtle rounded-[24px] shadow-[0_12px_40px_rgba(0,0,0,0.5)] overflow-hidden [animation:scaleIn_280ms_ease]" onClick={(e) => e.stopPropagation()}>
        <div className="px-5 py-4 border-b border-bg-subtle flex items-center gap-3">
          <i className="ti ti-pencil text-text-muted text-lg" />
          <span className="flex-1 text-text-primary text-[18px] font-medium">Редагувати картку</span>
          <button className="bg-transparent border-none text-text-muted cursor-pointer p-1 rounded-[6px] hover:text-text-primary hover:bg-bg-elevated" onClick={onClose}><i className="ti ti-x" /></button>
        </div>
        <form className="p-5" onSubmit={handleSave}>
          <div className="grid grid-cols-2 gap-3 mb-3 max-sm:grid-cols-1">
            <div><label className={labelCls}>Слово (EN)</label><input className={fieldCls} value={form.word} onChange={(e) => setForm({ ...form, word: e.target.value })} /></div>
            <div><label className={labelCls}>Переклад (UA)</label><input className={fieldCls} value={form.translation_uk} onChange={(e) => setForm({ ...form, translation_uk: e.target.value })} /></div>
          </div>
          <div className="mb-3"><label className={labelCls}>Визначення (EN)</label><input className={fieldCls} value={form.definition_en} onChange={(e) => setForm({ ...form, definition_en: e.target.value })} /></div>
          <div className="grid grid-cols-2 gap-3 max-sm:grid-cols-1">
            <div><label className={labelCls}>Приклад (EN)</label><input className={fieldCls} value={form.example_en} onChange={(e) => setForm({ ...form, example_en: e.target.value })} /></div>
            <div><label className={labelCls}>Приклад (UA)</label><input className={fieldCls} value={form.example_uk} onChange={(e) => setForm({ ...form, example_uk: e.target.value })} /></div>
          </div>
          <div className="flex justify-end gap-2 mt-5">
            <button type="button" className={BTN_GHOST} onClick={onClose}>Скасувати</button>
            <button type="submit" className={BTN_PRIMARY} disabled={saving}>{saving ? 'Збереження…' : 'Зберегти'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}
