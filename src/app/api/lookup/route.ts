import { NextRequest, NextResponse } from 'next/server'
import { getUser } from '@/lib/auth'

async function translateText(text: string, targetLang: string): Promise<string> {
  try {
    const encoded = encodeURIComponent(text)
    const res = await fetch(
      `https://lingva.ml/api/v1/en/${targetLang}/${encoded}`,
      { signal: AbortSignal.timeout(5000) }
    )
    if (!res.ok) return ''
    const data = await res.json()
    return data.translation || ''
  } catch {
    return ''
  }
}

export async function GET(request: NextRequest) {
  const user = getUser(request)
  if (!user) {
    return NextResponse.json({ error: 'Неавторизовано' }, { status: 401 })
  }

  const word = request.nextUrl.searchParams.get('word')?.trim()
  if (!word) {
    return NextResponse.json({ error: 'Параметр word обовʼязковий' }, { status: 400 })
  }

  try {
    // Fetch dictionary data and translation in parallel
    const [dictRes, translationRaw] = await Promise.all([
      fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`, {
        signal: AbortSignal.timeout(6000),
      }),
      translateText(word, 'uk'),
    ])

    let definition_en = ''
    let example_en = ''

    if (dictRes.ok) {
      const dictData = await dictRes.json()
      const entry = dictData[0]
      if (entry?.meanings?.[0]) {
        const meaning = entry.meanings[0]
        const def = meaning.definitions?.[0]
        if (def) {
          definition_en = def.definition || ''
          example_en = def.example || ''
        }
      }
    }

    if (!definition_en) {
      definition_en = `The word "${word}"`
    }

    // Translate example if we have one
    let example_uk = ''
    if (example_en) {
      example_uk = await translateText(example_en, 'uk')
    }

    const translation_uk = translationRaw || word

    return NextResponse.json({
      word,
      definition_en,
      example_en,
      translation_uk,
      example_uk,
    })
  } catch (error) {
    console.error('Lookup error:', error)
    return NextResponse.json({ error: 'Не вдалося знайти слово' }, { status: 500 })
  }
}
