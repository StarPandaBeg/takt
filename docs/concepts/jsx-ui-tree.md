# JSX и UI tree

## JSX runtime

Пакеты с TSX используют automatic transform:

```json
{
    "jsx": "react-jsx",
    "jsxImportSource": "@takt/ui"
}
```

`jsx(type, props, key?)` создаёт простой объект `JSXNode`; `jsxs` является alias. Здесь нет React, reconciliation, hooks или lifecycle. Intrinsic lowercase tags отключены (`IntrinsicElements = Record<never, never>`), поэтому интерфейс строится только из function components.

```ts
interface JSXNode {
    readonly type: NodeType | typeof Fragment | Component
    readonly props: JSXProps
    readonly key?: string | number
}
```

## Три формы дерева

```mermaid
flowchart LR
    TSX[TSX] --> JSXNode["JSXNode / JSXChild"]
    JSXNode -->|resolve| UINode["UINode[]"]
    UINode -->|measure + arrange| LayoutNode["LayoutRoot / LayoutNode"]
```

1. **JSX tree** может содержать function references, fragments, nested arrays и raw text.
2. **UI tree** содержит только зарегистрированный `type`, normalized `props` и `children`. Functional components уже выполнены.
3. **Layout tree** добавляет рассчитанные `bounds` и handler-specific data, не меняя исходный `UINode`.

## Functional components и Fragment

Component — синхронная функция `(props) => JSXChild`. Во время `resolve` она вызывается немедленно, после чего результат разрешается рекурсивно. `Fragment` не создаёт `UINode`, а только объединяет детей. Arrays flatten-ятся на любой глубине; boolean и nullish values пропускаются.

Raw string и number превращаются в `Text` с default props:

```tsx
<Group>
    Текст {42}
</Group>
```

даёт два text nodes, а не одну конкатенированную строку. Для одной строки следует явно использовать `<Text>Текст {42}</Text>`: `Text.children` принимает scalar или массив values и соединяет массив без separator.

## Primitive boundary

`definePrimitive` принимает input props и normalize function. Результат normalizer дополняется `x/y`, а `children` при разрешении перемещаются в отдельное поле. Например, `Rect` всегда доходит до renderer с полным набором defaults, а не с optional input props.

```ts
type UINode = {
    readonly type: NodeType
    readonly props: Readonly<NodeProps<NodeType>>
    readonly children: readonly UINode[]
}
```

Нормализация отделяет authoring API от renderer contract: renderer не повторяет default logic. Type correlation между `type` и `props` задаётся mapped union `UINode` и `NodeOf<T>`.

## Сериализация

После `resolve` built-in scenes не содержат functions, symbols или Luxon objects: даты уже форматированы в text strings, а image URLs представлены строками. Тест подтверждает `JSON.stringify` resolved tree. При этом UI не выполняет отдельную runtime-проверку произвольных пользовательских prop values на JSON compatibility; гарантия основана на normalizers конкретных primitives.

## Ошибки и особенности

- Неизвестный JSX element type вызывает `Unsupported JSX element type`.
- `key` не является layout identity и исчезает после resolution.
- Primitive registries статичны. Отдельный вызов `definePrimitive` не регистрирует новый тип в основном runtime.
- `setConfig` влияет на последующую нормализацию `Text`, но уже созданные JSX nodes не меняются.

