'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'

interface LookupModalProps {
  open: boolean
  onClose: () => void
}

export default function LookupModal({ open, onClose }: LookupModalProps) {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [activeIdx, setActiveIdx] = useState(-1)
  const [showSugg, setShowSugg] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) {
      setQuery('')
      setSuggestions([])
      setShowSugg(false)
      setActiveIdx(-1)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [open])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && open) onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  const fetchSuggestions = useCallback(async (q: string) => {
    if (q.length < 2) { setSuggestions([]); setShowSugg(false); return }
    try {
      const res = await fetch(`/api/autocomplete?q=${encodeURIComponent(q)}`)
      if (res.ok) {
        const data: string[] = await res.json()
        setSuggestions(data)
        setShowSugg(data.length > 0)
      }
    } catch {
      setSuggestions([])
    }
  }, [])

  useEffect(() => {
    setActiveIdx(-1)
    if (!query.trim()) { setSuggestions([]); setShowSugg(false); return }
    const t = setTimeout(() => fetchSuggestions(query), 200)
    return () => clearTimeout(t)
  }, [query, fetchSuggestions])

  function navigate(word: string) {
    const w = word.trim().toLowerCase()
    if (!w) return
    onClose()
    router.push(`/word/${encodeURIComponent(w)}`)
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
      if (word) navigate(word)
    }
  }

  if (!open) return null

  return (
    <div
      className="fixed inset-0 bg-[rgba(15,17,23,0.65)] backdrop-blur-[8px] flex items-start justify-center pt-20 px-6 pb-6 z-[100] [animation:fadeIn_200ms_ease-out]"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-[560px] bg-bg-surface border border-bg-subtle rounded-[20px] shadow-[0_12px_40px_rgba(0,0,0,0.5)] overflow-hidden [animation:scaleIn_280ms_ease]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Input */}
        <div className="px-5 py-4 flex items-center gap-3">
          <i className="ti ti-search text-text-muted text-lg" />
          <input
            ref={inputRef}
            className="flex-1 bg-transparent border-none outline-none text-text-primary text-[20px] font-medium placeholder:text-text-muted"
            placeholder="Пошук слова…"
            value={query}
            autoComplete="off"
            spellCheck={false}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
          />
          <span className="text-[11px] text-text-muted bg-bg-elevated border border-bg-subtle rounded px-1.5 py-0.5">esc</span>
          <button
            className="bg-transparent border-none text-text-muted cursor-pointer p-1 rounded-[6px] hover:text-text-primary hover:bg-bg-elevated"
            onClick={onClose}
          >
            <i className="ti ti-x" />
          </button>
        </div>

        {/* Suggestions */}
        {showSugg && suggestions.length > 0 && (
          <div className="border-t border-bg-subtle">
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
                  navigate(s)
                }}
              >
                <i className="ti ti-search text-text-muted text-[12px]" />
                <span>{s}</span>
                <i className="ti ti-arrow-right text-text-muted text-[11px] ml-auto" />
              </button>
            ))}
          </div>
        )}

        {/* Empty state */}
        {!query && (
          <div className="px-5 pb-5 text-center text-text-muted text-[13px] pt-2">
            Почніть вводити слово — з&apos;являться підказки
          </div>
        )}
      </div>
    </div>
  )
}
