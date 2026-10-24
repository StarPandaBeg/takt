import { DrawColor, Fragment, resolve } from '@takt/ui'
import { Group, Rect, Text } from '@takt/ui/components'
import { jsx } from '@takt/ui/jsx-runtime'
import assert from 'node:assert/strict'
import test from 'node:test'

test('primitive props are normalized exactly once', () => {
    const [rect] = resolve(Rect({}))
    const [text] = resolve(Text({ children: ['Takt ', 2], x: 4 }))

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
            color: DrawColor.BLACK,
            maxLineWidth: -1,
            renderThreshold: 128,
            x: 4,
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

test('raw text values are rejected outside Text', () => {
    assert.throws(
        () => resolve(['raw text', 42]),
        /Text values must be wrapped in the Text component/,
    )
})
