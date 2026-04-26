---
title: Keyboard Handling
description: How keyboard input, deletion, overlay triggers, and caret recovery flow through core.
keywords: [keyboard, caret recovery, raw selection, replaceRange, overlay]
---

Markput handles text input, deletion, paste, overlay insertion, block editing, and mark commands through core-owned raw positions.

## Edit Flow

1. React/Vue render adapter-owned token shells and text surfaces.
2. The adapter registers the root with `store.dom.container` and child structure with `store.dom.refFor()`.
3. Keyboard handlers convert the browser selection to a raw serialized range through `store.dom`.
4. Edits call `store.value.replaceRange()` or `store.value.replaceAll()`.
5. Core schedules `caret.recovery` and applies it after the next render.

Production code should not infer token identity from DOM child order or public data attributes.

## Text Input

Inline text input uses the current raw selection:

```ts
store.value.replaceRange(selection.range, text, {
    source: 'input',
    recover: {kind: 'caret', rawPosition: selection.range.start + text.length},
})
```

Controlled editors emit `onChange` first and apply recovery after the matching prop echo.

## Deleting Around Marks

Collapsed Backspace/Delete uses raw position boundaries. If the adjacent token is a mark, core deletes the whole mark range. If the adjacent token is text, core deletes the relevant character or selected raw range.

## Mark Commands

Use `useMark()` for mark-specific actions:

```tsx
import {useMark} from '@markput/react'

function RemovableMention() {
    const mark = useMark()
    return (
        <button type="button" onClick={() => mark.remove()}>
            @{mark.value}
        </button>
    )
}
```

To update a mark, call `mark.update()`:

```tsx
mark.update({value: 'alice'})
mark.update({meta: {kind: 'clear'}})
```

The hook no longer exposes a DOM ref. Focus moves through registered token shells and text surfaces owned by the adapters.

## Overlay Triggers

Overlay trigger probing uses the current raw caret position. During input, core can also use pending caret recovery to detect triggers before the browser selection has caught up to the new render.

## Custom Keyboard Handlers

Attach custom handlers to the container through `slotProps.container`, but let Markput own text mutation:

```tsx
<MarkedInput
    slotProps={{
        container: {
            onKeyDown(event) {
                if (event.key === 'Escape') {
                    // custom behavior
                }
            },
        },
    }}
/>
```

If a handler changes editor text, route it through component state (`value`/`onChange`) or a mark command. Do not mutate parsed tokens directly.
