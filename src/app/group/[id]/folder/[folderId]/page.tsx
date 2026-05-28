'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import Navbar from '@/components/Navbar'
import { useToast } from '@/components/ToastProvider'

interface DeckItem { id: string; name: string; card_count: number }
interface FolderData { folder: { id: string; name: string }; decks: DeckItem[] }

export default function GroupFolderPage() {
  const router = useRouter()
  const params = useParams()
  const groupId = params.id as string
  const folderId = params.folderId as string
  const { showToast } = useToast()

  const [data, setData] = useState<FolderData | null>(null)
  const [groupName, setGroupName] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      try {
        const [folderRes, groupRes] = await Promise.all([
          fetch(`/api/groups/${groupId}/folders/${folderId}`),
          fetch(`/api/groups/${groupId}`),
        ])
        if (folderRes.status === 401) { router.push('/login'); return }
        if (!folderRes.ok) { showToast('Папку не знайдено', 'error'); router.push(`/group/${groupId}`); return }
        setData(await folderRes.json())
        if (groupRes.ok) { const g = await groupRes.json(); setGroupName(g.name) }
      } catch { showToast('Помилка завантаження', 'error') } finally { setLoading(false) }
    }
    load()
  }, [groupId, folderId])

  if (loading) {
    return (
      <div className="flex flex-col min-h-screen">
        <Navbar />
        <main className="max-w-[1100px] flex-1 w-full mx-auto px-6 pt-6 pb-16">
          <div className="h-8 w-1/2 rounded bg-bg-elevated animate-pulse" />
        </main>
      </div>
    )
  }
  if (!data) return null

  return (
    <div className="flex flex-col min-h-screen">
      <Navbar />
      <main className="max-w-[1100px] flex-1 w-full mx-auto px-6 pt-6 pb-16">
        <div className="flex items-center gap-2 text-text-secondary text-[13px] mb-5">
          <Link href="/groups" className="hover:text-text-primary inline-flex items-center gap-1">
            <i className="ti ti-users-group" /> Групи
          </Link>
          <i className="ti ti-chevron-right" />
          <Link href={`/group/${groupId}`} className="hover:text-text-primary">
            {groupName || '…'}
          </Link>
          <i className="ti ti-chevron-right" />
          <span className="text-text-primary">{data.folder.name}</span>
        </div>

        <div className="bg-bg-surface border border-bg-subtle rounded-lg flex items-center gap-5 mb-6 p-6">
          <div className="text-[40px] leading-none">📁</div>
          <div>
            <h1 className="text-[28px] font-semibold m-0 tracking-[-0.01em]">{data.folder.name}</h1>
            <div className="text-text-secondary text-[13px] mt-1">{data.decks.length} {data.decks.length === 1 ? 'колода' : 'колод'}</div>
          </div>
        </div>

        {data.decks.length === 0 ? (
          <div className="bg-bg-surface border border-dashed border-bg-subtle rounded-lg text-center py-12 px-6">
            <div className="text-[36px] mb-2">📂</div>
            <h3 className="text-lg font-medium m-0">Папка порожня</h3>
            <p className="text-text-secondary text-[13px] mt-1">Власник ще не додав колоди до цієї папки.</p>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-4 max-md:grid-cols-2 max-sm:grid-cols-1">
            {data.decks.map((deck) => (
              <Link
                key={deck.id}
                href={`/deck/${deck.id}`}
                className="bg-bg-surface border border-bg-subtle rounded-md p-[18px] flex flex-col gap-2.5 transition-all duration-200 hover:-translate-y-0.5 hover:border-accent hover:shadow-[0_4px_16px_rgba(0,0,0,0.4)]"
              >
                <div className="flex justify-between items-start gap-2">
                  <h3 className="text-[18px] font-medium leading-tight m-0">{deck.name}</h3>
                  <div className="inline-flex items-center justify-center w-8 h-8 rounded-sm bg-bg-elevated text-base shrink-0">📘</div>
                </div>
                <span className="text-text-muted text-[12px]">{deck.card_count} {deck.card_count === 1 ? 'слово' : 'слів'}</span>
                <div className="flex gap-2 mt-1">
                  <button
                    className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-accent text-white text-[12px] font-medium cursor-pointer transition-all hover:bg-accent-hover"
                    onClick={(e) => { e.preventDefault(); router.push(`/deck/${deck.id}/study`) }}
                  >
                    <i className="ti ti-cards text-sm" /> Картки
                  </button>
                  <button
                    className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-bg-elevated border border-bg-subtle text-text-primary text-[12px] font-medium cursor-pointer transition-all hover:bg-bg-subtle"
                    onClick={(e) => { e.preventDefault(); router.push(`/deck/${deck.id}/quiz/multiple`) }}
                  >
                    <i className="ti ti-list-check text-sm" /> Тест
                  </button>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
