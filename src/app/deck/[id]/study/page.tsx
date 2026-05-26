'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Navbar from '@/components/Navbar'
import FlipCard from '@/components/FlipCard'
import { useToast } from '@/components/ToastProvider'
import { Card } from '@/lib/types'

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

interface SummaryRingProps {
  correct: number
  total: number
}

function SummaryRing({ correct, total }: SummaryRingProps) {
  const pct = total > 0 ? correct / total : 0
  const r = 52
  const circumference = 2 * Math.PI * r
  const dashoffset = circumference * (1 - pct)

  return (
    <svg width="140" height="140" viewBox="0 0 140 140">
      <circle cx="70" cy="70" r={r} fill="none" stroke="var(--surface2)" strokeWidth="10" />
      <circle
        cx="70"
        cy="70"
        r={r}
        fill="none"
        stroke={pct >= 0.7 ? 'var(--success)' : pct >= 0.4 ? 'var(--warning)' : 'var(--danger)'}
        strokeWidth="10"
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={dashoffset}
        transform="rotate(-90 70 70)"
        style={{ transition: 'stroke-dashoffset 1s ease' }}
      />
      <text x="70" y="65" className="ring-text">{Math.round(pct * 100)}%</text>
      <text x="70" y="84" className="ring-label">точність</text>
    </svg>
  )
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
  const [correctCount, setCorrectCount] = useState(0)
  const [wrongCount, setWrongCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [done, setDone] = useState(false)
  const [deckName, setDeckName] = useState('')

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

      if (!deckRes.ok) {
        showToast('Колода не знайдена', 'error')
        router.push('/home')
        return
      }

      const deckData = await deckRes.json()
      setDeckName(deckData.name)

      const cardsData: Card[] = await cardsRes.json()
      if (!cardsData.length) {
        showToast('У колоді немає карток', 'error')
        router.push(`/deck/${deckId}`)
        return
      }

      const shuffled = shuffle(cardsData)
      setCards(shuffled)
      setQueue(shuffled)
    } catch {
      showToast('Помилка завантаження', 'error')
    } finally {
      setLoading(false)
    }
  }

  function handleKnew() {
    setCorrectCount((c) => c + 1)
    advance()
  }

  function handleDidntKnow() {
    setWrongCount((c) => c + 1)
    advance()
  }

  function advance() {
    setFlipped(false)
    if (current + 1 >= queue.length) {
      setDone(true)
    } else {
      setCurrent((c) => c + 1)
    }
  }

  function restart() {
    const reshuffled = shuffle(cards)
    setQueue(reshuffled)
    setCurrent(0)
    setFlipped(false)
    setCorrectCount(0)
    setWrongCount(0)
    setDone(false)
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

  if (done) {
    const total = queue.length
    return (
      <>
        <Navbar />
        <div className="study-layout" style={{ paddingTop: '3rem' }}>
          <div className="summary-card animate-scaleIn">
            <h2 className="summary-title">🎉 Сесію завершено!</h2>

            <div className="ring-container">
              <SummaryRing correct={correctCount} total={total} />
            </div>

            <div className="summary-stats">
              <div className="stat-item">
                <span className="stat-number correct">{correctCount}</span>
                <span className="stat-label">Знав</span>
              </div>
              <div className="stat-item">
                <span className="stat-number wrong">{wrongCount}</span>
                <span className="stat-label">Не знав</span>
              </div>
              <div className="stat-item">
                <span className="stat-number" style={{ color: 'var(--accent)' }}>{total}</span>
                <span className="stat-label">Всього</span>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
              <button className="btn-outline" onClick={restart}>
                🔄 Повторити
              </button>
              <button className="btn-ghost" onClick={() => router.push(`/deck/${deckId}`)}>
                До колоди
              </button>
            </div>
          </div>
        </div>
      </>
    )
  }

  const card = queue[current]
  const progress = (current / queue.length) * 100

  return (
    <>
      <Navbar />
      <div className="study-layout">
        <div className="study-header">
          <button className="back-btn" style={{ margin: 0 }} onClick={() => router.push(`/deck/${deckId}`)}>
            ← {deckName}
          </button>
          <span className="study-progress-text">
            {current + 1} / {queue.length}
          </span>
        </div>

        <div className="progress-bar-track">
          <div className="progress-bar-fill" style={{ width: `${progress}%` }} />
        </div>

        <FlipCard card={card} flipped={flipped} onClick={() => setFlipped((f) => !f)} />

        <div className="study-buttons">
          <button className="btn-wrong" onClick={handleDidntKnow}>
            ✕ Не знав
          </button>
          <button className="btn-correct" onClick={handleKnew}>
            ✓ Знав
          </button>
        </div>
      </div>
    </>
  )
}
