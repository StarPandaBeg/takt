import type { Event as TemplateEvent } from '@takt/templates'
import { DateTime } from 'luxon'
import type { Event } from '../database/schema.js'

export const convertEvent = (event: Event): TemplateEvent => {
    const zone = event.timezone ?? 'Europe/Moscow'
    return {
        text: event.title,
        start: DateTime.fromJSDate(event.start).setZone(zone),
        ...(event.end === null
            ? {}
            : { end: DateTime.fromJSDate(event.end).setZone(zone) }),
    }
}
