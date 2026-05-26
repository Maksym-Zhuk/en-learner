'use client'

import { useState, useEffect, FormEvent, KeyboardEvent } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Navbar from '@/components/Navbar'
import { useToast } from '@/components/ToastProvider'
import { DeckWithCount, LookupResult } from '@/lib/types'

export default function HomePage() {
  const router = useRouter()
  const { showToast } = useToast()

  // Lookup state
  const [searchWord, setSearchWord] = useState('')
  const [lookupResult, setLookupResult] = useState<LookupResult | null>(null)
  const [lookupLoading, setLookupLoading] = useState(false)
  const [selectedDeckId, setSelectedDeckId] = useState<string>('')
  const [addingCard, setAddingCard] = useState(false)

  // Decks state
  const [decks, setDecks] = useState<DeckWithCount[]>([])
  const [decksLoading, setDecksLoading] = useState(true)
  const [newDeckName, setNewDeckName] = useState('')
  const [creatingDeck, setCreatingDeck] = useState(false)

  useEffect(() => {
    fetchDecks()
  }, [])

  async function fetchDecks() {
    setDecksLoading(true)
    try {
      const res = await fetch('/api/decks')
      if (res.status === 401) {
        router.push('/login')
        return
      }
      const data = await res.json()
      setDecks(data)
    } catch {
      showToast('Помилка завантаження колод', 'error')
    } finally {
      setDecksLoading(false)
    }
  }

  async function handleLookup() {
    if (!searchWord.trim()) return
    setLookupLoading(true)
    setLookupResult(null)

    try {
      const res = await fetch(`/api/lookup?word=${encodeURIComponent(searchWord.trim())}`)
      const data = await res.json()

      if (!res.ok) {
        showToast(data.error || 'Слово не знайдено', 'error')
        return
      }

      setLookupResult(data)
    } catch {
      showToast('Помилка пошуку', 'error')
    } finally {
      setLookupLoading(false)
    }
  }

  function handleSearchKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') handleLookup()
  }

  async function handleAddToDeck() {
    if (!lookupResult || !selectedDeckId) {
      showToast('Оберіть колоду', 'error')
      return
    }

    setAddingCard(true)
    try {
      const res = await fetch(`/api/decks/${selectedDeckId}/cards`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(lookupResult),
      })
      const data = await res.json()

      if (!res.ok) {
        showToast(data.error || 'Помилка додавання', 'error')
        return
      }

      showToast(`"${lookupResult.word}" додано до колоди!`, 'success')
      setDecks((prev) =>
        prev.map((d) =>
          d.id === selectedDeckId ? { ...d, card_count: d.card_count + 1 } : d
        )
      )
    } catch {
      showToast('Помилка мережі', 'error')
    } finally {
      setAddingCard(false)
    }
  }

  async function handleCreateDeck(e: FormEvent) {
    e.preventDefault()
    if (!newDeckName.trim()) return

    setCreatingDeck(true)
    try {
      const res = await fetch('/api/decks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newDeckName.trim() }),
      })
      const data = await res.json()

      if (!res.ok) {
        showToast(data.error || 'Помилка створення колоди', 'error')
        return
      }

      setDecks((prev) => [data, ...prev])
      setNewDeckName('')
      showToast(`Колоду "${data.name}" створено!`, 'success')
    } catch {
      showToast('Помилка мережі', 'error')
    } finally {
      setCreatingDeck(false)
    }
  }

  async function handleDeleteDeck(id: string, name: string) {
    if (!confirm(`Видалити колоду "${name}"? Всі картки будуть видалені.`)) return

    try {
      const res = await fetch(`/api/decks/${id}`, { method: 'DELETE' })
      if (!res.ok) {
        showToast('Помилка видалення', 'error')
        return
      }
      setDecks((prev) => prev.filter((d) => d.id !== id))
      if (selectedDeckId === id) setSelectedDeckId('')
      showToast(`Колоду "${name}" видалено`, 'info')
    } catch {
      showToast('Помилка мережі', 'error')
    }
  }

  return (
    <>
      <Navbar />
      <div className="page-container">
        {/* Word Lookup */}
        <section style={{ marginBottom: '2.5rem' }}>
          <h2 className="section-title" style={{ marginBottom: '1.25rem' }}>
            🔍 Пошук слова
          </h2>

          <div className="search-bar">
            <input
              type="text"
              className="search-input"
              placeholder="Введіть англійське слово..."
              value={searchWord}
              onChange={(e) => setSearchWord(e.target.value)}
              onKeyDown={handleSearchKeyDown}
            />
            <button
              className="search-btn"
              onClick={handleLookup}
              disabled={lookupLoading || !searchWord.trim()}
            >
              {lookupLoading ? <span className="spinner" /> : 'Шукати'}
            </button>
          </div>

          {lookupResult && (
            <div className="lookup-result">
              <div className="lookup-word">{lookupResult.word}</div>

              <div className="lookup-grid">
                <div className="lookup-col">
                  <div className="lookup-col-title">🇬🇧 Англійська</div>
                  <p className="lookup-def">{lookupResult.definition_en}</p>
                  {lookupResult.example_en && (
                    <p className="lookup-example">&ldquo;{lookupResult.example_en}&rdquo;</p>
                  )}
                </div>
                <div className="lookup-col">
                  <div className="lookup-col-title">🇺🇦 Українська</div>
                  <p className="lookup-def">{lookupResult.translation_uk}</p>
                  {lookupResult.example_uk && (
                    <p className="lookup-example">&ldquo;{lookupResult.example_uk}&rdquo;</p>
                  )}
                </div>
              </div>

              <div className="lookup-actions">
                <select
                  className="deck-select"
                  value={selectedDeckId}
                  onChange={(e) => setSelectedDeckId(e.target.value)}
                >
                  <option value="">— Оберіть колоду —</option>
                  {decks.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name} ({d.card_count} карток)
                    </option>
                  ))}
                </select>
                <button
                  className="btn-outline"
                  onClick={handleAddToDeck}
                  disabled={addingCard || !selectedDeckId}
                  style={{ whiteSpace: 'nowrap' }}
                >
                  {addingCard ? <span className="spinner" /> : null}
                  Додати до колоди
                </button>
              </div>
            </div>
          )}
        </section>

        {/* Decks */}
        <section>
          <div className="section-header">
            <h2 className="section-title">📂 Мої колоди</h2>
          </div>

          <form onSubmit={handleCreateDeck} className="new-deck-form">
            <input
              type="text"
              className="new-deck-input"
              placeholder="Назва нової колоди..."
              value={newDeckName}
              onChange={(e) => setNewDeckName(e.target.value)}
              maxLength={80}
            />
            <button
              type="submit"
              className="btn-outline"
              disabled={creatingDeck || !newDeckName.trim()}
              style={{ whiteSpace: 'nowrap' }}
            >
              {creatingDeck ? <span className="spinner" /> : null}
              + Нова колода
            </button>
          </form>

          {decksLoading ? (
            <div className="deck-grid">
              {[1, 2, 3].map((i) => (
                <div key={i} className="skeleton skeleton-card" />
              ))}
            </div>
          ) : decks.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">📭</div>
              <p className="empty-state-title">Колод ще немає</p>
              <p style={{ fontSize: '0.875rem' }}>Створіть першу колоду вище</p>
            </div>
          ) : (
            <div className="deck-grid">
              {decks.map((deck) => (
                <div key={deck.id} className="deck-card">
                  <Link
                    href={`/deck/${deck.id}`}
                    style={{ textDecoration: 'none', flex: 1 }}
                  >
                    <p className="deck-card-name">{deck.name}</p>
                    <p className="deck-card-count">
                      {deck.card_count} {deck.card_count === 1 ? 'картка' : 'карток'}
                    </p>
                  </Link>
                  <div className="deck-card-actions">
                    <button
                      className="btn-icon"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleDeleteDeck(deck.id, deck.name)
                      }}
                      title="Видалити колоду"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </>
  )
}
