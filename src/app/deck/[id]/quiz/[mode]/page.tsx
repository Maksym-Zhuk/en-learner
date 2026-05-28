'use client'

import { useState, useEffect, useRef, FormEvent } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { useToast } from '@/components/ToastProvider'
import { Card } from '@/lib/types'
import { useLocale } from '@/lib/i18n'

type BackMode = 'ua' | 'def'
type QuizMode = 'multiple' | 'write' | 'match'

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}
function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length
  const dp: number[][] = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)))
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      dp[i][j] = a[i - 1] === b[j - 1] ? dp[i - 1][j - 1] : 1 + Math.min(dp[i - 1][j - 1], dp[i - 1][j], dp[i][j - 1])
  return dp[m][n]
}
const norm = (s: string) => s.trim().toLowerCase()
const answerOf = (c: Card, mode: BackMode) => (mode === 'ua' ? c.translation_uk : c.definition_en)

// ─── Score ring summary ───────────────────────────────
function Summary({ correct, total, onRestart, onBack }: { correct: number; total: number; onRestart: () => void; onBack: () => void }) {
  const { t } = useLocale()
  const score = total > 0 ? Math.round(correct / total * 100) : 0
  const r = 68, circ = 2 * Math.PI * r, offset = circ * (1 - score / 100)
  return (
    <div className="px-6 py-[60px] text-center max-w-[600px] mx-auto">
      <div className="relative inline-flex items-center justify-center mb-6">
        <svg width="180" height="180">
          <circle cx="90" cy="90" r={r} fill="none" stroke="var(--bg-subtle)" strokeWidth="12" />
          <circle cx="90" cy="90" r={r} fill="none" stroke="var(--accent)" strokeWidth="12" strokeLinecap="round"
            strokeDasharray={circ} strokeDashoffset={offset} style={{ transition: 'stroke-dashoffset 1s ease' }} />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-[32px] font-bold text-text-primary">{score}%</span>
          <small className="text-[12px] text-text-muted">{t('quiz.accuracy')}</small>
        </div>
      </div>
      <h2 className="text-[22px] font-semibold text-text-primary mb-2">{t('quiz.result')}</h2>
      <p className="text-text-secondary text-[14px] mb-6">{t('quiz.resultDesc', { correct, total })}</p>
      <div className="grid grid-cols-3 gap-3 mx-auto mb-7 max-w-[480px] max-sm:grid-cols-1">
        <div className="bg-bg-surface border border-bg-subtle rounded-[10px] p-3.5">
          <div className="text-[22px] font-bold text-success">{correct}</div>
          <div className="text-[12px] text-text-muted mt-1">{t('quiz.correct')}</div>
        </div>
        <div className="bg-bg-surface border border-bg-subtle rounded-[10px] p-3.5">
          <div className="text-[22px] font-bold text-danger">{total - correct}</div>
          <div className="text-[12px] text-text-muted mt-1">{t('quiz.errors')}</div>
        </div>
        <div className="bg-bg-surface border border-bg-subtle rounded-[10px] p-3.5">
          <div className="text-[22px] font-bold text-text-primary">{total}</div>
          <div className="text-[12px] text-text-muted mt-1">{t('quiz.total')}</div>
        </div>
      </div>
      <div className="flex items-center justify-center gap-3">
        <button className="inline-flex items-center justify-center gap-2 h-10 px-4 bg-transparent border border-bg-subtle text-text-primary rounded-[10px] text-[13px] font-medium cursor-pointer transition-all hover:bg-bg-elevated" onClick={onBack}>{t('quiz.backToDeck')}</button>
        <button className="inline-flex items-center justify-center gap-2 h-10 px-4 bg-accent text-white rounded-[10px] text-[13px] font-medium cursor-pointer transition-all hover:bg-accent-hover hover:-translate-y-px" onClick={onRestart}><i className="ti ti-refresh" /> {t('quiz.retry')}</button>
      </div>
    </div>
  )
}

