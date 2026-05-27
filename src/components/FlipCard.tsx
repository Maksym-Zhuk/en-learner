'use client'

import { Card } from '@/lib/types'

interface FlipCardProps {
  card: Card
  flipped: boolean
  onClick: () => void
  backMode?: 'ua' | 'def'
}

export default function FlipCard({ card, flipped, onClick, backMode = 'ua' }: FlipCardProps) {
  return (
    <div
      className="perspective-1200 w-full h-[300px] cursor-pointer mb-8"
      onClick={onClick}
      role="button"
      aria-label="Перегорнути картку"
    >
      <div
        className={`w-full h-full relative preserve-3d transition-transform duration-[550ms] [transition-timing-function:cubic-bezier(0.4,0,0.2,1)] ${flipped ? 'rotate-y-180' : ''}`}
      >
        {/* Front — English */}
        <div className="absolute w-full h-full backface-hidden bg-bg-surface border border-[rgba(255,255,255,0.08)] rounded-[16px] shadow-[0_4px_24px_rgba(0,0,0,0.3),0_1px_4px_rgba(0,0,0,0.2)] flex flex-col items-center justify-center p-10">
          <p className="text-[2rem] font-bold text-text-primary mb-4 tracking-tight">{card.word}</p>
          {card.example_en && (
            <p className="text-[0.9375rem] text-text-secondary italic max-w-[420px] leading-relaxed">&ldquo;{card.example_en}&rdquo;</p>
          )}
          <p className="text-[0.8rem] text-text-secondary opacity-60 mt-6">натисніть, щоб перегорнути</p>
        </div>

        {/* Back */}
        <div className="absolute w-full h-full backface-hidden rotate-y-180 bg-bg-elevated border border-[rgba(16,185,129,0.2)] rounded-[16px] shadow-[0_4px_24px_rgba(0,0,0,0.3),0_1px_4px_rgba(0,0,0,0.2)] flex flex-col items-center justify-center p-10">
          {backMode === 'ua' ? (
            <>
              <p className="text-[1.5rem] font-bold text-accent mb-4 tracking-tight">{card.translation_uk}</p>
              {card.example_uk && (
                <p className="text-[0.9375rem] text-text-secondary italic max-w-[420px] leading-relaxed">&ldquo;{card.example_uk}&rdquo;</p>
              )}
            </>
          ) : (
            <p className="text-[1rem] text-text-secondary max-w-[460px] leading-relaxed text-center">{card.definition_en}</p>
          )}
        </div>
      </div>
    </div>
  )
}
