import type { RenderedFrame } from '../types.js'

/** Converts a finished raster frame into an external representation. */
export type FrameExporter<TOutput> = (
    frame: Readonly<RenderedFrame>,
) => Promise<TOutput>
