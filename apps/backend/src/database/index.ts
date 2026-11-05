import { drizzle } from 'drizzle-orm/libsql'
import { relations } from './schema.js'

const databaseUrl = process.env.DB_FILE_NAME
if (databaseUrl === undefined || databaseUrl.length === 0) {
    throw new Error('DB_FILE_NAME must contain a libSQL database URL')
}

export const db = drizzle(databaseUrl, { relations })

if (databaseUrl.startsWith('file:') && !databaseUrl.includes(':memory:')) {
    void db.$client.execute('PRAGMA journal_mode = WAL;').catch(() => {})
    void db.$client.execute('PRAGMA synchronous = NORMAL;').catch(() => {})
}