// ─── Multiple choice ──────────────────────────────────
function MultipleChoice({ cards, mode, onFinish }: { cards: Card[]; mode: BackMode; onFinish: (c: number, t: number) => void }) {
  const { t } = useLocale()
  const [queue, setQueue] = useState<Card[]>(() => shuffle(cards))
  const [idx, setIdx] = useState(0)
  const [options, setOptions] = useState<string[]>([])
  const [selected, setSelected] = useState<string | null>(null)
  const [correct, setCorrect] = useState(0)
  const firstAttemptIds = useRef(new Set<string>())
  const card = queue[idx]

  useEffect(() => {
    if (!card) return
    const right = answerOf(card, mode)
    const pool = Array.from(new Set(cards.map((c) => answerOf(c, mode)))).filter((t) => t !== right)
    setOptions(shuffle([right, ...shuffle(pool).slice(0, 3)]))
    setSelected(null)
  }, [idx, queue])

  function handleSelect(opt: string) {
    if (selected) return
    setSelected(opt)
    const right = answerOf(card, mode)
    const isCorrect = opt === right
    const first = !firstAttemptIds.current.has(card.id)
    firstAttemptIds.current.add(card.id)
    setTimeout(() => {
      let nc = correct
      if (isCorrect && first) { nc = correct + 1; setCorrect(nc) }
      const nextQueue = isCorrect ? queue : [...queue, card]
      if (!isCorrect) setQueue(nextQueue)
      if (idx + 1 >= nextQueue.length) onFinish(nc, cards.length)
      else setIdx((i) => i + 1)
    }, 800)
  }

  const answered = firstAttemptIds.current.size
  const progress = (answered / cards.length) * 100
  const right = answerOf(card, mode)

  return (
    <>
      <StudyHeaderlessProgress progress={progress} />
      <div className="flex-1 px-6 py-12 flex flex-col items-center">
        <div className="w-full max-w-[560px]">
          <div className="text-[13px] text-text-muted mb-2">{mode === 'ua' ? t('quiz.showUA') : t('quiz.showDef')}</div>
          <div className="text-[28px] font-semibold text-text-primary mb-2">{card.word}</div>
          {card.example_en && <div className="text-[14px] text-text-secondary italic mb-6">{card.example_en}</div>}
          <div className="grid grid-cols-1 gap-3">
            {options.map((opt, i) => {
              let cls = 'appearance-none bg-bg-surface border border-bg-subtle rounded-[10px] px-4 py-[18px] text-text-primary font-[inherit] text-[15px] font-medium text-left cursor-pointer transition-all flex items-center justify-between gap-3 min-h-[64px] hover:bg-bg-elevated w-full'
              if (selected) {
                if (opt === right) cls = 'appearance-none bg-[rgba(34,197,94,0.15)] border border-success text-success rounded-[10px] px-4 py-[18px] font-[inherit] text-[15px] font-medium text-left cursor-pointer transition-all flex items-center justify-between gap-3 min-h-[64px] w-full'
                else if (opt === selected) cls = 'appearance-none bg-[rgba(239,68,68,0.15)] border border-danger text-danger rounded-[10px] px-4 py-[18px] font-[inherit] text-[15px] font-medium text-left cursor-pointer transition-all flex items-center justify-between gap-3 min-h-[64px] w-full [animation:shake_400ms_ease]'
                else cls = 'appearance-none bg-bg-surface border border-bg-subtle rounded-[10px] px-4 py-[18px] text-text-primary font-[inherit] text-[15px] font-medium text-left cursor-pointer transition-all flex items-center justify-between gap-3 min-h-[64px] pointer-events-none opacity-50 w-full'
              }
              return (
                <button key={opt} className={cls} onClick={() => handleSelect(opt)} disabled={!!selected}>
                  <span className="text-text-muted text-[13px]">{i + 1}</span>
                  <span className="flex-1">{opt}</span>
                  <span className="opacity-0 data-[show]:opacity-100"><i className={`ti ${opt === right ? 'ti-check' : 'ti-x'}`} /></span>
                </button>
              )
            })}
          </div>
        </div>
      </div>
    </>
  )
}

