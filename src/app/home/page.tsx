'use client'

import { useState, useEffect, FormEvent, KeyboardEvent } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Navbar from '@/components/Navbar'
import { useToast } from '@/components/ToastProvider'
import { DeckWithCount, LookupResult, Folder } from '@/lib/types'

type Tab = 'search' | 'decks'

export default function HomePage() {
  const router = useRouter()
  const { showToast } = useToast()
  const [activeTab, setActiveTab] = useState<Tab>('search')

  // Lookup
  const [searchWord, setSearchWord] = useState('')
  const [lookupResult, setLookupResult] = useState<LookupResult | null>(null)
  const [lookupLoading, setLookupLoading] = useState(false)
  const [selectedDeckId, setSelectedDeckId] = useState<string>('')
  const [addingCard, setAddingCard] = useState(false)

  // Decks
  const [decks, setDecks] = useState<DeckWithCount[]>([])
  const [decksLoading, setDecksLoading] = useState(true)
  const [newDeckName, setNewDeckName] = useState('')
  const [creatingDeck, setCreatingDeck] = useState(false)

  // Folders
  const [folders, setFolders] = useState<Folder[]>([])
  const [newFolderName, setNewFolderName] = useState('')
  const [creatingFolder, setCreatingFolder] = useState(false)
  const [collapsedFolders, setCollapsedFolders] = useState<Set<string>>(new Set())
  const [movingDeck, setMovingDeck] = useState<string | null>(null)

  useEffect(() => {
    fetchAll()
  }, [])

  async function fetchAll() {
    setDecksLoading(true)
    try {
      const [decksRes, foldersRes] = await Promise.all([
        fetch('/api/decks'),
        fetch('/api/folders'),
      ])
      if (decksRes.status === 401) {
        router.push('/login')
        return
      }
      setDecks(await decksRes.json())
      if (foldersRes.ok) setFolders(await foldersRes.json())
    } catch {
      showToast('Помилка завантаження', 'error')
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

  async function handleCreateFolder(e: FormEvent) {
    e.preventDefault()
    if (!newFolderName.trim()) return
    setCreatingFolder(true)
    try {
      const res = await fetch('/api/folders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newFolderName.trim() }),
      })
      const data = await res.json()
      if (!res.ok) {
        showToast(data.error || 'Помилка створення папки', 'error')
        return
      }
      setFolders((prev) => [...prev, data])
      setNewFolderName('')
      showToast(`Папку "${data.name}" створено!`, 'success')
    } catch {
      showToast('Помилка мережі', 'error')
    } finally {
      setCreatingFolder(false)
    }
  }

  async function handleDeleteFolder(id: string, name: string) {
    if (!confirm(`Видалити папку "${name}"? Колоди залишаться без папки.`)) return
    try {
      const res = await fetch(`/api/folders/${id}`, { method: 'DELETE' })
      if (!res.ok) {
        showToast('Помилка видалення папки', 'error')
        return
      }
      setFolders((prev) => prev.filter((f) => f.id !== id))
      setDecks((prev) => prev.map((d) => d.folder_id === id ? { ...d, folder_id: null } : d))
      showToast(`Папку "${name}" видалено`, 'info')
    } catch {
      showToast('Помилка мережі', 'error')
    }
  }

  async function handleMoveDeck(deckId: string, folderId: string | null) {
    setMovingDeck(deckId)
    try {
      const res = await fetch(`/api/decks/${deckId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ folder_id: folderId }),
      })
      if (!res.ok) {
        showToast('Помилка переміщення', 'error')
        return
      }
      setDecks((prev) =>
        prev.map((d) => d.id === deckId ? { ...d, folder_id: folderId } : d)
      )
    } catch {
      showToast('Помилка мережі', 'error')
    } finally {
      setMovingDeck(null)
    }
  }

  function toggleFolder(id: string) {
    setCollapsedFolders((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const decksInFolder = (folderId: string | null) =>
    decks.filter((d) => d.folder_id === folderId)

  function renderDeckCard(deck: DeckWithCount) {
    return (
      <div key={deck.id} className="deck-card">
        <Link href={`/deck/${deck.id}`} style={{ textDecoration: 'none', flex: 1 }}>
          <p className="deck-card-name">{deck.name}</p>
          <p className="deck-card-count">
            {deck.card_count} {deck.card_count === 1 ? 'картка' : 'карток'}
          </p>
        </Link>

        <div className="deck-folder-row">
          <select
            className="deck-folder-select"
            value={deck.folder_id ?? ''}
            disabled={movingDeck === deck.id}
            onChange={(e) => handleMoveDeck(deck.id, e.target.value || null)}
          >
            <option value="">— Без папки —</option>
            {folders.map((f) => (
              <option key={f.id} value={f.id}>
                📁 {f.name}
              </option>
            ))}
          </select>

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
    )
  }

  return (
    <>
      <Navbar />
      <div className="page-container">

        {/* Tabs */}
        <div className="tab-bar">
          <button
            className={`tab-btn${activeTab === 'search' ? ' tab-btn--active' : ''}`}
            onClick={() => setActiveTab('search')}
          >
            🔍 Пошук
          </button>
          <button
            className={`tab-btn${activeTab === 'decks' ? ' tab-btn--active' : ''}`}
            onClick={() => setActiveTab('decks')}
          >
            📂 Мої колоди
            {decks.length > 0 && (
              <span className="tab-badge">{decks.length}</span>
            )}
          </button>
        </div>

        {/* Search tab */}
        {activeTab === 'search' && (
          <section>
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

            {!lookupResult && !lookupLoading && (
              <div className="search-hint">
                <p>Введіть слово і натисніть <strong>Шукати</strong> або <strong>Enter</strong></p>
              </div>
            )}
          </section>
        )}

        {/* Decks tab */}
        {activeTab === 'decks' && (
          <section>
            {/* Create forms */}
            <div className="create-row">
              <form onSubmit={handleCreateFolder} className="create-form">
                <input
                  type="text"
                  className="new-deck-input"
                  placeholder="Назва папки..."
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  maxLength={60}
                />
                <button
                  type="submit"
                  className="btn-outline"
                  disabled={creatingFolder || !newFolderName.trim()}
                  style={{ whiteSpace: 'nowrap' }}
                >
                  {creatingFolder ? <span className="spinner" /> : null}
                  + Папка
                </button>
              </form>

              <form onSubmit={handleCreateDeck} className="create-form">
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
                  + Колода
                </button>
              </form>
            </div>

            {decksLoading ? (
              <div className="deck-grid" style={{ marginTop: '1.5rem' }}>
                {[1, 2, 3].map((i) => (
                  <div key={i} className="skeleton skeleton-card" />
                ))}
              </div>
            ) : (
              <>
                {/* Folders */}
                {folders.map((folder) => {
                  const folderDecks = decksInFolder(folder.id)
                  const isCollapsed = collapsedFolders.has(folder.id)
                  return (
                    <div key={folder.id} className="folder-section">
                      <div className="folder-header" onClick={() => toggleFolder(folder.id)}>
                        <span className="folder-toggle">{isCollapsed ? '▶' : '▼'}</span>
                        <span className="folder-icon">📁</span>
                        <span className="folder-name">{folder.name}</span>
                        <span className="folder-count">
                          {folderDecks.length} {folderDecks.length === 1 ? 'колода' : 'колод'}
                        </span>
                        <button
                          className="btn-icon folder-delete-btn"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleDeleteFolder(folder.id, folder.name)
                          }}
                          title="Видалити папку"
                        >
                          ✕
                        </button>
                      </div>

                      {!isCollapsed && (
                        folderDecks.length === 0 ? (
                          <div className="folder-empty">Папка порожня. Перемістіть сюди колоду.</div>
                        ) : (
                          <div className="deck-grid folder-decks">
                            {folderDecks.map(renderDeckCard)}
                          </div>
                        )
                      )}
                    </div>
                  )
                })}

                {/* Unassigned decks */}
                {(() => {
                  const unassigned = decksInFolder(null)
                  if (unassigned.length === 0 && folders.length > 0) return null
                  return (
                    <div className="folder-section">
                      {folders.length > 0 && (
                        <div className="folder-header folder-header--plain">
                          <span className="folder-icon">📦</span>
                          <span className="folder-name">Без папки</span>
                          <span className="folder-count">
                            {unassigned.length} {unassigned.length === 1 ? 'колода' : 'колод'}
                          </span>
                        </div>
                      )}

                      {unassigned.length === 0 ? (
                        <div className="empty-state">
                          <div className="empty-state-icon">📭</div>
                          <p className="empty-state-title">Колод ще немає</p>
                          <p style={{ fontSize: '0.875rem' }}>Створіть першу колоду вище</p>
                        </div>
                      ) : (
                        <div className="deck-grid folder-decks">
                          {unassigned.map(renderDeckCard)}
                        </div>
                      )}
                    </div>
                  )
                })()}
              </>
            )}
          </section>
        )}

      </div>
    </>
  )
}
