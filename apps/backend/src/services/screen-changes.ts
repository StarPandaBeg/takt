export interface ScreenChange<Name extends string = string> {
    readonly name: Name
    readonly hash: string
}

export interface ScreenChangeServiceOptions<Name extends string> {
    readonly names: readonly Name[]
    readonly getHash: (name: Name) => Promise<string>
    readonly pollInterval?: number
    readonly onError?: (error: unknown) => void
}

type ScreenChangeListener<Name extends string> = (
    change: ScreenChange<Name>,
) => void

const DEFAULT_POLL_INTERVAL = 5_000

/** One revision monitor shared by every connected SSE client. */
export class ScreenChangeService<Name extends string> {
    readonly #names: readonly Name[]
    readonly #getHash: (name: Name) => Promise<string>
    readonly #pollInterval: number
    readonly #onError: (error: unknown) => void
    readonly #listeners = new Set<ScreenChangeListener<Name>>()
    readonly #hashes = new Map<Name, string>()
    #timer: NodeJS.Timeout | undefined
    #refreshing: Promise<void> | undefined
    #refreshAgain = false

    constructor(options: ScreenChangeServiceOptions<Name>) {
        if (
            !Number.isFinite(options.pollInterval ?? DEFAULT_POLL_INTERVAL) ||
            (options.pollInterval ?? DEFAULT_POLL_INTERVAL) <= 0
        ) {
            throw new RangeError('Screen poll interval must be positive')
        }

        this.#names = options.names
        this.#getHash = options.getHash
        this.#pollInterval = options.pollInterval ?? DEFAULT_POLL_INTERVAL
        this.#onError = options.onError ?? (() => undefined)
    }

    subscribe(listener: ScreenChangeListener<Name>): () => void {
        this.#listeners.add(listener)

        if (this.#hashes.size === 0) {
            this.checkNow()
        } else {
            for (const [name, hash] of this.#hashes) listener({ name, hash })
            this.checkNow()
        }
        this.#startPolling()

        return () => {
            this.#listeners.delete(listener)
            if (this.#listeners.size === 0) this.#stopPolling()
        }
    }

    /** Requests an immediate coalesced refresh without spawning parallel reads. */
    checkNow(): void {
        if (this.#listeners.size === 0) return

        this.#refreshAgain = true
        if (this.#refreshing !== undefined) return

        this.#refreshing = this.#runRefreshes()
            .catch(this.#onError)
            .finally(() => {
                this.#refreshing = undefined
                if (this.#refreshAgain) this.checkNow()
            })
    }

    close(): void {
        this.#listeners.clear()
        this.#stopPolling()
    }

    async #runRefreshes(): Promise<void> {
        while (this.#refreshAgain) {
            this.#refreshAgain = false
            await this.#refresh()
        }
    }

    async #refresh(): Promise<void> {
        const revisions = await Promise.all(
            this.#names.map(async (name) => ({
                name,
                hash: await this.#getHash(name),
            })),
        )

        if (this.#listeners.size === 0) return

        for (const change of revisions) {
            if (this.#hashes.get(change.name) === change.hash) continue
            this.#hashes.set(change.name, change.hash)
            for (const listener of this.#listeners) listener(change)
        }
    }

    #startPolling(): void {
        if (this.#timer !== undefined) return
        this.#timer = setInterval(() => this.checkNow(), this.#pollInterval)
        this.#timer.unref()
    }

    #stopPolling(): void {
        if (this.#timer !== undefined) clearInterval(this.#timer)
        this.#timer = undefined
        this.#hashes.clear()
        this.#refreshAgain = false
    }
}
