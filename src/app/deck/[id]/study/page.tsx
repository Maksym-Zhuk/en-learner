'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import FlipCard from '@/components/FlipCard'
import { useToast } from '@/components/ToastProvider'
import { Card } from '@/lib/types'

type BackMode = 'ua' | 'def'

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export default function StudyPage() {
  const router = useRouter()
  const params = useParams()
  const deckId = params.id as string
  const { showToast } = useToast()

  const [cards, setCards] = useState<Card[]>([])
  const [queue, setQueue] = useState<Card[]>([])
  const [current, setCurrent] = useState(0)
  const [flipped, setFlipped] = useState(false)
  const [known, setKnown] = useState(0)
  const [unknown, setUnknown] = useState(0)
  const [loading, setLoading] = useState(true)
  const [done, setDone] = useState(false)
  const [deckName, setDeckName] = useState('')
  const [backMode, setBackMode] = useState<BackMode>('ua')

  useEffect(() => { fetchCards() }, [deckId])

  async function fetchCards() {
    setLoading(true)
    try {
      const [deckRes, cardsRes] = await Promise.all([fetch(`/api/decks/${deckId}`), fetch(`/api/decks/${deckId}/cards`)])
      if (deckRes.status === 401) { router.push('/login'); return }
      if (!deckRes.ok) { showToast('Колода не знайдена', 'error'); router.push('/home'); return }
      const deckData = await deckRes.json()
      setDeckName(deckData.name)
      const cardsData: Card[] = await cardsRes.json()
      if (!cardsData.length) { showToast('У колоді немає карток', 'error'); router.push(`/deck/${deckId}`); return }
      const sh = shuffle(cardsData)
      setCards(sh); setQueue(sh)
    } catch { showToast('Помилка завантаження', 'error') } finally { setLoading(false) }
  }

  function recordSession(correctCount: number, totalCount: number) {
    fetch('/api/sessions', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deck_id: deckId, mode: 'flashcards', correct: correctCount, total: totalCount }),
    }).catch(() => {})
  }

  function finishWith(k: number) {
    setDone(true)
    recordSession(k, queue.length)
  }

  function handleKnew() {
    const nk = known + 1
    setKnown(nk); setFlipped(false)
    if (current + 1 >= queue.length) finishWith(nk)
    else setCurrent((c) => c + 1)
  }
  function handleDidntKnow() {
    setUnknown((c) => c + 1); setFlipped(false)
    if (current + 1 >= queue.length) finishWith(known)
    else setCurrent((c) => c + 1)
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (done || loading) return
      if (e.code === 'Space') { e.preventDefault(); setFlipped((f) => !f) }
      else if (flipped && (e.key === '1')) handleDidntKnow()
      else if (flipped && (e.key === '2')) handleKnew()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  function restart() {
    setQueue(shuffle(cards)); setCurrent(0); setFlipped(false); setKnown(0); setUnknown(0); setDone(false)
  }

  if (loading) {
    return (
      <div className="bg-bg-base min-h-screen flex flex-col">
        <div className="flex-1 px-6 py-12 flex flex-col items-center">
          <div className="h-[22px] bg-gradient-to-r from-bg-subtle via-[rgba(16,185,129,0.1)] to-bg-subtle bg-[size:200%_100%] rounded mb-3.5 [animation:shimmer_1.4s_linear_infinite] w-1/2" style={{ maxWidth: 400 }} />
        </div>
      </div>
    )
  }

  if (done) {
    const total = known + unknown
    const score = total > 0 ? Math.round(known / total * 100) : 0
    const r = 68
    const circ = 2 * Math.PI * r
    const offset = circ * (1 - score / 100)
    return (
      <div className="bg-bg-base min-h-screen flex flex-col">
        <div className="px-6 py-[60px] text-center max-w-[600px] mx-auto">
          <div className="relative inline-flex items-center justify-center mb-6">
            <svg width="180" height="180">
              <circle cx="90" cy="90" r={r} fill="none" stroke="var(--bg-subtle)" strokeWidth="12" />
              <circle cx="90" cy="90" r={r} fill="none" stroke="var(--accent)" strokeWidth="12" strokeLinecap="round"
                strokeDasharray={circ} strokeDashoffset={offset} style={{ transition: 'stroke-dashoffset 1s ease' }} />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-[32px] font-bold text-text-primary">{score}%</span>
              <small className="text-[12px] text-text-muted">точність</small>
            </div>
          </div>
          <h2 className="text-[22px] font-semibold text-text-primary mb-2">Чудова робота!</h2>
          <p className="text-text-secondary text-[14px] mb-6">Ви пройшли всю колоду «{deckName}».</p>
          <div className="grid grid-cols-3 gap-3 mx-auto mb-7 max-w-[480px]">
            <div className="bg-bg-surface border border-bg-subtle rounded-[10px] p-3.5">
              <div className="text-[22px] font-bold text-success">{known}</div>
              <div className="text-[12px] text-text-muted mt-1">Знав</div>
            </div>
            <div className="bg-bg-surface border border-bg-subtle rounded-[10px] p-3.5">
              <div className="text-[22px] font-bold text-danger">{unknown}</div>
              <div className="text-[12px] text-text-muted mt-1">Не знав</div>
            </div>
            <div className="bg-bg-surface border border-bg-subtle rounded-[10px] p-3.5">
              <div className="text-[22px] font-bold text-text-primary">{total}</div>
              <div className="text-[12px] text-text-muted mt-1">Всього</div>
            </div>
          </div>
          <div className="flex items-center justify-center gap-3">
            <button className="inline-flex items-center justify-center gap-2 h-10 px-4 bg-transparent border border-bg-subtle text-text-primary rounded-[10px] text-[13px] font-medium cursor-pointer transition-all hover:bg-bg-elevated" onClick={() => router.push(`/deck/${deckId}`)}>До колоди</button>
            <button className="inline-flex items-center justify-center gap-2 h-10 px-4 bg-accent text-white rounded-[10px] text-[13px] font-medium cursor-pointer transition-all hover:bg-accent-hover hover:-translate-y-px" onClick={restart}><i className="ti ti-refresh" /> Ще раз</button>
          </div>
        </div>
      </div>
    )
  }

  const card = queue[current]
  const progress = (current / queue.length) * 100

  return (
    <div className="bg-bg-base min-h-screen flex flex-col">
      <div className="px-6 pt-3 pb-2 border-b border-bg-subtle">
        <div className="h-1 bg-bg-elevated rounded-full overflow-hidden">
          <span className="block h-full bg-gradient-to-r from-accent to-emerald-300 rounded-[inherit] transition-[width_400ms_ease-out]" style={{ width: `${progress}%` }} />
        </div>
        <div className="flex items-center justify-between mt-2">
          <a className="flex items-center gap-2 text-text-secondary text-[13px] cursor-pointer hover:text-text-primary transition-colors" onClick={() => router.push(`/deck/${deckId}`)}>
            <i className="ti ti-arrow-left" /> <span className="font-medium">{deckName}</span>
          </a>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div className="grid grid-cols-2 bg-bg-elevated border border-bg-subtle rounded-full p-1 relative" style={{ width: 240, marginBottom: 0 }}>
              <div className="absolute top-1 left-1 w-[calc(50%-4px)] h-[calc(100%-8px)] bg-accent rounded-full transition-transform duration-240 shadow-[0_4px_12px_rgba(16,185,129,0.4)] z-0" style={backMode === 'def' ? { transform: 'translateX(100%)' } : undefined} />
              <button type="button" className={`relative z-10 bg-transparent border-none font-[inherit] text-[13px] font-medium h-9 cursor-pointer transition-colors ${backMode === 'ua' ? 'text-white' : 'text-text-secondary'}`} onClick={() => setBackMode('ua')}>Переклад</button>
              <button type="button" className={`relative z-10 bg-transparent border-none font-[inherit] text-[13px] font-medium h-9 cursor-pointer transition-colors ${backMode === 'def' ? 'text-white' : 'text-text-secondary'}`} onClick={() => setBackMode('def')}>Пояснення</button>
            </div>
            <span className="text-text-secondary text-[13px]"><i className="ti ti-check text-success" /> {known} · {unknown}</span>
          </div>
        </div>
      </div>

      <div className="flex-1 px-6 py-12 flex flex-col items-center">
        <div className="text-[13px] text-text-muted mb-4">Картка {current + 1} з {queue.length}</div>
        <FlipCard card={card} flipped={flipped} onClick={() => setFlipped((f) => !f)} backMode={backMode} />
        <div className={`mt-8 flex gap-3 transition-[opacity_300ms,transform_300ms] ${flipped ? 'opacity-100 translate-y-0 pointer-events-auto' : 'opacity-0 translate-y-3 pointer-events-none'}`}>
          <button className="inline-flex items-center justify-center gap-2 h-10 px-4 bg-transparent border border-[rgba(239,68,68,0.3)] text-danger rounded-[10px] text-[13px] font-medium cursor-pointer transition-all hover:bg-[rgba(239,68,68,0.08)] hover:border-danger" onClick={handleDidntKnow}><i className="ti ti-x" /> Не знав</button>
          <button className="inline-flex items-center justify-center gap-2 h-10 px-4 bg-accent text-white rounded-[10px] text-[13px] font-medium cursor-pointer transition-all hover:bg-accent-hover hover:-translate-y-px" onClick={handleKnew}><i className="ti ti-check" /> Знав</button>
        </div>
      </div>
    </div>
  )
}
