'use client'

import { useState, useEffect, useRef, FormEvent } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Navbar from '@/components/Navbar'
import { useToast } from '@/components/ToastProvider'
import { Card } from '@/lib/types'

// ─── Helpers ─────────────────────────────────────────────────

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

/** Levenshtein distance */
function levenshtein(a: string, b: string): number {
  const m = a.length
  const n = b.length
  const dp: number[][] = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  )
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] =
        a[i - 1] === b[j - 1]
          ? dp[i - 1][j - 1]
          : 1 + Math.min(dp[i - 1][j - 1], dp[i - 1][j], dp[i][j - 1])
    }
  }
  return dp[m][n]
}

function normalise(s: string) {
  return s.trim().toLowerCase()
}

// ─── Summary ─────────────────────────────────────────────────

interface SummaryProps {
  correct: number
  total: number
  onRestart: () => void
  onBack: () => void
}

function Summary({ correct, total, onRestart, onBack }: SummaryProps) {
  const pct = total > 0 ? correct / total : 0
  const r = 52
  const circ = 2 * Math.PI * r
  const offset = circ * (1 - pct)

  return (
    <div className="summary-card animate-scaleIn" style={{ marginTop: '2rem' }}>
      <h2 className="summary-title">🏆 Результат тесту</h2>
      <div className="ring-container">
        <svg width="140" height="140" viewBox="0 0 140 140">
          <circle cx="70" cy="70" r={r} fill="none" stroke="var(--surface2)" strokeWidth="10" />
          <circle
            cx="70" cy="70" r={r} fill="none"
            stroke={pct >= 0.7 ? 'var(--success)' : pct >= 0.4 ? 'var(--warning)' : 'var(--danger)'}
            strokeWidth="10" strokeLinecap="round"
            strokeDasharray={circ} strokeDashoffset={offset}
            transform="rotate(-90 70 70)"
            style={{ transition: 'stroke-dashoffset 1s ease' }}
          />
          <text x="70" y="65" className="ring-text">{Math.round(pct * 100)}%</text>
          <text x="70" y="84" className="ring-label">точність</text>
        </svg>
      </div>

      <div className="summary-stats">
        <div className="stat-item">
          <span className="stat-number correct">{correct}</span>
          <span className="stat-label">Правильно</span>
        </div>
        <div className="stat-item">
          <span className="stat-number wrong">{total - correct}</span>
          <span className="stat-label">Неправильно</span>
        </div>
        <div className="stat-item">
          <span className="stat-number" style={{ color: 'var(--accent)' }}>{total}</span>
          <span className="stat-label">Всього</span>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
        <button className="btn-outline" onClick={onRestart}>🔄 Ще раз</button>
        <button className="btn-ghost" onClick={onBack}>До колоди</button>
      </div>
    </div>
  )
}

// ─── Multiple Choice ──────────────────────────────────────────

function MultipleChoice({
  cards,
  onFinish,
}: {
  cards: Card[]
  onFinish: (correct: number, total: number) => void
}) {
  const [queue, setQueue] = useState<Card[]>(() => shuffle(cards))
  const [idx, setIdx] = useState(0)
  const [options, setOptions] = useState<string[]>([])
  const [selected, setSelected] = useState<string | null>(null)
  const [correct, setCorrect] = useState(0)
  const firstAttemptIds = useRef(new Set<string>())

  const card = queue[idx]

  useEffect(() => {
    if (!card) return
    const pool = Array.from(new Set(cards.map((c) => c.translation_uk))).filter(
      (t) => t !== card.translation_uk
    )
    const distractors = shuffle(pool).slice(0, 3)
    setOptions(shuffle([card.translation_uk, ...distractors]))
    setSelected(null)
  }, [idx, queue])

  function handleSelect(opt: string) {
    if (selected) return
    setSelected(opt)
    const isCorrect = opt === card.translation_uk
    const isFirstAttempt = !firstAttemptIds.current.has(card.id)
    firstAttemptIds.current.add(card.id)

    setTimeout(() => {
      let newCorrect = correct
      if (isCorrect && isFirstAttempt) {
        newCorrect = correct + 1
        setCorrect(newCorrect)
      }
      // Recycle wrong card to the end so it gets retried
      const nextQueue = isCorrect ? queue : [...queue, card]
      if (!isCorrect) setQueue(nextQueue)

      if (idx + 1 >= nextQueue.length) {
        onFinish(newCorrect, cards.length)
      } else {
        setIdx((i) => i + 1)
      }
    }, 900)
  }

  const answered = firstAttemptIds.current.size
  const progress = (answered / cards.length) * 100

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
        <span>{Math.min(answered + 1, cards.length)} / {cards.length}</span>
        <span>✓ {correct}</span>
      </div>

      <div className="progress-bar-track">
        <div className="progress-bar-fill" style={{ width: `${progress}%` }} />
      </div>

      <div className="quiz-card">
        <p className="quiz-question">{card.word}</p>
        {card.example_en && <p className="quiz-question-sub">&ldquo;{card.example_en}&rdquo;</p>}
      </div>

      <div className="options-grid">
        {options.map((opt) => {
          let cls = 'option-btn'
          if (selected) {
            if (opt === card.translation_uk) cls += ' correct'
            else if (opt === selected) cls += ' wrong'
          }
          return (
            <button
              key={opt}
              className={cls}
              onClick={() => handleSelect(opt)}
              disabled={!!selected}
            >
              {opt}
            </button>
          )
        })}
      </div>
    </>
  )
}

