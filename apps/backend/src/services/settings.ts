import * as settingsRepository from '#src/repository/settings.js'
import { DateTime, IANAZone } from 'luxon'

export interface ApplicationSettings {
    readonly timezone: string
    readonly tutorial: 0 | 1
}

const TIMEZONE_KEY = 'timezone'
const TUTORIAL_KEY = 'Tutorial'

let cachedTimezone: string | null = null
let cachedTutorial: 0 | 1 | null = null

export function isValidTimezone(timezone: string): boolean {
    return IANAZone.isValidZone(timezone) || timezone === 'UTC'
}

export async function getSettings(): Promise<ApplicationSettings> {
    if (cachedTimezone !== null && cachedTutorial !== null) {
        return { timezone: cachedTimezone, tutorial: cachedTutorial }
    }

    const [timezoneSetting, tutorialSetting] = await Promise.all([
        settingsRepository.get(TIMEZONE_KEY),
        settingsRepository.get(TUTORIAL_KEY),
    ])
    if (timezoneSetting === undefined) {
        throw new Error('Application timezone setting has not been initialized')
    }
    const timezone = timezoneSetting.value
    if (!isValidTimezone(timezone)) {
        throw new Error(`Stored application timezone is invalid: ${timezone}`)
    }

    const tutorialValue = tutorialSetting?.value ?? '0'
    if (tutorialSetting === undefined) {
        await settingsRepository.set(TUTORIAL_KEY, tutorialValue)
    }
    if (tutorialValue !== '0' && tutorialValue !== '1') {
        throw new Error(`Stored Tutorial setting is invalid: ${tutorialValue}`)
    }

    cachedTimezone = timezone
    cachedTutorial = Number(tutorialValue) as 0 | 1
    return { timezone, tutorial: cachedTutorial }
}

export async function getApplicationTimezone(): Promise<string> {
    return (await getSettings()).timezone
}

export async function getApplicationTime(): Promise<DateTime> {
    return DateTime.now().setZone(await getApplicationTimezone())
}

export async function updateSettings(changes: {
    readonly timezone?: string | undefined
    readonly tutorial?: 0 | 1 | undefined
}): Promise<ApplicationSettings> {
    if (changes.timezone !== undefined) {
        cachedTimezone = null
        await settingsRepository.set(TIMEZONE_KEY, changes.timezone)
    }
    if (changes.tutorial !== undefined) {
        cachedTutorial = null
        await settingsRepository.set(TUTORIAL_KEY, String(changes.tutorial))
    }
    return getSettings()
}
