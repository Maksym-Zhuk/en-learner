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

interface ToastProps {
  items: ToastItem[]
}

export function ToastContainer({ items }: ToastProps) {
  return (
    <div className="toast-container">
      {items.map((item) => (
        <div key={item.id} className={`toast ${item.type}`}>
          <span style={{ fontWeight: 700, fontSize: '1rem' }}>{ICONS[item.type]}</span>
          {item.message}
        </div>
      ))}
    </div>
  )
}
