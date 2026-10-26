# Пакет `@takt/renderer`

`renderer` принимает JSX content и viewport, строит layout и возвращает монохромный frame. Платформенные операции измерения/растеризации текста и декодирования изображений инъецируются через `RenderEnvironment`.

## Публичный API

Из `@takt/renderer` экспортируются:

- `createRenderer(env): RenderFunction`;
- `FramePixel` (`WHITE = 0`, `BLACK = 1`);
- типы из `types.ts`, включая `RenderEnvironment`, `RenderInput`, `RenderedFrame`, `Size`, `Bounds`, `MeasuredNode`, `LayoutNode` и `LayoutRoot`.

Из `@takt/renderer/exporters` экспортируются `exportPng` и `FrameExporter`.

```ts
interface RenderEnvironment {
    measureText(value: string, style: TextStyle): Size
    rasterizeText(value: string, style: TextStyle): TextBitmap
    loadImage(src: string): DecodedImage
}

interface RenderInput {
    content: JSXChild
    viewport: { width: number; height: number }
}
```

Viewport обязан содержать положительные целые размеры. `createRenderer` возвращает синхронную функцию; `exportPng(frame)` асинхронен.

## Pipeline

1. `resolve(content)` создаёт `UINode[]`.
2. `computeLayout` измеряет каждый root node с constraints, равными viewport.
3. Arrange phase превращает относительные offsets в абсолютные bounds.
4. `rasterize` создаёт white frame (`Uint8Array` из нулей) и обходит layout depth-first в paint order.
5. `exportPng` валидирует frame, упаковывает восемь pixels в byte и создаёт opaque 1-bit grayscale PNG.

Frame до экспорта хранит один byte на pixel, а не packed 1-bpp. Это внутреннее представление renderer, не firmware framebuffer format.

## Поддерживаемая графика

- `Rect`: fill/stroke, rounded corners и ordered 2×2 patterns для gray colors.
- `Line`: thickness и round ends по умолчанию; `butt` ограничивает линию endpoints.
- `Text`: multiline, horizontal/vertical alignment, `cut`, `emphasis` и word `line` overflow, underline/strikethrough.
- `Image`: `contain`/`cover`/`fill`, nearest или bilinear scaling, brightness modes, threshold/ordered/Floyd–Steinberg dithering, inversion и alpha composition.
- `Group` и `Flex` сами pixels не рисуют, а только размещают детей.

Rasterization обрезает writes по frame bounds. Paint order совпадает с порядком обхода: node handler, затем дети слева направо; поздние root nodes могут перекрыть ранние.

## Внутренние extension points

В исходниках есть `LayoutHandler`, `defineLayout`, `layoutRegistry`, `DrawHandler`, `defineDrawHandler` и `drawRegistry`. Они типизированы по `NodeType`, но не экспортируются через package entry points. Это текущая внутренняя организация, а не стабильный plugin API.

Правила layout и handler data подробно разобраны в [Layout и rendering](../concepts/layout-rendering.md).

## Ограничения

- `constraints` передаются handlers, но встроенные handlers пока не clamp-ят размеры к ним.
- У `Line` size равен `abs(dx) × abs(dy)` и не учитывает stroke width или отрицательное направление как полноценный visual bounding box; исходный код рекомендует использовать линии на root scene level.
- Текст с explicit bounds не клиппится по этим bounds; clipping действует только по frame.
- У renderer один render target — `RenderedFrame`; PNG и packed ESP
  framebuffer являются отдельными exporters. Browser Canvas target пока
  отсутствует.

