# The separator is structural, and a Row is a node

Status: resolved

Decided by the maintainer 2026-08-20. This closes [issue 02](02-decide-the-row-boundary.md)
(phase 0) as **candidate 3** — the separator belongs to the tree, not to any Markup — and
commits to the Row becoming a first-class tree node. The rejected alternative (keep
mark == row, add only the setting) is recorded below so it is not re-proposed.

## Decisions ratified

1. **Direction.** Rows are formed structurally from a separator; Markups match *within* rows;
   `RowNode` becomes the third node kind and the only root kind in block layout. No
   intermediate "mark == row + separator setting" release ships.
2. **The setting.** `separator`, editor-level, default `'\n\n'`, applied in **block layout
   only** for now; inline layout keeps today's behavior. Named `separator`, not `terminator`:
   it stands between rows and belongs to no Markup. It is **not** a `Parser` constructor
   input — descriptors are interned per Parser and adoption pairs on descriptor identity
   ([`TokenModel.ts:465-491`](../../../../packages/core/src/features/tokens/seam/TokenModel.ts)),
   so it enters at parse-call time beside the per-adoption `isBlock` read.
3. **Trailing convention (T2).** An empty piece after a final separator IS a row —
   unterminated and empty. Enter becomes uniform including at document end, and empty
   paragraphs become representable (today
   [`filterEmptyText`](../../../../packages/core/src/features/tokens/parser/utils/filterEmptyText.ts)
   erases them). Declared cost: existing terminated values (`'# a\n\n'`) gain a visible
   trailing empty row — Drag counts and snapshots churn once, with explained diffs.
4. **Merge policy.** Markdown-like: Backspace at a row boundary deletes the separator and
   reparse decides. Paragraph-into-heading absorbs (`'# ab'`). The reverse edge —
   heading-into-paragraph gives `'a# b'`, a paragraph with a nested open-tail heading — is
   accepted and gets documented, not special-cased.
5. **Enter** inserts the separator; a fresh row is an empty paragraph. `createRowContent` and
   its first-option dependence die.
6. **A paragraph is a Row with no markup** — no registered option, no Mark component. A
   zero-option block editor becomes legal (the `#hasMark` parser gate no longer decides
   whether rows exist).

## Why (measured, 2026-08-20)

- `'# __slot__'` without a terminator is destructive today: `isSlotLeading` is a **count**
  (`segments.length === 1 && hasSlot`,
  [`PatternMatcher.ts:139`](../../../../packages/core/src/features/tokens/parser/core/PatternMatcher.ts)),
  so `resolveSlotLeadingMatches` extends a *leading* marker backwards and hands it the
  previous row's text — issue 02:40-42's prediction, reproduced.
- A separator registered as an ordinary segment loses whole rows: the longest-first
  alternation
  ([`SegmentMatcher.ts:88`](../../../../packages/core/src/features/tokens/parser/core/SegmentMatcher.ts))
  lets `\n\n` eat another Markup's `\n` — the spec's violation row 1, isolated and confirmed
  (`['# __slot__\n\n', '- [__value__] __slot__\n']` on a mixed doc: 1 mark instead of 3).
- Both defects are unfixable by moving the same string into a field; the separator must be
  privileged (asserted where matches end, never in the alternation).

## Why not the incremental variant

Keeping mark == row with a structurally-formed paragraph option (`{markup: '__slot__', Mark}`)
was designed in full and rejected on four keystroke-reachable holes plus a doubled migration:

1. **Identity cliff**: typing at row start flips the root's descriptor (heading → paragraph),
   adoption pairs on descriptor identity → row remount, `BlockController`'s `WeakMap` state
   lost.
2. **Row-count cliff**: a span tiled by two marks is two rows; add a space between them — one;
   delete it — two again. "Row = text between separators" violated by the design's own rules.
3. Inline marks in a bare paragraph still require registering the paragraph option **with a
   Mark component** — "one setting" is really setting + mandatory option + component.
4. **Straddle hole**: a todo literal `'\n'` under separator `'\n\n'` discards the only
   boundary occurrence and fuses rows; the validation rule has to ban literal/separator
   overlap, not just containment.

Sequencing: shipping it first migrates the public options contract **twice**
(`'__slot__\n\n'` → `'__slot__'` → delete) and never touches bind/DOM/adapters — exactly
where the real risk of the target design lives. Its genuine virtue (small green steps) is
available inside the target design's steps 2-4, which are additive PRs with no production
caller.

## Design summary

Full analysis (phase7 archaeology, six subsystem maps, both design sketches, adversarial
review) produced 2026-08-20; essentials:

- **Parser.** New entry `parseRows(value, separator)` beside `parse()`: segment search →
  pattern match → one O(N) `indexOf` scan for separator occurrences, skipping any occurrence
  inside an accepted match's extent (hides codeBlock's internal `'\n\n'`) → close open
  trailing gaps **forward** to the row boundary → `TreeBuilder.build` unchanged → group top
  level into `RowToken`s. The separator never enters the alternation. `MarkupDescriptor`
  gains a placement bit (`trailingGap`), because counts cannot distinguish `'# __slot__'`
  from `'__slot__\n\n'`. Markups with a leading undelimited gap (`'__slot__\n\n'`) become
  invalid — the chain is replaced by a validation rule. Deleted:
  `resolveSlotLeadingMatches`, parser `isSlotLeading`, the Match slot seed, both
  `//TODO need review it` markers.
