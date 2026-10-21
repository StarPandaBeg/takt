export interface PositionProps {
    readonly x?: number
    readonly y?: number
}

export interface SizeProps {
    readonly width?: number
    readonly height?: number
}

export interface TransformProps extends PositionProps, SizeProps {}
