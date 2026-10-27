import * as schema from '#src/database/schema.js'
import * as templates from '@takt/templates'

export const convert = (note: schema.Note): templates.Note => {
    return {
        text: note.text,
        done: note.completed_at !== null,
    }
}