// ─── Write mode ───────────────────────────────────────
function WriteMode({ cards, mode, onFinish }: { cards: Card[]; mode: BackMode; onFinish: (c: number, t: number) => void }) {
  const { t } = useLocale()
  const [queue, setQueue] = useState<Card[]>(() => shuffle(cards))
  const [idx, setIdx] = useState(0)
  const [input, setInput] = useState('')
  const [feedback, setFeedback] = useState<'correct' | 'wrong' | null>(null)
  const [reveal, setReveal] = useState<string | null>(null)
  const [correct, setCorrect] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const firstAttemptIds = useRef(new Set<string>())
  const card = queue[idx]

  useEffect(() => { inputRef.current?.focus() }, [idx])

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (feedback) return
    const expected = norm(answerOf(card, mode))
    const isCorrect = levenshtein(norm(input), expected) <= 2
    const first = !firstAttemptIds.current.has(card.id)
    firstAttemptIds.current.add(card.id)
    if (isCorrect) {
      setFeedback('correct')
      let nc = correct
      if (first) { nc = correct + 1; setCorrect(nc) }
      setTimeout(() => {
        setFeedback(null); setInput(''); setReveal(null)
        if (idx + 1 >= queue.length) onFinish(nc, cards.length)
        else setIdx((i) => i + 1)
      }, 850)
    } else {
      setFeedback('wrong'); setReveal(answerOf(card, mode))
      const nextQueue = [...queue, card]
      setTimeout(() => {
        setQueue(nextQueue); setFeedback(null); setInput(''); setReveal(null)
        if (idx + 1 >= nextQueue.length) onFinish(correct, cards.length)
        else setIdx((i) => i + 1)
      }, 1400)
    }
  }

  const answered = firstAttemptIds.current.size
  const progress = (answered / cards.length) * 100

  return (
    <>
      <StudyHeaderlessProgress progress={progress} />
      <div className="flex-1 px-6 py-12 flex flex-col items-center">
        <div className="w-full max-w-[480px] text-center">
          <div className="text-[32px] font-bold text-text-primary mb-3">{card.word}</div>
          {card.example_en && <div className="text-[14px] text-text-secondary italic mb-8">{card.example_en}</div>}
          <form onSubmit={handleSubmit}>
            <div className="relative">
              <input
                ref={inputRef}
                className={`w-full h-14 bg-bg-elevated border-[1.5px] rounded-[10px] text-text-primary font-[inherit] text-[18px] px-5 pr-14 outline-none text-center transition-all focus:border-accent focus:shadow-[0_0_0_1px_theme(colors.accent),0_0_20px_rgba(16,185,129,0.15)] ${
                  feedback === 'correct' ? 'border-success shadow-[0_0_0_1px_theme(colors.success),0_0_20px_rgba(34,197,94,0.15)]' :
                  feedback === 'wrong' ? 'border-danger shadow-[0_0_0_1px_theme(colors.danger),0_0_20px_rgba(239,68,68,0.15)] [animation:shake_400ms_ease]' :
                  'border-bg-subtle'
                }`}
                placeholder={t('quiz.yourAnswer')}
                value={input} onChange={(e) => setInput(e.target.value)} disabled={!!feedback}
              />
              <button type="submit" className="absolute right-3 top-1/2 -translate-y-1/2 inline-flex items-center justify-center w-10 h-10 bg-accent text-white rounded-[6px] cursor-pointer disabled:opacity-40" disabled={!input.trim() || !!feedback}><i className="ti ti-arrow-right" /></button>
            </div>
          </form>
          <div className={`mt-4 text-[14px] transition-opacity ${feedback ? 'opacity-100' : 'opacity-0'}`}>
            {feedback === 'correct' && <span className="text-success">✓ {t('quiz.correct_feedback')}</span>}
            {feedback === 'wrong' && reveal && <span className="text-danger">✕ {t('quiz.correctAnswer')}: <span className="font-semibold">{reveal}</span></span>}
          </div>
          <div className="mt-6 text-[12px] text-text-muted"><span><kbd className="bg-bg-elevated border border-bg-subtle rounded px-1.5 py-0.5 text-[11px]">Enter</kbd> {t('quiz.check')}</span></div>
        </div>
      </div>
    </>
  )
}

