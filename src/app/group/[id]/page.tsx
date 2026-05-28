'use client'

import { useState, useEffect, useRef, FormEvent } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import Navbar from '@/components/Navbar'
import { useToast } from '@/components/ToastProvider'
import { DeckWithCount, Folder } from '@/lib/types'

interface Member { id: string; role: string; user_id: string; email: string }
interface Share { id: string; deck_id: string | null; folder_id: string | null; deck_name: string | null; folder_name: string | null }
interface Invitation { id: string; email: string; role: string; token: string }
interface GroupDetail {
  id: string; name: string; emoji: string; description: string; owner_id: string
  myRole: string; myUserId: string; members: Member[]; shares: Share[]; invitations: Invitation[]
}

const EMOJIS = ['👥', '🚀', '📚', '🎯', '🏆', '💼', '🌍', '🧠']

const BTN = 'inline-flex items-center justify-center gap-2 h-10 px-4 rounded-md text-[13px] font-medium border border-transparent cursor-pointer transition-all duration-200 whitespace-nowrap select-none'
const BTN_PRIMARY = `${BTN} bg-accent text-white hover:bg-accent-hover shadow-[0_1px_0_rgba(255,255,255,0.08)_inset,0_1px_3px_rgba(0,0,0,0.3)] disabled:opacity-50 disabled:cursor-not-allowed`
const BTN_GHOST = `${BTN} border-bg-subtle text-text-primary hover:bg-bg-elevated`
const BTN_DANGER = `${BTN} text-danger border-[rgba(239,68,68,0.3)] hover:bg-[rgba(239,68,68,0.1)]`
const BTN_ICON = 'inline-flex items-center justify-center w-9 h-9 rounded-md bg-bg-elevated text-text-secondary cursor-pointer transition-all duration-200 hover:text-text-primary hover:bg-bg-subtle border border-transparent'
const SELECT = 'appearance-none bg-bg-elevated border border-bg-subtle rounded-md text-text-primary text-[13px] cursor-pointer h-10 px-3'
const INPUT = 'w-full h-11 bg-bg-base border border-bg-subtle rounded-md text-text-primary text-[15px] px-3.5 outline-none transition-all duration-200 focus:border-accent focus:shadow-[0_0_0_3px_rgba(16,185,129,0.15)] placeholder:text-text-muted'

type Tab = 'decks' | 'folders' | 'members'

