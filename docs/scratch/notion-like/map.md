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
- **The chrome claim held with one hole, and P7 closed it by deleting both consumer
  components.** Mentions and the row menu were consumer components over shipped machinery; the
  hole was that the menu wrote over the CARET's span, so it started a row on an empty row but
  could not convert a row that already had text. Both are gone now — see the P7 line below.
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
  which no `Pairing` can express. `moveTo` was left untouched for P5.
  Ticket [11](issues/11-overlay-inserts-one-markup.md)'s missing half is now reachable:
  `turnInto` takes the new body text, so strip-and-retype is one commit.
- **P4's review found four real defects, all in the same shape: a reading that was widened but not
  widened enough** (2026-08-25). Finality was read of the last ROW where a removal takes the whole
  SUBTREE, so the last root with children lost its boundary. A retype spliced the whole line body,
  and adoption collapses every anchor inside a window onto its end, so every retype threw the caret
  to the row's end — the window is trimmed to the changed bytes now. A split always gave the
  subtree to the head, which fails for the one head that cannot hold it: the EMPTY one. And a row
  kind was resolved by option REFERENCE, which the Vue adapter breaks on every prop sync by
  rebuilding its option objects — `turnInto` could never succeed in Vue, and no adapter test called
  it. Resolution is by MARKUP now.
- **Four P4 mechanisms were load-bearing and unpinned**, found by deleting each and running the
  suite: `rowSequence`'s no-row fallback, `#insertAfter`'s non-row step, and both new dead-node
  checks. The dead-node lesson generalizes — the obvious case pins nothing, because a dead LAST
  row's stale window points past the shortened document and the transaction's own bound refuses it.
  Only a dead FIRST row's window still lands on live bytes.
- **A row moves to a PLACEMENT, and there is exactly ONE mover** (2026-08-25, P5).
  `moveTo(to: number)` became `moveTo({parent, index})`, `TextNode.moveTo` and `MarkNode.moveTo`
  are gone, and `BlockController` drops through the same verb — grep confirms `movePlan` has two
  callers, the model and its own property. There is NO common ancestor: a subtree is contiguous in
  pre-order, so a move is "cut this run, paste it before that index", and the splice is the
  narrowest CHANGED RANGE of lines rather than the ancestor's span. The spec's `store.block.move`
  over a SET of ids did not land and is not owed yet — nothing multi-selects rows, so it would be
  published surface with no caller.
- **P5's review found ONE defect, in three faces, and the third was found by the corpus rather
  than by a reviewer** (2026-08-25). A row whose lead carries a SURPLUS indent run is held at its
  depth by the row ABOVE it and by nothing else, so any splice that raises that ceiling re-parses
  it without touching its bytes. The mover asked `depthCeiling` about its own run's root and about
  nothing else, so: an untouched row after the span re-parented (`'x⏎⏎⇥⇥b'` → `b` became `x`'s
  child, reachable from the shipped drag); an untouched row re-emitted INSIDE the span did the
  same; and a moved blank row re-led to `''` became EMPTY, which takes no children, so the subtree
  it was carrying was promoted out of it. All three collapse into one answer — replay the SCAN over
  the span the splice rewrites, plus one row — and the mover refuses rather than widening, because
  normalizing another row's lead cascades into the row after it.
- **`setDepth` shared the same hole, in TWO faces, and both are closed** (2026-08-25, P6). The
  declared one first: `'x⏎⏎⇥⇥b'`, `blank.setDepth(1)` emitted `'x⏎⇥⏎⇥⇥b'` and the untouched root
  `b` landed two levels down as a grandchild. The second was found by measuring the verb rather
  than by reading it — indenting a row that HAS children emitted `'a⏎⇥b⏎⇥c'` from `'a⏎b⏎⇥c'`, where
  `c` stopped being `b`'s child and became its sibling, which is Tab in a list. Both come from
  rewriting ONE row's lead: the subtree travels now, re-led by the same depth delta the mover uses,
  and the scan replay is shared with the mover as `scanAgrees` rather than written twice. What it
  still does NOT refuse, because the encoding says so: outdenting a row leaves the siblings after it
  at a depth its new depth grants, so they become its children — the outliner's answer.
