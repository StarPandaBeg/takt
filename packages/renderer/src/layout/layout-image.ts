import type { DecodedImage } from '../types.js'
import { defineLayout } from './handler.js'

export interface ImageLayoutData {
    readonly image: DecodedImage
}

export const ImageLayout = defineLayout<
    'image',
    { imageData: ImageLayoutData }
>('image', {
    measure(node, context) {
        const image = context.loadImage(node.props.src)
        const { width: naturalWidth, height: naturalHeight, data } = image
        const sourceName =
            typeof node.props.src === 'string'
                ? node.props.src
                : node.props.src.path

        if (
            !Number.isInteger(naturalWidth) ||
            naturalWidth <= 0 ||
            !Number.isInteger(naturalHeight) ||
            naturalHeight <= 0 ||
            data.length !== naturalWidth * naturalHeight * 4
        ) {
            throw new RangeError(
                `Invalid decoded image dimensions for "${sourceName}"`,
            )
        }

        const hasWidth = node.props.width >= 0
        const hasHeight = node.props.height >= 0
        let width = hasWidth ? node.props.width : naturalWidth
        let height = hasHeight ? node.props.height : naturalHeight

        if (hasWidth && !hasHeight) {
            height = (width * naturalHeight) / naturalWidth
        } else if (!hasWidth && hasHeight) {
            width = (height * naturalWidth) / naturalHeight
        }

        return {
            size: { width, height },
            children: [],
            additionalData: {
                imageData: { image },
            },
        }
    },

    arrange() {
        return []
    },
})
