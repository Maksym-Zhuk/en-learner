'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { useToast } from '@/components/ToastProvider'

interface Preview { email: string; role: string; group_name: string; emoji: string }

export default function InvitePage() {
  const params = useParams()
  const router = useRouter()
  const token = params.token as string
  const { showToast } = useToast()

  const [preview, setPreview] = useState<Preview | null>(null)
  const [loading, setLoading] = useState(true)
  const [accepting, setAccepting] = useState(false)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    fetch(`/api/invites/${token}`)
      .then(async (res) => {
        if (!res.ok) { setNotFound(true); return }
        setPreview(await res.json())
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false))
  }, [token])

  async function accept() {
    setAccepting(true)
    try {
      const res = await fetch(`/api/invites/${token}`, { method: 'POST' })
      if (res.status === 401) {
        showToast('Увійдіть, щоб прийняти запрошення', 'info')
        router.push(`/login?next=/invite/${token}`)
        return
      }
      const data = await res.json()
      if (!res.ok) { showToast(data.error || 'Помилка', 'error'); return }
      showToast('Ви приєдналися до групи!', 'success')
      router.push(`/group/${data.group_id}`)
    } catch { showToast('Помилка мережі', 'error') } finally { setAccepting(false) }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-bg-base flex items-center justify-center">
        <div className="h-[22px] bg-gradient-to-r from-bg-subtle via-[rgba(16,185,129,0.1)] to-bg-subtle bg-[size:200%_100%] rounded [animation:shimmer_1.4s_linear_infinite] w-[360px]" />
      </div>
    )
  }

  return (
    <section className="relative min-h-screen flex items-center justify-center px-6 py-12">
      <div className="fixed inset-0 pointer-events-none"
        style={{ backgroundImage: 'repeating-linear-gradient(0deg,rgba(16,185,129,0.04) 0 1px,transparent 1px 32px),repeating-linear-gradient(90deg,rgba(16,185,129,0.04) 0 1px,transparent 1px 32px)', maskImage: 'radial-gradient(ellipse at center,black,transparent 75%)' }} />
      <div className="relative w-full max-w-[480px] bg-bg-surface border border-bg-subtle rounded-[24px] px-9 py-10 shadow-[0_12px_40px_rgba(0,0,0,0.5)] text-center">
        {notFound || !preview ? (
          <>
            <div className="text-[48px] mb-3">🔒</div>
            <h1 className="text-[22px] m-0">Запрошення недійсне</h1>
            <p className="text-text-secondary text-[13px] mt-2 mb-0">Можливо, його вже використали або відкликали.</p>
            <Link href="/login" className="inline-flex items-center justify-center gap-2 h-12 px-5 bg-accent text-white rounded-[10px] text-[15px] font-medium cursor-pointer transition hover:bg-accent-hover mt-4">На головну</Link>
          </>
        ) : (
          <>
            <div className="text-[48px] mb-3">{preview.emoji}</div>
            <h1 className="text-[22px] m-0">Запрошення до групи</h1>
            <p className="text-text-secondary text-[13px] mt-2 mb-0">
              Вас запрошують у «{preview.group_name}» як {preview.role === 'editor' ? 'редактора' : 'учасника'}.
            </p>
            <button className="inline-flex items-center justify-center gap-2 h-12 px-5 w-full bg-accent text-white rounded-[10px] text-[15px] font-medium cursor-pointer transition hover:bg-accent-hover mt-4 disabled:opacity-60 disabled:cursor-not-allowed" onClick={accept} disabled={accepting}>
              {accepting ? 'Приєднання…' : 'Приєднатися'}
            </button>
          </>
        )}
      </div>
    </section>
  )
}