// ─── Match mode ───────────────────────────────────────
interface MItem { id: string; text: string; type: 'word' | 'tr'; pairId: string; matched: boolean }
function MatchMode({ cards, mode, onFinish }: { cards: Card[]; mode: BackMode; onFinish: (c: number, t: number) => void }) {
  const { t } = useLocale()
  const BATCH = 6
  const [batchStart, setBatchStart] = useState(0)
  const [items, setItems] = useState<MItem[]>([])
  const [pairsCount, setPairsCount] = useState(0)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [wrongIds, setWrongIds] = useState<string[]>([])
  const [matched, setMatched] = useState(0)
  const [totalCorrect, setTotalCorrect] = useState(0)
  const all = useRef(shuffle(cards))

  useEffect(() => { loadBatch(0) }, [])

  function loadBatch(start: number) {
    const batch = all.current.slice(start, start + BATCH)
    setPairsCount(batch.length)
    const words: MItem[] = batch.map((c) => ({ id: `w-${c.id}`, text: c.word, type: 'word', pairId: c.id, matched: false }))
    const trs: MItem[] = shuffle(batch.map((c) => ({ id: `t-${c.id}`, text: answerOf(c, mode), type: 'tr' as const, pairId: c.id, matched: false })))
    setItems([...words, ...trs]); setSelectedId(null); setWrongIds([]); setMatched(0)
  }

  function handleSelect(itemId: string) {
    const item = items.find((i) => i.id === itemId)
    if (!item || item.matched || wrongIds.includes(itemId)) return
    if (!selectedId) { setSelectedId(itemId); return }
    if (selectedId === itemId) { setSelectedId(null); return }
    const first = items.find((i) => i.id === selectedId)!
    if (first.pairId === item.pairId && first.type !== item.type) {
      setItems((prev) => prev.map((i) => i.pairId === first.pairId ? { ...i, matched: true } : i))
      setSelectedId(null)
      const nm = matched + 1; setMatched(nm); setTotalCorrect((c) => c + 1)
      if (nm >= pairsCount) {
        const next = batchStart + BATCH
        setTimeout(() => {
          if (next < all.current.length) { setBatchStart(next); loadBatch(next) }
          else onFinish(totalCorrect + 1, all.current.length)
        }, 600)
      }
    } else {
      setWrongIds([selectedId, itemId])
      setTimeout(() => { setWrongIds([]); setSelectedId(null) }, 600)
    }
  }

  const progress = totalCorrect / all.current.length * 100

  const getPillClass = (i: MItem) => {
    if (i.matched) return 'bg-bg-surface border border-bg-subtle rounded-full px-4 py-3 text-text-primary text-[15px] font-medium cursor-pointer transition-[opacity_350ms,transform_350ms] text-center select-none opacity-0 scale-0 pointer-events-none'
    if (wrongIds.includes(i.id)) return 'bg-[rgba(239,68,68,0.15)] border border-danger text-danger rounded-full px-4 py-3 text-[15px] font-medium cursor-pointer transition-all text-center select-none hover:bg-bg-elevated [animation:shake_400ms_ease]'
    if (selectedId === i.id) return 'bg-bg-elevated border border-accent text-accent rounded-full px-4 py-3 text-[15px] font-medium cursor-pointer transition-all text-center select-none shadow-[0_0_0_1px_theme(colors.accent),0_0_20px_rgba(16,185,129,0.15)]'
    return 'bg-bg-surface border border-bg-subtle rounded-full px-4 py-3 text-text-primary text-[15px] font-medium cursor-pointer transition-all text-center select-none hover:bg-bg-elevated'
  }

  return (
    <>
      <StudyHeaderlessProgress progress={progress} />
      <div className="flex-1 px-6 py-12 flex flex-col items-center">
        <div className="w-full max-w-[640px]">
          <h2 className="text-[20px] font-semibold text-text-primary mb-1">{t('quiz.matchTitle')}</h2>
          <div className="text-[13px] text-text-muted mb-6">{t('quiz.matchDesc')}</div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-3">{items.filter((i) => i.type === 'word').map((i) => (
              <button key={i.id} className={getPillClass(i)} onClick={() => handleSelect(i.id)} disabled={i.matched}>{i.text}</button>))}</div>
            <div className="flex flex-col gap-3">{items.filter((i) => i.type === 'tr').map((i) => (
              <button key={i.id} className={getPillClass(i)} onClick={() => handleSelect(i.id)} disabled={i.matched}>{i.text}</button>))}</div>
          </div>
        </div>
      </div>
    </>
  )
}

function StudyHeaderlessProgress({ progress }: { progress: number }) {
  return (
    <div className="px-6 pt-3 pb-2 border-b border-bg-subtle">
      <div className="h-1 bg-bg-elevated rounded-full overflow-hidden">
        <span className="block h-full bg-gradient-to-r from-accent to-emerald-300 rounded-[inherit] transition-[width_400ms_ease-out]" style={{ width: `${progress}%` }} />
      </div>
    </div>
  )
}

