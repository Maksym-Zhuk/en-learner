'use client'

import { useState, useEffect, useRef, useCallback, Suspense } from 'react'
import { useRouter } from 'next/navigation'
import Navbar from '@/components/Navbar'

function LookupPageInner() {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [activeIdx, setActiveIdx] = useState(-1)
  const [open, setOpen] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 50)
  }, [])

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  const fetchSuggestions = useCallback(async (q: string) => {
    if (q.length < 2) { setSuggestions([]); setOpen(false); return }
    try {
      const res = await fetch(`/api/autocomplete?q=${encodeURIComponent(q)}`)
      if (res.ok) {
        const data: string[] = await res.json()
        setSuggestions(data)
        setOpen(data.length > 0)
      }
    } catch {
      setSuggestions([])
    }
  }, [])

  useEffect(() => {
    setActiveIdx(-1)
    if (!query.trim()) { setSuggestions([]); setOpen(false); return }
    const t = setTimeout(() => fetchSuggestions(query), 200)
    return () => clearTimeout(t)
  }, [query, fetchSuggestions])

  function navigate(word: string) {
    const w = word.trim().toLowerCase()
    if (w) router.push(`/word/${encodeURIComponent(w)}`)
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIdx((i) => Math.min(i + 1, suggestions.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIdx((i) => Math.max(i - 1, -1))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const word = activeIdx >= 0 ? suggestions[activeIdx] : query.trim()
      if (word) { setOpen(false); navigate(word) }
    } else if (e.key === 'Escape') {
      setOpen(false)
    }
  }

  const showDropdown = open && suggestions.length > 0

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1 px-6 py-6 pb-16 w-full mx-auto [animation:fadeIn_280ms_ease]" style={{ maxWidth: 600 }}>
        <div className="flex items-center gap-2 text-text-secondary text-[13px] mb-5">
          <a
            className="text-text-secondary transition-colors cursor-pointer hover:text-text-primary"
            onClick={() => router.back()}
          >
            <i className="ti ti-arrow-left" /> Назад
          </a>
        </div>

        <h1 className="text-[24px] font-semibold text-text-primary mb-6">Пошук слова</h1>

        <div className="relative" ref={containerRef}>
          <div
            className={`flex items-center gap-3 bg-bg-elevated border border-bg-subtle px-4 text-[20px] text-text-muted transition-colors focus-within:border-accent focus-within:shadow-[0_0_0_3px_rgba(16,185,129,0.15)] ${
              showDropdown ? 'rounded-t-[16px] border-b-transparent' : 'rounded-[16px]'
            }`}
          >
            <i className="ti ti-search" />
            <input
              ref={inputRef}
              className="flex-1 bg-transparent border-none outline-none text-[18px] text-text-primary py-4 font-[inherit] placeholder:text-text-muted"
              placeholder="Введіть англійське слово…"
              value={query}
              autoComplete="off"
              spellCheck={false}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              onFocus={() => { if (suggestions.length > 0) setOpen(true) }}
            />
            {query && (
              <button
                className="bg-transparent border-none text-text-muted cursor-pointer p-1 rounded-[6px] hover:text-text-primary hover:bg-bg-subtle"
                onClick={() => {
                  setQuery('')
                  setSuggestions([])
                  setOpen(false)
                  inputRef.current?.focus()
                }}
              >
                <i className="ti ti-x" />
              </button>
            )}
          </div>

          {showDropdown && (
            <div className="absolute top-full left-0 right-0 bg-bg-elevated border border-bg-subtle border-t-0 rounded-b-[16px] overflow-hidden z-10 shadow-[0_8px_24px_rgba(0,0,0,0.3)]">
              {suggestions.map((s, i) => (
                <button
                  key={s}
                  className={`w-full text-left px-5 py-3 text-[15px] transition-colors cursor-pointer border-none flex items-center gap-3 ${
                    i === activeIdx
                      ? 'bg-[rgba(16,185,129,0.12)] text-accent'
                      : 'text-text-primary hover:bg-bg-subtle'
                  } ${i > 0 ? 'border-t border-bg-subtle' : ''}`}
                  onMouseDown={(e) => {
                    e.preventDefault()
                    setOpen(false)
                    navigate(s)
                  }}
                >
                  <i className="ti ti-search text-text-muted text-[12px]" />
                  <span>{s}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {!query && (
          <div className="px-5 py-8 text-center text-text-muted text-[13px] mt-12 flex flex-col items-center gap-2">
            <i className="ti ti-keyboard text-[28px]" />
            Почніть вводити слово — з&apos;являться підказки
          </div>
        )}
      </main>
    </div>
  )
}

export default function LookupPage() {
  return (
    <Suspense>
      <LookupPageInner />
    </Suspense>
  )
}
