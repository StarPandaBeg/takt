import { defineDrawHandler } from './handler.js'

export const drawGroup = defineDrawHandler('group', {
    draw() {
        // Groups affect layout only and have no pixels of their own.
    },
})
