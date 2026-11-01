import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
    plugins: [react()],
    server: {
        port: 5173,
        proxy: {
            '/api': {
                target: 'https://takt.stpnd-private.ru',
                changeOrigin: true,
            },
            '/screens': {
                target: 'https://takt.stpnd-private.ru',
                changeOrigin: true,
            },
            '/health': {
                target: 'https://takt.stpnd-private.ru',
                changeOrigin: true,
            },
        },
    },
})
