'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import Navbar from '@/components/Navbar'
import CardItem from '@/components/CardItem'
import { useToast } from '@/components/ToastProvider'
import { Card, DeckWithCount } from '@/lib/types'

export default function DeckPage() {
  const router = useRouter()
  const params = useParams()
  const deckId = params.id as string
  const { showToast } = useToast()

  const [deck, setDeck] = useState<DeckWithCount | null>(null)
  const [cards, setCards] = useState<Card[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchData()
  }, [deckId])

  async function fetchData() {
    setLoading(true)
    try {
      const [deckRes, cardsRes] = await Promise.all([
        fetch(`/api/decks/${deckId}`),
        fetch(`/api/decks/${deckId}/cards`),
      ])

      if (deckRes.status === 401 || cardsRes.status === 401) {
        router.push('/login')
        return
      }

      if (!deckRes.ok) {
        showToast('Колода не знайдена', 'error')
        router.push('/home')
        return
      }

      const deckData = await deckRes.json()
      const cardsData = await cardsRes.json()
      setDeck(deckData)
      setCards(cardsData)
    } catch {
      showToast('Помилка завантаження', 'error')
    } finally {
      setLoading(false)
    }
  }

  async function handleDeleteCard(id: string) {
    try {
      const res = await fetch(`/api/cards/${id}`, { method: 'DELETE' })
      if (!res.ok) {
        showToast('Помилка видалення картки', 'error')
        return
      }
      setCards((prev) => prev.filter((c) => c.id !== id))
      setDeck((prev) => prev ? { ...prev, card_count: prev.card_count - 1 } : prev)
      showToast('Картку видалено', 'info')
    } catch {
      showToast('Помилка мережі', 'error')
    }
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

  if (!deck) return null

  return (
    <>
      <Navbar />
      <div className="page-container">
        <button className="back-btn" onClick={() => router.push('/home')}>
          ← Назад до колод
        </button>

        <div className="deck-detail-header">
          <div>
            <h1 className="deck-detail-title">{deck.name}</h1>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginTop: '0.25rem' }}>
              {cards.length} {cards.length === 1 ? 'картка' : 'карток'}
            </p>
          </div>

          {cards.length > 0 && (
            <div className="deck-detail-actions">
              <Link href={`/deck/${deckId}/study`} className="btn-outline" style={{ textDecoration: 'none' }}>
                📖 Вивчати
              </Link>
              <Link href={`/deck/${deckId}/quiz/multiple`} className="btn-ghost" style={{ textDecoration: 'none' }}>
                🧠 Тест
              </Link>
            </div>
          )}
        </div>

        {cards.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">🃏</div>
            <p className="empty-state-title">Карток ще немає</p>
            <p style={{ fontSize: '0.875rem', marginBottom: '1.5rem' }}>
              Скористайтеся пошуком слів на головній сторінці
            </p>
            <button className="btn-primary" style={{ width: 'auto' }} onClick={() => router.push('/home')}>
              Знайти слова
            </button>
          </div>
        ) : (
          <>
            {cards.length >= 4 && (
              <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
                <Link href={`/deck/${deckId}/quiz/multiple`} className="btn-ghost" style={{ textDecoration: 'none', fontSize: '0.8125rem' }}>
                  🔤 Множинний вибір
                </Link>
                <Link href={`/deck/${deckId}/quiz/write`} className="btn-ghost" style={{ textDecoration: 'none', fontSize: '0.8125rem' }}>
                  ✍️ Письмо
                </Link>
                <Link href={`/deck/${deckId}/quiz/match`} className="btn-ghost" style={{ textDecoration: 'none', fontSize: '0.8125rem' }}>
                  🔗 Відповідність
                </Link>
              </div>
            )}

            <div className="card-list">
              {cards.map((card) => (
                <CardItem key={card.id} card={card} onDelete={handleDeleteCard} />
              ))}
            </div>
          </>
        )}
      </div>
    </>
  )
}
