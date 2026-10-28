import 'dotenv/config'

import { migrate } from 'drizzle-orm/libsql/migrator'
import { fileURLToPath } from 'node:url'
import { db } from './index.js'

const migrationsFolder = fileURLToPath(
    new URL('../../drizzle/', import.meta.url),
)

async function main(): Promise<void> {
    await migrate(db, { migrationsFolder })
    console.info('Database migrations are up to date')
}

void main().catch((error: unknown) => {
    console.error('Failed to migrate Takt database', error)
    process.exitCode = 1
})