export default function GroupPage() {
  const router = useRouter()
  const params = useParams()
  const groupId = params.id as string
  const { showToast } = useToast()

  const [group, setGroup] = useState<GroupDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [decks, setDecks] = useState<DeckWithCount[]>([])
  const [folders, setFolders] = useState<Folder[]>([])
  const [tab, setTab] = useState<Tab>('decks')

  const [shareSel, setShareSel] = useState('')
  const [folderSel, setFolderSel] = useState('')

  const [inviteOpen, setInviteOpen] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState('viewer')
  const [inviting, setInviting] = useState(false)

  const [editOpen, setEditOpen] = useState(false)
  const [editForm, setEditForm] = useState({ name: '', emoji: '👥', description: '' })
  const [savingEdit, setSavingEdit] = useState(false)

  useEffect(() => { load() }, [groupId])

  async function load() {
    setLoading(true)
    try {
      const res = await fetch(`/api/groups/${groupId}`)
      if (res.status === 401) { router.push('/login'); return }
      if (res.status === 403) { showToast('Немає доступу', 'error'); router.push('/groups'); return }
      if (!res.ok) { router.push('/groups'); return }
      setGroup(await res.json())
      const [dRes, fRes] = await Promise.all([fetch('/api/decks'), fetch('/api/folders')])
      if (dRes.ok) setDecks(await dRes.json())
      if (fRes.ok) setFolders(await fRes.json())
    } catch { showToast('Помилка завантаження', 'error') } finally { setLoading(false) }
  }

  const canManage = group?.myRole === 'owner' || group?.myRole === 'editor'
  const isOwner = group?.myRole === 'owner'

  const deckShares = group?.shares.filter((s) => s.deck_id) ?? []
  const folderShares = group?.shares.filter((s) => s.folder_id) ?? []
  const sharedDeckIds = new Set(deckShares.map((s) => s.deck_id))
  const sharedFolderIds = new Set(folderShares.map((s) => s.folder_id))

  async function handleShareDeck(e: FormEvent) {
    e.preventDefault()
    if (!shareSel) return
    await doShare({ deck_id: shareSel })
    setShareSel('')
  }
  async function handleShareFolder(e: FormEvent) {
    e.preventDefault()
    if (!folderSel) return
    await doShare({ folder_id: folderSel })
    setFolderSel('')
  }
  async function doShare(body: { deck_id?: string; folder_id?: string }) {
    try {
      const res = await fetch(`/api/groups/${groupId}/share`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) { showToast(data.error || 'Помилка', 'error'); return }
      load()
      showToast('Додано до групи', 'success')
    } catch { showToast('Помилка мережі', 'error') }
  }

  async function removeShare(shareId: string) {
    try {
      const res = await fetch(`/api/groups/${groupId}/share`, {
        method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ share_id: shareId }),
      })
      if (!res.ok) { showToast('Помилка', 'error'); return }
      load()
    } catch { showToast('Помилка мережі', 'error') }
  }

  async function revokeInvitation(invitationId: string) {
    try {
      const res = await fetch(`/api/groups/${groupId}/invite`, {
        method: 'DELETE', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invitation_id: invitationId }),
      })
      const data = await res.json()
      if (!res.ok) { showToast(data.error || 'Помилка', 'error'); return }
      showToast('Запрошення скасовано', 'info')
      load()
    } catch { showToast('Помилка мережі', 'error') }
  }

  async function removeMember(memberId: string) {
    if (!confirm('Видалити учасника з групи?')) return
    try {
      const res = await fetch(`/api/groups/${groupId}/members/${memberId}`, { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok) { showToast(data.error || 'Помилка', 'error'); return }
      showToast('Учасника видалено', 'info')
      load()
    } catch { showToast('Помилка мережі', 'error') }
  }

  async function handleInvite(e: FormEvent) {
    e.preventDefault()
    if (!inviteEmail.trim()) return
    setInviting(true)
    try {
      const res = await fetch(`/api/groups/${groupId}/invite`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: inviteEmail.trim(), role: inviteRole }),
      })
      const data = await res.json()
      if (!res.ok) { showToast(data.error || 'Помилка', 'error'); return }
      if (data.added) showToast(`${data.email} додано до групи`, 'success')
      else {
        const link = `${window.location.origin}/invite/${data.token}`
        await navigator.clipboard.writeText(link).catch(() => {})
        showToast(data.emailed ? 'Запрошення надіслано на email' : 'Запрошення створено — посилання скопійовано', 'success')
      }
      setInviteEmail(''); setInviteOpen(false)
      load()
    } catch { showToast('Помилка мережі', 'error') } finally { setInviting(false) }
  }

  function openEdit() {
    if (!group) return
    setEditForm({ name: group.name, emoji: group.emoji, description: group.description })
    setEditOpen(true)
  }
  async function handleEdit(e: FormEvent) {
    e.preventDefault()
    if (!editForm.name.trim()) return
    setSavingEdit(true)
    try {
      const res = await fetch(`/api/groups/${groupId}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(editForm),
      })
      const data = await res.json()
      if (!res.ok) { showToast(data.error || 'Помилка', 'error'); return }
      setGroup((p) => p ? { ...p, name: data.name, emoji: data.emoji, description: data.description } : p)
      setEditOpen(false)
      showToast('Групу оновлено', 'success')
    } catch { showToast('Помилка мережі', 'error') } finally { setSavingEdit(false) }
  }

  async function deleteGroup() {
    if (!confirm('Видалити групу? Це незворотно.')) return
    const res = await fetch(`/api/groups/${groupId}`, { method: 'DELETE' })
    if (!res.ok) { showToast('Помилка видалення', 'error'); return }
    showToast('Групу видалено', 'info'); router.push('/groups')
  }

  if (loading) {
    return <div className="flex flex-col min-h-screen"><Navbar /><main className="max-w-[1100px] flex-1 w-full mx-auto px-6 pt-6 pb-16"><div className="h-8 w-1/2 rounded bg-bg-elevated animate-pulse" /></main></div>
  }
  if (!group) return null

  const TabBtn = ({ id, icon, label, count }: { id: Tab; icon: string; label: string; count: number }) => (
    <button
      className={`inline-flex items-center gap-2 px-4 py-2.5 bg-transparent border-none border-b-2 text-[13px] font-medium cursor-pointer transition-all duration-200 -mb-px ${tab === id ? 'text-accent border-accent' : 'text-text-secondary border-transparent hover:text-text-primary'}`}
      onClick={() => setTab(id)}
    >
      <i className={`ti ${icon}`} /> {label}
      <span className={`text-[11px] rounded-full py-px px-2 ${tab === id ? 'bg-[rgba(16,185,129,0.15)] text-accent' : 'bg-bg-elevated text-text-muted'}`}>{count}</span>
    </button>
  )

  return (
    <div className="flex flex-col min-h-screen">
      <Navbar />
      <main className="max-w-[1100px] flex-1 w-full mx-auto px-6 pt-6 pb-16">
        <div className="flex items-center gap-2 text-text-secondary text-[13px] mb-5">
          <Link href="/groups" className="hover:text-text-primary inline-flex items-center gap-1"><i className="ti ti-users-group" /> Групи</Link>
          <i className="ti ti-chevron-right" />
          <span className="text-text-primary">{group.name}</span>
        </div>

        <div className="bg-bg-surface border border-bg-subtle rounded-lg flex items-start gap-5 mb-6 p-6 relative overflow-hidden max-sm:flex-col">
          <div className="text-[40px] leading-none">{group.emoji}</div>
          <div className="flex-1">
            <h1 className="text-[28px] font-semibold m-0 tracking-[-0.01em]">{group.name}</h1>
            <div className="text-text-secondary text-[13px] mt-1">{group.members.length} учасників · {group.shares.length} спільних об&apos;єктів · ваша роль: {group.myRole}</div>
            {group.description && <p className="text-text-secondary text-[13px] m-0 mt-2">{group.description}</p>}
          </div>
          {isOwner && (
            <div className="flex gap-2">
              <button className={BTN_GHOST} onClick={openEdit}><i className="ti ti-pencil" /> Редагувати</button>
              <button className={BTN_DANGER} onClick={deleteGroup}><i className="ti ti-trash" /> Видалити</button>
            </div>
          )}
        </div>

        <div className="flex gap-1 border-b border-bg-subtle mb-5">
          <TabBtn id="decks" icon="ti-stack-2" label="Колоди" count={deckShares.length} />
          <TabBtn id="folders" icon="ti-folder" label="Папки" count={folderShares.length} />
          <TabBtn id="members" icon="ti-users" label="Учасники" count={group.members.length} />
        </div>

        {tab === 'decks' && (
          <>
            {canManage && (
              <form onSubmit={handleShareDeck} className="flex items-center gap-2 mb-4">
                <i className="ti ti-plus text-text-muted" />
                <select className={`${SELECT} flex-1`} value={shareSel} onChange={(e) => setShareSel(e.target.value)}>
                  <option value="">— оберіть колоду для спільного доступу —</option>
                  {decks.filter((d) => !sharedDeckIds.has(d.id)).map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
                <button type="submit" className={BTN_PRIMARY} disabled={!shareSel}>Додати</button>
              </form>
            )}
            {deckShares.length === 0 ? (
              <Empty icon="📘" title="Колод ще немає" sub="Поділіться колодою з групою." />
            ) : (
              <div className="grid grid-cols-3 gap-4 max-md:grid-cols-2 max-sm:grid-cols-1">
                {deckShares.map((s) => (
                  <Link key={s.id} href={`/deck/${s.deck_id}`} className="bg-bg-surface border border-bg-subtle rounded-md p-[18px] flex flex-col gap-2.5 relative transition-all duration-200 hover:-translate-y-0.5 hover:border-accent">
                    <div className="flex justify-between items-start gap-2">
                      <h3 className="text-[18px] font-medium leading-tight m-0">{s.deck_name}</h3>
                      <div className="inline-flex items-center justify-center w-8 h-8 rounded-sm bg-bg-elevated text-base shrink-0">📘</div>
                    </div>
                    <span className="inline-flex w-fit items-center gap-1 text-[11px] font-medium rounded-full bg-bg-elevated text-text-secondary border border-bg-subtle py-[3px] px-2">Колода</span>
                    {canManage && (
                      <div className="flex mt-1" onClick={(e) => e.preventDefault()}>
                        <button className={`${BTN_ICON} w-9 h-9 ml-auto hover:text-danger`} onClick={(e) => { e.preventDefault(); removeShare(s.id) }} title="Прибрати з групи"><i className="ti ti-x text-sm" /></button>
                      </div>
                    )}
                  </Link>
                ))}
              </div>
            )}
          </>
        )}

        {tab === 'folders' && (
          <>
            {canManage && (
              <form onSubmit={handleShareFolder} className="flex items-center gap-2 mb-4">
                <i className="ti ti-plus text-text-muted" />
                <select className={`${SELECT} flex-1`} value={folderSel} onChange={(e) => setFolderSel(e.target.value)}>
                  <option value="">— оберіть папку для спільного доступу —</option>
                  {folders.filter((f) => !sharedFolderIds.has(f.id)).map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
                </select>
                <button type="submit" className={BTN_PRIMARY} disabled={!folderSel}>Додати</button>
              </form>
            )}
            {folderShares.length === 0 ? (
              <Empty icon="📁" title="Папок ще немає" sub="Поділіться папкою з групою." />
            ) : (
              <div className="grid grid-cols-3 gap-4 max-md:grid-cols-2 max-sm:grid-cols-1">
                {folderShares.map((s) => (
                  <Link key={s.id} href={`/group/${groupId}/folder/${s.folder_id}`} className="bg-bg-surface border border-bg-subtle rounded-md p-[18px] flex flex-col gap-2.5 relative transition-all duration-200 hover:-translate-y-0.5 hover:border-accent">
                    <div className="flex justify-between items-start gap-2">
                      <h3 className="text-[18px] font-medium leading-tight m-0">{s.folder_name}</h3>
                      <div className="inline-flex items-center justify-center w-8 h-8 rounded-sm bg-bg-elevated text-base shrink-0">📁</div>
                    </div>
                    <span className="inline-flex w-fit items-center gap-1 text-[11px] font-medium rounded-full bg-bg-elevated text-text-secondary border border-bg-subtle py-[3px] px-2">Папка</span>
                    {canManage && (
                      <div className="flex mt-1" onClick={(e) => e.preventDefault()}>
                        <button className={`${BTN_ICON} w-9 h-9 ml-auto hover:text-danger`} onClick={(e) => { e.preventDefault(); removeShare(s.id) }} title="Прибрати з групи"><i className="ti ti-x text-sm" /></button>
                      </div>
                    )}
                  </Link>
                ))}
              </div>
            )}
          </>
        )}

        {tab === 'members' && (
          <div className="grid grid-cols-[1fr_320px] gap-4 max-md:grid-cols-1">
            <div className="bg-bg-surface border border-bg-subtle rounded-md p-5">
              <div className="flex justify-between items-center mb-3">
                <h2 className="text-lg font-medium m-0">Учасники · {group.members.length}</h2>
                {canManage && <button className={BTN_PRIMARY} onClick={() => setInviteOpen(true)}><i className="ti ti-user-plus" /> Запросити</button>}
              </div>
              <ul className="flex flex-col gap-1 m-0 p-0 list-none">
                {group.members.map((m) => {
                  const canRemoveThis = canManage && m.role !== 'owner' && m.user_id !== group.myUserId &&
                    !(group.myRole === 'editor' && m.role === 'editor')
                  return (
                    <li key={m.id} className="flex items-center gap-3 py-2">
                      <span className="inline-flex items-center justify-center w-9 h-9 rounded-full text-white font-semibold text-[13px] bg-gradient-to-br from-accent to-teal-500">{m.email.slice(0, 2).toUpperCase()}</span>
                      <span className="flex-1 text-[13px]">{m.email}<small className="text-text-muted"> · {m.role}</small></span>
                      {canRemoveThis && (
                        <button className={`${BTN_ICON} w-9 h-9 hover:text-danger`} title="Видалити з групи" onClick={() => removeMember(m.id)}>
                          <i className="ti ti-user-minus text-sm" />
                        </button>
                      )}
                    </li>
                  )
                })}
              </ul>
            </div>

            <div className="bg-bg-surface border border-bg-subtle rounded-md p-5 h-fit">
              <h2 className="text-lg font-medium m-0 mb-3">Очікують · {group.invitations.length}</h2>
              {group.invitations.length === 0 ? (
                <p className="text-text-muted text-[13px] m-0">Немає активних запрошень.</p>
              ) : (
                <ul className="flex flex-col gap-1 m-0 p-0 list-none">
                  {group.invitations.map((inv) => (
                    <li key={inv.id} className="flex items-center gap-3 py-2">
                      <span className="inline-flex items-center justify-center w-9 h-9 rounded-full bg-bg-elevated text-text-muted"><i className="ti ti-clock" /></span>
                      <span className="flex-1 text-[13px] truncate">{inv.email}<small className="text-text-muted"> · {inv.role}</small></span>
                      <button className={`${BTN_ICON} w-9 h-9`} title="Скопіювати посилання"
                        onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/invite/${inv.token}`); showToast('Посилання скопійовано', 'info') }}>
                        <i className="ti ti-link text-sm" />
                      </button>
                      {canManage && (
                        <button className={`${BTN_ICON} w-9 h-9 hover:text-danger`} title="Скасувати запрошення"
                          onClick={() => revokeInvitation(inv.id)}>
                          <i className="ti ti-x text-sm" />
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </main>

      {inviteOpen && (
        <Modal title="Запросити учасника" icon="ti-user-plus" onClose={() => setInviteOpen(false)}>
          <form onSubmit={handleInvite}>
            <label className="block text-[11px] text-text-secondary mb-1.5 font-medium">Email користувача</label>
            <input className={INPUT} type="email" placeholder="name@example.com" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} autoFocus />
            <label className="block text-[11px] text-text-secondary mb-1.5 mt-4 font-medium">Роль</label>
            <select className={`${SELECT} w-full`} value={inviteRole} onChange={(e) => setInviteRole(e.target.value)}>
              <option value="viewer">Перегляд</option>
              <option value="editor">Редагування</option>
            </select>
            <p className="text-text-muted text-[12px] mt-3 m-0">Якщо користувач уже зареєстрований — його одразу додано. Інакше надішлемо запрошення на email із посиланням.</p>
            <div className="flex justify-end gap-2 mt-5">
              <button type="button" className={BTN_GHOST} onClick={() => setInviteOpen(false)}>Скасувати</button>
              <button type="submit" className={BTN_PRIMARY} disabled={!inviteEmail.trim() || inviting}>{inviting ? 'Надсилання…' : 'Запросити'}</button>
            </div>
          </form>
        </Modal>
      )}

      {editOpen && (
        <Modal title="Редагувати групу" icon="ti-pencil" onClose={() => setEditOpen(false)}>
          <form onSubmit={handleEdit}>
            <div className="flex gap-2 flex-wrap mb-4">
              {EMOJIS.map((em) => (
                <button type="button" key={em} className={`w-10 h-10 rounded-md text-xl inline-flex items-center justify-center cursor-pointer transition-all duration-200 border ${editForm.emoji === em ? 'border-accent bg-[rgba(16,185,129,0.15)]' : 'border-bg-subtle bg-bg-base hover:bg-bg-elevated'}`}
                  onClick={() => setEditForm({ ...editForm, emoji: em })}>{em}</button>
              ))}
            </div>
            <label className="block text-[11px] text-text-secondary mb-1.5 font-medium">Назва групи</label>
            <input className={INPUT} value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} autoFocus />
            <label className="block text-[11px] text-text-secondary mb-1.5 mt-4 font-medium">Опис</label>
            <textarea className="w-full min-h-[72px] resize-y bg-bg-base border border-bg-subtle rounded-md text-text-primary text-[15px] py-2.5 px-3.5 outline-none transition-all duration-200 focus:border-accent focus:shadow-[0_0_0_3px_rgba(16,185,129,0.15)] placeholder:text-text-muted" value={editForm.description} onChange={(e) => setEditForm({ ...editForm, description: e.target.value })} placeholder="Необов'язково" />
            <div className="flex justify-end gap-2 mt-5">
              <button type="button" className={BTN_GHOST} onClick={() => setEditOpen(false)}>Скасувати</button>
              <button type="submit" className={BTN_PRIMARY} disabled={!editForm.name.trim() || savingEdit}>{savingEdit ? 'Збереження…' : 'Зберегти'}</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}

function Empty({ icon, title, sub }: { icon: string; title: string; sub: string }) {
  return (
    <div className="bg-bg-surface border border-dashed border-bg-subtle rounded-lg text-center py-12 px-6">
      <div className="text-[36px] mb-2">{icon}</div>
      <h3 className="text-lg font-medium m-0">{title}</h3>
      <p className="text-text-secondary text-[13px] mt-1">{sub}</p>
    </div>
  )
}

function Modal({ title, icon, onClose, children }: { title: string; icon: string; onClose: () => void; children: React.ReactNode }) {
  const modalRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  useEffect(() => {
    const el = modalRef.current?.querySelector<HTMLElement>('input, button, [tabindex]:not([tabindex="-1"])')
    el?.focus()
  }, [])
  return (
    <div className="fixed inset-0 bg-[rgba(15,17,23,0.65)] backdrop-blur-[8px] flex items-start justify-center pt-20 px-6 pb-6 z-[100] [animation:fadeIn_200ms_ease-out]" onClick={onClose}>
      <div ref={modalRef} role="dialog" aria-modal="true" aria-labelledby="group-edit-modal-title" className="relative w-full max-w-[460px] bg-bg-surface border border-bg-subtle rounded-[24px] shadow-[0_12px_40px_rgba(0,0,0,0.5)] overflow-hidden [animation:scaleIn_280ms_ease]" onClick={(e) => e.stopPropagation()}>
        <div className="px-5 py-4 border-b border-bg-subtle flex items-center gap-3">
          <i className={`ti ${icon} text-text-muted text-lg`} />
          <span id="group-edit-modal-title" className="flex-1 text-text-primary text-[18px] font-medium">{title}</span>
          <button className="bg-transparent border-none text-text-muted cursor-pointer p-1 rounded-[6px] hover:text-text-primary hover:bg-bg-elevated" onClick={onClose}><i className="ti ti-x" /></button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  )
}
