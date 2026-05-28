'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Navbar from '@/components/Navbar'
import { useToast } from '@/components/ToastProvider'
import { useLocale } from '@/lib/i18n'

interface RecentSession { id: string; mode: string; correct: number; total: number; day: string; deck_name: string }
interface Stats {
  wordCount: number
  sessionCount: number
  totalAnswered: number
  accuracy: number
  streak: number
  bestStreak: number
  avgSession: number
  last7: number
  prev7: number
  weeklyDelta: number
  perDay: { day: string; answered: number }[]
  byMode: { mode: string; correct: number; total: number }[]
  heatmap: { day: string; answered: number }[]
  topDecks: { id: string; name: string; sessions: number; word_count: number }[]
  recentSessions: RecentSession[]
}

const MODE_ICON: Record<string, string> = {
  flashcards: 'ti-cards', multiple: 'ti-list-check', write: 'ti-pencil', match: 'ti-arrows-shuffle',
}

const CARD = 'bg-bg-surface border border-bg-subtle rounded-md mb-4 py-[18px] px-5'
const STAT_CARD = 'bg-bg-surface border border-bg-subtle rounded-md py-3.5 px-4'

function hmLevel(n: number) {
  if (n === 0) return 0
  if (n < 10) return 1
  if (n < 25) return 2
  if (n < 50) return 3
  return 4
}
const HM_BG = ['bg-bg-elevated', 'bg-[rgba(16,185,129,0.25)]', 'bg-[rgba(16,185,129,0.45)]', 'bg-[rgba(16,185,129,0.7)]', 'bg-accent']

function LineChart({ data }: { data: { day: string; answered: number }[] }) {
  const W = 720, H = 200, pad = 8
  const max = Math.max(1, ...data.map((d) => d.answered))
  const step = data.length > 1 ? (W - pad * 2) / (data.length - 1) : 0
  const pts = data.map((d, i) => {
    const x = pad + i * step
    const y = H - pad - (d.answered / max) * (H - pad * 2)
    return [x, y] as const
  })
  const line = pts.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ')
  const area = `${line} L${pad + (data.length - 1) * step},${H - pad} L${pad},${H - pad} Z`
  return (
    <svg className="w-full h-[200px]" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
      <defs>
        <linearGradient id="fillGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgba(16,185,129,0.35)" />
          <stop offset="100%" stopColor="rgba(16,185,129,0)" />
        </linearGradient>
      </defs>
      <path d={area} fill="url(#fillGrad)" />
      <path d={line} fill="none" stroke="var(--accent)" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
      {pts.map(([x, y], i) => <circle key={i} cx={x} cy={y} r="2.5" fill="var(--accent)" />)}
    </svg>
  )
}

