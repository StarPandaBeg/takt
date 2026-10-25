import * as templates from '@takt/templates'
import * as schema from '../database/schema.js'

export const convert = (note: schema.Note): templates.Note => {
    return {
        text: note.text,
        done: note.completed_at !== null,
    }
}
