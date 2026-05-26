import { pgTable, uuid, text, timestamp } from 'drizzle-orm/pg-core'

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull().unique(),
  password_hash: text('password_hash').notNull(),
  created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const folders = pgTable('folders', {
  id: uuid('id').primaryKey().defaultRandom(),
  user_id: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const decks = pgTable('decks', {
  id: uuid('id').primaryKey().defaultRandom(),
  user_id: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  folder_id: uuid('folder_id').references(() => folders.id, { onDelete: 'set null' }),
  share_token: uuid('share_token').unique(),
  created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const cards = pgTable('cards', {
  id: uuid('id').primaryKey().defaultRandom(),
  deck_id: uuid('deck_id').notNull().references(() => decks.id, { onDelete: 'cascade' }),
  word: text('word').notNull(),
  definition_en: text('definition_en').notNull(),
  example_en: text('example_en').notNull().default(''),
  translation_uk: text('translation_uk').notNull(),
  example_uk: text('example_uk').notNull().default(''),
  created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})
