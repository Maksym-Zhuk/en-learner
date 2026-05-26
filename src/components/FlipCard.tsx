'use client'

import { Card } from '@/lib/types'

interface FlipCardProps {
  card: Card
  flipped: boolean
  onClick: () => void
}

export default function FlipCard({ card, flipped, onClick }: FlipCardProps) {
  return (
    <div className="flip-card-scene" onClick={onClick} role="button" aria-label="Перегорнути картку">
      <div className={`flip-card-inner${flipped ? ' flipped' : ''}`}>
        {/* Front — English */}
        <div className="flip-card-face">
          <p className="flip-card-word">{card.word}</p>
          {card.example_en && (
            <p className="flip-card-example">&ldquo;{card.example_en}&rdquo;</p>
          )}
          <p className="flip-card-hint">натисніть, щоб перегорнути</p>
        </div>

        {/* Back — Ukrainian */}
        <div className="flip-card-face flip-card-back">
          <p className="flip-card-translation">{card.translation_uk}</p>
          {card.example_uk && (
            <p className="flip-card-example">&ldquo;{card.example_uk}&rdquo;</p>
          )}
          <p className="flip-card-hint" style={{ marginTop: '1rem', fontSize: '0.75rem' }}>
            {card.definition_en}
          </p>
        </div>
      </div>
    </div>
  )
}
