import type { MeasuredNode } from '../types.js'

export function sumSize(
    children: readonly MeasuredNode[],
    getSize: (child: MeasuredNode) => number,
    gap: number,
): number {
    return (
        children.reduce((sum, child) => sum + getSize(child), 0) +
        Math.max(0, children.length - 1) * gap
    )
}

export function maxSize(
    children: readonly MeasuredNode[],
    getSize: (child: MeasuredNode) => number,
): number {
    return children.reduce((max, child) => Math.max(max, getSize(child)), 0)
}
