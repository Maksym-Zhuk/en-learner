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
  const [sharing, setSharing] = useState(false)

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
      if (!res.ok) { showToast('Помилка видалення картки', 'error'); return }
      setCards((prev) => prev.filter((c) => c.id !== id))
      setDeck((prev) => prev ? { ...prev, card_count: prev.card_count - 1 } : prev)
      showToast('Картку видалено', 'info')
    } catch {
      showToast('Помилка мережі', 'error')
    }
  }

  function handleUpdateCard(updated: Card) {
    setCards((prev) => prev.map((c) => c.id === updated.id ? updated : c))
  }

  async function handleShare() {
    if (!deck) return
    setSharing(true)
    try {
      if (deck.share_token) {
        // Copy existing link
        const url = `${window.location.origin}/s/${deck.share_token}`
        await navigator.clipboard.writeText(url)
        showToast('Посилання скопійовано!', 'success')
      } else {
        // Generate new token
        const res = await fetch(`/api/decks/${deckId}/share`, { method: 'POST' })
        const data = await res.json()
        if (!res.ok) { showToast(data.error || 'Помилка', 'error'); return }
        setDeck((prev) => prev ? { ...prev, share_token: data.share_token } : prev)
        const url = `${window.location.origin}/s/${data.share_token}`
        await navigator.clipboard.writeText(url)
        showToast('Посилання створено і скопійовано!', 'success')
      }
    } catch {
      showToast('Помилка мережі', 'error')
    } finally {
      setSharing(false)
    }
  }

  async function handleUnshare() {
    if (!deck?.share_token) return
    if (!confirm('Закрити доступ до колоди? Посилання перестане працювати.')) return
    try {
      await fetch(`/api/decks/${deckId}/share`, { method: 'DELETE' })
      setDeck((prev) => prev ? { ...prev, share_token: null } : prev)
      showToast('Доступ закрито', 'info')
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

          <div className="deck-detail-actions">
            {cards.length > 0 && (
              <>
                <Link href={`/deck/${deckId}/study`} className="btn-outline" style={{ textDecoration: 'none' }}>
                  📖 Вивчати
                </Link>
                <Link href={`/deck/${deckId}/quiz/multiple`} className="btn-ghost" style={{ textDecoration: 'none' }}>
                  🧠 Тест
                </Link>
              </>
            )}
            <button
              className={deck.share_token ? 'btn-outline' : 'btn-ghost'}
              onClick={handleShare}
              disabled={sharing}
              title={deck.share_token ? 'Скопіювати посилання' : 'Поділитися колодою'}
              style={{ fontSize: '0.8125rem' }}
            >
              {sharing ? <span className="spinner" /> : (deck.share_token ? '🔗 Скопіювати' : '🔗 Поділитися')}
            </button>
            {deck.share_token && (
              <button
                className="btn-icon"
                onClick={handleUnshare}
                title="Закрити доступ"
                style={{ fontSize: '0.75rem' }}
              >
                🔒
              </button>
            )}
          </div>
        </div>

        {deck.share_token && (
          <div className="share-link-bar">
            <span className="share-link-label">🌐 Публічне посилання:</span>
            <code className="share-link-url">{typeof window !== 'undefined' ? `${window.location.origin}/s/${deck.share_token}` : `/s/${deck.share_token}`}</code>
            <button
              className="btn-ghost"
              style={{ fontSize: '0.75rem', padding: '0.375rem 0.75rem' }}
              onClick={handleShare}
            >
              Копіювати
            </button>
          </div>
        )}

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
                <CardItem key={card.id} card={card} onDelete={handleDeleteCard} onUpdate={handleUpdateCard} />
              ))}
            </div>
          </>
        )}
      </div>
    </>
  )
}