export default function StatsPage() {
  const router = useRouter()
  const { showToast } = useToast()
  const { t } = useLocale()
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)

  const MODE_LABEL: Record<string, string> = {
    flashcards: t('stats.modeFlashcards'),
    multiple: t('stats.modeMultiple'),
    write: t('stats.modeWrite'),
    match: t('stats.modeMatch'),
  }

  useEffect(() => {
    fetch('/api/stats')
      .then(async (res) => {
        if (res.status === 401) { router.push('/login'); return }
        if (!res.ok) { showToast(t('stats.loadError'), 'error'); return }
        setStats(await res.json())
      })
      .catch(() => showToast(t('common.networkError'), 'error'))
      .finally(() => setLoading(false))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="flex flex-col min-h-screen">
      <Navbar />
      <main className="max-w-[1100px] flex-1 w-full mx-auto px-6 pt-6 pb-16">
        <div className="flex justify-between items-end gap-4 mb-7 max-sm:flex-col max-sm:items-stretch">
          <div>
            <h1 className="text-[28px] font-semibold m-0 tracking-[-0.01em]">{t('stats.title')}</h1>
            <p className="text-text-secondary text-[13px] mt-1">{t('stats.subtitle')}</p>
          </div>
        </div>

        {loading ? (
          <div className={CARD}><div className="h-6 w-1/2 rounded bg-bg-elevated animate-pulse mb-2" /><div className="h-4 w-[90%] rounded bg-bg-elevated animate-pulse" /></div>
        ) : !stats ? null : (
          <>
            <div className="grid grid-cols-4 gap-3 mb-3 max-md:grid-cols-2">
              <div className={STAT_CARD}>
                <div className="flex items-center gap-1.5 text-text-secondary text-[13px]"><i className="ti ti-cards" /> {t('stats.words')}</div>
                <div className="text-[28px] font-semibold mt-1 tabular-nums">{stats.wordCount}</div>
                <div className="text-text-muted text-[11px]">{t('stats.inCollection')}</div>
              </div>
              <div className={STAT_CARD}>
                <div className="flex items-center gap-1.5 text-text-secondary text-[13px]"><i className="ti ti-flame" /> {t('stats.streak')}</div>
                <div className="text-[28px] font-semibold mt-1 tabular-nums">{t('stats.streakDays', { n: stats.streak })}</div>
                <div className="text-text-muted text-[11px]">{t('stats.bestStreak', { n: stats.bestStreak })}</div>
              </div>
              <div className={STAT_CARD}>
                <div className="flex items-center gap-1.5 text-text-secondary text-[13px]"><i className="ti ti-target-arrow" /> {t('stats.accuracy')}</div>
                <div className="text-[28px] font-semibold mt-1 tabular-nums">{stats.accuracy}%</div>
                <div className="text-text-muted text-[11px]">{t('stats.allTime')}</div>
              </div>
              <div className={STAT_CARD}>
                <div className="flex items-center gap-1.5 text-text-secondary text-[13px]"><i className="ti ti-history" /> {t('stats.answers')}</div>
                <div className="text-[28px] font-semibold mt-1 tabular-nums">{stats.totalAnswered}</div>
                <div className="text-text-muted text-[11px]">{t('stats.sessionsSummary', { sessions: stats.sessionCount, avg: stats.avgSession })}</div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3 mb-4 max-md:grid-cols-1">
              <div className={`${STAT_CARD} flex items-center gap-3`}>
                <div className={`inline-flex items-center justify-center w-10 h-10 rounded-md ${stats.weeklyDelta >= 0 ? 'bg-[rgba(34,197,94,0.15)] text-success' : 'bg-[rgba(239,68,68,0.12)] text-danger'}`}>
                  <i className={`ti ${stats.weeklyDelta >= 0 ? 'ti-trending-up' : 'ti-trending-down'}`} />
                </div>
                <div>
                  <div className="text-[13px] text-text-secondary">{t('stats.thisWeek')}</div>
                  <div className="text-lg font-semibold tabular-nums">{t('stats.answersCount', { n: stats.last7 })} <span className={stats.weeklyDelta >= 0 ? 'text-success text-[13px]' : 'text-danger text-[13px]'}>{stats.weeklyDelta >= 0 ? '+' : ''}{stats.weeklyDelta}%</span></div>
                </div>
              </div>
              <div className={`${STAT_CARD} flex items-center gap-3`}>
                <div className="inline-flex items-center justify-center w-10 h-10 rounded-md bg-bg-elevated text-text-secondary"><i className="ti ti-calendar-stats" /></div>
                <div>
                  <div className="text-[13px] text-text-secondary">{t('stats.lastWeek')}</div>
                  <div className="text-lg font-semibold tabular-nums">{t('stats.answersCount', { n: stats.prev7 })}</div>
                </div>
              </div>
              <div className={`${STAT_CARD} flex items-center gap-3`}>
                <div className="inline-flex items-center justify-center w-10 h-10 rounded-md bg-[rgba(16,185,129,0.15)] text-accent"><i className="ti ti-bolt" /></div>
                <div>
                  <div className="text-[13px] text-text-secondary">{t('stats.avgSession')}</div>
                  <div className="text-lg font-semibold tabular-nums">{t('stats.answersCount', { n: stats.avgSession })}</div>
                </div>
              </div>
            </div>

            <div className={CARD}>
              <div className="flex flex-wrap justify-between items-center gap-2 mb-3">
                <h2 className="text-lg font-medium m-0">{t('stats.activity14')}</h2>
                <div className="text-text-secondary text-[12px] flex items-center gap-1.5"><span className="inline-block w-2 h-2 rounded-full bg-accent" /> {t('stats.answersPerDay')}</div>
              </div>
              <LineChart data={stats.perDay} />
            </div>

            <div className="grid grid-cols-2 gap-4 max-md:grid-cols-1">
              <div className={CARD}>
                <div className="mb-3"><h2 className="text-lg font-medium m-0">{t('stats.accuracyByMode')}</h2></div>
                <div className="flex flex-col gap-3.5">
                  {stats.byMode.length === 0 && <p className="text-text-muted text-[13px]">{t('stats.noModeData')}</p>}
                  {stats.byMode.map((m) => {
                    const p = m.total > 0 ? Math.round(m.correct / m.total * 100) : 0
                    return (
                      <div key={m.mode}>
                        <div className="flex justify-between items-center text-[13px] mb-1.5">
                          <span className="flex items-center gap-1.5"><i className={`ti ${MODE_ICON[m.mode] || 'ti-circle'} text-text-muted`} />{MODE_LABEL[m.mode] || m.mode}</span>
                          <span className="text-text-muted text-[11px] tabular-nums"><b className="text-text-primary">{m.correct}</b>/{m.total} · <span className="text-accent font-medium">{p}%</span></span>
                        </div>
                        <div className="h-2 rounded-full bg-bg-elevated overflow-hidden"><span className="block h-full bg-accent rounded-full transition" style={{ width: `${p}%` }} /></div>
                      </div>
                    )
                  })}
                </div>
              </div>

              <div className={CARD}>
                <div className="mb-3"><h2 className="text-lg font-medium m-0">{t('stats.topDecks')}</h2></div>
                <div className="flex flex-col gap-1">
                  {stats.topDecks.length === 0 && <p className="text-text-muted text-[13px]">{t('stats.noDecks')}</p>}
                  {stats.topDecks.map((d, i) => (
                    <Link key={d.id} href={`/deck/${d.id}`} className="flex items-center gap-3 py-2 px-1 rounded-md hover:bg-bg-elevated transition">
                      <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-bg-elevated text-text-muted text-[11px] font-semibold">{i + 1}</span>
                      <span className="text-base">📘</span>
                      <span className="flex-1 text-[13px] truncate">{d.name}</span>
                      <span className="text-text-muted text-[11px] tabular-nums"><b className="text-text-primary">{d.sessions}</b> {t('stats.sessionsUnit')} · {d.word_count} {t('stats.wordsCount')}</span>
                    </Link>
                  ))}
                </div>
              </div>
            </div>

            <div className={CARD}>
              <div className="mb-3"><h2 className="text-lg font-medium m-0">{t('stats.recentSessions')}</h2></div>
              {stats.recentSessions.length === 0 ? (
                <p className="text-text-muted text-[13px]">{t('stats.noSessions')}</p>
              ) : (
                <div className="overflow-x-auto">
                  <div className="flex flex-col min-w-[480px]">
                    {stats.recentSessions.map((s) => {
                      const p = s.total > 0 ? Math.round(s.correct / s.total * 100) : 0
                      const color = p >= 80 ? 'text-success' : p >= 50 ? 'text-warning' : 'text-danger'
                      return (
                        <div key={s.id} className="flex items-center gap-3 py-2.5 border-t border-bg-subtle first:border-t-0">
                          <i className={`ti ${MODE_ICON[s.mode] || 'ti-circle'} text-text-muted`} />
                          <span className="flex-1 text-[13px] truncate">{s.deck_name}</span>
                          <span className="text-text-muted text-[11px]">{MODE_LABEL[s.mode] || s.mode}</span>
                          <span className="text-text-muted text-[11px] tabular-nums w-24 text-right">{s.correct}/{s.total} · <span className={`${color} font-medium`}>{p}%</span></span>
                          <span className="text-text-muted text-[11px] w-24 text-right">{s.day}</span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>

            <div className={CARD}>
              <div className="mb-3"><h2 className="text-lg font-medium m-0">{t('stats.heatmap')}</h2></div>
              <div className="overflow-x-auto"><div className="grid grid-rows-7 grid-flow-col gap-1 auto-cols-min">
                {stats.heatmap.map((d) => (
                  <span key={d.day} className={`w-3 h-3 rounded-sm ${HM_BG[hmLevel(d.answered)]}`} title={`${d.day}: ${d.answered}`} />
                ))}
              </div></div>
              <div className="flex items-center gap-1 text-text-muted text-[11px] mt-3">
                {t('stats.heatmapLess')}
                <span className="inline-block w-3 h-3 rounded-sm bg-[rgba(16,185,129,0.25)] mx-1" />
                <span className="inline-block w-3 h-3 rounded-sm bg-[rgba(16,185,129,0.7)] mr-1" />
                <span className="inline-block w-3 h-3 rounded-sm bg-accent mr-1" />
                {t('stats.heatmapMore')}
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  )
}
