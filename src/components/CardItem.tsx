'use client'

import { useState, FormEvent } from 'react'
import { Card } from '@/lib/types'
import { useToast } from './ToastProvider'

interface CardItemProps {
  card: Card
  onDelete: (id: string) => void
  onUpdate: (card: Card) => void
}

export default function CardItem({ card, onDelete, onUpdate }: CardItemProps) {
  const { showToast } = useToast()
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    word: card.word,
    definition_en: card.definition_en,
    example_en: card.example_en,
    translation_uk: card.translation_uk,
    example_uk: card.example_uk,
  })

  function openEdit() {
    setForm({
      word: card.word,
      definition_en: card.definition_en,
      example_en: card.example_en,
      translation_uk: card.translation_uk,
      example_uk: card.example_uk,
    })
    setEditing(true)
  }

  async function handleSave(e: FormEvent) {
    e.preventDefault()
    if (!form.word.trim() || !form.definition_en.trim() || !form.translation_uk.trim()) {
      showToast('Слово, визначення та переклад обовʼязкові', 'error')
      return
    }
    setSaving(true)
    try {
      const res = await fetch(`/api/cards/${card.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) {
        showToast(data.error || 'Помилка збереження', 'error')
        return
      }
      onUpdate(data)
      setEditing(false)
      showToast('Картку оновлено', 'success')
    } catch {
      showToast('Помилка мережі', 'error')
    } finally {
      setSaving(false)
    }
  }

  if (editing) {
    return (
      <form className="card-edit-form" onSubmit={handleSave}>
        <div className="card-edit-grid">
          <div className="card-edit-col">
            <label className="card-edit-label">🇬🇧 Слово</label>
            <input
              className="card-edit-input"
              value={form.word}
              onChange={(e) => setForm({ ...form, word: e.target.value })}
              placeholder="Слово"
              autoFocus
            />
            <label className="card-edit-label" style={{ marginTop: '0.5rem' }}>Визначення</label>
            <textarea
              className="card-edit-input card-edit-textarea"
              value={form.definition_en}
              onChange={(e) => setForm({ ...form, definition_en: e.target.value })}
              placeholder="Definition in English"
              rows={2}
            />
            <label className="card-edit-label" style={{ marginTop: '0.5rem' }}>Приклад (EN)</label>
            <input
              className="card-edit-input"
              value={form.example_en}
              onChange={(e) => setForm({ ...form, example_en: e.target.value })}
              placeholder="Example sentence"
            />
          </div>
          <div className="card-edit-col">
            <label className="card-edit-label">🇺🇦 Переклад</label>
            <input
              className="card-edit-input"
              value={form.translation_uk}
              onChange={(e) => setForm({ ...form, translation_uk: e.target.value })}
              placeholder="Переклад"
            />
            <label className="card-edit-label" style={{ marginTop: '0.5rem' }}>Приклад (UA)</label>
            <input
              className="card-edit-input"
              value={form.example_uk}
              onChange={(e) => setForm({ ...form, example_uk: e.target.value })}
              placeholder="Приклад речення"
            />
          </div>
        </div>
        <div className="card-edit-actions">
          <button type="submit" className="btn-outline" disabled={saving}>
            {saving ? <span className="spinner" /> : null}
            Зберегти
          </button>
          <button type="button" className="btn-ghost" onClick={() => setEditing(false)}>
            Скасувати
          </button>
        </div>
      </form>
    )
  }

  return (
    <div className="card-item">
      <span className="card-item-word">{card.word}</span>
      <span className="card-item-translation">{card.translation_uk}</span>
      {card.example_en && (
        <span className="card-item-example">{card.example_en}</span>
      )}
      <div className="card-item-actions">
        <button className="btn-icon" onClick={openEdit} title="Редагувати картку">
          ✎
        </button>
        <button className="btn-icon" onClick={() => onDelete(card.id)} title="Видалити картку">
          ✕
        </button>
      </div>
    </div>
  )
}
