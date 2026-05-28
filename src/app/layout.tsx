import type { Metadata } from 'next'
import './globals.css'
import { ToastProvider } from '@/components/ToastProvider'
import { LocaleProvider } from '@/lib/i18n'

export const metadata: Metadata = {
  title: 'EN Learner — Флеш-картки',
  description: 'Вивчення англійської мови з флеш-картками',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
        <link
          href="https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@latest/tabler-icons.min.css"
          rel="stylesheet"
        />
      </head>
      <body>
        <ToastProvider>
          <LocaleProvider>
            {children}
          </LocaleProvider>
        </ToastProvider>
      </body>
    </html>
  )
}