// ─── Write Mode ───────────────────────────────────────────────

function WriteMode({
  cards,
  onFinish,
}: {
  cards: Card[]
  onFinish: (correct: number, total: number) => void
}) {
  const [queue, setQueue] = useState<Card[]>(() => shuffle(cards))
  const [idx, setIdx] = useState(0)
  const [input, setInput] = useState('')
  const [feedback, setFeedback] = useState<'correct' | 'wrong' | null>(null)
  const [correct, setCorrect] = useState(0)
  const [correctAnswer, setCorrectAnswer] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const firstAttemptIds = useRef(new Set<string>())

  const card = queue[idx]

  useEffect(() => {
    inputRef.current?.focus()
  }, [idx])

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (feedback) return

    const answer = normalise(input)
    const expected = normalise(card.translation_uk)
    const isCorrect = levenshtein(answer, expected) <= 2
    const isFirstAttempt = !firstAttemptIds.current.has(card.id)
    firstAttemptIds.current.add(card.id)

    if (isCorrect) {
      setFeedback('correct')
      let newCorrect = correct
      if (isFirstAttempt) {
        newCorrect = correct + 1
        setCorrect(newCorrect)
      }
      setTimeout(() => {
        setFeedback(null)
        setInput('')
        setCorrectAnswer(null)
        if (idx + 1 >= queue.length) {
          onFinish(newCorrect, cards.length)
        } else {
          setIdx((i) => i + 1)
        }
      }, 900)
    } else {
      setFeedback('wrong')
      setCorrectAnswer(card.translation_uk)
      // Recycle wrong card to the end so it gets retried
      const nextQueue = [...queue, card]
      setTimeout(() => {
        setQueue(nextQueue)
        setFeedback(null)
        setInput('')
        setCorrectAnswer(null)
        if (idx + 1 >= nextQueue.length) {
          onFinish(correct, cards.length)
        } else {
          setIdx((i) => i + 1)
        }
      }, 1200)
    }
  }

  const answered = firstAttemptIds.current.size
  const progress = (answered / cards.length) * 100

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
        <span>{Math.min(answered + 1, cards.length)} / {cards.length}</span>
        <span>✓ {correct}</span>
      </div>

      <div className="progress-bar-track">
        <div className="progress-bar-fill" style={{ width: `${progress}%` }} />
      </div>

      <div className="quiz-card">
        <p className="quiz-question">{card.word}</p>
        {card.example_en && <p className="quiz-question-sub">&ldquo;{card.example_en}&rdquo;</p>}
      </div>

      <form onSubmit={handleSubmit} className="write-form">
        <input
          ref={inputRef}
          type="text"
          className={`write-input${feedback ? ` ${feedback}` : ''}`}
          placeholder="Введіть переклад українською..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={!!feedback}
        />
        {feedback === 'correct' && (
          <p className="write-feedback correct">✓ Правильно!</p>
        )}
        {feedback === 'wrong' && correctAnswer && (
          <p className="write-feedback wrong">✕ Правильна відповідь: {correctAnswer}</p>
        )}
        <button
          type="submit"
          className="btn-primary"
          style={{ width: 'auto', alignSelf: 'flex-end', padding: '0.75rem 2rem' }}
          disabled={!input.trim() || !!feedback}
        >
          Перевірити
        </button>
      </form>
    </>
  )
}

