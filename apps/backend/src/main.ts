import { buildApp } from './app.js'

const DEFAULT_HOST = '0.0.0.0'
const DEFAULT_PORT = 3000

function readPort(value: string | undefined): number {
    if (value === undefined) return DEFAULT_PORT

    const port = Number(value)
    if (!Number.isInteger(port) || port < 0 || port > 65_535) {
        throw new RangeError(`Invalid PORT: ${value}`)
    }

    return port
}

async function main() {
    const host = process.env['HOST'] ?? DEFAULT_HOST
    const port = readPort(process.env['PORT'])
    const app = buildApp()
    let isClosing = false

    const close = async (signal: NodeJS.Signals) => {
        if (isClosing) return
        isClosing = true
        app.log.info({ signal }, 'Stopping Takt backend')
        await app.close()
    }

    const shutdown = (signal: NodeJS.Signals) => {
        void close(signal).catch((error: unknown) => {
            app.log.error(error, 'Failed to stop Takt backend')
            process.exitCode = 1
        })
    }

    process.once('SIGINT', () => shutdown('SIGINT'))
    process.once('SIGTERM', () => shutdown('SIGTERM'))

    await app.listen({ host, port })
}

void main().catch((error: unknown) => {
    console.error('Failed to start Takt backend', error)
    process.exitCode = 1
})
