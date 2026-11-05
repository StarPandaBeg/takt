import * as settingsRepository from '#src/repository/settings.js'
import { DateTime, IANAZone } from 'luxon'

export interface ApplicationSettings {
    readonly timezone: string
}

const TIMEZONE_KEY = 'timezone'

let cachedTimezone: string | null = null

export function isValidTimezone(timezone: string): boolean {
    return IANAZone.isValidZone(timezone) || timezone === 'UTC'
}

export async function getSettings(): Promise<ApplicationSettings> {
    if (cachedTimezone !== null) {
        return { timezone: cachedTimezone }
    }
    const setting = await settingsRepository.get(TIMEZONE_KEY)
    if (setting === undefined) {
        throw new Error('Application timezone setting has not been initialized')
    }
    const timezone = setting.value
    if (!isValidTimezone(timezone)) {
        throw new Error(`Stored application timezone is invalid: ${timezone}`)
    }
    cachedTimezone = timezone
    return { timezone }
}

export async function getApplicationTimezone(): Promise<string> {
    return (await getSettings()).timezone
}

export async function getApplicationTime(): Promise<DateTime> {
    return DateTime.now().setZone(await getApplicationTimezone())
}

export async function updateSettings(changes: {
    readonly timezone?: string | undefined
}): Promise<ApplicationSettings> {
    if (changes.timezone !== undefined) {
        cachedTimezone = null
        await settingsRepository.set(TIMEZONE_KEY, changes.timezone)
    }
    return getSettings()
}
