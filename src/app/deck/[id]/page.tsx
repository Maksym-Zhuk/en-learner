'use client'

import { useState, useEffect, useRef, FormEvent } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import Navbar from '@/components/Navbar'
import { useToast } from '@/components/ToastProvider'
import ShareToGroupModal from '@/components/ShareToGroupModal'
import { Card, DeckWithCount } from '@/lib/types'
import { useLocale } from '@/lib/i18n'

const DECK_EMOJIS = ['📘', '📗', '📙', '📕', '📓', '🗂️', '🎯', '🧠', '✏️', '📝', '🔤', '💬', '🌍', '🎓', '🚀', '⭐', '🔥', '💡', '📚', '🎪']

const BTN = 'inline-flex items-center justify-center gap-2 h-10 px-4 rounded-md text-[13px] font-medium border border-transparent cursor-pointer transition duration-200 whitespace-nowrap select-none'
const BTN_PRIMARY = `${BTN} bg-accent text-white hover:bg-accent-hover shadow-[0_1px_0_rgba(255,255,255,0.08)_inset,0_1px_3px_rgba(0,0,0,0.3)] disabled:opacity-50 disabled:cursor-not-allowed`
const BTN_GHOST = `${BTN} border-bg-subtle text-text-primary hover:bg-bg-elevated`
const BTN_ICON = 'inline-flex items-center justify-center w-10 h-10 rounded-md bg-bg-elevated text-text-secondary cursor-pointer transition duration-200 hover:text-text-primary hover:bg-bg-subtle border border-transparent'

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
  const { t } = useLocale()

  const [deck, setDeck] = useState<(DeckWithCount & { readonly?: boolean }) | null>(null)
  const [cards, setCards] = useState<Card[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<Card | null>(null)
  const [shareOpen, setShareOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)

  useEffect(() => { fetchData() }, [deckId])

  async function fetchData() {
    setLoading(true)
    try {
      const [deckRes, cardsRes] = await Promise.all([
        fetch(`/api/decks/${deckId}`),
        fetch(`/api/decks/${deckId}/cards`),
      ])
      if (deckRes.status === 401 || cardsRes.status === 401) { router.push('/login'); return }
      if (!deckRes.ok) { showToast(t('deck.deckNotFound'), 'error'); router.push('/home'); return }
      setDeck(await deckRes.json())
      setCards(await cardsRes.json())
    } catch {
      showToast(t('deck.loadError'), 'error')
    } finally {
      setLoading(false)
    }
  }

  async function handleDeleteCard(id: string) {
    try {
      const res = await fetch(`/api/cards/${id}`, { method: 'DELETE' })
      if (!res.ok) { showToast(t('common.deleteError'), 'error'); return }
      setCards((p) => p.filter((c) => c.id !== id))
      setDeck((p) => p ? { ...p, card_count: p.card_count - 1 } : p)
      showToast(t('deck.cardDeleted'), 'info')
    } catch { showToast(t('common.networkError'), 'error') }
  }

  async function handleShare() {
    if (!deck) return
    try {
      if (deck.share_token) {
        await navigator.clipboard.writeText(`${window.location.origin}/s/${deck.share_token}`)
        showToast(t('deck.linkCopied'), 'success')
      } else {
        const res = await fetch(`/api/decks/${deckId}/share`, { method: 'POST' })
        const data = await res.json()
        if (!res.ok) { showToast(data.error || t('common.error'), 'error'); return }
        setDeck((p) => p ? { ...p, share_token: data.share_token } : p)
        await navigator.clipboard.writeText(`${window.location.origin}/s/${data.share_token}`)
        showToast(t('deck.linkCreated'), 'success')
      }
    } catch { showToast(t('common.networkError'), 'error') }
  }

  async function handleDeleteDeck() {
    if (!deck || !confirm(t('deck.confirmDeleteDeck', { name: deck.name }))) return
    try {
      const res = await fetch(`/api/decks/${deckId}`, { method: 'DELETE' })
      if (!res.ok) { showToast(t('common.deleteError'), 'error'); return }
      showToast(t('deck.deckDeleted', { name: deck.name }), 'info')
      router.push('/home')
    } catch { showToast(t('common.networkError'), 'error') }
  }

  async function handlePatchDeck(patch: { name?: string; emoji?: string }): Promise<boolean> {
    try {
      const res = await fetch(`/api/decks/${deckId}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      })
      const data = await res.json()
      if (!res.ok) { showToast(data.error || t('common.error'), 'error'); return false }
      setDeck((p) => p ? { ...p, ...data } : p)
      showToast(t('deck.saved'), 'success')
      return true
    } catch { showToast(t('common.networkError'), 'error'); return false }
  }

  async function handleUnshare() {
    if (!deck?.share_token) return
    if (!confirm(t('deck.confirmCloseAccess'))) return
    try {
      await fetch(`/api/decks/${deckId}/share`, { method: 'DELETE' })
      setDeck((p) => p ? { ...p, share_token: null } : p)
      showToast(t('deck.accessClosed'), 'info')
    } catch { showToast(t('common.networkError'), 'error') }
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
    { mode: 'study', cls: '', icon: 'ti-cards', title: t('deck.modeCards'), desc: t('deck.modeCardsDesc') },
    { mode: 'quiz/multiple', cls: 'success', icon: 'ti-list-check', title: t('deck.modeChoice'), desc: t('deck.modeChoiceDesc') },
    { mode: 'quiz/write', cls: 'warn', icon: 'ti-pencil', title: t('deck.modeWrite'), desc: t('deck.modeWriteDesc') },
    { mode: 'quiz/match', cls: 'danger', icon: 'ti-arrows-shuffle', title: t('deck.modePairs'), desc: t('deck.modePairsDesc') },
  ]

  return (
    <div className="flex flex-col min-h-screen">
      <Navbar />
      <main className="max-w-[1100px] flex-1 w-full mx-auto px-6 pt-6 pb-16">
        <div className="flex items-center gap-2 text-text-secondary text-[13px] mb-5">
          <Link href="/home" className="hover:text-text-primary inline-flex items-center gap-1"><i className="ti ti-home" /> {t('deck.myDecks')}</Link>
          <i className="ti ti-chevron-right" />
          <span className="text-text-primary">{deck.name}</span>
        </div>

        <div className="bg-bg-surface border border-bg-subtle rounded-lg flex items-start gap-5 mb-6 p-6 relative overflow-hidden max-sm:flex-col">
          <div className="text-[44px] leading-none select-none">{deck.emoji || '📘'}</div>
          <div className="flex-1">
            <h1 className="text-[28px] font-semibold m-0 tracking-[-0.01em]">{deck.name}</h1>
            <div className="text-text-secondary text-[13px] mt-1">{cards.length} {t('common.words')}</div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {!deck.readonly && (
              <>
                <button className={BTN_ICON} onClick={() => setShareOpen(true)} title={t('deck.addToGroup')}><i className="ti ti-users-group" /></button>
                <button className={BTN_ICON} onClick={handleShare} title={deck.share_token ? t('deck.copyLink') : t('deck.share')}>
                  <i className="ti ti-share" />
                </button>
                {deck.share_token && (
                  <button className={BTN_ICON} onClick={handleUnshare} title={t('deck.closeAccess')}><i className="ti ti-lock" /></button>
                )}
                <button className={BTN_ICON} onClick={() => setSettingsOpen(true)} title={t('deck.settings')}>
                  <i className="ti ti-settings" />
                </button>
              </>
            )}
            {cards.length > 0 && (
              <button className={BTN_PRIMARY} onClick={() => router.push(`/deck/${deckId}/study`)}>
                <i className="ti ti-player-play" /> {t('deck.study')}
              </button>
            )}
          </div>
        </div>

        {cards.length > 0 && (
          <>
            <div className="flex justify-between items-center my-4"><h2 className="text-lg font-medium m-0">{t('deck.studyModes')}</h2></div>
            <div className="grid grid-cols-4 gap-3 mb-7 max-md:grid-cols-2 max-sm:grid-cols-1">
              {modes.map((m) => {
                const disabled = m.mode === 'quiz/multiple' && cards.length < 4
                return (
                  <button key={m.mode}
                    className={`group/tile bg-bg-surface border border-bg-subtle rounded-md cursor-pointer transition duration-200 text-left flex flex-col gap-2.5 p-[18px] relative overflow-hidden hover:-translate-y-0.5 hover:border-accent hover:shadow-[0_4px_16px_rgba(0,0,0,0.4)] ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                    onClick={() => { if (disabled) { showToast(t('deck.needMin4'), 'error'); return } router.push(`/deck/${deckId}/${m.mode}`) }}>
                    <div className={`inline-flex items-center justify-center w-9 h-9 rounded-sm ${MODE_ICON_BG[m.cls]}`}><i className={`ti ${m.icon} text-xl`} /></div>
                    <div className="text-[15px] font-medium text-text-primary">{m.title}</div>
                    <div className="text-text-secondary text-[11px] leading-relaxed">{m.desc}</div>
                    <i className="ti ti-arrow-right absolute bottom-3.5 right-3.5 text-text-muted opacity-0 transition duration-200 group-hover/tile:opacity-100 group-hover/tile:text-accent" />
                  </button>
                )
              })}
            </div>
          </>
        )}

        <div className="flex justify-between items-center my-4">
          <h2 className="text-lg font-medium m-0">{t('deck.wordsSection')} <span className="text-text-muted font-normal">· {cards.length}</span></h2>
          {!deck.readonly && (
            <div className="flex gap-2">
              <button className={BTN_GHOST} onClick={() => router.push(`/lookup?deckId=${deckId}`)}><i className="ti ti-plus" /> {t('deck.addWord')}</button>
            </div>
          )}
        </div>

        {cards.length === 0 ? (
          <div className="bg-bg-surface border border-dashed border-bg-subtle rounded-lg text-center py-12 px-6">
            <div className="text-[40px] mb-2">🃏</div>
            <h3 className="text-lg font-medium m-0">{t('deck.noCardsTitle')}</h3>
            {!deck.readonly && (
              <>
                <p className="text-text-secondary text-[13px] mt-1 mb-4">{t('deck.noCardsDesc')}</p>
                <button className={`${BTN_PRIMARY} mx-auto`} onClick={() => router.push(`/lookup?deckId=${deckId}`)}><i className="ti ti-search" /> {t('deck.findWords')}</button>
              </>
            )}
          </div>
        ) : (
          <div className="bg-bg-surface border border-bg-subtle rounded-md overflow-hidden">
            <div className="overflow-x-auto">
            <table className="w-full border-collapse text-[13px]">
              <thead>
                <tr className="text-left text-text-muted text-[11px] uppercase tracking-wide">
                  <th className="py-3 px-4 font-medium">{t('deck.colEnglish')}</th>
                  <th className="py-3 px-4 font-medium">{t('deck.colUkrainian')}</th>
                  <th className="py-3 px-4 font-medium max-md:hidden">{t('deck.colDefinition')}</th>
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
                          <button className="inline-flex items-center justify-center w-9 h-9 rounded-md text-text-muted hover:text-text-primary hover:bg-bg-subtle transition" onClick={() => setEditing(c)} title={t('common.edit')}><i className="ti ti-pencil text-sm" /></button>
                          <button className="inline-flex items-center justify-center w-9 h-9 rounded-md text-text-muted hover:text-danger hover:bg-bg-subtle transition" onClick={() => handleDeleteCard(c.id)} title={t('common.delete')}><i className="ti ti-trash text-sm" /></button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </div>
        )}
      </main>

      {!deck.readonly && (
        <button className="fixed bottom-7 right-7 z-40 inline-flex items-center justify-center w-14 h-14 rounded-full bg-accent text-white border-0 cursor-pointer transition duration-200 hover:bg-accent-hover hover:scale-105 shadow-[0_12px_32px_rgba(16,185,129,0.45),inset_0_0_0_1px_rgba(255,255,255,0.08)]" onClick={() => router.push(`/lookup?deckId=${deckId}`)} title={t('nav.findWord')}><i className="ti ti-search text-xl" /></button>
      )}

      <ShareToGroupModal open={shareOpen} onClose={() => setShareOpen(false)} kind="deck" id={deckId} name={deck.name} />

      {settingsOpen && !deck.readonly && (
        <DeckSettingsModal
          deck={deck}
          onClose={() => setSettingsOpen(false)}
          onPatch={handlePatchDeck}
          onDelete={handleDeleteDeck}
        />
      )}

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

