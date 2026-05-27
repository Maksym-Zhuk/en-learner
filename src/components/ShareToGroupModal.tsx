'use client'

import { useState, useEffect } from 'react'
import { useToast } from './ToastProvider'

interface GroupLite {
  id: string
  name: string
  emoji: string
  member_count: number
}

interface ShareToGroupModalProps {
  open: boolean
  onClose: () => void
  kind: 'deck' | 'folder'
  id: string
  name: string
}

export default function ShareToGroupModal({ open, onClose, kind, id, name }: ShareToGroupModalProps) {
  const { showToast } = useToast()
  const [groups, setGroups] = useState<GroupLite[]>([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setLoading(true)
    fetch('/api/groups')
      .then(async (res) => { if (res.ok) setGroups(await res.json()) })
      .catch(() => showToast('Помилка завантаження груп', 'error'))
      .finally(() => setLoading(false))
  }, [open, showToast])

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape' && open) onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  async function share(groupId: string) {
    setBusyId(groupId)
    try {
      const res = await fetch(`/api/groups/${groupId}/share`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(kind === 'deck' ? { deck_id: id } : { folder_id: id }),
      })
      const data = await res.json()
      if (!res.ok) { showToast(data.error || 'Помилка', 'error'); return }
      showToast('Додано до групи', 'success')
      onClose()
    } catch { showToast('Помилка мережі', 'error') } finally { setBusyId(null) }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 bg-[rgba(15,17,23,0.65)] backdrop-blur-[8px] flex items-start justify-center pt-20 px-6 pb-6 z-[100] [animation:fadeIn_200ms_ease-out]" onClick={onClose}>
      <div className="relative w-full max-w-[480px] bg-bg-surface border border-bg-subtle rounded-[24px] shadow-[0_12px_40px_rgba(0,0,0,0.5)] overflow-hidden [animation:scaleIn_280ms_ease]" onClick={(e) => e.stopPropagation()}>
        <div className="px-5 py-4 border-b border-bg-subtle flex items-center gap-3">
          <i className="ti ti-users-group text-text-muted text-lg" />
          <span className="flex-1 text-text-primary text-[18px] font-medium">Додати «{name}» до групи</span>
          <button className="bg-transparent border-none text-text-muted cursor-pointer p-1 rounded-[6px] hover:text-text-primary hover:bg-bg-elevated" onClick={onClose}><i className="ti ti-x" /></button>
        </div>
        <div className="p-5">
          {loading ? (
            <div className="h-[22px] bg-gradient-to-r from-bg-subtle via-[rgba(16,185,129,0.1)] to-bg-subtle bg-[size:200%_100%] rounded [animation:shimmer_1.4s_linear_infinite] w-[90%]" />
          ) : groups.length === 0 ? (
            <div className="bg-bg-surface border border-dashed border-bg-subtle rounded-[16px] px-6 py-6 text-center">
              <div className="text-[32px]">👥</div>
              <h3 className="m-0 mb-1.5 text-[18px] font-medium">Груп ще немає</h3>
              <p className="m-0 text-text-secondary text-[13px]">Спочатку створіть групу на сторінці «Групи».</p>
            </div>
          ) : (
            <div className="flex flex-col gap-1">
              {groups.map((g) => (
                <button key={g.id} className="flex items-center gap-3 px-3 py-2.5 rounded-[10px] bg-transparent border border-bg-subtle text-left cursor-pointer transition-all hover:bg-bg-elevated hover:border-accent disabled:opacity-50 disabled:cursor-not-allowed w-full" disabled={busyId === g.id} onClick={() => share(g.id)}>
                  <span className="text-[22px]">{g.emoji}</span>
                  <span className="flex-1 text-[13px] font-medium text-text-primary">{g.name}</span>
                  <span className="text-[11px] text-text-muted">{g.member_count} учасників</span>
                  <i className="ti ti-plus text-accent" />
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
