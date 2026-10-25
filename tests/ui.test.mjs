import { DrawColor, Fragment, resolve } from '@takt/ui'
import { defineImageAsset, Group, Image, Rect, Text } from '@takt/ui/components'
import { jsx } from '@takt/ui/jsx-runtime'
import assert from 'node:assert/strict'
import test from 'node:test'

test('primitive props are normalized exactly once', () => {
    const [rect] = resolve(Rect({}))
    const [text] = resolve(Text({ children: ['Takt ', 2], x: 4 }))
    const [image] = resolve(Image({ src: 'assets/takt.png' }))

    assert.deepEqual(rect, {
        type: 'rect',
        props: {
            width: 0,
            height: 0,
            fill: false,
            fillColor: DrawColor.BLACK,
            stroke: false,
            strokeColor: DrawColor.BLACK,
            strokeWidth: 1,
            borderRadius: [0, 0, 0, 0],
            x: 0,
            y: 0,
        },
        children: [],
    })
    assert.deepEqual(text, {
        type: 'text',
        props: {
            value: 'Takt 2',
            width: -1,
            height: -1,
            align: 'left',
            alignVertical: 'top',
            fontSize: 16,
            fontFamily: 'Arial',
            fontWeight: 400,
            italic: false,
            underline: false,
            lineHeight: 1.2,
            metrics: 'font',
            color: DrawColor.BLACK,
            maxLineWidth: -1,
            overflow: 'line',
            renderThreshold: 128,
            x: 4,
            y: 0,
        },
        children: [],
    })
    assert.deepEqual(image, {
        type: 'image',
        props: {
            src: 'assets/takt.png',
            width: -1,
            height: -1,
            fit: 'contain',
            smoothing: true,
            dithering: 'ordered',
            brightness: 'perceived',
            threshold: 128,
            invert: false,
            x: 0,
            y: 0,
        },
        children: [],
    })
})

test('resolve handles components, fragments, arrays and groups', () => {
    const CustomRect = () => Rect({ width: 2, height: 3, x: 1 })
    const input = Group({
        x: 5,
        children: jsx(Fragment, {
            children: [jsx(CustomRect, {}), null, false],
        }),
    })

    const [group] = resolve(input)

    assert.equal(group?.type, 'group')
    assert.deepEqual(group?.props, { x: 5, y: 0 })
    assert.equal(group?.children[0]?.type, 'rect')
    assert.deepEqual(group?.children[0]?.props, {
        width: 2,
        height: 3,
        fill: false,
        fillColor: DrawColor.BLACK,
        stroke: false,
        strokeColor: DrawColor.BLACK,
        strokeWidth: 1,
        borderRadius: [0, 0, 0, 0],
        x: 1,
        y: 0,
    })
    assert.doesNotThrow(() => JSON.stringify(group))
})

test('raw strings and numbers resolve as Text nodes with standard props', () => {
    assert.deepEqual(resolve(['raw text', 42]), [
        resolve(Text({ children: 'raw text' }))[0],
        resolve(Text({ children: 42 }))[0],
    ])
})

test('Image preserves a serializable module-relative asset reference', () => {
    const asset = defineImageAsset(
        '../assets/panda.png',
        'file:///app/screen.js',
    )
    const [image] = resolve(Image({ src: asset }))

    assert.deepEqual(image?.props.src, asset)
    assert.equal(
        JSON.stringify(image?.props.src),
        '{"path":"../assets/panda.png","moduleUrl":"file:///app/screen.js"}',
    )
})
