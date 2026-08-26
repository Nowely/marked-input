---
title: Row Kinds
description: Declare a row kind - a markup matched at a row's own start that types the row and renders it through your component.
keywords: [row kind, row, RowSpec, RowProps, heading, list, to-do, table, split, cells, turnInto]
---

A **row kind** is a [Markup](/api/type-aliases/markup/) matched ONLY at a row's own start. Matching it
TYPES the row: the row renders through the component the option names instead of through
`slots.paragraph`, and the bytes that matched — the opener, and a closing literal where the kind has
one — become structural. They stay in the value, they never reach your component, and no caret may
enter them.

It is the same markup language a mark uses, compiled by the same compiler. What makes it a row is
the `row` key:

```tsx
import type {RowProps} from '@markput/react'
import {MarkedInput} from '@markput/react'

const Heading = ({children, ref, className, style}: RowProps) => (
    <h1 ref={ref} className={className} style={style}>
        {children}
    </h1>
)

;<MarkedInput
    defaultValue={'# Title\nplain text'}
    options={[{markup: '# __slot__', row: {Component: Heading}}]}
/>
```

`'# Title'` paints as `<h1>Title</h1>` — the `'# '` is gone from the screen and still in the value.
`'plain text'` has no kind, so it is a **paragraph** and renders through `slots.paragraph`.

## Markup rules for a row

A row markup obeys every rule a mark's markup obeys, plus three of its own. A markup that breaks one
is reported to the console and contributes no row kind — the option is skipped and every other option
keeps its index.

| Rule                                                     | Rejected                            |
| -------------------------------------------------------- | ----------------------------------- |
| Must not BEGIN with a placeholder (the mark rule)         | `'__slot__\n'`                      |
| Exactly one body placeholder — `__slot__` or `__value__`  | `'# __value__ __slot__'`            |
| No second `__value__`: an opener is a literal scan        | `'<__value__>__slot__</__value__>'`  |
| No two placeholders touching                              | `'# __meta____slot__'`              |
| Its opener must not already be claimed by an earlier option | two options both opening `'# '`   |

`__meta__` gaps are allowed beside the body — that is a to-do's checked flag and a fence's language.

### The body placeholder decides how the interior is read

- `__slot__` — the body is **inline-parsed**. Marks inside it are marks, and the row's inline content
  is what your component gets as children.
- `__value__` — the body is **raw** and never re-parsed. Enter inside it is a literal newline rather
  than a row split, and a separator inside it is that markup's own text, not a boundary — which is
  how a fenced code block or a frontmatter frame reads as ONE row across several visual lines.

```tsx value uses=CodeFence
{markup: '```__meta__\n__value__\n```', row: {Component: CodeFence}}
```

A kind whose markup has no closing literal after the body — `'# __slot__'`, `'- __slot__'` — is
**open**: its body ends at the row's own separator.

### Longest opener wins

Openers are scanned longest-first, so a longer opener beats a prefix of itself and the two never
compete:

```tsx sketch="two openers side by side, both row specs elided"
{markup: '- [__meta__] __slot__', row: {…}}  // '- [x] ' — a to-do
{markup: '- __slot__',           row: {…}}  // '- '     — a bullet
```

Two options that compile to the SAME opener are not a precedence question: the later one is reported
and dropped.

## The row spec

Everything a kind declares beyond its markup lives in [`RowSpec`](/api/interfaces/rowspec/).