// ─── Match Mode ───────────────────────────────────────────────

interface MatchPair {
  id: string
  word: string
  translation: string
}

interface MatchItem {
  id: string
  text: string
  type: 'word' | 'translation'
  pairId: string
  matched: boolean
}

function MatchMode({
  cards,
  onFinish,
}: {
  cards: Card[]
  onFinish: (correct: number, total: number) => void
}) {
  const BATCH = 6
  const [batchStart, setBatchStart] = useState(0)
  const [pairs, setPairs] = useState<MatchPair[]>([])
  const [items, setItems] = useState<MatchItem[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [wrongIds, setWrongIds] = useState<string[]>([])
  const [matchedCount, setMatchedCount] = useState(0)
  const [totalCorrect, setTotalCorrect] = useState(0)
  const [totalBatches, setTotalBatches] = useState(0)

  const shuffledCards = useRef(shuffle(cards))

  useEffect(() => {
    loadBatch(0)
    setTotalBatches(Math.ceil(cards.length / BATCH))
  }, [])

  function loadBatch(start: number) {
    const batch = shuffledCards.current.slice(start, start + BATCH)
    const newPairs: MatchPair[] = batch.map((c) => ({
      id: c.id,
      word: c.word,
      translation: c.translation_uk,
    }))
    setPairs(newPairs)

    const words: MatchItem[] = newPairs.map((p) => ({
      id: `w-${p.id}`,
      text: p.word,
      type: 'word',
      pairId: p.id,
      matched: false,
    }))
    const translations: MatchItem[] = shuffle(newPairs.map((p) => ({
      id: `t-${p.id}`,
      text: p.translation,
      type: 'translation',
      pairId: p.id,
      matched: false,
    })))

    setItems([...words, ...translations])
    setSelectedId(null)
    setWrongIds([])
    setMatchedCount(0)
  }

  function handleSelect(itemId: string) {
    const item = items.find((i) => i.id === itemId)
    if (!item || item.matched || wrongIds.includes(itemId)) return

    if (!selectedId) {
      setSelectedId(itemId)
      return
    }

    if (selectedId === itemId) {
      setSelectedId(null)
      return
    }

    const first = items.find((i) => i.id === selectedId)!
    const second = item

    if (first.pairId === second.pairId && first.type !== second.type) {
      // Match!
      const newItems = items.map((i) =>
        i.pairId === first.pairId ? { ...i, matched: true } : i
      )
      setItems(newItems)
      setSelectedId(null)
      const newMatched = matchedCount + 1
      setMatchedCount(newMatched)
      setTotalCorrect((c) => c + 1)

      if (newMatched >= pairs.length) {
        const nextStart = batchStart + BATCH
        if (nextStart < shuffledCards.current.length) {
          setTimeout(() => {
            setBatchStart(nextStart)
            loadBatch(nextStart)
          }, 600)
        } else {
          setTimeout(() => {
            onFinish(totalCorrect + 1, shuffledCards.current.length)
          }, 600)
        }
      }
    } else {
      // Wrong
      setWrongIds([selectedId, itemId])
      setTimeout(() => {
        setWrongIds([])
        setSelectedId(null)
      }, 600)
    }
  }

  const progress = totalCorrect / shuffledCards.current.length * 100
  const words = items.filter((i) => i.type === 'word')
  const translations = items.filter((i) => i.type === 'translation')

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
        <span>Пара {matchedCount} / {pairs.length}</span>
        <span>✓ {totalCorrect}</span>
      </div>

      <div className="progress-bar-track" style={{ marginBottom: '1.5rem' }}>
        <div className="progress-bar-fill" style={{ width: `${progress}%` }} />
      </div>

      <div className="match-grid">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {words.map((item) => (
            <button
              key={item.id}
              className={`match-item${item.matched ? ' matched' : ''}${selectedId === item.id ? ' selected' : ''}${wrongIds.includes(item.id) ? ' wrong-flash' : ''}`}
              onClick={() => handleSelect(item.id)}
              disabled={item.matched}
            >
              {item.text}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {translations.map((item) => (
            <button
              key={item.id}
              className={`match-item${item.matched ? ' matched' : ''}${selectedId === item.id ? ' selected' : ''}${wrongIds.includes(item.id) ? ' wrong-flash' : ''}`}
              onClick={() => handleSelect(item.id)}
              disabled={item.matched}
            >
              {item.text}
            </button>
          ))}
        </div>
      </div>
    </>
  )
}

// ─── Main Quiz Page ───────────────────────────────────────────

type QuizMode = 'multiple' | 'write' | 'match'

const MODE_LABELS: Record<QuizMode, string> = {
  multiple: '🔤 Множинний вибір',
  write: '✍️ Письмо',
  match: '🔗 Відповідність',
}

export default function QuizPage() {
  const router = useRouter()
  const params = useParams()
  const deckId = params.id as string
  const mode = params.mode as QuizMode
  const { showToast } = useToast()

  const [cards, setCards] = useState<Card[]>([])
  const [loading, setLoading] = useState(true)
  const [finished, setFinished] = useState(false)
  const [finalCorrect, setFinalCorrect] = useState(0)
  const [finalTotal, setFinalTotal] = useState(0)
  const [deckName, setDeckName] = useState('')
  const [key, setKey] = useState(0)

  useEffect(() => {
    fetchCards()
  }, [deckId])

  async function fetchCards() {
    setLoading(true)
    try {
      const [deckRes, cardsRes] = await Promise.all([
        fetch(`/api/decks/${deckId}`),
        fetch(`/api/decks/${deckId}/cards`),
      ])

      if (deckRes.status === 401) { router.push('/login'); return }
      if (!deckRes.ok) { router.push('/home'); return }

      const deckData = await deckRes.json()
      setDeckName(deckData.name)

      const cardsData: Card[] = await cardsRes.json()

      if (mode === 'multiple' && cardsData.length < 4) {
        showToast('Потрібно мінімум 4 картки для цього режиму', 'error')
        router.push(`/deck/${deckId}`)
        return
      }

      if (cardsData.length < 1) {
        showToast('У колоді немає карток', 'error')
        router.push(`/deck/${deckId}`)
        return
      }

      setCards(cardsData)
    } catch {
      showToast('Помилка завантаження', 'error')
    } finally {
      setLoading(false)
    }
  }

  function handleFinish(correct: number, total: number) {
    setFinalCorrect(correct)
    setFinalTotal(total)
    setFinished(true)
  }

  function handleRestart() {
    setFinished(false)
    setKey((k) => k + 1)
  }

  if (!['multiple', 'write', 'match'].includes(mode)) {
    router.push(`/deck/${deckId}`)
    return null
  }

  if (loading) {
    return (
      <>
        <Navbar />
        <div style={{ display: 'flex', justifyContent: 'center', paddingTop: '4rem' }}>
          <span className="spinner-lg" />
        </div>
      </>
    )
  }

  return (
    <>
      <Navbar />
      <div className="quiz-layout">
        <button className="back-btn" onClick={() => router.push(`/deck/${deckId}`)}>
          ← {deckName}
        </button>

        <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '1.5rem', letterSpacing: '-0.02em' }}>
          {MODE_LABELS[mode] || mode}
        </h2>

        {/* Mode selector */}
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '2rem', flexWrap: 'wrap' }}>
          {(['multiple', 'write', 'match'] as QuizMode[]).map((m) => (
            <button
              key={m}
              className={mode === m ? 'btn-outline' : 'btn-ghost'}
              onClick={() => router.push(`/deck/${deckId}/quiz/${m}`)}
              style={{ fontSize: '0.8125rem' }}
            >
              {MODE_LABELS[m]}
            </button>
          ))}
        </div>

        {finished ? (
          <Summary
            correct={finalCorrect}
            total={finalTotal}
            onRestart={handleRestart}
            onBack={() => router.push(`/deck/${deckId}`)}
          />
        ) : (
          <>
            {mode === 'multiple' && (
              <MultipleChoice key={key} cards={cards} onFinish={handleFinish} />
            )}
            {mode === 'write' && (
              <WriteMode key={key} cards={cards} onFinish={handleFinish} />
            )}
            {mode === 'match' && (
              <MatchMode key={key} cards={cards} onFinish={handleFinish} />
            )}
          </>
        )}
      </div>
    </>
  )
}
