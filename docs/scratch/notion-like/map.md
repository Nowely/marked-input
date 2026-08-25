# Notion-like editor — map

Label: wayfinder:map

## Destination

A list of API gaps, each backed by a running story rather than by argument, that
a future separate `notion-like` package would have to be built on. The artifact
that produces it is a probe: one Storybook page that builds the reference
document out of nothing but the published API, where every place the API refuses
becomes a ticket here.

## Notes

- Two phases, settled with the maintainer 2026-08-25. **Phase 1 is a probe**:
  published API only, no hacks, no core edits — a hack would hide the very gap
  the probe exists to find. **Phase 2 is a prototype** of the wanted UX in a
  worktree, and starts only after phase 1 reports.
- The reference document is a Notion export in the OKF / Obsidian shape:
  frontmatter properties, headings, paragraphs, a bullet list, a markdown table,
  a fenced code block, a blockquote, mentions and links. Its YAML frontmatter is
  in scope as one atomic properties mark — the mark component parses its own
  interior; a real YAML parser can replace that later.
- **Separator is `'\n\n'`**, the library default: a block is delimited by a blank
  line and a literal `'\n'` is a soft break INSIDE a block (which is what
  Shift+Enter already inserts, `beforeInput.ts:82`). Accepted cost, stated by the
  maintainer: a tight bullet list is therefore ONE row, so it drags and menus as
  a whole rather than per item — [05](issues/05-per-item-rows.md).
- Editor chrome (slash menu, drag grips, row menu) is IN scope for the probe and
  must actually work off existing machinery — overlay triggers and
  `draggable: true` — because the claim under test is "the library should
  already support this".
- API changes are **tickets only** in this phase. Nothing here is implemented
  without the maintainer approving that ticket on its own.
- Vocabulary: this repo's word for a Notion "block" is a **Row**; `CONTEXT.md`
  puts `block`, `widget` and `annotation` on avoid-lists. No term for a *typed*
  row is coined until the probe shows what a typed row actually is — settled
  2026-08-25, glossary untouched until then.
- Out of the probe by construction, ticketed instead: toggle/collapsible rows
  (nested rows are deferred by ADR-0009), divider, nested lists, editing inside
  atomic marks (`backlog/issues/01-editable-mark-values.md`).
- Adjacent effort, do not disturb: `row-mark-unification/issues/02-one-render-path.md`
  specs the per-row render slot and is PAUSED. The probe's job is to produce
  evidence for whoever reopens it, not to reopen it.

## Decisions so far

<!-- one line per closed ticket -->

- **Phase 1 is done and the page runs** (2026-08-25). `Notion/Document` renders
  the reference document — properties panel, headings, prose, two tables, a
  fenced code block, a quote, mentions and links — and `Notion/Editor` adds the
  `@` picker and the `/` block menu. Both are driven by
  `packages/storybook/src/pages/Notion/Notion.react.spec.tsx`, which types the
  character a user types and asserts the emitted value.
- **A whole markdown table is one ROW KIND**: `'|__value__'`, a leading literal
  and a raw body that closes at the row's own separator. It was a mark when this
  was written; P1 made it a kind, and the cost is unchanged — atomicity, nothing
  inside a cell is a token. Cells become rows when a kind can declare a split (P9).
- **Option order does not affect matching.** Static segments go into one
  alternation sorted by literal length, and the earliest-starting match wins, so
  `@[` beats `[` and a table's leading `|` beats the `- ` inside its own
  `| --- |` rule. Order DOES decide which `Mark` a match resolves to and which
  option owns a trigger.
- **A matched `__value__` interior is never re-parsed**, which is what makes a
  fence work: `# →` inside the canary code block stays code.
- **The chrome claim holds, with one hole.** Mentions and the block menu are
  consumer components over shipped machinery. The hole: the menu writes over the
  caret's span, so it starts a block on an empty row but cannot convert a row
  that already has text ([11](issues/11-overlay-inserts-one-markup.md)).
