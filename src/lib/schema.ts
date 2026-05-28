import { pgTable, uuid, text, timestamp, integer } from 'drizzle-orm/pg-core'

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
  emoji: text('emoji').notNull().default('📘'),
  folder_id: uuid('folder_id').references(() => folders.id, { onDelete: 'set null' }),
  share_token: uuid('share_token').unique(),
  created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const groups = pgTable('groups', {
  id: uuid('id').primaryKey().defaultRandom(),
  owner_id: uuid('owner_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  emoji: text('emoji').notNull().default('👥'),
  description: text('description').notNull().default(''),
  created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const groupMembers = pgTable('group_members', {
  id: uuid('id').primaryKey().defaultRandom(),
  group_id: uuid('group_id').notNull().references(() => groups.id, { onDelete: 'cascade' }),
  user_id: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  role: text('role').notNull().default('viewer'),
  created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const groupInvitations = pgTable('group_invitations', {
  id: uuid('id').primaryKey().defaultRandom(),
  group_id: uuid('group_id').notNull().references(() => groups.id, { onDelete: 'cascade' }),
  email: text('email').notNull(),
  role: text('role').notNull().default('viewer'),
  token: uuid('token').notNull().unique().defaultRandom(),
  created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const groupShares = pgTable('group_shares', {
  id: uuid('id').primaryKey().defaultRandom(),
  group_id: uuid('group_id').notNull().references(() => groups.id, { onDelete: 'cascade' }),
  deck_id: uuid('deck_id').references(() => decks.id, { onDelete: 'cascade' }),
  folder_id: uuid('folder_id').references(() => folders.id, { onDelete: 'cascade' }),
  created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const studySessions = pgTable('study_sessions', {
  id: uuid('id').primaryKey().defaultRandom(),
  user_id: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  deck_id: uuid('deck_id').references(() => decks.id, { onDelete: 'set null' }),
  mode: text('mode').notNull(),
  correct: integer('correct').notNull().default(0),
  total: integer('total').notNull().default(0),
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
