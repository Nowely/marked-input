---
title: Rows and Nesting
description: The separator that makes a document rows, the indent that nests them, row selection, drag, and the editor's own undo stack.
keywords: [rows, separator, indent, nesting, depth, row selection, drag, history, undo, paragraph slot]
---

By default a Markput document has **rows**: `separator` is `'\n'`, so every line is a row, with its
own drag grip, its own place in the tree, and its own entry in the row menu.

```tsx markup
<MarkedInput defaultValue={'first row\nsecond row'} />
```

A row with no [row kind](/guides/row-kinds) is a **paragraph**. A row that matched a kind's opener
renders through that kind's component instead.

## The separator

`separator` is editor-level: it belongs to no markup, and it is the whole of what makes a document
rows.

| Value              | Effect                                                                                             |
| ------------------ | -------------------------------------------------------------------------------------------------- |
| `'\n'` _(default)_ | One line is one row.                                                                                |
| `null`             | The value never splits: one document, no rows, no row controls — a plain annotated text field. |
| `''`               | Separates nothing. The editor reports it to the console and renders as if it were `null`.           |
| any other string   | Rows are delimited by it.                                                                            |

It is never stored on a row. The value is a projection that joins rows with it, so only the
document-final row lacks one — and the piece after the final separator is a row even when it is
empty, which is why Enter at the end of a document always gives you a visible row.

Inside a row kind's RAW body — a `__value__` gap, like a fenced code block — the separator is that
markup's own text and no boundary at all. One row can read as several visual lines and still carry
one grip.

With `separator={null}` there are no rows to select, drag, indent or convert; `draggable` has nothing
to act on, and Enter is an ordinary character in the value.

## Nesting

Rows nest by **indentation**, and by nothing else. `indent` is the string one nesting level is
written with, default `'\t'`:

```
- Risks
	- EU region capacity unconfirmed
		- Awaiting quota approval
```

A row whose lead is deeper than the row before it is that row's child, **at most one level deeper**.
The scan reads a maximal run of whole indent units at a row's own start; those bytes are structural
and no caret may enter them.

`indent={''}` turns nesting off — and with it row TYPING on any line that starts with the old indent:
a line whose first character is not an opener is a paragraph. Pass it when your document stores
leading indentation as content.

### Depth is the tree, lead is the bytes

**`depth` counts from 0**: a root row is at depth 0, its child at depth 1. That is the number a row
kind's component receives as `depth` and the number `setDepth` takes.

There is no function from one to the other, and the difference is observable. An over-indented paste
keeps its surplus run in the row's `lead` and renders one level shallower than the bytes say. The
surplus survives round-trip until the row or an ancestor is re-indented, at which point `setDepth`
normalizes it away.

An **empty row takes no children**: a blank line cannot be a parent, so outdenting a blank row to a
root promotes whatever was under it.

## Painting the rows

| Where                | What it reaches                                                          |
| -------------------- | ------------------------------------------------------------------------ |
| `slots.paragraph`    | The component a row with NO kind renders through. Default: a bare `div`.  |
| `slotProps.row`      | Props merged onto EVERY row's wrapper — kind and paragraph alike.         |
| `option.row.Component` | The component rows of that kind render through.                        |

```tsx markup uses=Paragraph
<MarkedInput
    slots={{paragraph: Paragraph}}
    slotProps={{row: {className: 'doc-row'}}}
    options={options}
/>
```

The two are not a pair, and the names say which is which: `slots.paragraph` is consulted only for a
row with no kind, while `slotProps.row` reaches every row.

## Row verbs

Every row is a live [`RowNode`](/api/interfaces/rownode/). A row kind's component receives its own as
the `node` prop, and each verb is one edit — one undo entry, one `onChange`.

| Verb                       | What it does                                                                                |
| -------------------------- | ------------------------------------------------------------------------------------------- |
| `turnInto(option, patch?)` | Retype the row, keeping its id, element and children. `undefined` makes it a paragraph.       |
| `setDepth(depth)`          | Re-indent the row AND its subtree; the descendants travel with it.                            |
| `splitAt(anchor)`          | Split at a caret. The tail keeps the kind where the kind `continues`.                         |
| `writeRows(span, rows)`    | Write several rows into the body at a span — what a multi-line paste lands through.           |
| `addSibling()`             | Open a blank row after this row's whole subtree, at this row's depth.                         |
| `duplicate()`, `remove()`  | The row menu's own verbs.                                                                     |
| `moveTo({parent, index})`  | Move the row and its subtree, keeping every identity on both ends.                            |