- **A property exhaustive over PLACEMENTS is not exhaustive over DOCUMENTS.** P5's generator
  rendered every row at `INDENT.repeat(depth)`, so the corpus was canonical-only and structurally
  incapable of holding the class all three defects lived in. Widening it — surplus leads at 25%,
  blank rows allowed children — found the third defect immediately. The legality predicate is now
  the ENCODING and not a copy of the mover's rules: the intended tree is projected to bytes and
  PARSED BACK, and the placement is legal exactly when the parse agrees.
- **The mover's window narrowness was a docstring paragraph and nothing else.** Splicing the whole
  document instead left all 91 files / 1691 tests green, because `moveTo` carries the caret through
  adoption's verified-move short-circuit rather than through the window map. Restored and pinned
  rather than deleted — the answer to an unpinned claim you want to keep is a pin.
- **The row keymap is four keys and no rules of its own** (2026-08-25, P6). `blockEdit.ts` became
  `rowKeys.ts`; every arm resolves `tokens.rowOf(anchor)` and calls a P4/P5 verb. Enter is
  `splitAt` — one call for end-of-row, mid-row and start-of-row — and on an EMPTY row it runs the
  ONE demote ladder (depth, then kind) that Backspace-at-a-row-entry runs too. Backspace's last
  rung is NOT a `mergeWith` call: it falls through to the shared delete arm, whose boundary
  expansion already is the merge, so the keymap has 0 of the 2 possible merge implementations. Tab
  is `setDepth`, gated by the new `RowSpec.indents`, which gates the KEY rather than the verb.
  The two rules the keymap DOES hold are the two the verbs cannot answer, and both were wrong on
  the first pass: whose line a continuation joins, and whose declaration Tab reads (below).
- **The soft break is a CONTINUATION ROW, and `softBreak` is not built** (2026-08-25, P6). Tested
  against what a soft break must do rather than argued: it travels with its parent on a drag and
  copies with it (it is inside the parent's span), it reaches the parent's component as the `rows`
  prop, and the caret walks in and out natively. FOUR costs, all declared in ADR-0011's amendment:
  Backspace at its start outdents before it merges, so rejoining takes two presses; a consumer
  cannot tell it from a Tab-nested row, because the two ARE the same document; typed into a row
  that already has children it lands before them, where unbounded in-slot index pairing shifts
  those children's ids; and a kind whose component ignores the `rows` prop paints no child rows at
  all, continuation or otherwise — a contract on the kind, since core cannot see whether a
  component reads a prop. It is ONE splice — `separator + indent.repeat(continuationDepth)` — and
  that is forced rather than preferred: two verbs cannot compose in controlled mode, where the tree
  has not moved when the first returns.
- **`childDepth` is the scan's ceiling, asked instead of re-derived.** The continuation needs "how
  deep may a row written under this one sit", and an EMPTY row takes no children — so
  `depth + 1` would write an indent run the scan never grants and hand back a sibling carrying
  stray bytes. `rowOf` answers `depthCeiling` directly, which makes Shift+Enter on an empty row a
  plain split with no rule restated above the tree.
- **The continuation asks WHOSE line it is, and the first draft did not** (2026-08-25, P6 review).
  Measuring from the caret's own row built a staircase: after the first Shift+Enter the caret is IN
  the continuation, so `'- a'` soft-broken three times emitted `'- a⏎⇥one⏎⇥⇥two⏎⇥⇥⇥'` — four levels
  for one list item, with only line 2 landing in the bullet's own slot. `continuationDepth` now
  reads a row with a KIND, or a ROOT with none, as the owner of its lines (child), and a NESTED row
  with neither as an interior line already (sibling). The paragraph half is not cosmetic: the first
  repair made a root paragraph's soft break a sibling, and `Drag.spec`'s "not create a new row when
  pressing Shift+Enter" caught it — a paragraph receives its child rows as ordinary children, so
  its continuation really does paint inside it and stays one draggable block.
- **A row with no kind inherits `indents` from the row it is nested in** (2026-08-25, P6 review).
  Reading the declaration off the caret's own row let Tab EJECT FOCUS from the second line of a
  list item while indenting the first — the exact split `handleRowIndent`'s own docblock calls
  worse than either. `AnchoredRow` gained `parent`, free from `rowOf`'s existing walk. Cost (b)
  above is therefore a RULE, not an ambiguity: a Tab-nested paragraph answers the same way, because
  it is the same document.
- **Three verbs, three answers to the empty-row wall, and that is policy rather than duplication.**
  The rule has one owner (`depthCeiling`); what differs is the reaction. `setDepth` REFUSES, since
  a re-indent that silently un-nests is a surprise with no gain and the children can be outdented
  first. `splitAt` RELOCATES the subtree to its tail, which a split has a home for. `turnInto` lets
  the scan PROMOTE, because refusing would leave no way to un-type an empty parent — the keystroke
  would be a no-op with no escape. The last one is now pinned at the keymap as well as at the verb,
  because P6 is what made it one keystroke.
- **P6's honest cost: `+370 / −103` production lines, net +267** (excluding specs, READMEs and the
  website), across the eight phase commits plus this review's six. Rule 14 asks for the number even
  when the change grows the code, and no P6 commit body stated it. What came OUT: `blockEdit.ts`
  (a pure move), `setValue`'s `enterRoot` with its sole caller, `depthPlan`'s own `landsAt` clamp,
  `movePlan`'s inline scan walk, `scannedAs`'s field-wise restatement of an empty line, and two
  guards no answer of `rowOf` can reach. Runtime: `rowOf` is a full pre-order walk now run on every
  Enter, Tab and Backspace — no benchmark, and not on a documented hot path either.
