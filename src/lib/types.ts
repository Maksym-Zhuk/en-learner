export interface User {
  id: string
  email: string
  password_hash: string
  created_at: string
}

export interface Folder {
  id: string
  user_id: string
  name: string
  created_at: string
}

export interface Deck {
  id: string
  user_id: string
  name: string
  emoji: string
  folder_id: string | null
  share_token: string | null
  created_at: string
}

export interface DeckWithCount extends Deck {
  card_count: number
}

export interface Card {
  id: string
  deck_id: string
  word: string
  definition_en: string
  example_en: string
  translation_uk: string
  example_uk: string
  created_at: string
}

export interface DefinitionOption {
  pos: string
  definition: string
  example: string
}

export interface ExampleOption {
  en: string
  uk: string
}

export interface LookupResult {
  word: string
  definition_en: string
  example_en: string
  translation_uk: string
  example_uk: string
  translations_uk?: Record<string, string[]>
  definitions_en?: DefinitionOption[]
  examples?: ExampleOption[]
}

export interface AuthResponse {
  user: {
    id: string
    email: string
  }
}

export interface JwtPayload {
  userId: string
  email: string
  iat?: number
  exp?: number
}
