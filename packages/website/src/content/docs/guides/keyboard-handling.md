---
title: Keyboard Handling
description: How keyboard input, deletion, overlay triggers, and caret placement flow through core.
keywords: [keyboard, selection, node anchor, replace, overlay, caret]
---

Markput handles text input, deletion, paste, overlay insertion, row editing, and mark commands through core-owned NODE ANCHORS — a node plus a local offset, never an absolute position in the value string.

## Edit Flow

1. React/Vue render adapter-owned token shells and text surfaces.
2. The adapter registers the root with `store.host.container` and child structure through `store.tokens.control()` (for non-editable controls inside a token) and `store.tokens.children(ownerId)` (for nested `__slot__` child sequence hosts).
3. Keyboard handlers read the browser selection as a pair of node anchors through `store.tokens.domAnchors()`.
4. Edits call `store.edit.replace(from, to, text)`, which places the post-edit caret itself; a caller that needs a different caret writes `store.tokens.selection.select(anchor)`.
5. `store.tokens.selection` stores the selection as node anchors and its DOM driver applies them after the next render, placing each anchor through its OWN node.

Production code should not infer token identity from DOM child order or public data attributes.

## Text Input

Inline text input uses the selection the DOM reports:

```ts
const anchors = store.tokens.domAnchors()
if (anchors) store.edit.replace(anchors.anchor, anchors.head, text)
```

`store.edit.replace(from, to, replacement)` moves the caret for you, to the end of what it inserted; the pair is normalized, so `from` after `to` is legal. To move the caret without editing, write `store.tokens.selection.select(anchor)`.

It also reads the live selection into `store.tokens.selection` before it commits, because `selectionchange` is delivered on a task of its own: a caret that has moved since the last one leaves the stored anchors naming where it was, and an edit is addressed from the DOM. So "where the caret was" — the position an undo goes back to, and the one a controlled echo maps into a post-edit caret — is always the browser's reading at the moment of the edit. A selection the editor cannot resolve, one inside a registered control root or a consumer's own `contenteditable` island, leaves the stored anchors standing.

Controlled editors emit `onChange` first and update the accepted value after the matching prop echo.

## Undo and Redo

The editor keeps its own stack, in both value modes. `Ctrl/Cmd+Z` undoes and `Shift+Ctrl/Cmd+Z` redoes; so do the `historyUndo` and `historyRedo` input types, which is how the Edit menu and trackpad gestures arrive. Native browser undo stays swallowed — every input path cancels its default, so the browser's own stack is empty by construction.

An undo restores the value AND the caret the edit was made from, and it replays the edit's own splice, so a row keeps its identity across an undone move. Consecutive characters typed forward within 500ms are one entry; every row verb — a move, a duplicate, a turn-into — is its own entry, and so is a paste.

Wire your own controls to the same stack:

```ts
store.history.canUndo() // reactive: safe to read inside a computed
store.history.undo()    // answers whether the document moved
store.history.redo()
```

In a controlled editor an entry is recorded only once your `onChange` has echoed the value back. An emission you decline leaves nothing behind, and a value you write yourself — a reset, a change from elsewhere — leaves `canUndo()` false until the document is back at an entry the editor recorded.

Pass `history={false}` to turn both keys back into no-ops.

## Selecting Rows

Where the value splits into rows, `Esc` turns the caret into a ROW SELECTION: the whole row it sits in, and one level wider on each press after that. `Shift+ArrowUp`/`Shift+ArrowDown` grow the selection by a row — absorbing that row whole, so growing past a first child reaches its parent — and `Ctrl/Cmd+A` widens a nested row selection to the row it is nested in before it selects the whole document.

There is no separate row-selection state: a row is selected exactly while the text selection spans it whole, so the browser paints it and every read is one call.

```ts
store.rows.selected() // reactive: the ids of the selected rows, in document order
store.rows.move({parent: null, index: 2}) // move them, as one splice
```

