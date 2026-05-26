'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { Card } from '@/lib/types'

interface SharedDeck {
  id: string
  name: string
  created_at: string
}

export default function SharedDeckPage() {
  const params = useParams()
  const token = params.token as string

  const [deck, setDeck] = useState<SharedDeck | null>(null)
  const [cards, setCards] = useState<Card[]>([])
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [flipped, setFlipped] = useState<Set<string>>(new Set())

  useEffect(() => {
    fetch(`/api/s/${token}`)
      .then(async (res) => {
        if (!res.ok) { setNotFound(true); return }
        const data = await res.json()
        setDeck(data.deck)
        setCards(data.cards)
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false))
  }, [token])

  function toggleCard(id: string) {
    setFlipped((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
        <span className="spinner-lg" />
      </div>
    )
  }

  if (notFound || !deck) {
    return (
      <div className="auth-page">
        <div className="auth-card animate-scaleIn" style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🔒</div>
          <h1 className="auth-title" style={{ fontSize: '1.25rem' }}>Колоду не знайдено</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginTop: '0.5rem' }}>
            Посилання недійсне або доступ закрито
          </p>
          <Link href="/login" className="btn-primary" style={{ display: 'inline-flex', marginTop: '1.5rem', textDecoration: 'none', width: 'auto', padding: '0.75rem 2rem' }}>
            Увійти до EN Learner
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      {/* Header */}
      <nav className="navbar">
        <Link href="/login" className="navbar-logo" style={{ textDecoration: 'none' }}>
          📚 <span>EN</span>Learner
        </Link>
        <Link href="/register" className="btn-ghost" style={{ fontSize: '0.8125rem', textDecoration: 'none' }}>
          Зареєструватися
        </Link>
      </nav>

      <div className="page-container" style={{ maxWidth: '860px' }}>
        {/* Banner */}
        <div className="share-banner">
          <div>
            <p className="share-banner-label">Публічна колода</p>
            <h1 className="share-banner-title">{deck.name}</h1>
            <p className="share-banner-count">{cards.length} {cards.length === 1 ? 'картка' : 'карток'}</p>
          </div>
          <Link href="/register" className="btn-primary" style={{ textDecoration: 'none', width: 'auto', whiteSpace: 'nowrap' }}>
            Зберегти до свого акаунту
          </Link>
        </div>

        {/* Cards */}
        {cards.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">🃏</div>
            <p className="empty-state-title">Картки відсутні</p>
          </div>
        ) : (
          <div className="share-cards-grid">
            {cards.map((card) => {
              const isFlipped = flipped.has(card.id)
              return (
                <div
                  key={card.id}
                  className={`share-card${isFlipped ? ' share-card--flipped' : ''}`}
                  onClick={() => toggleCard(card.id)}
                >
                  <div className="share-card-inner">
                    <div className="share-card-front">
                      <p className="share-card-word">{card.word}</p>
                      {card.example_en && (
                        <p className="share-card-example">&ldquo;{card.example_en}&rdquo;</p>
                      )}
                      <p className="share-card-hint">Натисніть щоб побачити переклад</p>
                    </div>
                    <div className="share-card-back">
                      <p className="share-card-translation">{card.translation_uk}</p>
                      {card.example_uk && (
                        <p className="share-card-example">&ldquo;{card.example_uk}&rdquo;</p>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
