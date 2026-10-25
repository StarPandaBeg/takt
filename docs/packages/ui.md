# Пакет `@takt/ui`

`ui` определяет язык описания экрана: custom JSX runtime, primitive components, типы узлов и преобразование JSX в нормализованный `UINode[]`. Пакет не содержит layout или drawing logic.

## Публичные entry points

| Import | Содержимое |
| --- | --- |
| `@takt/ui` | типы JSX/UI tree, `resolve`, primitive registry helpers, colors, quad helpers, typography config |
| `@takt/ui/components` | `Group`, `Rect`, `Text`, `H1`–`H3`, `Flex`, `Row`, `Column`, `Line`, `Image` и их props/types |
| `@takt/ui/jsx-runtime` | `jsx`, `jsxs`, `Fragment`, JSX namespace |
| `@takt/ui/jsx-dev-runtime` | `jsxDEV`, `Fragment`, JSX namespace |

## Примитивы

| Primitive | Назначение и существенные defaults |
| --- | --- |
| `Group` | Абсолютная группировка детей; собственный размер выводится из границ детей |
| `Rect` | Прямоугольник; default `width/height = 0`, fill/stroke выключены, radius `0` |
| `Text` | Текст; natural size обозначается `width/height = -1`, default 16 px Arial, wrapping mode `line` |
| `H1`, `H2`, `H3` | Обёртки `Text` с соответствующим typography preset |
| `Flex` | Одномерный row/column layout; natural size `-1`, default `row`, `start`, gap/padding `0` |
| `Row`, `Column` | Обёртки `Flex` с фиксированным `direction` |
| `Line` | Линия от `(x, y)` на вектор `(dx, dy)`; stroke включён, width `1` |
| `Image` | Локальное изображение; natural dimensions `-1`, `contain`, smoothing, ordered dithering |

Все primitives принимают optional `x` и `y`; `definePrimitive` нормализует их в числа со значением `0`. `DrawColor` допускает `black`, `gray_75`, `gray_50`, `gray_25`, `white`.

```tsx
import { DrawColor } from '@takt/ui'
import { Column, Rect, Text } from '@takt/ui/components'

const content = (
    <Column x={12} y={8} gap={6} padding={[4, 8]}>
        <Text size="h2">Сегодня</Text>
        <Rect width={120} height={1} fill fillColor={DrawColor.GRAY_50} />
    </Column>
)
```

## Нормализация

`definePrimitive(type, normalize)` создаёт function component с полем `nodeType`. При вызове component его props нормализуются ровно один раз и упаковываются в JSX node. `nodeRegistry` содержит шесть встроенных типов: `group`, `rect`, `text`, `flex`, `line`, `image`.

`resolve(input)`:

1. удаляет `null`, `undefined` и boolean;
2. рекурсивно flatten-ит массивы и fragments;
3. превращает raw string/number в `Text`;
4. вызывает functional components;
5. проверяет primitive type по registry;
6. переносит `children` из props в `UINode.children`.

Результат не содержит component functions и пригоден для `JSON.stringify`, если сами props сериализуемы. `key` используется JSX transform, но в `UINode` не переносится.

Подробнее о формах данных — в [JSX и UI tree](../concepts/jsx-ui-tree.md).

## Typography config

Пакет экспортирует mutable module-level `defaultConfig` и `setConfig(DeepPartial<DefaultsConfig>)`. `Text` читает configuration во время создания primitive node. `defineProject(config)` из templates вызывает `setConfig`; bundled project таким образом меняет font family presets на `Inter`.

Это глобальная настройка процесса, а не request-local context. Последовательное создание проектов с разными configs меняет defaults для следующих создаваемых `Text` nodes.

## Расширение

`definePrimitive` и `defineNodeRegistry` публично экспортируются, но renderer поддерживает только типы из встроенного `nodeRegistry`. Созданный отдельно primitive (как `badge` в type-contract test) не становится допустимым runtime node автоматически. Полное добавление типа требует согласованных изменений в UI registry и внутренних layout/draw registries renderer; см. [разработка](../development.md).

