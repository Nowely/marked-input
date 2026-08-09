---
title: Keyboard Handling
description: How keyboard input, deletion, overlay triggers, and caret placement flow through core.
keywords: [keyboard, raw selection, replace, overlay, caret range]
---

Markput handles text input, deletion, paste, overlay insertion, block editing, and mark commands through core-owned raw positions.

## Edit Flow

1. React/Vue render adapter-owned token shells and text surfaces.
2. The adapter registers the root with `store.host.container` and child structure through `store.refs.control(path?)` (for non-editable controls inside a token) and `store.refs.children(ownerPath)` (for nested `__slot__` child sequence hosts).
3. Keyboard handlers convert the browser selection to a raw serialized range through `store.selection.readRaw()` or `store.selection.rawPositionFromBoundary()`.
4. Edits call `store.edit.replace()`, which places the post-edit caret itself; a caller that needs a different caret passes an explicit position or writes `store.selection.position(n)`.
5. `SelectionController` stores the selection as node anchors and applies them to the DOM after the next render. `store.selection.range()` is a read-only projection of those anchors into absolute positions.

Production code should not infer token identity from DOM child order or public data attributes.

## Text Input

Inline text input uses the current raw selection:

```ts
store.edit.replace(selection.range, text)
```

`store.edit.replace(range, replacement, caretAt?)` moves the caret for you — to the end of the replacement by default, or to `caretAt` when the natural end is not what the caller wants. To move the caret without editing, write `store.selection.position(n)`; `store.selection.range()` is read-only.

Controlled editors emit `onChange` first and update the accepted value after the matching prop echo.

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
            @{mark.value()}
        </button>
    )
}
```

To update a mark, call `mark.update()`:

```tsx
mark.update({value: 'alice'})
mark.update({meta: null})
```

The hook no longer exposes a DOM ref. Focus moves through registered token shells and text surfaces owned by the adapters.

## Overlay Triggers

Overlay trigger probing uses the current raw caret position (`caret.selection()`). During input, core probes the caret range which is updated synchronously with value edits.

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
