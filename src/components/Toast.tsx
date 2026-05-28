'use client'

export type ToastType = 'success' | 'error' | 'info'

export interface ToastItem {
  id: string
  message: string
  type: ToastType
}

const ICONS: Record<ToastType, string> = {
  success: '✓',
  error: '✕',
  info: 'ℹ',
}

const TYPE_CLASSES: Record<ToastType, string> = {
  success: 'bg-[rgba(34,197,94,0.15)] border border-[rgba(34,197,94,0.3)] text-[#4ade80]',
  error:   'bg-[rgba(239,68,68,0.15)] border border-[rgba(239,68,68,0.3)] text-[#f87171]',
  info:    'bg-[rgba(16,185,129,0.15)] border border-[rgba(16,185,129,0.3)] text-[#6ee7b7]',
}

interface ToastProps {
  items: ToastItem[]
}

export function ToastContainer({ items }: ToastProps) {
  return (
    <div className="fixed top-6 right-6 z-[999] flex flex-col gap-2.5 pointer-events-none" aria-live="polite" aria-atomic="true">
      {items.map((item) => (
        <div
          key={item.id}
          className={`flex items-center gap-2.5 px-5 py-3.5 rounded-[10px] text-sm font-medium max-w-xs pointer-events-auto shadow-[0_4px_16px_rgba(0,0,0,0.3)] [animation:slideInRight_0.3s_ease] ${TYPE_CLASSES[item.type]}`}
        >
          <span className="font-bold text-base">{ICONS[item.type]}</span>
          {item.message}
        </div>
      ))}
    </div>
  )
}
