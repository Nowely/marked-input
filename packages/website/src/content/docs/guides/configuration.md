---
title: 🚧 Configuration
description: Configure Markput - props, the options array, markup patterns, per-option components, and TypeScript.
keywords: [configuration, markup patterns, options, props, separator, indent, setup]
---

Everything is configured through props on `<MarkedInput>` and through the `options` array it is given.

```tsx uses=MyMarkComponent,users
import {MarkedInput} from '@markput/react'
import {useState} from 'react'

function Editor() {
    const [value, setValue] = useState('')

    return (
        <MarkedInput
            value={value}
            onChange={setValue}
            Mark={MyMarkComponent}
            options={[{markup: '@[__value__](__meta__)', overlay: {trigger: '@', data: users}}]}
        />
    )
}
```

## Props

| Prop            | Type                             | Default  | Purpose                                                                    |
| --------------- | -------------------------------- | -------- | -------------------------------------------------------------------------- |
| `value`         | `string`                         | —        | The document, controlled. Pair it with `onChange`.                          |
| `defaultValue`  | `string`                         | —        | The document, uncontrolled. Read ONCE — setting it later moves nothing.     |
| `onChange`      | `(value: string) => void`        | —        | Fires with the intended value.                                              |
| `options`       | `Option[]`                       | one `@` mention | The markups this editor knows. See below.                            |
| `Mark`          | component                        | —        | Fallback component for every mark an option does not name one for.          |
| `Overlay`       | component                        | built-in | Fallback overlay component.                                                 |
| `Span`          | component                        | `'span'` | Plain-text segments. It receives `value` and the editor's `ref`; the ref must land on the element that shows the text, because that element IS the surface core writes into. |
| `slots`         | `{container, paragraph}`         | `div`    | Replace the root container, or the component a row with no kind renders through. |
| `slotProps`     | `{container, row}`               | —        | Props merged onto the container, or onto every row's wrapper.                |
| `separator`     | `string \| null`                 | `'\n'`   | What delimits [rows](/guides/rows). `null` = the value never splits.        |
| `indent`        | `string`                         | `'\t'`   | The unit a nested row leads with. `''` turns nesting off.                    |
| `history`       | `boolean`                        | `true`   | The editor's own undo stack.                                                 |
| `draggable`     | `boolean \| {alwaysShowHandle}`  | `false`  | Drag grips on rows. Ineffective when `separator` is `null`.                  |
| `readOnly`      | `boolean`                        | `false`  | Read-only mode.                                                              |
| `showOverlayOn` | `'change' \| 'selectionChange' \| 'none' \| Array<…>` | `'change'` | Which events probe for an overlay trigger.                 |
| `className`     | `string`                         | —        | On the container.                                                            |
| `style`         | `CSSProperties`                  | —        | On the container.                                                            |
| `ref`           | `Ref<MarkputHandle>`             | —        | `container` and `focus()`; everything else goes through `value`.              |

Vue takes the same props, with `class` for `className` and a `change` emit for `onChange`.

## The options array

An option is one configured kind of markup: what it serialises to, what renders it, and whether an
overlay may be triggered for it.

```tsx fragment uses=MentionComponent,users,HashtagComponent,hashtags
const options: Option<{userId?: string}>[] = [
    {
        markup: '@[__value__](__meta__)',
        Mark: MentionComponent,
        mark: ({meta}: MarkProps) => ({userId: meta}),
        overlay: {trigger: '@', data: users},
    },
    {
        markup: '#[__value__]',
        Mark: HashtagComponent,
        overlay: {trigger: '#', data: hashtags},
    },
]
```

