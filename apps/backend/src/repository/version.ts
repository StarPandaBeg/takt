import { db } from '#/database/index.js'
import { versionsTable, type Version } from '#/database/schema.js'
import { eq, sql } from 'drizzle-orm'

export const get = async (
    key: Version['key'],
): Promise<Version | undefined> => {
    return await db.query.versionsTable.findFirst({ where: { key } })
}

export const invalidate = async (key: Version['key']): Promise<Version> => {
    return (
        await db
            .insert(versionsTable)
            .values({ key, value: 1 })
            .onConflictDoUpdate({
                target: versionsTable.key,
                set: { value: sql`${versionsTable.value} + 1` },
            })
            .returning()
    )[0]!
}

export async function mutate<T>(
    source: string,
    operation: (
        tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
    ) => Promise<T>,
): Promise<T> {
    return db.transaction(async (tx) => {
        const result = await operation(tx)

        await tx
            .update(versionsTable)
            .set({
                value: sql`${versionsTable.value} + 1`,
            })
            .where(eq(versionsTable.key, source))

        return result
    })
}