function DeckSettingsModal({
  deck, onClose, onPatch, onDelete,
}: {
  deck: DeckWithCount & { readonly?: boolean }
  onClose: () => void
  onPatch: (patch: { name?: string; emoji?: string }) => Promise<boolean>
  onDelete: () => Promise<void>
}) {
  const [name, setName] = useState(deck.name)
  const [selectedEmoji, setSelectedEmoji] = useState(deck.emoji || '📘')
  const [saving, setSaving] = useState(false)
  const { t } = useLocale()
  const settingsModalRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  useEffect(() => {
    const el = settingsModalRef.current?.querySelector<HTMLElement>('button, input, [tabindex]:not([tabindex="-1"])')
    el?.focus()
  }, [])

  async function handleSave(e: FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    setSaving(true)
    const ok = await onPatch({ name: name.trim(), emoji: selectedEmoji })
    setSaving(false)
    if (ok) onClose()
  }

  return (
    <div className="fixed inset-0 bg-[rgba(15,17,23,0.65)] backdrop-blur-[8px] flex items-start justify-center pt-4 sm:pt-20 px-6 pb-6 z-[100] [animation:fadeIn_200ms_ease-out]" onClick={onClose}>
      <div ref={settingsModalRef} role="dialog" aria-modal="true" aria-labelledby="settings-modal-title" className="relative w-full max-w-[480px] bg-bg-surface border border-bg-subtle rounded-[24px] shadow-[0_12px_40px_rgba(0,0,0,0.5)] overflow-hidden [animation:scaleIn_280ms_ease]" onClick={(e) => e.stopPropagation()}>
        <div className="px-5 py-4 border-b border-bg-subtle flex items-center gap-3">
          <i className="ti ti-settings text-text-muted text-lg" />
          <span id="settings-modal-title" className="flex-1 text-text-primary text-[18px] font-medium">{t('deck.deckSettings')}</span>
          <button className="bg-transparent border-none text-text-muted cursor-pointer p-1 rounded-[6px] hover:text-text-primary hover:bg-bg-elevated" onClick={onClose}><i className="ti ti-x" /></button>
        </div>
        <form className="p-5" onSubmit={handleSave}>
          <div className="mb-4">
            <label className="block text-[11px] text-text-secondary mb-1.5 font-medium">{t('deck.deckName')}</label>
            <input
              className="w-full h-11 bg-bg-base border border-bg-subtle rounded-md text-text-primary text-[14px] px-3 outline-none transition duration-200 focus:border-accent focus:shadow-[0_0_0_3px_rgba(16,185,129,0.15)]"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={80}
              autoFocus
            />
          </div>
          <div className="mb-6">
            <label className="block text-[11px] text-text-secondary mb-2 font-medium">{t('deck.icon')}</label>
            <div className="flex flex-wrap gap-2">
              {DECK_EMOJIS.map((em) => (
                <button
                  key={em}
                  type="button"
                  className={`w-10 h-10 rounded-md text-[20px] flex items-center justify-center transition duration-150 border-2 ${selectedEmoji === em ? 'border-accent bg-[rgba(16,185,129,0.15)]' : 'border-transparent bg-bg-elevated hover:bg-bg-subtle'}`}
                  onClick={() => setSelectedEmoji(em)}
                >
                  {em}
                </button>
              ))}
            </div>
          </div>
          <div className="flex justify-between items-center pt-4 border-t border-bg-subtle">
            <button
              type="button"
              className="inline-flex items-center gap-2 h-9 px-3 rounded-md text-[13px] font-medium text-danger border border-transparent hover:bg-[rgba(239,68,68,0.1)] cursor-pointer transition"
              onClick={onDelete}
            >
              <i className="ti ti-trash text-sm" /> {t('deck.deleteDeck')}
            </button>
            <div className="flex gap-2">
              <button type="button" className={BTN_GHOST} onClick={onClose}>{t('common.cancel')}</button>
              <button type="submit" className={BTN_PRIMARY} disabled={!name.trim() || saving}>{saving ? t('common.saving') : t('common.save')}</button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}

function EditWordModal({ card, onClose, onSaved }: { card: Card; onClose: () => void; onSaved: (c: Card) => void }) {
  const { showToast } = useToast()
  const { t } = useLocale()
  const [form, setForm] = useState({
    word: card.word, definition_en: card.definition_en, example_en: card.example_en,
    translation_uk: card.translation_uk, example_uk: card.example_uk,
  })
  const [saving, setSaving] = useState(false)
  const cardModalRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  useEffect(() => {
    const el = cardModalRef.current?.querySelector<HTMLElement>('button, input, [tabindex]:not([tabindex="-1"])')
    el?.focus()
  }, [])

  async function handleSave(e: FormEvent) {
    e.preventDefault()
    if (!form.word.trim() || !form.definition_en.trim() || !form.translation_uk.trim()) {
      showToast(t('deck.requiredFields'), 'error'); return
    }
    setSaving(true)
    try {
      const res = await fetch(`/api/cards/${card.id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) { showToast(data.error || t('deck.savingError'), 'error'); return }
      showToast(t('deck.cardUpdated'), 'success')
      onSaved(data)
    } catch { showToast(t('common.networkError'), 'error') } finally { setSaving(false) }
  }

  const fieldCls = 'w-full h-11 bg-bg-base border border-bg-subtle rounded-md text-text-primary text-[14px] px-3 outline-none transition duration-200 focus:border-accent focus:shadow-[0_0_0_3px_rgba(16,185,129,0.15)]'
  const labelCls = 'block text-[11px] text-text-secondary mb-1.5 font-medium'

  return (
    <div className="fixed inset-0 bg-[rgba(15,17,23,0.65)] backdrop-blur-[8px] flex items-start justify-center pt-4 sm:pt-20 px-6 pb-6 z-[100] [animation:fadeIn_200ms_ease-out]" onClick={onClose}>
      <div ref={cardModalRef} role="dialog" aria-modal="true" aria-labelledby="card-modal-title" className="relative w-full max-w-[600px] bg-bg-surface border border-bg-subtle rounded-[24px] shadow-[0_12px_40px_rgba(0,0,0,0.5)] overflow-hidden [animation:scaleIn_280ms_ease]" onClick={(e) => e.stopPropagation()}>
        <div className="px-5 py-4 border-b border-bg-subtle flex items-center gap-3">
          <i className="ti ti-pencil text-text-muted text-lg" />
          <span id="card-modal-title" className="flex-1 text-text-primary text-[18px] font-medium">{t('deck.editCard')}</span>
          <button className="bg-transparent border-none text-text-muted cursor-pointer p-1 rounded-[6px] hover:text-text-primary hover:bg-bg-elevated" onClick={onClose}><i className="ti ti-x" /></button>
        </div>
        <form className="p-5" onSubmit={handleSave}>
          <div className="grid grid-cols-2 gap-3 mb-3 max-sm:grid-cols-1">
            <div><label className={labelCls}>{t('deck.wordEN')}</label><input className={fieldCls} value={form.word} onChange={(e) => setForm({ ...form, word: e.target.value })} /></div>
            <div><label className={labelCls}>{t('deck.translationUA')}</label><input className={fieldCls} value={form.translation_uk} onChange={(e) => setForm({ ...form, translation_uk: e.target.value })} /></div>
          </div>
          <div className="mb-3"><label className={labelCls}>{t('deck.definitionEN')}</label><input className={fieldCls} value={form.definition_en} onChange={(e) => setForm({ ...form, definition_en: e.target.value })} /></div>
          <div className="grid grid-cols-2 gap-3 max-sm:grid-cols-1">
            <div><label className={labelCls}>{t('deck.exampleEN')}</label><input className={fieldCls} value={form.example_en} onChange={(e) => setForm({ ...form, example_en: e.target.value })} /></div>
            <div><label className={labelCls}>{t('deck.exampleUA')}</label><input className={fieldCls} value={form.example_uk} onChange={(e) => setForm({ ...form, example_uk: e.target.value })} /></div>
          </div>
          <div className="flex justify-end gap-2 mt-5">
            <button type="button" className={BTN_GHOST} onClick={onClose}>{t('common.cancel')}</button>
            <button type="submit" className={BTN_PRIMARY} disabled={saving}>{saving ? t('common.saving') : t('common.save')}</button>
          </div>
        </form>
      </div>
    </div>
  )
}
