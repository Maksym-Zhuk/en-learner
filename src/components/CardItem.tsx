'use client'

import { Card } from '@/lib/types'

interface CardItemProps {
  card: Card
  onDelete: (id: string) => void
}

export default function CardItem({ card, onDelete }: CardItemProps) {
  return (
    <div className="card-item">
      <span className="card-item-word">{card.word}</span>
      <span className="card-item-translation">{card.translation_uk}</span>
      {card.example_en && (
        <span className="card-item-example">{card.example_en}</span>
      )}
      <div className="card-item-actions">
        <button
          className="btn-icon"
          onClick={() => onDelete(card.id)}
          title="Видалити картку"
        >
          ✕
        </button>
      </div>
    </div>
  )
}
