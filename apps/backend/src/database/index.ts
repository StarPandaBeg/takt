import { drizzle } from 'drizzle-orm/libsql'
import { relations } from './schema.js'

export const db = drizzle(process.env.DB_FILE_NAME!, { relations })