- **The block controls layer is a sibling of the rows** inside the container, and
  it is the child carrying `contenteditable="false"` — so "the last row" is not
  `host.lastElementChild`. Anything walking rows in the DOM has to skip it.
- **A Row carries a KIND** (2026-08-25, P1, ADR-0010). The parser carves the row
  skeleton first and parses inlines per row, so a row kind is recognised at a
  row's own start and its body is bounded before any match runs. That closes
  [01](issues/01-row-start-anchoring.md), [06](issues/06-repeats-nest-instead-of-continuing.md),
  [07](issues/07-closing-literal-newline.md) and
  [09](issues/09-frontmatter-only-at-offset-zero.md), and answers the fog item
  that asked whether the model could carry a row type at all. The costs are
  declared in ADR-0010: an inline mark can no longer span a row boundary, and a
  typed row's opener and closing literal are structural bytes no caret enters.
- **The separator is the whole row model, and a line is a row** (2026-08-25, P2, ADR-0011). The
  `layout` prop is deleted: `separator?: string | null` is the only fact that says whether a
  document splits, `null` means it never does, and the default moved from `'\n\n'` to `'\n'`. That
  closes [05](issues/05-per-item-rows.md) — the probe's `list` became a row kind in the same phase,
  so each item of the risk list and the decision log is a row with its own grip and menu. The
  fence had to become a kind with it, because an inline mark cannot span a row (ADR-0010) and it
  was shattering into four rows. The price is the one [05](issues/05-per-item-rows.md) named as its
  alternative: a soft break has no representation under `'\n'`, so Shift+Enter SPLITS THE ROW —
  through the generic `insertLineBreak` path, so without Enter's own rules — until the keymap
  phase adds `softBreak`; recorded on [08](issues/08-soft-breaks-are-invisible.md).
- **A markdown table has no header row on the probe.** An OPEN kind's body runs to the row's own
  separator, so a table line is a row; which line is the header is a fact about the line AFTER it,
  and a row component sees only its own row. It comes back with cells-as-rows at P9.
- **Half of [03](issues/03-row-node-not-nameable.md) landed**: `RowNode` and
  `RowProps` are exported from core and both adapters. `Store` still is not, so
  the ticket stays open.
- **The row verbs are addressed in PRE-ORDER, and each one splices the narrowest span it can**
  (2026-08-25, P4). `turnInto(option, patch)` and `splitAt(anchor)` are new; `remove`,
  `duplicate`, `insertAfter` and `mergeWith` were each wrong under nesting for the same reason —
  they read the ROOT list, where the last root and the last row are different rows and a parent's
  span covers its children's. Three answers of "final" and two of "the boundary between two rows"
  collapsed into `endsDocument` and `rowBoundary`. Costs declared: a split places its tail after
  the head's whole SUBTREE, because a row at the parent's lead written directly under it adopts
  the parent's children; a merge into a typed row removes that row's opener, so the survivor keeps
  the FIRST row's kind; and a retype that changes a row's emptiness can re-parent the row after it,
  which no `Pairing` can express. `moveTo` is untouched — P5 owns the common-ancestor splice.
  Ticket [11](issues/11-overlay-inserts-one-markup.md)'s missing half is now reachable:
  `turnInto` takes the new body text, so strip-and-retype is one commit.
- Checked and NOT filed: the End key. It moves the caret to the end of the
  VISUAL line, which on a wrapped row is mid-row — correct browser behaviour,
  not a defect.

## Fog

- What a package on top of this owns: does it wrap `MarkedInput` and ship
  options + components, or does it need core changes first? The ticket list here
  is the input to that decision, not the answer.
- Caret ergonomics at document scale — atomic tables and code blocks, Tab
  leaving the field, native undo swallowed (ADR-0002/0006 accepted costs) — are
  unmeasured over a document this size.