- **Tree.** `RowNode {kind: 'row', children, position (includes trailing separator when
  terminated), terminated}`; rows tile the document, `joinNodes(roots) === value`
  byte-for-byte; empty row carries ONE empty text child (phase7 rule `e2db61c6`); a Row is
  never a child — nested rows inside slots are **deferred** (v1 honors "inside `__slot__`"
  only as trailing-open-slot closure).
- **DOM.** The RowNode binds to the Block wrapper the adapter already renders — **no new
  element level**, so ADR-0005 probes and the Nested `ul/li/h1` fixtures are untouched.
  Three local arms: editableState skip for row bindings, caret delegation to leaf children,
  domBoundary `fromChildAnchor` with owner = Row (replacing the single-token-per-row
  `rowElement` arm). Follow-on: the `rowElement`/`consignRow` concept dies.
- **Block/keyboard.** Enter = insert separator; merge = delete the first row's separator;
  `isTextLikeRow`, `project/compose/insertRow`, `createRowContent` die. New required work:
  port `input.ts`'s mark-swallow arm to block — paragraphs now contain inline marks, and
  block Backspace currently fails closed at a mark edge.
- **Adapters.** `Container` unchanged; `Block` renders `node.children()` instead of one
  `<Token>`; `Token`/`resolveMarkSlot` never see a Row. Paragraph rows render as bare spans —
  "a paragraph is just text", literally.
- **Phase7 material** (`phase7-first-class-rows-wip`, 16-commit tranche, net −435 lines over
  55 files, never landed): reusable — RowToken shape, empty-row rule, the round-trip +
  row-locality property pair (`011de777`, 200 seeded iterations), the ops/keyboard deletion
  checklists. NOT reusable as code — its `BlockParser` pre-splits before matching, which is
  unsound for opaque gaps, and it derived the terminator from markups instead of a setting.

## Migration (each step green)

**EXECUTED 2026-08-20**, steps 2-7 landed as one commit each on `b0` (parser `fc148a53`,
tree `25ff7aaa`, plumbing `5c9a4db8`, cutover `65c46f02`, chain deletion `5b993063`,
reductions+docs follow). The inline open-tail sub-decision below was taken per this file's
own recommendation: an open trailing gap closes at END OF INPUT inline — one rule, one
direction, declared in [ADR-0009](../../../adr/0009-the-separator-is-structural.md).

1. ~~Ratify decisions~~ — this file.
2. Parser additive: `RowToken`, `trailingGap` descriptor bit, `parseRows` beside `parse()`,
   property specs (round-trip; row-locality). No production caller.
3. Tree additive: `RowNode` + arms (build/join/slice, anchors, adopt/adoptUtils incl. the
   pairing rule, snapshot, selectNode). Unreachable in production.
4. Plumbing additive: `props.separator` signal, watch-tuple member, boundary dep — read but
   unused by the fold.
5. **Cutover (the one atomic PR)**: block fold → `parseRows`; bind/editableState/caret/
   domBoundary row arms; `Block` renders children; blockEdit/BlockController/siblings
   simplifications; fixtures drop `'\n\n'` from markups; snapshots regenerated with explained
   diffs.
6. Chain deletion (pure): `resolveSlotLeadingMatches` + seed + `isSlotLeading`s +
   `filterEmptyText` wiring + `createRowContent` + `isTextLikeRow` + `project/compose`, with
   the inline capability change declared and re-covered.
7. Reductions + docs: `rowElement`/`consignRow` deletion; `CONTEXT.md` Row glossary; new ADR
   "the row separator is structural, not markup"; website docs; block mark-swallow port.

## Guards required before step 5

- **Pairing × `terminated` property spec**: a reorder involving the document-final
  unterminated row flips `terminated` on two rows; naive pair-equality then rejects the
  pairing and identity silently degrades to index pairing — the exact ADR-0007 failure mode.
  The spec must assert every row keeps its object across such reorders, and `movePlan`'s
  span text becomes a separator-normalized join, not the verbatim slice.
- Anchor-vocabulary sweep: `{before/after: RowNode}` now reaches consumers (overlay,
  `MarkputHandle`, clipboard `selectedContent`) — audit before, not after.
- Snapshot discipline per AGENTS.md: every parser inline-snapshot diff explained, never
  regenerated blind.

## Remaining sub-decisions (surface before the step that needs them, not before starting)

- ~~**Inline rule for open-tail markups**~~ TAKEN at step 6, per the recommendation: an open
  trailing gap closes at end of input (document = one implicit row). A leading-gap markup
  (`'__slot__\n\n'`) throws at registration — the declared capability change.
- **Shift+Enter under `separator: '\n'`** — still open, and now LIVE in the TodoList story:
  `insertLineBreak` inserts `'\n'`, which IS that editor's separator, so a soft break splits
  the row. Arguably correct for a per-line editor; decide before documenting soft-break.

## Relation to the phase plan

- [Issue 02](02-decide-the-row-boundary.md) — closed by this decision (candidate 3).
- [Issue 03](03-make-the-row-extent-local.md) (local row extent) — achieved by construction
  at steps 5-6.
- [Issue 07](07-a-markup-cannot-match-its-own-neighbours.md) — the shared-delimiter class
  becomes unreachable **for block rows** (markups lose their delimiters entirely); the
  general inline case remains that issue's.
- Layout-dependent parsing is not new risk: `filterEmptyText` is already `isBlock`-gated and
  read per adoption; a layout flip already reparses. Declared rule: layout flip = remount.
  No spec or story switches layout at runtime today.
