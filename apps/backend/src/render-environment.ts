import { createCanvas, Image } from '@napi-rs/canvas'
import type { DecodedImage, RenderEnvironment, TextStyle } from '@takt/renderer'
import { resolve as resolveUI, type JSXChild, type UINode } from '@takt/ui'
import type { ImageSource } from '@takt/ui/components'
import { readFileSync, statSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const RASTER_EDGE_GUARD = 1

interface TextGeometry {
    readonly width: number
    readonly height: number
    readonly baseline: number
    readonly drawX: number
    readonly advanceWidth: number
    readonly underlineY: number
    readonly underlineThickness: number
}

export interface NodeEnvironmentOptions {
    /** Base directory used for relative image sources. Defaults to repository root. */
    readonly assetRoot?: string
    /** Maximum number of decoded images retained by this environment. */
    readonly imageCacheSize?: number
}

interface CachedImage {
    readonly signature: string
    readonly image: DecodedImage
}

interface ImageResource {
    readonly path: string
    readonly label: string
    readonly signature: string
}

export interface NodeRenderEnvironment extends RenderEnvironment {
    /** Decodes every image needed by content before synchronous rendering. */
    readonly preloadImages: (content: JSXChild) => Promise<void>
}

const DEFAULT_ASSET_ROOT = fileURLToPath(new URL('../../../', import.meta.url))

export function createNodeEnvironment(
    options: NodeEnvironmentOptions = {},
): NodeRenderEnvironment {
    const assetRoot = resolve(options.assetRoot ?? DEFAULT_ASSET_ROOT)
    const imageCacheSize = options.imageCacheSize ?? 32
    if (!Number.isInteger(imageCacheSize) || imageCacheSize < 0) {
        throw new RangeError('imageCacheSize must be a non-negative integer')
    }

    const imageCache = new Map<string, CachedImage>()
    let preparedImages = new Map<string, CachedImage>()
    const canvas = createCanvas(1, 1)
    const ctx = canvas.getContext('2d')

    function resolveImageSource(source: ImageSource): string {
        if (typeof source === 'string') {
            if (source.length === 0) {
                throw new Error('src must not be empty')
            }
            if (/^[a-z][a-z\d+.-]*:/i.test(source)) {
                throw new Error('only local file paths are supported')
            }
            return resolve(assetRoot, source)
        }

        const url = new URL(source.path, source.moduleUrl)
        if (url.protocol !== 'file:') {
            throw new Error('imported images must resolve to a local file')
        }
        return fileURLToPath(url)
    }

    function inspectImage(src: ImageSource): ImageResource {
        const label = typeof src === 'string' ? src : src.path
        let path: string

        try {
            path = resolveImageSource(src)
        } catch (cause) {
            const reason = cause instanceof Error ? `: ${cause.message}` : ''
            throw new Error(`Unable to resolve image "${label}"${reason}`, {
                cause,
            })
        }

        try {
            const stat = statSync(path, { bigint: true })
            if (!stat.isFile()) {
                throw new Error('path does not point to a regular file')
            }

            const signature = `${stat.size}:${stat.mtimeNs}:${stat.ctimeNs}`
            return { path, label, signature }
        } catch (cause) {
            throw new Error(
                `Unable to load image "${label}" resolved to "${path}"`,
                { cause },
            )
        }
    }

    function getCachedImage(resource: ImageResource): CachedImage | undefined {
        const prepared = preparedImages.get(resource.path)
        if (prepared?.signature === resource.signature) return prepared

        const cached = imageCache.get(resource.path)
        if (cached?.signature !== resource.signature) return undefined

        // Reinsert the item to maintain least-recently-used order.
        imageCache.delete(resource.path)
        imageCache.set(resource.path, cached)
        return cached
    }

    function cacheImage(resource: ImageResource, image: DecodedImage): void {
        if (imageCacheSize === 0) return

        imageCache.delete(resource.path)
        imageCache.set(resource.path, { signature: resource.signature, image })
        while (imageCache.size > imageCacheSize) {
            const oldest = imageCache.keys().next().value
            if (oldest === undefined) break
            imageCache.delete(oldest)
        }
    }

    async function decodeImage(resource: ImageResource): Promise<DecodedImage> {
        const encoded = readFileSync(resource.path)
        const source = new Image()
        source.src = encoded
        await source.decode()

        const width = source.naturalWidth
        const height = source.naturalHeight
        if (
            !source.complete ||
            !Number.isInteger(width) ||
            width <= 0 ||
            !Number.isInteger(height) ||
            height <= 0
        ) {
            throw new Error('unsupported or invalid encoded image')
        }

        const imageCanvas = createCanvas(width, height)
        const imageContext = imageCanvas.getContext('2d')
        imageContext.drawImage(source, 0, 0)
        const rgba = imageContext.getImageData(0, 0, width, height).data
        const data = new Uint8Array(rgba.length)
        data.set(rgba)
        return { width, height, data }
    }

    async function prepareImage(resource: ImageResource): Promise<CachedImage> {
        const cached = getCachedImage(resource)
        if (cached !== undefined) return cached

        try {
            const image = await decodeImage(resource)
            cacheImage(resource, image)
            return { signature: resource.signature, image }
        } catch (cause) {
            throw new Error(
                `Unable to decode image "${resource.label}" resolved to "${resource.path}"`,
                { cause },
            )
        }
    }

    function collectImageSources(nodes: readonly UINode[]): ImageSource[] {
        const sources: ImageSource[] = []

        const visit = (node: UINode) => {
            if (node.type === 'image') sources.push(node.props.src)
            for (const child of node.children) visit(child)
        }
        for (const node of nodes) visit(node)

        return sources
    }

    async function preloadImages(content: JSXChild): Promise<void> {
        const resources = new Map<string, ImageResource>()
        for (const source of collectImageSources(resolveUI(content))) {
            const resource = inspectImage(source)
            resources.set(resource.path, resource)
        }

        const entries = await Promise.all(
            [...resources.values()].map(
                async (resource) =>
                    [resource.path, await prepareImage(resource)] as const,
            ),
        )
        preparedImages = new Map(entries)
    }

    function loadImage(src: ImageSource): DecodedImage {
        const resource = inspectImage(src)
        const cached = getCachedImage(resource)
        if (cached !== undefined) return cached.image

        throw new Error(
            `Image "${resource.label}" is not decoded; call preloadImages() before rendering`,
        )
    }

    function applyTextStyle(style: TextStyle) {
        ctx.font = [
            style.italic ? 'italic' : 'normal',
            style.fontWeight,
            `${style.fontSize}px`,
            JSON.stringify(style.fontFamily),
        ].join(' ')

        ctx.textBaseline = 'alphabetic'
    }

    function getTextGeometry(value: string, style: TextStyle): TextGeometry {
        applyTextStyle(style)

        const metrics = ctx.measureText(value)
        const hasInk =
            metrics.actualBoundingBoxAscent !== 0 ||
            metrics.actualBoundingBoxDescent !== 0 ||
            metrics.actualBoundingBoxLeft !== 0 ||
            metrics.actualBoundingBoxRight !== 0
        const horizontalGuard = hasInk ? RASTER_EDGE_GUARD : 0

        // Horizontal bounds stay tight in both modes because they are used
        // for horizontal alignment. Skia can antialias into the adjacent pixel
        // when an outline lands exactly on a reported boundary.
        const left =
            Math.floor(-metrics.actualBoundingBoxLeft) - horizontalGuard
        const right =
            Math.ceil(metrics.actualBoundingBoxRight) + horizontalGuard

        // Font bounds provide a stable baseline and are defined to contain
        // every glyph in the selected font. Tight bounds intentionally follow
        // the actual glyphs and therefore vary with the text content.
        const baseTop =
            style.metrics === 'tight'
                ? Math.floor(-metrics.actualBoundingBoxAscent)
                : Math.floor(-metrics.fontBoundingBoxAscent)
        const baseBottom =
            style.metrics === 'tight'
                ? Math.ceil(metrics.actualBoundingBoxDescent)
                : Math.ceil(metrics.fontBoundingBoxDescent)
        const verticalGuard =
            style.metrics === 'font' || hasInk ? RASTER_EDGE_GUARD : 0
        const top = baseTop - verticalGuard
        const bottom = baseBottom + verticalGuard

        const drawX = -left
        const baseline = -top

        const underlineThickness = Math.max(1, style.fontSize * 0.05)
        const underlineOffset = Math.max(1, style.fontSize * 0.08)
        const underlineY = baseline + underlineOffset

        // Подчёркивание тоже должно попадать в границы bitmap
        const width = Math.max(
            0,
            right - left,
            style.underline
                ? Math.ceil(drawX + metrics.width + RASTER_EDGE_GUARD)
                : 0,
        )

        const height = Math.max(
            0,
            bottom - top,
            style.underline
                ? Math.ceil(underlineY + underlineThickness + RASTER_EDGE_GUARD)
                : 0,
        )

        return {
            width,
            height,
            baseline,
            drawX,
            advanceWidth: metrics.width,
            underlineY,
            underlineThickness,
        }
    }

    return {
        loadImage,
        preloadImages,

        measureText(value, style) {
            const { width, height } = getTextGeometry(value, style)
            return { width, height }
        },

        rasterizeText(value, style) {
            const geometry = getTextGeometry(value, style)
            const { width, height } = geometry

            if (width === 0 || height === 0) {
                return {
                    width,
                    height,
                    buffer: new Uint8Array(0),
                }
            }

            canvas.width = width
            canvas.height = height

            // Изменение размера Canvas сбрасывает настройки контекста
            applyTextStyle(style)
            ctx.fillStyle = '#000'

            ctx.fillText(value, geometry.drawX, geometry.baseline)

            if (style.underline) {
                ctx.fillRect(
                    geometry.drawX,
                    geometry.underlineY,
                    geometry.advanceWidth,
                    geometry.underlineThickness,
                )
            }

            const rgba = ctx.getImageData(0, 0, width, height).data
            const buffer = new Uint8Array(width * height)

            for (let i = 0; i < buffer.length; i++) {
                buffer[i] = rgba[i * 4 + 3] ?? 0
            }

            return { width, height, buffer }
        },
    }
}
