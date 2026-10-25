# Разработка и расширение

## Где размещать изменения

- Authoring types, JSX behavior и primitive props — `packages/ui`.
- Geometry, text wrapping, drawing и exporters — `packages/renderer`.
- Calendar presentation и scene composition — `packages/templates`.
- Node/HTTP integration и platform adapters — `apps/backend`.

Не помещайте calendar-specific данные в renderer и Canvas/Node dependencies в UI.

## Добавление UI-примитива

Полноценного внешнего registration API пока нет. Новый built-in primitive требует согласованных изменений:

1. Создать component через `definePrimitive` в `packages/ui/src/components/` и нормализовать все optional defaults.
2. Экспортировать component из `components/index.ts`.
3. Добавить component в `nodeRegistry`; это расширит `NodeType`, `NodeProps` и `UINode`.
4. Добавить layout handler и запись в `layoutRegistry`.
5. Если primitive рисует pixels, добавить draw handler и запись в `drawRegistry`. Container-only primitive может не иметь draw handler.
6. Добавить behavior tests и type-contract assertions.

Отдельно созданный `definePrimitive('name', ...)` полезен для type inference, но без регистрации не пройдёт `resolve` и не поддерживается renderer.

## Layout handler

Handler создаётся внутренней функцией `defineLayout(type, { measure, arrange })`.

- `measure` должен измерить нужных детей через `ctx.measureChild`, вернуть собственный `size`, измеренных детей и данные, необходимые drawing phase.
- `arrange` должен разместить измеренных детей через `ctx.placeChild`; возвращаемый список становится `LayoutNode.children`.
- Handler-specific data следует типизировать вторым generic argument, чтобы соответствующий draw handler получил его без `any`.

`layoutRegistry` проверяется mapped type по всем `NodeType`: после добавления primitive TypeScript потребует handler. Эти модули внутренние и не доступны через package exports, поэтому third-party registration без изменения пакета не поддерживается.

## Drawing и exporters

Draw handler регистрируется во внутреннем `drawRegistry`. Он получает готовые absolute bounds, общий `RenderedFrame` и `RenderEnvironment`. Необходимо:

- обрезать любые writes по frame bounds;
- использовать `FramePixel`, а не `DrawColor`, в buffer;
- сохранять порядок рисования и прозрачность, если primitive композитный;
- тестировать fractional/negative bounds и нулевые размеры.

Новый output format лучше оформлять `FrameExporter<TOutput>` рядом с PNG exporter и экспортировать через `@takt/renderer/exporters`. Сейчас exporter registration или generic target registry отсутствуют.

## Новая scene/template

Создайте typed `defineScene` в `packages/templates/src/screens/`, compose UI components и добавьте сцену в `project.scenes`. Dynamic values должны приходить через context. Если context расширяется, обновите `ProjectContext` и composition code backend.

```tsx
export const compact = defineScene<ProjectContext>(({ today }) => (
    <Text>{today.toFormat('dd.MM HH:mm')}</Text>
))
```

Image sources для Node backend должны быть relative paths или `file:` URL. Для module-relative bundled asset используется `new URL('../../assets/name.png', import.meta.url).href`. Backend обязательно должен вызвать `preloadImages(content)` до renderer.

## Проверка изменений

```bash
npm run typecheck
npm run lint
npm test
```

Текущие tests покрывают:

- normalization, fragments, components и serialization UI tree;
- layout/group/flex/text behavior, paint order и clipping;
- image scaling, dithering, alpha и cache invalidation;
- PNG bit packing и validation;
- реальный Fastify response и Node Canvas text geometry;
- compile-time contracts в `tests/type-contracts.ts` через `npm run typecheck`.

При изменении public contract добавляйте compile-time assertion; при изменении pixels — проверку buffer или decoded PNG, а не только snapshot структуры.

## Известные архитектурные зоны

- Registries renderer internal и статичны; стабильного extension API нет.
- Typography config global и mutable.
- Constraints пока informational и не ограничивают layout.
- Backend context hard-coded; storage/sync boundary ещё не появился.
- Device framebuffer format, revisions и SSE отсутствуют.
- Browser renderer/web preview отсутствуют, поэтому pixel parity между browser и Node пока не определена.

Эти ограничения следует учитывать, но не обходить speculative abstractions до появления конкретной задачи.

