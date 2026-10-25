import type { Version } from '../database/schema.js'
import * as versionsRepo from '../repository/version.js'

export const get = async (key: Version['key']): Promise<Version['value']> => {
    const version = await versionsRepo.get(key)
    if (!version) return 0
    return version.value
}

export const invalidate = async (
    key: Version['key'],
): Promise<Version['value']> => {
    const version = await versionsRepo.invalidate(key)
    return version.value
}