An arrow key is only ever intercepted once a row selection stands — which follows from the selection being derived and is not a synonym for "after `Esc`": a plain text selection that spans one row WHOLE grows by a row rather than by a line, and what `Shift+ArrowDown` writes back is that row's exact span, so the sweep becomes a row selection at that press. Until then `store.rows.selected()` is empty and no verb acts on the row the sweep merely covers. At the document's edges the key is still the gesture's and does nothing, rather than falling back to the browser and collapsing the selection it was extending. `Esc` defers to anything already open — the suggestions overlay and the row menu — each of which closes on that press instead. An EMPTY row cannot be row-selected on its own — its content is zero-width, so a caret resting in one sits at both of its edges — but it is selected as part of a range that spans its neighbours.

Widening never narrows: where a selection spans two parents, `Esc` and `Ctrl/Cmd+A` climb to the parent AND keep the rows outside it, and once every selected row is a root `Esc` leaves the selection alone.

`Enter` over a TEXT range is deliberately not the replace-the-range rule: it splices a row boundary at the range's LOW end and KEEPS what was selected, so nothing a selection covers is lost to the key that opened a row above it. Over a ROW SELECTION it does replace, opening one fresh row where the selected rows were — the same answer it gives for an all-selected document, at row granularity.

A row selection is the ROWS, openers and leads included, and paste, cut and `Backspace`/`Delete` all read it that way: a paste replaces the selected rows with the clip, a cut or a delete takes them away rather than emptying the first, and what a copy put on the clipboard is exactly what those two write over. This applies wherever the selection covers a whole number of rows EXACTLY — including the one a triple-click makes, which is a row selection by every reading this editor has, and excluding a sweep that runs from mid-row into another row, which is a text selection however much of a row it covers. TYPING is not one of them: a character replaces the text that was selected and the row it was typed in keeps its kind.

A clip pasted over a row selection takes the same rules it takes at a caret in the same row: a FOREIGN clip's lines each open a row at the covered rows' depth, carrying their kind wherever the kind declares `continues`, so a one-line clip keeps the kind exactly as typing does; this editor's own clip is the value's own projection and is spliced verbatim.

`Tab` and `Shift+Tab` move every row the selection holds, in one splice; where no row selection stands they move the caret's own row. A step no selected row can take moves none of them. `indents` is asked of every row the key would move rather than of the first: a selection holding one row of a kind that declares nothing leaves the key to the browser, exactly as a caret in that row does.

Dragging a row's grip carries the whole row selection when the gripped row is part of it, and that row alone otherwise. Where the drop lands — including how DEEP — comes from the pointer: its vertical position names the gap between two lines, its horizontal position names one of the depths that gap legally admits, and every candidate is planned before it is offered, so the drop indicator promises rather than predicts. A pointer below a nested subtree names the gap after that subtree's LAST line, not the slot under the root it started at. The placement the rows ALREADY hold is one of the depths a gap offers, so releasing at a row's own indent leaves it where it was instead of re-indenting it. The rows in flight are stepped over at BOTH ends of a gap, so a dragged row's own gap offers the same depths whether the pointer sits on the upper half of its line or the lower.

## Copying and Pasting

Copying part of a TYPED row emits a partial RE-ANNOTATION rather than the painted text: half a heading copies as `'# half'`, and one cell of a table line copies as that line with the other cells empty, so the pasted cell keeps its column. That is what makes a clip round-trip through the editor as the same kind it came from.

A pasted clip's LINE BREAKS open rows, through the same plan `Enter` writes: the first line joins the row the caret is in, each line after it opens a row at that row's depth, carrying its kind wherever the kind declares `continues`, and the rest of the body follows the last one. `\r\n`, `\r` and `\n` are all line breaks here, whatever the editor's own separator is — and so is the separator itself, wherever a line still holds one. A text DROP carrying line breaks takes the same rule, since it delivers the same bytes. Two clips are spliced verbatim instead: one that came from this editor — it is the value's own projection, and every line already carries its lead and its opener — and one landing inside a raw closed kind, whose body holds separators as content.

One SPAN shape is outside all of this: a paste whose selection runs from one row into another is spliced raw, line breaks and all, because the split refuses a span that leaves a single row's body.

Where the value does NOT split into rows, a pasted line break is an ordinary character, as it always was.

A delete the model cannot express — one that would reach through a raw closed kind's closing line, or past either end of the document — is CONSUMED and changes nothing, rather than being handed back to the browser.

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