export default function QuizPage() {
  const router = useRouter()
  const params = useParams()
  const deckId = params.id as string
  const mode = params.mode as QuizMode
  const { showToast } = useToast()
  const { t } = useLocale()

  const [cards, setCards] = useState<Card[]>([])
  const [loading, setLoading] = useState(true)
  const [finished, setFinished] = useState(false)
  const [finalCorrect, setFinalCorrect] = useState(0)
  const [finalTotal, setFinalTotal] = useState(0)
  const [deckName, setDeckName] = useState('')
  const [backMode, setBackMode] = useState<BackMode>('ua')
  const [key, setKey] = useState(0)

  useEffect(() => { fetchCards() }, [deckId])

  async function fetchCards() {
    setLoading(true)
    try {
      const [deckRes, cardsRes] = await Promise.all([fetch(`/api/decks/${deckId}`), fetch(`/api/decks/${deckId}/cards`)])
      if (deckRes.status === 401) { router.push('/login'); return }
      if (!deckRes.ok) { router.push('/home'); return }
      const deckData = await deckRes.json()
      setDeckName(deckData.name)
      const cardsData: Card[] = await cardsRes.json()
      if (mode === 'multiple' && cardsData.length < 4) { showToast(t('deck.needMin4'), 'error'); router.push(`/deck/${deckId}`); return }
      if (cardsData.length < 1) { showToast(t('study.noCards'), 'error'); router.push(`/deck/${deckId}`); return }
      setCards(cardsData)
    } catch { showToast(t('study.loadError'), 'error') } finally { setLoading(false) }
  }

  function handleFinish(c: number, t: number) {
    setFinalCorrect(c); setFinalTotal(t); setFinished(true)
    fetch('/api/sessions', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deck_id: deckId, mode, correct: c, total: t }),
    }).catch(() => {})
  }
  function handleRestart() { setFinished(false); setKey((k) => k + 1) }

  if (!['multiple', 'write', 'match'].includes(mode)) { router.push(`/deck/${deckId}`); return null }
  if (loading) return (
    <div className="bg-bg-base min-h-screen flex flex-col">
      <div className="flex-1 px-6 py-12 flex flex-col items-center">
        <div className="h-[22px] bg-gradient-to-r from-bg-subtle via-[rgba(16,185,129,0.1)] to-bg-subtle bg-[size:200%_100%] rounded mb-3.5 [animation:shimmer_1.4s_linear_infinite] w-1/2" style={{ maxWidth: 400 }} />
      </div>
    </div>
  )

  return (
    <div className="bg-bg-base min-h-screen flex flex-col">
      <div className="px-6 pt-3 pb-2">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <Link href={`/deck/${deckId}`} className="flex items-center gap-2 text-text-secondary text-[13px] hover:text-text-primary transition-colors">
            <i className="ti ti-arrow-left" /> <span className="font-medium">{deckName}</span>
          </Link>
          {!finished && (
            <div className="grid grid-cols-2 bg-bg-elevated border border-bg-subtle rounded-full p-1 relative" style={{ width: 240, marginBottom: 0 }}>
              <div className="absolute top-1 left-1 w-[calc(50%-4px)] h-[calc(100%-8px)] bg-accent rounded-full transition-transform duration-240 shadow-[0_4px_12px_rgba(16,185,129,0.4)] z-0" style={backMode === 'def' ? { transform: 'translateX(100%)' } : undefined} />
              <button type="button" className={`relative z-10 bg-transparent border-none font-[inherit] text-[13px] font-medium h-9 cursor-pointer transition-colors ${backMode === 'ua' ? 'text-white' : 'text-text-secondary'}`} onClick={() => { setBackMode('ua'); setKey((k) => k + 1) }}>{t('study.translation')}</button>
              <button type="button" className={`relative z-10 bg-transparent border-none font-[inherit] text-[13px] font-medium h-9 cursor-pointer transition-colors ${backMode === 'def' ? 'text-white' : 'text-text-secondary'}`} onClick={() => { setBackMode('def'); setKey((k) => k + 1) }}>{t('study.definition')}</button>
            </div>
          )}
        </div>
      </div>

      {finished ? (
        <Summary correct={finalCorrect} total={finalTotal} onRestart={handleRestart} onBack={() => router.push(`/deck/${deckId}`)} />
      ) : (
        <>
          {mode === 'multiple' && <MultipleChoice key={key} cards={cards} mode={backMode} onFinish={handleFinish} />}
          {mode === 'write' && <WriteMode key={key} cards={cards} mode={backMode} onFinish={handleFinish} />}
          {mode === 'match' && <MatchMode key={key} cards={cards} mode={backMode} onFinish={handleFinish} />}
        </>
      )}
    </div>
  )
}
