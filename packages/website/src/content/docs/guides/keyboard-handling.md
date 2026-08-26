---
title: Keyboard Handling
description: How keyboard input, deletion, overlay triggers, and caret placement flow through core.
keywords: [keyboard, selection, node anchor, replace, overlay, caret]
---

Markput handles text input, deletion, paste, overlay insertion, row editing, and mark commands through core-owned NODE ANCHORS — a node plus a local offset, never an absolute position in the value string.

## The Keymap

Every binding below except `Home`/`End` exists only where the value splits into
[rows](/guides/rows); with `separator={null}` the editor keeps the plain-text behaviour in the
right-hand column's parentheses.

| Key                          | What it does                                                                                                                                  |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `Enter`                      | Splits the caret's row. On an EMPTY row it demotes instead — depth first, then kind — and inserts only when the row has neither left to give. Over a text range it splices at the range's LOW end and keeps what was selected; over a row selection it replaces those rows with one fresh row. Inside a raw closed body (a fence) it is a literal newline. It defers to an open suggestion list. (Otherwise: a `'\n'` in the value.) |
| `Shift+Enter`                | Opens a CONTINUATION line — a row inside the subtree of the row whose kind owns the line, so N soft breaks are N lines at one level. Refused inside a carved cell.        |
| `Tab` / `Shift+Tab`          | Re-indents the row selection, or the caret's row, in an editor where some option declares `indents`. Inside a carved row it walks to the next/previous cell, and is consumed at the ends without moving the caret. In an editor where no option declares it, the key leaves the field (ADR-0002). |
| `Home` / `End`               | The caret to its visual line's edge, `Shift` to extend. Owned by the editor on every platform, and present with `separator={null}` too: macOS binds both keys to SCROLLING the document, so in a page with room left to scroll the caret did not move at all until the key was pressed a second time. A modifier is left to the platform — `Cmd+Left`/`Right` and `Ctrl+Home` are still the browser's. |
| `Backspace` at a row's entry | Runs the same demote ladder as Enter on an empty row; otherwise the boundary expansion merges the row with the one above.                       |
| `Backspace` / `Delete`       | Next to a mark, deletes the WHOLE mark. Over a row selection, takes those rows away rather than emptying the first.                            |
| `Esc`                        | Turns the caret into a ROW SELECTION, one level wider on each press. Defers to an open overlay or row menu, which closes on that press instead.  |
| `Shift+ArrowUp` / `Down`     | Grows the selection by a whole row.                                                                                                            |
| `Ctrl/Cmd+A`                 | Widens a nested row selection to the row it is nested in, then selects the whole document.                                                      |
| `Ctrl/Cmd+Z`                 | Undo. `Shift+Ctrl/Cmd+Z` redoes. `history={false}` turns both into no-ops.                                                                       |
| Arrow keys                   | The browser's, except while a row selection stands.                                                                                            |
| Click on a frozen block      | SELECTS that row. An atomic kind paints none of its own text, so there is no caret position in it; the selection is written across the row's own element, so the browser paints the block and the next key acts on it. |
| A trigger character          | Opens the overlay the option owning that character declares — `@` for a picker, `/` for the row menu.                                            |

## Edit Flow

1. React/Vue render adapter-owned token shells and text surfaces.
2. The adapter registers the root with `store.host.container` and child structure through `store.tokens.control()` (for non-editable controls inside a token) and `store.tokens.children(ownerId)` (for nested `__slot__` child sequence hosts).
3. Keyboard handlers read the browser selection as a pair of node anchors through `store.tokens.domAnchors()`.
4. Edits call `store.edit.replace(from, to, text)`, which places the post-edit caret itself; a caller that needs a different caret writes `store.tokens.selection.select(anchor)`.
5. `store.tokens.selection` stores the selection as node anchors and its DOM driver applies them after the next render, placing each anchor through its OWN node.

Production code should not infer token identity from DOM child order or public data attributes.

## Text Input

Inline text input uses the selection the DOM reports:

```ts fragment uses=text
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

```ts fragment
store.history.canUndo() // reactive: safe to read inside a computed
store.history.undo()    // answers whether the document moved
store.history.redo()
```

In a controlled editor an entry is recorded only once your `onChange` has echoed the value back. An emission you decline leaves nothing behind, and a value you write yourself — a reset, a change from elsewhere — leaves `canUndo()` false until the document is back at an entry the editor recorded.

Pass `history={false}` to turn both keys back into no-ops.

## Selecting Rows

Where the value splits into rows, `Esc` turns the caret into a ROW SELECTION: the whole row it sits in, and one level wider on each press after that. `Shift+ArrowUp`/`Shift+ArrowDown` grow the selection by a row — absorbing that row whole, so growing past a first child reaches its parent — and `Ctrl/Cmd+A` widens a nested row selection to the row it is nested in before it selects the whole document.

There is no separate row-selection state: a row is selected exactly while the text selection spans it whole, so the browser paints it and every read is one call.

```ts fragment
store.rows.selected() // reactive: the ids of the selected rows, in document order
store.rows.move({parent: null, index: 2}) // move them, as one splice
```

An arrow key is only ever intercepted once a row selection stands — which follows from the selection being derived and is not a synonym for "after `Esc`": a plain text selection that spans one row WHOLE grows by a row rather than by a line, and what `Shift+ArrowDown` writes back is that row's exact span, so the sweep becomes a row selection at that press. Until then `store.rows.selected()` is empty and no verb acts on the row the sweep merely covers. At the document's edges the key is still the gesture's and does nothing, rather than falling back to the browser and collapsing the selection it was extending. `Esc` defers to anything already open — the suggestions overlay and the row menu — each of which closes on that press instead. An EMPTY row cannot be row-selected on its own — its content is zero-width, so a caret resting in one sits at both of its edges — but it is selected as part of a range that spans its neighbours.

Widening never narrows: where a selection spans two parents, `Esc` and `Ctrl/Cmd+A` climb to the parent AND keep the rows outside it, and once every selected row is a root `Esc` leaves the selection alone.

`Enter` at a row's own START opens an empty row ABOVE it, and the row you were in keeps its kind, its `meta` and its children. The row that OPENS is the one `continues` describes, so Enter at the head of a bullet gives you a second bullet above it and Enter at the head of a heading gives you a plain row. It follows that a kind seeded from the `/` menu — a table header, whose caret lands at the head of the seed so the first thing typed replaces a column name rather than appending to the last one — answers the very next `Enter` with an empty row of what that kind CONTINUES INTO, above the seeded row. To open the first data row instead, put the caret in the LAST cell first (`Tab`, or a click) and press `Enter` there.

`Enter` over a TEXT range is deliberately not the replace-the-range rule: it splices a row boundary at the range's LOW end and KEEPS what was selected, so nothing a selection covers is lost to the key that opened a row above it. Over a ROW SELECTION it does replace, opening one fresh row where the selected rows were — the same answer it gives for an all-selected document, at row granularity.

A row selection is the ROWS, openers and leads included, and paste, cut and `Backspace`/`Delete` all read it that way: a paste replaces the selected rows with the clip, a cut or a delete takes them away rather than emptying the first, and what a copy put on the clipboard is exactly what those two write over. This applies wherever the selection covers a whole number of rows EXACTLY — including the one a triple-click makes, which is a row selection by every reading this editor has, and excluding a sweep that runs from mid-row into another row, which is a text selection however much of a row it covers.

"Exactly" is a BOUNDARY and not an offset. Between one line's last character and the next line's first typable position lie the separator, the next line's indent, its opener and any `meta` inside that opener — and between two CARVED pieces of one row lies the delimiter the kind split at. All of it is structural, none of it is a caret position, so every offset in such a stretch names the same boundary and any of them closes the run. That is what the browser hands you: `Shift+ArrowDown` from a row's start, a mouse sweep down one line and a triple-click all end at the NEXT line's first position, and `getSelection().toString()` on a selected `BBB` reads `"BBB\n"` where the highlight paints only `BBB`.

EVERY RANGED EDIT READS IT THAT WAY, not only the ones over a row selection. A selection edge that lands on structural bytes resolves to the content boundary it names — the low edge forward, the high edge back — so the span an edit writes is the CONTENT the highlight covers and never the structure between two pieces of it. The resolution only ever shrinks a selection, so an edit can never touch a byte outside what you selected. It matters most where no row selection is possible at all: a triple-click on a row that HAS CHILDREN covers the parent's own line while the parent's span covers its whole subtree, and a triple-click on a table CELL covers a piece that no gesture can name as a row. Both used to write over the raw offsets, and both swallowed their neighbour — `- A` with children became `- ZB`, and a cell typed over cost the row a column.

An edge that lands INSIDE a line's content is left exactly where it is: a sweep from mid-row into another row is a text edit and still merges the two rows, which is what it looks like it does.

TYPING stays TEXT: a character replaces the rows' own text and the first row keeps its kind. The ONE exception is a row that holds no editable position, an atomic kind that paints none of its own text: there is no prose there to replace, so the ROW goes and a plain row carrying what was typed takes its place.

A clip pasted over a row selection takes the same rules it takes at a caret in the same row: a FOREIGN clip's lines each open a row at the covered rows' depth, carrying their kind wherever the kind declares `continues`, so a one-line clip keeps the kind exactly as typing does; this editor's own clip is the value's own projection and is spliced verbatim.

`Tab` and `Shift+Tab` move every row the selection holds, in one splice; where no row selection stands they move the caret's own row. A step no selected row can take moves none of them. `indents` is the EDITOR's declaration, not the row's: it answers whether Tab belongs to the field at all, and which rows may actually nest is the same question a DROP asks — the scan's depth ceiling, plus whether the would-be parent's component paints child rows. So the keyboard and the drag agree, and a row of a kind that declares nothing still nests under a bullet by either gesture.

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

```tsx fragment
mark.update({value: 'alice'})
mark.update({meta: null})
```

The hook no longer exposes a DOM ref. Focus moves through registered token shells and text surfaces owned by the adapters.

## Overlay Triggers

Overlay trigger probing uses the current raw caret position (`caret.selection()`). During input, core probes the caret range which is updated synchronously with value edits.

## Custom Keyboard Handlers

Attach custom handlers to the container through `slotProps.container`, but let Markput own text mutation:

```tsx markup
<MarkedInput
    slotProps={{
        container: {
            onKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
                if (event.key === 'Escape') {
                    // custom behavior
                }
            },
        },
    }}
/>
```

If a handler changes editor text, route it through component state (`value`/`onChange`) or a mark command. Do not mutate parsed tokens directly.