- **The keymap's own browser spec found a two-keystroke data-loss bug that predates it.** Typing
  `'- '` into an empty editor and then any character REPLACED the whole document: a document whose
  content is one empty-bodied typed row has its first selectable offset AT its length, so a plain
  caret there satisfied both of `isAllSelected`'s equalities. A collapsed selection selects nothing
  now. The collapsed case had a test, and it was decorative — its fixture was a caret mid-'hello',
  which the equalities already refuse.
- **An option that declares a menu entry IS the menu** (2026-08-25, P7). `CoreOption.menu` is the
  whole registration: `overlay.entries` is assembled from the options carrying one and narrowed by
  the typed query through `filterSuggestions`, so the "does this row match" rule has ONE owner
  across both overlays. `choose` gained an `option` arm beside its value arm rather than a second
  write path, and that arm cuts the trigger out of the caret's row and retypes the row in ONE
  splice — forced, not preferred: two verbs cannot compose in controlled mode. That closes
  [11](issues/11-overlay-inserts-one-markup.md) in all three of its halves, the third being
  `overlay.data` widening to carry an identity beside a label.
- **`mode` is a label, not a switch.** `'insert'` versus `'turnInto'` is a fact about the CARET'S
  ROW, so it lives on the overlay and not on every entry, and `choose` runs the same splice either
  way — the only thing it decides is whether `menu.text`/`menu.meta` seed the body, which they do
  exactly where there is nothing to keep. Both readings come from one private target read, so what
  the menu says it will do and what it does cannot disagree.
- **The measurement is the deletion.** `SlashMenu.tsx` (60 lines) and `MentionOverlay.tsx` (54)
  are gone from the probe: `/` is the adapters' new `BlockMenu` and `@` is the built-in
  Suggestions over `overlay.data`. The phase's exit criterion — "the showcase's menu component
  contains no filtering and no insert logic" — is satisfied by there being no such component. Six
  CSS blocks went with them (52 lines). Honest cost: `+447 / −217` production lines across the six
  commits (excluding specs and the website), net +230 — and 166 of the deletions are the probe's,
  so core and the adapters grew by roughly 390 lines for two shipped menu components, three new
  overlay members, one tree read and the `data` widening.
- **`BlockMenu` has no keyboard navigation, and that is stated rather than hidden.** The
  arrow/Enter protocol is `SuggestionsModel`'s and is bound to `overlay.data`; giving the menu its
  own highlight is a second piece of list state, and P7 did not need one. `MenuSpec.section` ships
  with no painter for the same reason — the showcase groups by it at P11.
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