| Key       | Purpose                                                                                |
| --------- | -------------------------------------------------------------------------------------- |
| `markup`  | The pattern this option matches and serialises to.                                       |
| `Mark`    | The component for this option's marks. Overrides the global `Mark`.                      |
| `mark`    | Props for that component — an object, or a function of `{value, meta}`.                  |
| `Overlay` | The overlay component for this option. Overrides the global `Overlay`.                   |
| `overlay` | `{trigger, data}` — the character that opens an overlay, and the rows it offers.          |
| `row`     | Presence makes this a ROW option. See [Row Kinds](/guides/row-kinds).                    |
| `menu`    | One contribution to the [row menu](/guides/overlay-customization#the-row-menu).           |

The capitalised keys are components; the lowercase ones are their props. That is the whole rule.

## Markup patterns

```tsx fragment
markup: '@[__value__]'                  // @[Alice]
markup: '@[__value__](__meta__)'        // @[Alice](user:1)
markup: '**__slot__**'                  // **bold with *italic* inside**
markup: '<__value__>__slot__</__value__>' // <div>content</div>
```

| Placeholder | Holds                                    | Nesting |
| ----------- | ---------------------------------------- | ------- |
| `__value__` | Main content, plain text                  | no      |
| `__meta__`  | Metadata beside the value, plain text     | no      |
| `__slot__`  | Content that may contain other marks      | yes     |

**A markup must not begin with a placeholder**, must carry at least one, and may not repeat one
except for the two-value `<__value__>…</__value__>` form. A markup that breaks those rules — or an
option with no `markup` at all — is reported to the console and contributes nothing: the option is
skipped and every other option keeps its index.

"Contributes nothing" reaches the overlay too. An `overlay.trigger` on such an option still OPENS the
overlay — that is how an overlay-only option is written, and it is how the `/` row menu is wired —
but choosing a suggestion inserts nothing rather than writing a markup no parser can read back.

Trigger lookup, unlike matching, IS order-sensitive: the FIRST option carrying a trigger character
owns it.

See [How It Works](/development/how-it-works) for the parse, and [Row Kinds](/guides/row-kinds) for
the extra rules a markup takes on when it types a row.

## Mark props

`mark` turns what the markup captured into what your component takes. Two forms:

```tsx fragment uses=Mention,Chip
// Function — derive props from the markup
const derived: Option<{username?: string; userId?: string; href: string}> = {
    markup: '@[__value__](__meta__)',
    Mark: Mention,
    mark: ({value, meta}: MarkProps) => ({
        username: value,
        userId: meta,
        href: `/users/${meta}`,
    }),
}

// Object — fixed props for every mark of this option
const fixed: Option<{variant: string; color: string; size: string}> = {
    markup: '@[__value__]',
    Mark: Chip,
    mark: {variant: 'filled', color: 'primary', size: 'small'},
}
```

Without `mark`, the component receives `{value, meta}` as they were parsed. The two forms do not mix:
the object form has no access to the markup's data.

For a mark that contains other marks, see [Nested Marks](/guides/nested-marks); for reading and
writing a mark at runtime, [Dynamic Marks](/guides/dynamic-marks).

## Component resolution

Components resolve per option:

```
Mark:    option.Mark    →  MarkedInput.Mark   →  error if neither
Overlay: option.Overlay →  MarkedInput.Overlay →  built-in Suggestions
Row:     option.row.Component  (required — slots.paragraph answers only a row with NO kind)
Text:    MarkedInput.Span →  a bare <span>
```

```tsx markup uses=DefaultMark,MentionMark
<MarkedInput
    Mark={DefaultMark}
    options={[
        {markup: '@[__value__]', Mark: MentionMark}, // MentionMark
        {markup: '#[__value__]'}, //                    DefaultMark
    ]}
/>
```

## TypeScript

```tsx fragment uses=Mention,setValue
import {MarkedInput} from '@markput/react'
import type {Option} from '@markput/react'

interface MentionProps {
    username: string
    userId: string
}

const options: Option<MentionProps>[] = [
    {
        markup: '@[__value__](__meta__)',
        Mark: Mention,
        mark: ({value, meta}) => ({username: value ?? '', userId: meta ?? ''}),
        overlay: {trigger: '@', data: ['Alice', 'Bob']},
    },
]

;<MarkedInput<MentionProps> options={options} value={value} onChange={setValue} />
```

## Best practices

```tsx fragment elide uses=users
// Memoize options that are built at render time
const options = useMemo<Option[]>(() => [...], [users])

// Prefer a stable component over an inline arrow in `Mark`
const Mention = ({value}: MarkProps) => <span className="mention">{value}</span>

// Keep `mark` cheap — it runs for every mark on every paint
const mark = ({value, meta}: MarkProps) => ({username: value, userId: meta})
```

**Questions?** Ask in [GitHub Discussions](https://github.com/Nowely/marked-input/discussions).
