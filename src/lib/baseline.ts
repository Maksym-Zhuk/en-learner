import postgres from 'postgres'
import { createHash } from 'crypto'
import { readFileSync } from 'fs'
import { resolve } from 'path'

interface JournalEntry { tag: string; when: number; breakpoints: boolean }
interface Journal { entries: JournalEntry[] }

async function main() {
  const client = postgres(process.env.DATABASE_URL!, { max: 1 })

  await client`CREATE SCHEMA IF NOT EXISTS drizzle`
  await client`
    CREATE TABLE IF NOT EXISTS drizzle."__drizzle_migrations" (
      id         SERIAL PRIMARY KEY,
      hash       TEXT   NOT NULL,
      created_at BIGINT
    )
  `

  const migrationsDir = resolve('./drizzle')
  const journal: Journal = JSON.parse(
    readFileSync(resolve(migrationsDir, 'meta/_journal.json'), 'utf8')
  )

  for (const entry of journal.entries) {
    const sql = readFileSync(resolve(migrationsDir, `${entry.tag}.sql`), 'utf8')
    const hash = createHash('sha256').update(sql).digest('hex')

    // Drizzle skips migrations where folderMillis <= last applied created_at
    // So we insert with created_at = entry.when to mark this migration as applied
    const existing = await client`
      SELECT id FROM drizzle."__drizzle_migrations" WHERE created_at = ${entry.when}
    `

    if (existing.length > 0) {
      console.log(`⏭  Already baselined: ${entry.tag}`)
    } else {
      await client`
        INSERT INTO drizzle."__drizzle_migrations" (hash, created_at)
        VALUES (${hash}, ${entry.when})
      `
      console.log(`✓  Baselined: ${entry.tag}`)
    }
  }

  await client.end()
  console.log('Baseline complete. Run "npm run db:migrate" for future migrations.')
}

main().catch((err) => { console.error(err); process.exit(1) })
