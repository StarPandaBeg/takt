# Пакет `@takt/templates`

`templates` определяет generic contracts проекта и сцены, доменные типы демонстрационного календаря и bundled project с двумя экранами 800×480.

## Публичный API

Пакет экспортирует:

- `defineScene`, `Scene`;
- `defineProject`, `Project`, `ProjectSettings`;
- `Event`, `EventState`, `Deadline`, `Note` и helpers выбора элементов;
- готовый `project`.

Внутренние screen/component modules не объявлены как package subpath exports.

```ts
interface Scene<TContext = unknown> {
    readonly generate: (context: TContext) => JSXChild
}

interface ProjectSettings {
    readonly screen: { readonly width: number; readonly height: number }
}
```

`defineScene` только оборачивает generator в `{ generate }`. `defineProject<TContext>(config?)` возвращает generic builder, который сохраняет literal types settings/scenes и, если передан config, применяет глобальный UI `setConfig`.

```tsx
import { defineProject, defineScene } from '@takt/templates'
import { Text } from '@takt/ui/components'

interface Context {
    readonly title: string
}

const status = defineScene((ctx: Context) => <Text>{ctx.title}</Text>)

const project = defineProject<Context>()({
    settings: { screen: { width: 200, height: 80 } },
    scenes: { status },
})
```

## Bundled project

`project.settings.screen` равен `800 × 480`. UI typography presets переключаются с Arial на Inter по имени family; файл шрифта пакет не регистрирует и не поставляет.

Контекст сцены `main` содержит:

```ts
interface CalendarMainContext {
    today: DateTime
    events: Event[]
    deadlines: Deadline[]
    notes: Note[]
}
```

`Event.end` optional, поэтому событие без продолжительности поддерживается. Bundled scenes:

| Имя | Содержимое |
| --- | --- |
| `main` | дата, время обновления, deadlines, события, notes и вертикальная неделя |
| `splash` | полноэкранный dithered background и изображение panda |

Обе сцены детерминированы относительно context и локальных asset files. Они не обращаются к сети или базе.

## Взаимодействие

Backend индексирует `project.scenes` по URL parameter, формирует `ProjectContext`, вызывает `generate`, preloads найденные `Image` sources и передаёт результат renderer вместе с `project.settings.screen`. Подробнее — [проекты и сцены](../concepts/scenes.md).

