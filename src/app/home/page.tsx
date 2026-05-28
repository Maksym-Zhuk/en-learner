'use client'

import { useState, useEffect, useRef, FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import Navbar from '@/components/Navbar'
import { useToast } from '@/components/ToastProvider'
import ShareToGroupModal from '@/components/ShareToGroupModal'
import { DeckWithCount, Folder } from '@/lib/types'
import { useLocale } from '@/lib/i18n'

const DECK_EMOJI = ['📘', '📗', '📙', '📕', '📓', '🗂️']
function deckEmoji(id: string) {
  let h = 0
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  return DECK_EMOJI[h % DECK_EMOJI.length]
}

const NO_FOLDER = '__none__'

const BTN = 'inline-flex items-center justify-center gap-2 h-10 px-4 rounded-md text-[13px] font-medium border border-transparent cursor-pointer transition duration-200 whitespace-nowrap select-none'
const BTN_PRIMARY = `${BTN} bg-accent text-white hover:bg-accent-hover shadow-[0_1px_0_rgba(255,255,255,0.08)_inset,0_1px_3px_rgba(0,0,0,0.3)] disabled:opacity-50 disabled:cursor-not-allowed`
const BTN_GHOST = `${BTN} border-bg-subtle text-text-primary hover:bg-bg-elevated`
const BTN_ICON = 'inline-flex items-center justify-center w-9 h-9 rounded-md bg-bg-elevated text-text-secondary cursor-pointer transition duration-200 hover:text-text-primary hover:bg-bg-subtle border border-transparent'
const STAT_CARD = 'bg-bg-surface border border-bg-subtle rounded-md py-3.5 px-4'

export default function HomePage() {
  const router = useRouter()
  const { showToast } = useToast()
  const { t } = useLocale()

  const [decks, setDecks] = useState<DeckWithCount[]>([])
  const [folders, setFolders] = useState<Folder[]>([])
  const [loading, setLoading] = useState(true)

  const [createKind, setCreateKind] = useState<'deck' | 'folder' | null>(null)
  const [createName, setCreateName] = useState('')
  const [creating, setCreating] = useState(false)

  const [editingFolderId, setEditingFolderId] = useState<string | null>(null)
  const [editingFolderName, setEditingFolderName] = useState('')

  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const [dragDeckId, setDragDeckId] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState<string | null>(null)

  const [shareTarget, setShareTarget] = useState<{ id: string; name: string } | null>(null)
  const homeModalRef = useRef<HTMLDivElement>(null)

  useEffect(() => { fetchAll() }, [])

  useEffect(() => {
    if (!createKind) return
    const el = homeModalRef.current?.querySelector<HTMLElement>('button, input, [tabindex]:not([tabindex="-1"])')
    el?.focus()
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setCreateKind(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [createKind])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        router.push('/lookup')
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [router])

  async function fetchAll() {
    setLoading(true)
    try {
      const [decksRes, foldersRes] = await Promise.all([fetch('/api/decks'), fetch('/api/folders')])
      if (decksRes.status === 401) { router.push('/login'); return }
      setDecks(await decksRes.json())
      if (foldersRes.ok) setFolders(await foldersRes.json())
    } catch {
      showToast(t('common.loadingError'), 'error')
    } finally {
      setLoading(false)
    }
  }

  function openCreate(kind: 'deck' | 'folder') {
    setCreateKind(kind)
    setCreateName('')
  }

  async function handleCreate(e: FormEvent) {
    e.preventDefault()
    const name = createName.trim()
    if (!name || !createKind) return
    setCreating(true)
    try {
      const url = createKind === 'deck' ? '/api/decks' : '/api/folders'
      const res = await fetch(url, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      })
      const data = await res.json()
      if (!res.ok) { showToast(data.error || t('common.error'), 'error'); return }
      if (createKind === 'deck') {
        setDecks((p) => [data, ...p])
        showToast(t('home.deckCreated', { name: data.name }), 'success')
      } else {
        setFolders((p) => [...p, data])
        showToast(t('home.folderCreated', { name: data.name }), 'success')
      }
      setCreateKind(null)
    } catch { showToast(t('common.networkError'), 'error') } finally { setCreating(false) }
  }

  async function handleDeleteFolder(id: string, name: string) {
    if (!confirm(t('home.confirmDeleteFolder', { name }))) return
    try {
      const res = await fetch(`/api/folders/${id}`, { method: 'DELETE' })
      if (!res.ok) { showToast(t('common.deleteError'), 'error'); return }
      setFolders((p) => p.filter((f) => f.id !== id))
      setDecks((p) => p.map((d) => d.folder_id === id ? { ...d, folder_id: null } : d))
      showToast(t('home.folderDeleted', { name }), 'info')
    } catch { showToast(t('common.networkError'), 'error') }
  }

  async function handleRenameFolder(id: string) {
    const name = editingFolderName.trim()
    if (!name) { setEditingFolderId(null); return }
    try {
      const res = await fetch(`/api/folders/${id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      })
      const data = await res.json()
      if (!res.ok) { showToast(data.error || t('common.error'), 'error'); return }
      setFolders((p) => p.map((f) => f.id === id ? { ...f, name: data.name } : f))
      showToast(t('home.folderUpdated'), 'success')
    } catch { showToast(t('common.networkError'), 'error') }
    finally { setEditingFolderId(null) }
  }

  async function handleMoveDeck(deckId: string, folderId: string | null) {
    const deck = decks.find((d) => d.id === deckId)
    if (!deck || (deck.folder_id ?? null) === folderId) return
    const prevFolder = deck.folder_id ?? null
    setDecks((p) => p.map((d) => d.id === deckId ? { ...d, folder_id: folderId } : d))
    try {
      const res = await fetch(`/api/decks/${deckId}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ folder_id: folderId }),
      })
      if (!res.ok) {
        setDecks((p) => p.map((d) => d.id === deckId ? { ...d, folder_id: prevFolder } : d))
        showToast(t('home.moveError'), 'error')
      }
    } catch {
      setDecks((p) => p.map((d) => d.id === deckId ? { ...d, folder_id: prevFolder } : d))
      showToast(t('common.networkError'), 'error')
    }
  }

  function toggleFolder(id: string) {
    setCollapsed((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  function onDropTo(folderId: string | null) {
    if (dragDeckId) handleMoveDeck(dragDeckId, folderId)
    setDragDeckId(null)
    setDragOver(null)
  }

  const totalWords = decks.reduce((s, d) => s + d.card_count, 0)
  const decksInFolder = (fid: string | null) => decks.filter((d) => (d.folder_id ?? null) === fid)

  function renderDeckCard(deck: DeckWithCount) {
    const dragging = dragDeckId === deck.id
    return (
      <article
        key={deck.id}
        className={`group/card bg-bg-surface border rounded-md p-[18px] flex flex-col gap-2.5 relative transition duration-200 cursor-pointer hover:-translate-y-0.5 hover:shadow-[0_4px_16px_rgba(0,0,0,0.4)] hover:border-accent ${dragging ? 'opacity-40 border-accent cursor-grabbing' : 'border-bg-subtle'}`}
        draggable
        onDragStart={(e) => { setDragDeckId(deck.id); e.dataTransfer.effectAllowed = 'move' }}
        onDragEnd={() => { setDragDeckId(null); setDragOver(null) }}
        tabIndex={0}
        role="link"
        onClick={() => router.push(`/deck/${deck.id}`)}
        onKeyDown={(e) => { if (e.key === 'Enter') router.push(`/deck/${deck.id}`) }}
      >
        <div className="flex items-center gap-2.5">
          <div className="inline-flex items-center justify-center w-9 h-9 rounded-md bg-bg-elevated text-[20px] shrink-0">{deck.emoji || deckEmoji(deck.id)}</div>
          <h3 className="text-[17px] font-medium leading-tight m-0 tracking-[-0.005em]">{deck.name}</h3>
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="inline-flex items-center gap-1 text-[11px] font-medium leading-snug rounded-full bg-bg-elevated text-text-secondary border border-bg-subtle py-[3px] px-2">{deck.card_count} {t('common.words')}</span>
          {deck.share_token && (
            <span className="inline-flex items-center gap-1 text-[11px] font-medium leading-snug rounded-full bg-[rgba(16,185,129,0.15)] text-accent border border-[rgba(16,185,129,0.3)] py-[3px] px-2">
              <i className="ti ti-link text-[11px]" /> {t('home.sharedBadge')}
            </span>
          )}
        </div>
      </article>
    )
  }

  return (
    <div className="flex flex-col min-h-screen">
      <Navbar />
      <main className="max-w-[1100px] flex-1 w-full mx-auto px-6 pt-6 pb-16">
        <div className="flex justify-between items-end gap-4 mb-7 max-sm:flex-col max-sm:items-stretch">
          <div>
            <h1 className="text-[28px] font-semibold m-0 tracking-[-0.01em]">{t('home.title')}</h1>
            <p className="text-text-secondary text-[13px] mt-1">{t('home.subtitle', { decks: decks.length, words: totalWords, folders: folders.length })}</p>
          </div>
          <div className="flex gap-2">
            <button className={BTN_GHOST} onClick={() => openCreate('folder')}>
              <i className="ti ti-folder-plus" /> {t('home.createFolder')}
            </button>
            <button className={BTN_PRIMARY} onClick={() => openCreate('deck')}>
              <i className="ti ti-plus" /> {t('home.createDeck')}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-3 mb-7 max-md:grid-cols-2">
          <div className={STAT_CARD}>
            <div className="flex items-center gap-1.5 text-text-secondary text-[13px]"><i className="ti ti-cards" /> {t('home.statsWords')}</div>
            <div className="text-[28px] font-semibold mt-1 tabular-nums">{totalWords}</div>
            <div className="text-text-muted text-[11px]">{t('home.statsWordsDesc')}</div>
          </div>
          <div className={STAT_CARD}>
            <div className="flex items-center gap-1.5 text-text-secondary text-[13px]"><i className="ti ti-stack-2" /> {t('home.statsDecks')}</div>
            <div className="text-[28px] font-semibold mt-1 tabular-nums">{decks.length}</div>
            <div className="text-text-muted text-[11px]">{t('home.statsDecksDesc')}</div>
          </div>
          <div className={STAT_CARD}>
            <div className="flex items-center gap-1.5 text-text-secondary text-[13px]"><i className="ti ti-folder" /> {t('home.statsFolders')}</div>
            <div className="text-[28px] font-semibold mt-1 tabular-nums">{folders.length}</div>
            <div className="text-text-muted text-[11px]">{t('home.statsFoldersDesc')}</div>
          </div>
          <div className={STAT_CARD}>
            <div className="flex items-center gap-1.5 text-text-secondary text-[13px]"><i className="ti ti-link" /> {t('home.statsShared')}</div>
            <div className="text-[28px] font-semibold mt-1 tabular-nums">{decks.filter((d) => d.share_token).length}</div>
            <div className="text-text-muted text-[11px]">{t('home.statsSharedDesc')}</div>
          </div>
        </div>

        {loading ? (
          <div className="grid grid-cols-3 gap-4 max-md:grid-cols-2 max-sm:grid-cols-1">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-bg-surface border border-bg-subtle rounded-md p-[18px] flex flex-col gap-3">
                <div className="h-5 w-[70%] rounded bg-bg-elevated animate-pulse" />
                <div className="h-3 w-1/2 rounded bg-bg-elevated animate-pulse" />
                <div className="h-3 w-[90%] rounded bg-bg-elevated animate-pulse" />
              </div>
            ))}
          </div>
        ) : decks.length === 0 && folders.length === 0 ? (
          <div className="bg-bg-surface border border-dashed border-bg-subtle rounded-lg text-center py-12 px-6">
            <div className="text-[40px] mb-2">🗂️</div>
            <h3 className="text-lg font-medium m-0">{t('home.emptyTitle')}</h3>
            <p className="text-text-secondary text-[13px] mt-1 mb-4">{t('home.emptyDesc')}</p>
            <button className={`${BTN_PRIMARY} mx-auto`} onClick={() => openCreate('deck')}>
              <i className="ti ti-plus" /> {t('home.createDeck')}
            </button>
          </div>
        ) : (
          <>
            {folders.map((folder) => {
              const fd = decksInFolder(folder.id)
              const isOpen = !collapsed.has(folder.id)
              const isEditing = editingFolderId === folder.id
              const over = dragOver === folder.id
              return (
                <div
                  key={folder.id}
                  className={`rounded-md p-1 mb-2 transition duration-200 ${over ? 'bg-[rgba(16,185,129,0.12)] shadow-[inset_0_0_0_2px_var(--accent)]' : ''}`}
                  onDragOver={(e) => { if (dragDeckId) { e.preventDefault(); setDragOver(folder.id) } }}
                  onDragLeave={(e) => { if (e.currentTarget === e.target) setDragOver(null) }}
                  onDrop={(e) => { e.preventDefault(); onDropTo(folder.id) }}
                >
                  <div className="flex justify-between items-center my-4">
                    {isEditing ? (
                      <form
                        onSubmit={(e) => { e.preventDefault(); handleRenameFolder(folder.id) }}
                        className="flex items-center gap-2 flex-1"
                      >
                        <input
                          className="h-9 bg-bg-base border border-accent rounded-md text-text-primary text-[15px] px-3 outline-none shadow-[0_0_0_3px_rgba(16,185,129,0.15)]"
                          value={editingFolderName}
                          onChange={(e) => setEditingFolderName(e.target.value)}
                          autoFocus
                          maxLength={60}
                          onKeyDown={(e) => { if (e.key === 'Escape') setEditingFolderId(null) }}
                        />
                        <button type="submit" className={`${BTN_PRIMARY} h-9 px-2.5 text-[11px]`}>{t('common.save')}</button>
                        <button type="button" className={`${BTN_GHOST} h-9 px-2.5 text-[11px]`} onClick={() => setEditingFolderId(null)}>{t('common.cancel')}</button>
                      </form>
                    ) : (
                      <button className="flex items-center gap-2 bg-transparent border-none cursor-pointer text-text-primary text-[18px] font-semibold p-0 tracking-[-0.01em]" onClick={() => toggleFolder(folder.id)}>
                        <i className={`ti ti-chevron-right text-[18px] text-text-muted transition-transform duration-200 ${isOpen ? 'rotate-90' : ''}`} />
                        <i className="ti ti-folder text-base text-accent" />
                        {folder.name}
                        <span className="text-text-muted font-normal"> · {fd.length}</span>
                      </button>
                    )}
                    {!isEditing && (
                      <div className="flex items-center gap-1.5">
                        <button className={BTN_ICON} title={t('home.addToGroup')} onClick={() => setShareTarget({ id: folder.id, name: folder.name })}><i className="ti ti-users-group" /></button>
                        <button className={BTN_ICON} title={t('common.rename')} onClick={() => { setEditingFolderId(folder.id); setEditingFolderName(folder.name) }}><i className="ti ti-pencil" /></button>
                        <button className={`${BTN_ICON} hover:text-danger`} title={t('common.delete')} onClick={() => handleDeleteFolder(folder.id, folder.name)}><i className="ti ti-trash" /></button>
                      </div>
                    )}
                  </div>
                  {isOpen && (
                    fd.length === 0
                      ? <div className={`flex items-center justify-center gap-2 p-[18px] border border-dashed rounded-md text-[13px] ${over ? 'border-accent text-accent' : 'border-bg-subtle text-text-muted'}`}><i className="ti ti-drag-drop" /> {t('home.dragHereDeck')}</div>
                      : <div className="grid grid-cols-3 gap-4 max-md:grid-cols-2 max-sm:grid-cols-1">{fd.map(renderDeckCard)}</div>
                  )}
                </div>
              )
            })}

            <div
              className={`rounded-md p-1 transition duration-200 ${dragOver === NO_FOLDER ? 'bg-[rgba(16,185,129,0.12)] shadow-[inset_0_0_0_2px_var(--accent)]' : ''}`}
              onDragOver={(e) => { if (dragDeckId) { e.preventDefault(); setDragOver(NO_FOLDER) } }}
              onDragLeave={(e) => { if (e.currentTarget === e.target) setDragOver(null) }}
              onDrop={(e) => { e.preventDefault(); onDropTo(null) }}
            >
              <div className="flex justify-between items-center my-4">
                <h2 className="text-lg font-medium m-0">{t('home.noFolder')} <span className="text-text-muted font-normal">· {decksInFolder(null).length}</span></h2>
              </div>
              {decksInFolder(null).length === 0
                ? <div className={`flex items-center justify-center gap-2 p-[18px] border border-dashed rounded-md text-[13px] ${dragOver === NO_FOLDER ? 'border-accent text-accent' : 'border-bg-subtle text-text-muted'}`}><i className="ti ti-drag-drop" /> {t('home.dragHereRemove')}</div>
                : <div className="grid grid-cols-3 gap-4 max-md:grid-cols-2 max-sm:grid-cols-1">{decksInFolder(null).map(renderDeckCard)}</div>}
            </div>
          </>
        )}
      </main>

      <button className="fixed bottom-7 right-7 z-40 inline-flex items-center justify-center w-14 h-14 rounded-full bg-accent text-white border-0 cursor-pointer transition duration-200 hover:bg-accent-hover hover:scale-105 shadow-[0_12px_32px_rgba(16,185,129,0.45),inset_0_0_0_1px_rgba(255,255,255,0.08)]" onClick={() => router.push('/lookup')} title={t('nav.findWord')}>
        <i className="ti ti-search text-xl" />
      </button>

      {createKind && (
        <div className="fixed inset-0 bg-[rgba(15,17,23,0.65)] backdrop-blur-[8px] flex items-start justify-center pt-20 px-6 pb-6 z-[100] [animation:fadeIn_200ms_ease-out]" onClick={() => setCreateKind(null)}>
          <div ref={homeModalRef} role="dialog" aria-modal="true" aria-labelledby="create-modal-title" className="relative w-full max-w-[460px] bg-bg-surface border border-bg-subtle rounded-[24px] shadow-[0_12px_40px_rgba(0,0,0,0.5)] overflow-hidden [animation:scaleIn_280ms_ease]" onClick={(e) => e.stopPropagation()}>
            <div className="px-5 py-4 border-b border-bg-subtle flex items-center gap-3">
              <i className={`ti ${createKind === 'deck' ? 'ti-stack-2' : 'ti-folder-plus'} text-text-muted text-lg`} />
              <span id="create-modal-title" className="flex-1 text-text-primary text-[18px] font-medium">{createKind === 'deck' ? t('home.newDeck') : t('home.newFolder')}</span>
              <button className="bg-transparent border-none text-text-muted cursor-pointer p-1 rounded-[6px] hover:text-text-primary hover:bg-bg-elevated" onClick={() => setCreateKind(null)}><i className="ti ti-x" /></button>
            </div>
            <form className="p-5" onSubmit={handleCreate}>
              <label className="block text-[11px] text-text-secondary mb-1.5 font-medium">{createKind === 'deck' ? t('home.deckName') : t('home.folderName')}</label>
              <input
                className="w-full h-12 bg-bg-base border border-bg-subtle rounded-md text-text-primary text-[15px] px-3.5 outline-none transition duration-200 focus:border-accent focus:shadow-[0_0_0_3px_rgba(16,185,129,0.15)] placeholder:text-text-muted"
                placeholder={createKind === 'deck' ? t('home.deckNamePlaceholder') : t('home.folderNamePlaceholder')}
                maxLength={createKind === 'deck' ? 80 : 60}
                value={createName}
                onChange={(e) => setCreateName(e.target.value)}
                autoFocus
              />
              <div className="flex justify-end gap-2 mt-5">
                <button type="button" className={BTN_GHOST} onClick={() => setCreateKind(null)}>{t('common.cancel')}</button>
                <button type="submit" className={BTN_PRIMARY} disabled={!createName.trim() || creating}>
                  {creating ? t('common.creating') : t('common.create')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ShareToGroupModal
        open={!!shareTarget}
        onClose={() => setShareTarget(null)}
        kind="folder"
        id={shareTarget?.id ?? ''}
        name={shareTarget?.name ?? ''}
      />
    </div>
  )
}