Each answers `false` rather than throwing when the model cannot express the result: a move into the
row's own subtree, a re-indent the scan would read back as a different tree, any row verb in an
editor with no separator, `addSibling()` on a carved cell.

Reads: `node.slot()` is the row's own interior text, `node.rows()` its child rows, `node.meta()` its
kind's metadata gap, `node.option()` the index of the option that typed it.

## Row selection

The rows the text selection covers WHOLE, in document order. It is DERIVED and never stored: a row is
selected exactly while the selection spans it, so the browser paints it and a collapsed caret selects
no rows at all.

- `Esc` turns the caret into a row selection — the row it sits in, and one level wider on each press
  after that.
- `Shift+ArrowUp` / `Shift+ArrowDown` grow it by a whole row, so growing past a first child reaches
  its parent.
- `Ctrl/Cmd+A` widens a nested selection to the row it is nested in before it selects the document.

The selection is readable from your own components. `useMarkput(selector)` is the one published door
to the editor's store, in both adapters, and it re-renders on exactly the signals the selector names
— so hand it the signal itself rather than calling it:

```tsx
import {useMarkput} from '@markput/react'

const SelectionCount = () => {
    const selected = useMarkput(s => s.rows.selected) // readonly number[] — row ids, document order
    return <span>{selected.length} rows</span>
}
```

The hook works anywhere under the editor: a row kind's component, a mark's component, a slot. The
store's other row verbs hang off the same `s.rows` — see
[Keyboard Handling → Selecting Rows](/guides/keyboard-handling#selecting-rows).

A row selection is the ROWS — openers and leads included. Paste, cut, copy and Backspace/Delete all
read it that way; typing replaces the rows' TEXT and keeps the first row's kind. See
[Keyboard Handling](/guides/keyboard-handling) for the full contract.

## Drag

```tsx markup
<MarkedInput draggable options={options} />
<MarkedInput draggable={{alwaysShowHandle: true}} options={options} />
```

`draggable` is `false` by default, and ineffective when `separator` is `null`. There is ONE grip, on
the row nearest the pointer, painted from a single layer beside the rows rather than inside them;
`alwaysShowHandle` keeps it visible instead of fading it in on hover.

Dragging carries the whole row selection when the gripped row is part of it, and that row alone
otherwise; which rows those are is fixed when the grip is pressed, since the browser owns the text
selection for the length of a native drag. The drop's vertical position names the gap between two
lines and its horizontal position names one of the depths that gap legally admits — every candidate
is planned before it is offered, so the indicator promises rather than predicts. A depth whose parent
would paint nothing is not among them (see
[Row Kinds → What your component receives](/guides/row-kinds#what-your-component-receives)). The
editor takes its focus back when the drag ends, so the next keystroke lands in the document.

## The row menu

Add, duplicate and delete a row, and convert it to another kind. One menu per editor, opened from the
grip or by the `/` trigger, and addressed by the id of the row it opened on — so a row that has left
the tree refuses instead of being written to.

Both lists take the same keyboard: the first entry is highlighted from the moment the menu opens,
`ArrowUp`/`ArrowDown` move the highlight, `Enter` runs it and `Esc` closes. After a verb the editor
takes its focus back from the grip, so the next character lands in the document.

Which kinds it offers is not a list you write: an option that declares a `menu` IS in the menu. See
[Overlay Customization → The Row Menu](/guides/overlay-customization#the-row-menu).

## History

The editor keeps its own undo stack, on by default:

```tsx markup
<MarkedInput history={false} options={options} />
```

`Ctrl/Cmd+Z` undoes and `Shift+Ctrl/Cmd+Z` redoes, in both value modes. An undo restores the value
AND the caret the edit was made from, and it replays the edit's own splice — so a row keeps its
identity across an undone move.

`history={false}` turns both keys into no-ops. It does NOT hand undo back to the browser: every input
path cancels its default, so the browser's own stack is empty by construction.

In a controlled editor an entry is recorded only once your `onChange` has echoed the value back. An
emission you decline leaves nothing behind. Details, and the store verbs for your own toolbar, are in
[Keyboard Handling → Undo and Redo](/guides/keyboard-handling#undo-and-redo).

## See also

- [Row Kinds](/guides/row-kinds) — declaring a kind, its spec, and carving a row into cells
- [Keyboard Handling](/guides/keyboard-handling) — the keymap, paste, and selection
- [`MarkedInputProps`](/api/interfaces/markedinputprops/) — `separator`, `indent`, `draggable`,
  `history`
