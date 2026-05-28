'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { Card } from '@/lib/types'

interface SharedDeck { id: string; name: string; created_at: string }

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
        setDeck(data.deck); setCards(data.cards)
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false))
  }, [token])

  function toggle(id: string) {
    setFlipped((p) => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n })
  }

  if (loading) {
    return (
      <div className="bg-bg-base min-h-screen flex flex-col">
        <div className="flex-1 px-6 py-12 flex flex-col items-center">
          <div className="h-[22px] bg-gradient-to-r from-bg-subtle via-[rgba(16,185,129,0.1)] to-bg-subtle bg-[size:200%_100%] rounded mb-3.5 [animation:shimmer_1.4s_linear_infinite] w-1/2" style={{ maxWidth: 400 }} />
        </div>
      </div>
    )
  }

  if (notFound || !deck) {
    return (
      <section className="relative min-h-screen flex items-center justify-center px-6 py-12">
        <div className="relative w-full max-w-[480px] bg-bg-surface border border-bg-subtle rounded-[24px] px-9 py-10 shadow-[0_12px_40px_rgba(0,0,0,0.5)]" style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>🔒</div>
          <h1 className="text-[22px] font-semibold text-text-primary" style={{ margin: 0 }}>Колоду не знайдено</h1>
          <p className="text-text-muted text-[13px] mt-2">Посилання недійсне або доступ закрито</p>
          <Link href="/login" className="inline-flex items-center justify-center gap-2 h-12 px-5 text-[15px] bg-accent text-white rounded-[10px] font-medium cursor-pointer transition hover:bg-accent-hover hover:-translate-y-px mt-4">Увійти до en-learner</Link>
        </div>
      </section>
    )
  }

  return (
    <div className="min-h-screen flex flex-col">
      <nav className="sticky top-0 z-50 flex items-center justify-between px-7 py-3.5 border-b border-bg-subtle bg-[rgba(15,17,23,0.7)] backdrop-blur-[12px]">
        <Link href="/login" className="inline-flex items-center gap-2.5 text-text-primary font-semibold text-[18px] tracking-[-0.01em]">
          <span className="w-7 h-7 rounded-lg bg-accent inline-flex items-center justify-center text-white text-sm font-semibold"><span>en</span></span>
          <span>en-learner</span>
        </Link>
        <Link href="/register" className="inline-flex items-center justify-center gap-2 h-10 px-4 bg-accent text-white rounded-[10px] text-[13px] font-medium cursor-pointer transition hover:bg-accent-hover hover:-translate-y-px"><i className="ti ti-user-plus" /> Зареєструватися</Link>
      </nav>

      <main className="flex-1 px-6 py-6 pb-16 max-w-[1100px] w-full mx-auto [animation:fadeIn_280ms_ease]">
        <div className="flex items-center gap-5 mb-6">
          <div className="text-5xl">🌐</div>
          <div className="flex-1">
            <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-[rgba(16,185,129,0.15)] text-accent border border-[rgba(16,185,129,0.3)] mb-2"><i className="ti ti-link" style={{ fontSize: 11 }} /> Публічна колода</span>
            <h1 className="text-[28px] font-semibold text-text-primary">{deck.name}</h1>
            <div className="text-text-secondary text-[13px] mt-1">{cards.length} {cards.length === 1 ? 'слово' : 'слів'} · натисніть картку, щоб побачити переклад</div>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/register" className="inline-flex items-center justify-center gap-2 h-10 px-4 bg-accent text-white rounded-[10px] text-[13px] font-medium cursor-pointer transition hover:bg-accent-hover hover:-translate-y-px"><i className="ti ti-bookmark" /> Зберегти собі</Link>
          </div>
        </div>

        {cards.length === 0 ? (
          <div className="bg-bg-surface border border-dashed border-bg-subtle rounded-[16px] px-6 py-12 text-center">
            <div style={{ fontSize: 40 }}>🃏</div>
            <h3 className="text-[18px] font-medium text-text-primary mt-2">Картки відсутні</h3>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-4 mb-2 max-md:grid-cols-2 max-sm:grid-cols-1">
            {cards.map((c) => {
              const isF = flipped.has(c.id)
              return (
                <article key={c.id} role="button" tabIndex={0} className="bg-bg-surface border border-bg-subtle rounded-[10px] p-[18px] flex flex-col gap-2.5 transition cursor-pointer relative hover:-translate-y-[3px] hover:shadow-[0_4px_16px_rgba(0,0,0,0.4)] hover:border-accent" onClick={() => toggle(c.id)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(c.id) } }} style={{ minHeight: 120, justifyContent: 'center' }}>
                  {!isF ? (
                    <>
                      <h3 className="text-[15px] font-medium text-accent">{c.word}</h3>
                      {c.example_en && <p className="text-[12px] text-text-secondary">{c.example_en}</p>}
                    </>
                  ) : (
                    <>
                      <h3 className="text-[15px] font-medium text-text-primary">{c.translation_uk}</h3>
                      {c.definition_en && <p className="text-[12px] text-text-secondary">{c.definition_en}</p>}
                    </>
                  )}
                </article>
              )
            })}
          </div>
        )}
      </main>
    </div>
  )
}
