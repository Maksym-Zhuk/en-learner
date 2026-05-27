'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Navbar from '@/components/Navbar'
import { useToast } from '@/components/ToastProvider'
import { DeckWithCount, LookupResult, DefinitionOption, ExampleOption } from '@/lib/types'

interface GroupedMeaning {
  pos: string
  definitions: DefinitionOption[]
}

export default function WordPage() {
  const router = useRouter()
  const params = useParams()
  const word = decodeURIComponent(params.word as string)
  const { showToast } = useToast()

  const [result, setResult] = useState<LookupResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [decks, setDecks] = useState<DeckWithCount[]>([])
  const [deckId, setDeckId] = useState('')
  const [adding, setAdding] = useState(false)
  const [selectedDef, setSelectedDef] = useState<DefinitionOption | null>(null)
  const [selectedTranslation, setSelectedTranslation] = useState('')

  useEffect(() => {
    fetch('/api/decks')
      .then((r) => {
        if (r.status === 401) { router.push('/login'); return null }
        return r.json()
      })
      .then((data) => { if (data) setDecks(data) })
      .catch(() => {})
  }, [router])

  useEffect(() => {
    setLoading(true)
    setError(null)
    setResult(null)
    setSelectedDef(null)
    setSelectedTranslation('')

    fetch(`/api/lookup?word=${encodeURIComponent(word)}`)
      .then((r) => r.json().then((d) => ({ ok: r.ok, data: d })))
      .then(({ ok, data }) => {
        if (!ok) { setError(data.error || 'Слово не знайдено'); return }
        setResult(data)
        if (data.definitions_en?.[0]) setSelectedDef(data.definitions_en[0])
        setSelectedTranslation(data.translation_uk || '')
      })
      .catch(() => setError('Помилка мережі'))
      .finally(() => setLoading(false))
  }, [word])

  const groupedMeanings: GroupedMeaning[] = []
  if (result?.definitions_en) {
    for (const d of result.definitions_en) {
      const existing = groupedMeanings.find((g) => g.pos === d.pos)
      if (existing) existing.definitions.push(d)
      else groupedMeanings.push({ pos: d.pos, definitions: [d] })
    }
  }

  async function handleAdd() {
    if (!result || !deckId) { showToast('Оберіть колоду', 'error'); return }
    setAdding(true)
    const exampleUk = result.examples?.find((e: ExampleOption) => e.en === selectedDef?.example)?.uk || result.example_uk
    try {
      const res = await fetch(`/api/decks/${deckId}/cards`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          word: result.word,
          definition_en: selectedDef?.definition || result.definition_en,
          example_en: selectedDef?.example || result.example_en,
          translation_uk: selectedTranslation || result.translation_uk,
          example_uk: exampleUk,
        }),
      })
      const data = await res.json()
      if (!res.ok) { showToast(data.error || 'Помилка додавання', 'error'); return }
      showToast(`"${result.word}" додано до колоди!`, 'success')
    } catch {
      showToast('Помилка мережі', 'error')
    } finally {
      setAdding(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main
        className="flex-1 px-6 py-6 pb-16 w-full mx-auto [animation:fadeIn_280ms_ease]"
        style={{ maxWidth: 820 }}
      >
        <div className="flex items-center gap-2 text-text-secondary text-[13px] mb-5">
          <a
            className="text-text-secondary transition-colors cursor-pointer hover:text-text-primary"
            onClick={() => router.back()}
          >
            <i className="ti ti-arrow-left" /> Назад
          </a>
        </div>

        {loading && <WordSkeleton />}

        {error && !loading && (
          <div className="text-center py-20 flex flex-col items-center gap-4">
            <i className="ti ti-mood-sad text-[32px] text-text-muted" />
            <p className="text-text-muted text-[15px]">{error}</p>
            <button
              className="text-accent text-[13px] hover:underline cursor-pointer"
              onClick={() => router.push('/lookup')}
            >
              ← Спробувати інше слово
            </button>
          </div>
        )}

        {!loading && result && (
          <div>
            {/* Header */}
            <div className="mb-8">
              <div className="flex items-end gap-4 flex-wrap">
                <h1 className="text-[42px] font-bold text-text-primary tracking-tight leading-none">
                  {result.word}
                </h1>
                {selectedTranslation && (
                  <span className="text-[20px] text-text-muted font-light mb-0.5">
                    — {selectedTranslation}
                  </span>
                )}
              </div>
              {groupedMeanings.length > 0 && (
                <div className="flex gap-1.5 mt-3 flex-wrap">
                  {groupedMeanings.map((g) => (
                    <span
                      key={g.pos}
                      className="text-[11px] italic bg-bg-elevated border border-bg-subtle rounded-full px-2.5 py-[3px] text-text-muted"
                    >
                      {g.pos}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Meanings grouped by POS */}
            {groupedMeanings.length > 0 && (
              <div className="flex flex-col gap-4 mb-8">
                {groupedMeanings.map((group) => (
                  <div
                    key={group.pos}
                    className="bg-bg-elevated border border-bg-subtle rounded-[16px] overflow-hidden"
                  >
                    <div className="flex items-center gap-3 px-5 py-3 border-b border-bg-subtle">
                      <span className="text-[11px] font-bold uppercase tracking-[0.1em] text-accent">
                        {group.pos}
                      </span>
                      <div className="flex-1 h-px bg-bg-subtle" />
                    </div>
                    <div className="p-5 flex flex-col gap-0">
                      {group.definitions.map((def, i) => (
                        <button
                          key={i}
                          className={`flex gap-3 text-left rounded-[10px] px-3 py-3 transition-colors cursor-pointer w-full border ${
                            selectedDef === def
                              ? 'bg-[rgba(16,185,129,0.08)] border-accent'
                              : 'bg-transparent border-transparent hover:bg-bg-subtle'
                          } ${i > 0 ? 'mt-1' : ''}`}
                          onClick={() => setSelectedDef(def)}
                        >
                          <span className="text-[13px] text-text-muted shrink-0 w-5 text-right pt-[1px]">
                            {i + 1}.
                          </span>
                          <div className="flex-1 min-w-0">
                            <p className="text-[14px] text-text-primary leading-relaxed">{def.definition}</p>
                            {def.example && (
                              <p className="text-[12px] text-text-muted italic mt-1.5 leading-relaxed">
                                &ldquo;{def.example}&rdquo;
                              </p>
                            )}
                          </div>
                          {selectedDef === def && (
                            <i className="ti ti-check text-accent text-[14px] shrink-0 pt-[1px]" />
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Translations */}
            {result.translations_uk && Object.keys(result.translations_uk).length > 0 && (
              <div className="bg-bg-elevated border border-bg-subtle rounded-[16px] overflow-hidden mb-8">
                <div className="flex items-center gap-3 px-5 py-3 border-b border-bg-subtle">
                  <span className="text-[11px] font-bold uppercase tracking-[0.1em] text-text-muted">
                    Переклад (uk)
                  </span>
                  <div className="flex-1 h-px bg-bg-subtle" />
                  <span className="text-[11px] text-text-muted flex items-center gap-1">
                    <i className="ti ti-language" /> Google Translate
                  </span>
                </div>
                <div className="p-5 flex flex-col gap-3">
                  {Object.entries(result.translations_uk).map(([pos, words]) => (
                    <div key={pos}>
                      <span className="text-[11px] italic text-text-muted block mb-2">{pos}</span>
                      <div className="flex flex-wrap gap-1.5">
                        {(words as string[]).map((w) => (
                          <button
                            key={w}
                            onClick={() => setSelectedTranslation(w)}
                            className={`text-[12px] rounded-full px-3 py-1 border transition-colors cursor-pointer ${
                              selectedTranslation === w
                                ? 'bg-[rgba(16,185,129,0.15)] border-accent text-accent'
                                : 'bg-bg-base border-bg-subtle text-text-secondary hover:border-accent hover:text-text-primary'
                            }`}
                          >
                            {w}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Sources */}
            <div className="flex items-center gap-2 mb-6 flex-wrap">
              <span className="text-[11px] text-text-muted px-2 py-0.5 bg-bg-base border border-bg-subtle rounded-full inline-flex items-center gap-1">
                <i className="ti ti-book" /> dictionaryapi.dev
              </span>
              <span className="text-[11px] text-text-muted px-2 py-0.5 bg-bg-base border border-bg-subtle rounded-full inline-flex items-center gap-1">
                <i className="ti ti-language" /> Google Translate
              </span>
            </div>

            {/* Add to deck */}
            <div className="flex items-center gap-3 flex-wrap pt-2 border-t border-bg-subtle">
              <div className="relative inline-flex items-center gap-2 bg-bg-elevated border border-bg-subtle rounded-[10px] px-3 py-2 text-[13px] text-text-primary transition-all hover:border-accent">
                <i className="ti ti-stack-2" />
                <span>Колода:</span>
                <select
                  value={deckId}
                  onChange={(e) => setDeckId(e.target.value)}
                  className="bg-transparent border-none outline-none text-text-primary text-[13px] cursor-pointer"
                >
                  <option value="">— оберіть —</option>
                  {decks.map((d) => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
              </div>
              <button
                className="inline-flex items-center justify-center gap-2 h-10 px-4 bg-accent text-white rounded-[10px] text-[13px] font-medium cursor-pointer transition-all hover:bg-accent-hover hover:-translate-y-px disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0"
                onClick={handleAdd}
                disabled={adding || !deckId}
              >
                <i className="ti ti-plus" />
                {adding ? 'Додаємо…' : 'Додати до колоди'}
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}

function WordSkeleton() {
  return (
    <div className="[animation:fadeIn_280ms_ease]">
      <div className="mb-8">
        <div className="h-[42px] w-48 bg-gradient-to-r from-bg-subtle via-[rgba(16,185,129,0.1)] to-bg-subtle bg-[size:200%_100%] rounded-[8px] [animation:shimmer_1.4s_linear_infinite] mb-3" />
        <div className="flex gap-2">
          <div className="h-5 w-14 bg-gradient-to-r from-bg-subtle via-[rgba(16,185,129,0.1)] to-bg-subtle bg-[size:200%_100%] rounded-full [animation:shimmer_1.4s_linear_infinite]" />
          <div className="h-5 w-10 bg-gradient-to-r from-bg-subtle via-[rgba(16,185,129,0.1)] to-bg-subtle bg-[size:200%_100%] rounded-full [animation:shimmer_1.4s_linear_infinite]" />
        </div>
      </div>
      {[1, 2].map((n) => (
        <div key={n} className="bg-bg-elevated border border-bg-subtle rounded-[16px] p-5 mb-4">
          <div className="h-3 w-16 bg-gradient-to-r from-bg-subtle via-[rgba(16,185,129,0.1)] to-bg-subtle bg-[size:200%_100%] rounded [animation:shimmer_1.4s_linear_infinite] mb-4" />
          <div className="h-3 w-full bg-gradient-to-r from-bg-subtle via-[rgba(16,185,129,0.1)] to-bg-subtle bg-[size:200%_100%] rounded [animation:shimmer_1.4s_linear_infinite] mb-2" />
          <div className="h-3 w-4/5 bg-gradient-to-r from-bg-subtle via-[rgba(16,185,129,0.1)] to-bg-subtle bg-[size:200%_100%] rounded [animation:shimmer_1.4s_linear_infinite] mb-2" />
          <div className="h-3 w-1/2 bg-gradient-to-r from-bg-subtle via-[rgba(16,185,129,0.1)] to-bg-subtle bg-[size:200%_100%] rounded [animation:shimmer_1.4s_linear_infinite]" />
        </div>
      ))}
    </div>
  )
}
