import { NextRequest, NextResponse } from 'next/server'
import { getUser } from '@/lib/auth'

interface TranslateResult {
  main: string
  variants: Record<string, string[]>
}

async function translateWord(word: string): Promise<TranslateResult> {
  try {
    const encoded = encodeURIComponent(word)
    const res = await fetch(
      `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=uk&dt=t&dt=bd&q=${encoded}`,
      { signal: AbortSignal.timeout(5000) }
    )
    if (!res.ok) return { main: word, variants: {} }
    const data = await res.json()

    const main: string = data[0]?.[0]?.[0] || word
    const variants: Record<string, string[]> = {}

    if (Array.isArray(data[1])) {
      for (const entry of data[1]) {
        const pos: string = entry[0]
        const words: string[] = entry[1] || []
        if (pos && words.length) variants[pos] = words
      }
    }

    return { main, variants }
  } catch {
    return { main: word, variants: {} }
  }
}

async function translateText(text: string): Promise<string> {
  try {
    const encoded = encodeURIComponent(text)
    const res = await fetch(
      `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=uk&dt=t&q=${encoded}`,
      { signal: AbortSignal.timeout(5000) }
    )
    if (!res.ok) return ''
    const data = await res.json()
    return data[0]?.[0]?.[0] || ''
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
    const [dictRes, translation] = await Promise.all([
      fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`, {
        signal: AbortSignal.timeout(6000),
      }),
      translateWord(word),
    ])

    const definitions_en: { pos: string; definition: string; example: string }[] = []

    if (dictRes.ok) {
      const dictData = await dictRes.json()
      const entry = dictData[0]
      if (entry?.meanings) {
        for (const meaning of entry.meanings) {
          const pos: string = meaning.partOfSpeech || ''
          for (const def of meaning.definitions?.slice(0, 3) ?? []) {
            if (def.definition) {
              definitions_en.push({
                pos,
                definition: def.definition,
                example: def.example || '',
              })
            }
          }
        }
      }
    }

    const first = definitions_en[0]
    const definition_en = first?.definition || `The word "${word}"`

    const uniqueExamples = Array.from(
      new Set(definitions_en.map((d) => d.example).filter(Boolean))
    ).slice(0, 5)

    const translatedExamples = await Promise.all(
      uniqueExamples.map(async (en) => ({ en, uk: await translateText(en) }))
    )

    const example_en = translatedExamples[0]?.en || ''
    const example_uk = translatedExamples[0]?.uk || ''

    return NextResponse.json({
      word,
      definition_en,
      example_en,
      translation_uk: translation.main,
      example_uk,
      translations_uk: translation.variants,
      definitions_en,
      examples: translatedExamples,
    })
  } catch (error) {
    console.error('Lookup error:', error)
    return NextResponse.json({ error: 'Не вдалося знайти слово' }, { status: 500 })
  }
}
