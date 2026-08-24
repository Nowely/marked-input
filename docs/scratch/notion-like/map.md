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

## Fog

- Whether a markdown table can be one atomic mark at all: `__value__` is capped
  at two per markup, so an N-cell markup is out, and a whole-table blob depends
  on match greed across rows.
- Whether the mark components can carry a document's worth of options without
  the fixture text tripping mid-row matches.
- Whether an overlay `choose` can replace a whole row's leading markup — the
  mechanism a slash menu needs to turn a paragraph into a heading.
