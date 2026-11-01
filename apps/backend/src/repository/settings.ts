import { db } from '#src/database/index.js'
import { settingsTable, type Settings } from '#src/database/schema.js'

export async function get(key: string): Promise<Settings | undefined> {
    const settings = await db.query.settingsTable.findFirst({
        where: { key },
    })
    return settings
}

export async function set(key: string, value: string): Promise<Settings> {
    const now = new Date()
    await db
        .insert(settingsTable)
        .values({ key, value, createdAt: now, updatedAt: now })
        .onConflictDoUpdate({
            target: settingsTable.key,
            set: { value, updatedAt: now },
        })
    const setting = await get(key)
    if (setting === undefined) throw new Error(`Setting ${key} was not saved`)
    return setting
}
