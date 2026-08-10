---
title: Keyboard Handling
description: How keyboard input, deletion, overlay triggers, and caret placement flow through core.
keywords: [keyboard, selection, node anchor, replace, overlay, caret]
---

Markput handles text input, deletion, paste, overlay insertion, block editing, and mark commands through core-owned NODE ANCHORS — a node plus a local offset, never an absolute position in the value string.

## Edit Flow

1. React/Vue render adapter-owned token shells and text surfaces.
2. The adapter registers the root with `store.host.container` and child structure through `store.tokens.control()` (for non-editable controls inside a token) and `store.tokens.children(ownerId)` (for nested `__slot__` child sequence hosts).
3. Keyboard handlers read the browser selection as a pair of node anchors through `store.selection.domAnchors()`.
4. Edits call `store.edit.replace(from, to, text)`, which places the post-edit caret itself; a caller that needs a different caret writes `store.selection.select(anchor)`.
5. `SelectionController` stores the selection as node anchors and applies them to the DOM after the next render, placing each anchor through its OWN node.

Production code should not infer token identity from DOM child order or public data attributes.

## Text Input

Inline text input uses the selection the DOM reports:

```ts
const anchors = store.selection.domAnchors()
if (anchors) store.edit.replace(anchors.anchor, anchors.head, text)
```

`store.edit.replace(from, to, replacement)` moves the caret for you, to the end of what it inserted; the pair is normalized, so `from` after `to` is legal. To move the caret without editing, write `store.selection.select(anchor)`.

Controlled editors emit `onChange` first and update the accepted value after the matching prop echo.

## Deleting Around Marks

Collapsed Backspace/Delete asks the tree for the mark ADJACENT to the caret anchor. If there is one, core deletes the whole mark. Otherwise it steps the anchor one character and deletes that span.

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