| Field       | Default     | What it does                                                                                                          |
| ----------- | ----------- | --------------------------------------------------------------------------------------------------------------------- |
| `Component` | required    | The component every row of this kind renders through. There is no per-kind fallback — `slots.paragraph` answers only the row with NO kind. |
| `continues` | `false`     | What the row a split produces is. `true` is this kind again, with the same `meta` — Enter at the end of a `continues` row opens another row of it, and mid-row the tail keeps it. `false` is a plain row. An **option** is a third answer: the tail takes THAT kind and carries no `meta` of this one's, which is how a table header continues into a table line. A list item continues, a heading does not, a checked to-do splits into two checked to-dos. |
| `indents`   | `false`     | Does Tab / Shift+Tab re-indent a row of this kind — and does Tab belong to the editor at all while the caret is in one. It gates the KEY, not the verb: a kind that declares it consumes Tab even where the depth cannot change. Everywhere else Tab still leaves the field. |
| `split`     | —           | This kind carves its own body at a literal into **cells**. See [Carving a row into cells](#carving-a-row-into-cells). |

## What your component receives

[`RowProps`](/api/interfaces/rowprops/), in React:

| Prop                       | What it is                                                                                        |
| -------------------------- | ------------------------------------------------------------------------------------------------- |
| `children`                 | The row's own inline content, already rendered.                                                    |
| `rows`                     | The row's CHILD ROWS, already rendered. Always present — empty when the row has none.               |
| `meta`                     | The kind's `__meta__` gap — a to-do's flag, a fence's language.                                     |
| `depth`                    | Nesting depth, counted from 0 — a root row is at depth 0.                                          |
| `index`                    | Position among the row's own siblings.                                                             |
| `node`                     | The live [`RowNode`](/api/interfaces/rownode/): its id, its own text, and its verbs.                |
| `ref`, `className`, `style` | Slot plumbing. **Spread all three onto the element you render.**                                   |

The `ref` is load-bearing. It is how the editor finds the row's element; a component that drops it
leaves the row unbound and the caret cannot resolve into it.

**A kind that never renders `rows` cannot be nested under.** Rendering it is how the editor learns
that this kind has somewhere to put a child: the wrapper the adapter hands over registers itself,
and a kind that drops it registers nothing. Tab and a drag both read that and refuse to nest a row
where nothing would paint it — the drop indicator never offers the depth, and Tab is consumed and
does nothing. Nothing is lost and nothing is hidden, which is what the alternative cost: a row moved
under a heading that renders no `rows` stayed in the value with no box, no caret position and
nothing on screen.

So render `rows` even where the design has no children in mind — an empty wrapper costs nothing,
and it is what keeps the kind nestable. Hiding them is a different thing and is fine (below); it is
read as "not now", and a nest into a hidden subtree is refused for the same reason.

Collapse by HIDING, never by unmounting. An unpainted row leaves the DOM binding and takes its
anchors with it, so `End`, select-all and every arrow that resolves through the last row would walk
into a row with no element:

```tsx markup uses=open:boolean,rows:ReactNode
<span hidden={!open}>{rows}</span>
```

### The same kind in Vue

Vue delivers the child rows as a **slot** named `rows` rather than as a prop — the one place the two
adapters' row contract differs, because a rendered node is a slot in Vue and a node in React. The
editor's `ref` resolves through the component instance, so there is nothing to spread; `class` and
`style` fall through onto the root element unless the component declares `inheritAttrs: false`.

```ts
import {defineComponent} from 'vue'

const Bullet = defineComponent({
    props: {meta: String, node: {type: null}, depth: Number, index: Number},
    template: '<li><slot /><slot name="rows" /></li>',
})
```

Declare the props you read. Vue puts every prop a component does not declare onto its root element,
so `node` and `depth` would otherwise land there as attributes.

## Controls inside a row

Everything a row's component paints sits inside the one `contenteditable` container. An element the
editor knows nothing about is document content: the caret enters it, the browser edits it, and what
the user types into a checkbox's label lands in the value.

A control announces itself with `useControlRef()`:

```tsx
import type {RowProps} from '@markput/react'
import {useControlRef} from '@markput/react'

const Bullet = ({children, rows, ref, className, style}: RowProps) => {
    const controlRef = useControlRef()
    return (
        <div ref={ref} className={className} style={style}>
            <span className="bullet" ref={controlRef} />
            {children}
            {rows}
        </div>
    )
}
```

Use it for anything that is chrome rather than text: a bullet glyph, a toggle arrow, a checkbox, a
`<select>`, a tab bar.

A control that is FOCUSABLE — a checkbox, a `<select>`, a `<button>` — takes DOM focus when it is
clicked, which is the browser's own default, and it leaves the selection where it was. The editor
takes its focus back once the control's edit has landed, so the user can go on typing where the
caret already is. The cost of that, stated: a control driven by the KEYBOARD that commits on every
keystroke — a `<select>` arrowed with its popup closed — loses focus after the first commit.

## Retyping a row

`node.turnInto(option, patch?)` replaces the row's kind, keeping the row's identity — its id, its
element, its drag grip, its child rows. `undefined` makes it a paragraph.

```tsx fragment uses=node:RowNode,todo:Option
node.turnInto(todo, {meta: 'x'}) // tick the box
node.turnInto(undefined)         // back to a paragraph
```

The patch carries `meta` (absent leaves it, `null` clears it, a string sets it) and `text`, which
REPLACES the body — that is what lets a caller strip a span and retype in ONE splice.

The reparse decides what comes back: a body carrying the separator becomes two rows, and a body whose
own start matches a longer opener types as THAT kind. `turnInto` answers `false` for an option this
editor compiles no row kind from, and for a no-op.

## Carving a row into cells

A kind that declares `split` carves its OWN body at a literal, and each piece becomes an ordinary Row
of the option `as` names — a table line into cells.

```tsx fragment uses=TableLine
const cell: Option = {
    row: {
        Component: ({children, ref, className, style}: RowProps) => (
            <div ref={ref} className={`${className} cell`} style={style}>
                {children}
            </div>
        ),
    },
}

const tableLine: Option = {
    markup: '| __slot__',
    row: {continues: true, split: {at: ' | ', as: cell}, Component: TableLine},
    menu: {label: 'Table row'},
}
```

`| Auth migration | Blocked | Kara` paints as three cells. `TableLine` renders the pieces through
`rows` — they are the row's children — and nothing else.

- `as` may be an option with **no markup at all** — an anonymous kind, which nothing scans and which
  exists only as a split's target. It must be an option of this editor carrying `row`; anything else
  is reported and this kind carves nothing.
- A carved row takes no indent-nested children: its children ARE its body, and no separator is
  written between them.
- Tab inside a cell walks to the next piece rather than changing depth; at the first or last piece
  there is no neighbour and the key is not consumed.
- Every other key names the LINE, because a piece has no line of its own to splice: Enter splits the
  line, Backspace at the first piece demotes the line, and the row menu converts the line.
  Shift+Enter is refused there.
- A piece cannot contain the delimiter — an escape scoped to a cell's body is a named follow-up, not
  a feature.
- Copying one cell emits the whole line with the other cells empty, so a pasted cell keeps its
  column.

## Appearing in the row menu

An option that declares `menu` IS in the row menu — there is no list of kinds anywhere else:

```tsx value uses=Heading
{markup: '# __slot__', row: {Component: Heading}, menu: {label: 'Heading 1', keywords: ['h1', 'title']}}
```

See [Overlay Customization → The Row Menu](/guides/overlay-customization#the-row-menu) for the
trigger wiring and the seed fields.

## Worked example: a Notion to-do

Everything above, in one kind. The markup carries a `__meta__` flag and an inline-parsed body; the
kind continues, so Enter opens another to-do; it indents, so Tab nests one under another; the
checkbox is a control, and ticking it is a retype.

```tsx
import type {Option, RowProps} from '@markput/react'
import {MarkedInput, useControlRef} from '@markput/react'

const todo: Option = {
    markup: '- [__meta__] __slot__',
    row: {
        continues: true,
        indents: true,
        Component: ({meta, children, rows, node, ref, className, style}: RowProps) => {
            const controlRef = useControlRef()
            const done = meta === 'x'
            return (
                <div ref={ref} className={className} style={style}>
                    <input
                        type="checkbox"
                        ref={controlRef}
                        checked={done}
                        onChange={event => node.turnInto(todo, {meta: event.target.checked ? 'x' : ' '})}
                    />
                    <span className={done ? 'done' : undefined}>{children}</span>
                    {rows}
                </div>
            )
        },
    },
    menu: {label: 'To-do list', keywords: ['todo', 'task', 'check'], meta: ' '},
}

const Bullet = ({children, rows, ref, className, style}: RowProps) => (
    <li ref={ref} className={className} style={style}>
        {children}
        {rows}
    </li>
)

const bullet: Option = {
    markup: '- __slot__',
    row: {continues: true, indents: true, Component: Bullet},
    menu: {label: 'Bulleted list'},
}

export const Editor = () => (
    <MarkedInput
        defaultValue={'- [ ] Confirm the EU quota\n- [x] Signed off by Platform'}
        options={[{overlay: {trigger: '/'}}, todo, bullet, {markup: '@[__value__](__meta__)'}]}
    />
)
```

Notes on the pieces:

- `'- [x] '` is a longer opener than `'- '`, so the to-do wins over the bullet whichever order the
  options are listed in.
- `meta: ' '` on the menu entry seeds a NEW row's flag. Seeds apply only where there is nothing to
  keep — a row that already has text keeps its own body, since a turn-into must not discard what the
  user typed.
- `node.turnInto(todo, {meta})` is the whole of the toggle. The row keeps its id, so its element,
  its child rows and its drag grip survive the tick, and the tick is one undo entry.
- The `@[__value__](__meta__)` option needs no `row`: a mark inside a to-do's body is a mark like any
  other, because `__slot__` bodies are inline-parsed.

The full vocabulary this kind was taken from — headings, callouts, fences, toggles, tables, a board
and a metrics strip — is the showcase page in
[`packages/storybook/src/pages/Notion/`](https://github.com/Nowely/marked-input/tree/next/packages/storybook/src/pages/Notion).
It imports the published adapter and React and nothing else.

## See also

- [Rows and Nesting](/guides/rows) — the separator, the indent, row selection, drag, history
- [Keyboard Handling](/guides/keyboard-handling) — what each key does in a row
- [`RowSpec`](/api/interfaces/rowspec/), [`RowProps`](/api/interfaces/rowprops/),
  [`RowNode`](/api/interfaces/rownode/)
