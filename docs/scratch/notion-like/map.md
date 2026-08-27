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
  own highlight is a second piece of list state, and P7 did not need one.
- **P7's review pass deleted three members and one dead guard, each by measurement.**
  `overlay.mode` (spec'd by P7, and the one deviation from the spec text) and `MenuSpec.section`
  / `MenuEntry.section` both shipped with ZERO readers — no shipped menu paints either, and the
  same "no caller" rule had already killed `MenuSpec.icon` inside the phase. Deleting them left
  the suite green, so they come back with the painter that needs them (P11's grouped showcase
  menu) and not before. `choose`'s `meta` on the option arm had no caller either, and
  `slotWithout`'s `from > to` arm guarded a span `#findTrigger` cannot build. Two arms that had
  been pinned only THROUGH `mode` got pins of their own in the same commit.
- **A history entry is an edit that LANDED, and controlled mode is what forces that** (2026-08-25,
  P8, ADR-0012). The record is captured at `CommitSink.commit` — the one place both modes hold the
  pre-image, since a controlled commit never reaches the fold — and emitted only when the tree
  actually takes it, which in controlled mode is the echo. That is what makes the "parent refuses
  the emission" case cost nothing: recorded at commit instead, such an entry BURIES every good one
  under it, because the stack's top then names a document that does not exist. Whatever an emission
  owes on landing rides WITH the emission, in the same record the pairing already rode in.
- **`#replaying` was never written, in either direction.** A replay does not go through the sink
  that captures records, so it emits none and the stack cannot re-enter itself; and the mutant that
  swaps `replay` for `setValue` reddens five cases, two of them by exactly that re-entry.
- **An undo replays the recorded window BACKWARDS.** Measured before it was designed: `'a\nb\nc'`
  with the first row moved keeps every id, and a `setValue`-shaped undo restores the same string
  while handing row `a`'s node the text `b` had. `invertWindow` reverses the pairing with it — and
  the first version of that pin was DECORATIVE, because the swap it used is its own inverse. A
  rotation is what reddens a pairing read forwards.
- **Three rules derived instead of stored, which is why `EditRecord` has no `origin`.** An entry is
  usable only while the document still holds the projection its window lives in; a typing run is
  recognised from the records themselves (two one-character inserts, contiguous, chained, inside
  500 ms); a fresh edit discards the redo branch. The spec's second origin, `'foreign'`, existed to
  clear the redo stack and close the run on an outside value — both of which fall out of those
  comparisons, so the field had no reader and was not built.
- **The shared browser spec earned itself on its first run.** `history` arrived as `false` in Vue
  whenever a caller omitted it: Vue casts an absent Boolean-typed prop to `false` unless the
  declaration carries a default, and this is the first boolean prop in `MarkedInput` whose core
  default is `true` — `readOnly` and `draggable` default to `false`, so the cast had agreed with
  them by coincidence. Undo worked in React and did nothing in Vue.
- **P8's review pass found the two places an undo stack rots, and both were real.** IDENTITY: the
  record held live `Anchors`, so undoing an edit that destroyed the nodes the caret sat in — a
  Backspace row merge, a delete across a mark — restored the right string with a caret in a
  detached node, which keeps the `position` it died with. Every caret pin in the phase read that
  position and passed; only `placeCaret` disagreed. Records carry OFFSETS now, resolved after
  adoption. REFUSAL: the stack moved on the call rather than on the landing, so a controlled parent
  declining the undo consumed the entry into a redo stack that could never offer it — one refusal
  cost every entry underneath. The move rides on `Landing` with the record and the caret.
- **P8's two "irreducible" mechanisms were deleted and measured.** `replay`'s `#ensureSeeded` is
  gone: a replay needs a record, a record needs an edit that landed, and landing seeds. `#push`'s
  `history` read survived the same treatment for the opposite reason — the suite stayed green
  because it had no pin, not because it does nothing, and the off-then-ON case is now a test that
  reddens without it. `canUndo` also learned about `readOnly`, which `replay` had always refused.
- **A cell is a Row born from its parent's carve** (2026-08-25, P9,
  [02](issues/02-variadic-placeholders.md)). A kind declaring `split: {at, as}` has its own body
  taken apart at the literal, and no fifth node kind and no cell branch in the DOM layer came with
  it. The tree learns ONE question — are a row's child rows its own body — and answers it
  structurally, from children being inline-then-rows: a row whose first child is a row has no
  inline content. Three readings follow, and they are the whole cost: the body IS the children, the
  line covers them, and the pre-order walk never names one, so no separator is written between
  pieces.
- **The edges, all declared rather than discovered later.** N delimiters is N+1 pieces INCLUDING
  the empty ones a leading, doubled or trailing delimiter produces; a delimiter that would straddle
  the row's closing literal is not one; a piece cannot contain its own delimiter, which is the
  declared limitation an escape scoped to a cell body would lift; the carve goes one level, so a
  kind naming itself terminates. In the keymap: Enter splits the LINE and the pieces after the
  caret move into the row it produces, Backspace at the first piece un-types the line, Tab at the
  first or last piece leaves the field (ADR-0002's accepted cost), and a slash menu opened in a
  piece converts the line. Shift+Enter is REFUSED there, found by the review pass: a continuation
  is a row nested under the line's own row and a carved row is granted none, so the separator went
  INSIDE the body — `'| a | b'` broken at the first piece emitted `'| ⏎a | b'`, one empty cell above
  a paragraph holding the rest. Consumed and doing nothing, which is Backspace's answer at a piece's
  start.
- **The spec's rule that `split` excludes `indents` was NOT added, because the defect behind it is
  closed at its source.** The rule existed to stop a row holding both cells and indented children
  from losing the indented ones from the projection. A carved row now takes no indent-nested
  children at all — the scan's depth ceiling refuses them — so an indented line under a table line
  stays a root. Measured both ways: without the ceiling `'| a | b⏎⇥child'` loses `child` from the
  top level, and with it the value round-trips. A rule with no defect behind it is a rule with no
  reason.
- **The header is a RUN, not a line, and it stays a consumer-side reading.** P2 declared a table
  renders without one because which line is the header is a fact about the line AFTER it, and the
  split does not change that — a row is recognised by its own first bytes alone. What it changes is
  that the reading needs no component to ask: the cells are elements, so `.table + .table` is
  "preceded by a table line" and what it fails to match is the first line of each run. The fact
  core is still missing is a wrapper around the run — `RowSpec.group`, in the spec's type and not
  built — which is also why columns do not align between lines.
- **In-slot pairing was unbounded index pairing, and P4 measured it into P9's lap.** The
  window-bounded prefix/suffix walk ran on the ROOT list alone, so writing a delimiter into column 2
  of a five-column line handed columns 3–5 the node objects of the columns before them, with a
  byte-identical value either way. The same walk now runs at every depth. It does NOT fix the
  parent/child `mergeWith` grandchild, and that is not the same defect: `Pairing` is an
  equal-length permutation, which a merge that removes a row cannot be, and the grandchild's node
  is one level below the row being deleted while its token is now a sibling of the survivor's text.
  Only a cross-level claim could pair them.
- **A ROW SELECTION IS THE TEXT SELECTION, read at row granularity** (2026-08-25, P10).
  `store.block.selected` is a `Computed` over `(nodes(), selection.anchors())` — the maximal rows
  the selection covers WHOLE — and there is no second store. That is what makes Esc, Shift+arrows
  and Mod+A one `select` call each and nothing else: a store of selected ids would need pruning on
  every commit, re-pairing across every adoption and reconciling with the caret, three clocks for a
  fact the selection already carries, and the DOM paints it for free. All four gestures ask
  `tokens.rowScope(anchors, scope)`, so no two keys can disagree about what one level wider means.
  Declared costs: an EMPTY row cannot be row-selected on its own (its content is zero-width, so a
  caret in one sits at both of its edges — `isAllSelected`'s own refusal read at the row); Esc
  defers to an open overlay; and Shift+arrows are consumed only once a row selection stands, by the
  same test that says there is nothing to grow.
- **The hit test is two searches, and the nearest fallback is ROOT-ONLY.** A parent's box CONTAINS
  its children's, so the flat binary search over roots always answered the outermost row and every
  nested drag would have been a root drag. `rowAt` binary-searches the roots and then runs the same
  search over the hit row's own child rows. Inside a parent the leftover space IS the parent's own
  line, so a nearest CHILD would claim a point its parent owns — a distinction the flat search never
  had to make. A CARVED row is a leaf: pointing anywhere in a table line answers the LINE. AMENDED
  in review: root-only was right sideways and wrong downward. A point PAST a root's box is past its
  whole subtree, and answering the root there reads the gap off the root's own line — which for a
  parent is its first child's slot, so a drop below the document landed above the very children the
  pointer was below. The walk continues to the subtree's last PAINTED line, which is also the
  nearest painted row to a point below everything.
- **The collapse hazard is answered by walking, not by giving up.** A row hidden by a collapsed
  ancestor is still in the tree and still bound, and it has no box to be ordered by; the old code
  abandoned the whole document the moment one row on its path was unbound. A probe that lands on an
  unpainted row now walks outward to the nearest painted one. Paintedness is
  `getClientRects().length === 0`, measured: `getBoundingClientRect()` answers all zeros for a
  hidden element and cannot be told from a real box at the origin, and without the distinction a
  hidden row among painted siblings sends the search the wrong way and the row above it becomes
  unhoverable.
- **A drop RESOLVES a placement at `dragover`, and the indicator promises rather than predicts.**
  The pointer's Y names a gap — read off the hit row's own LINE, since a parent's box covers its
  children — and its X names a depth inside it. Which depths a gap offers is bounded by the scan's
  ceiling above and the next line's depth below (go shallower and that line becomes a CHILD of what
  was dropped) — the line the MOVE leaves after the gap, since a row in flight is not there to be
  re-parented, which the first cut of the floor missed — and then every candidate is PLANNED by
  P5's mover; the refused ones are never
  painted. `state.drop` therefore holds the placement that will happen together with the line that
  says so, and `rootIndexOf` is deleted with its last caller. The indent unit is MEASURED off the
  document — the hit row is inset from the parent the descent came through — so core reads a depth
  out of a horizontal position without knowing one CSS rule.
- **The mover took a SET, and that could not be a loop.** Two verbs cannot compose in controlled
  mode, so `movePlan` widened rather than being called repeatedly: the set is normalized to maximal
  subtrees inside the plan (the pre-order list is the only place "is this row inside that one" is
  answerable), each run carries its own depth delta, and every named root lands as a sibling of the
  others in document order. One observable consequence: a row NAMED in a move is re-led even when it
  keeps its position and its depth, which normalizes a surplus indent run — the verb's documented
  behaviour, previously unreachable.
- **A CELL is not draggable, and that is the whole answer for a carved row.** A piece has no line of
  its own and the pre-order walk names none, so a cell can be neither moved nor made a destination;
  the hit test stops at the line and Esc inside a cell selects the LINE. Nothing about this is a new
  rule — it is `rowOf`'s and `preorderRows`' existing reading, now stated at the mover.
- **A cross-parent drop keeps the NODE and loses the COMPONENT, measured in both adapters** (P10).
  The deferred experiment the spec owed came back negative: a row that changes parent moves between
  two different framework parents, and neither React nor Vue can carry a DOM element or a component
  instance across that boundary, so consumer state held in a row component resets while `node.id`
  comes through unchanged. That is the measurement the spec said would buy
  `store.block.collapsed` — a core-owned, node-keyed store of per-row view state. NOT built here:
  this phase is selection and drag, and a keyed signal registry is its own change with its own
  pruning clock.
- **Driving the pin in Vue found a defect one layer down.** `DomModel.selectRange` normalizes its
  pair with `Range.comparePoint`, whose premise is that both boundaries live under the one editing
  host; a framework re-parenting a row replaces its element and `bound` pulses per registration, so
  a pulse can land while one end has just left the document. `comparePoint` throws there, and in Vue
  it escaped as an unhandled rejection with no selection applied at all. Both ends are checked for
  being connected now, and the refusal is self-healing — the last registration of the same patch
  pulses `bound` again.
- **`rowAtPoint(clientX, clientY)` was NOT built, and the spec's own paragraph is why.** P10 puts
  cross-axis hit-testing explicitly out of scope in the same breath, which leaves `clientX` a
  parameter with no reader; the depth the pointer's X chooses is a DROP question, answered where the
  X is already in hand. `rowAt(clientY)` keeps its name and gains the descent.
- **P10's review round: five real defects, all in the same seam between a gesture and its span.**
  (1) the drop floor read a line that was itself in flight, so the commonest drag there is — pick a
  row up, drop it at its own gap to change only its depth — offered no outdent, and a gap whose
  whole remainder was leaving offered nothing at all; (2) the widening rung answered the FIRST
  covered row's parent verbatim, so Esc and Mod+A both SHRANK a selection spanning two parents, and
  Esc's `'row'` fallback shrank it again at depth 0; (3) Shift+arrow at a document edge fell through
  to the browser, whose own gesture then collapsed the selection it was extending — the arm's
  `undefined` meant two opposite things; (4) a drop below the document nested into the last root;
  (5) Esc with the row menu open did both, since the menu's dismissal is on `document` and cannot
  see this arm's `defaultPrevented`. Four mechanisms survived deletion with the suite green and are
  now pinned rather than deleted, each seen to redden: `#indentStep`'s own-child arm,
  `ASSUMED_INDENT`, `#lineBottom`'s carved-row return, and `state.drop`'s own equality.
  `ASSUMED_INDENT` was NOT derived from `SlotsFeature`'s gutter width — same number, different
  fact, and tying them would move drop depths on a restyle. The `dragover` cost the phase never
  stated is measured and written down: ~1.5 ms a tick at 4000 rows, 9% of a frame, kept because the
  alternative is a depth rule restated outside the mover.
- **Undeclared, not undesigned: a row gesture needs no Esc.** Because `selected` is derived, a plain
  text selection covering one row WHOLE already holds that row, so the next Shift+arrow grows by a
  ROW. That is what "a row selection IS the text selection" means, and it was true from the first
  commit; only the docs implied otherwise by saying "once a row selection stands". Now pinned and
  written.
- **The package is options and components, and the grep says so** (2026-08-25, P11;
  moved 2026-08-26). Twenty-five row kinds and seven marks, and
  `packages/storybook/src/pages/Notion/boundary.spec.ts` is the acceptance test the
  whole effort was aimed at: every import resolves to `react`, to `@markput/react` or
  to a file inside the showcase directory; no relative path climbs out of it;
  `store.edit` and `store.tokens` appear nowhere. All three arms were seen to redden — a `@markput/core/src` import,
  a `../../storybook/…` import and a `store.tokens.value()` call each turn one red.
  The theme and the sixteen presentational leaves MOVED into the package rather than
  being copied: a status chip is what a `<status:…>` mark renders, so a package that
  could not reach them would have to grow a second chip. The move is pure — the
  twenty `Notion/UI kit` snapshots did not shift a byte.
- **P11 needed exactly ONE new piece of surface: `useControlRef()`.** A row kind's
  component paints inside the one contenteditable container, so a checkbox, a toggle
  arrow or a language `<select>` is document content until something says otherwise —
  and `bind`'s sibling freeze does not say it: that walk runs from a MARK's root down
  to its slot host, and a ROW is its own host, so it terminates before its first step.
  `TokenModel.control()` already answered this and reaching it means reaching through
  `store.tokens`, which is the seam the grep forbids. Three lines in the React adapter.
  Vue's is owed by P12, with its caller.
- **`RowSpec.group` was NOT built, and P11 did not need it.** The three wants the fog
  hung off it were answered without a wrapper in the tree: columns align because
  consecutive `display: table-row` siblings are wrapped by CSS in ONE anonymous table
  box (and, after the caret measurement below, because every line declares the same
  grid template); a numbered run counts from one through a CSS counter reset on
  `:not(.numbered + .numbered)`, since `RowProps.index` is the position among ALL
  siblings; and the header is a KIND of its own (`'|= '`, a longer opener than `'| '`)
  rather than "the first line of a run". What stays unreachable is the ACCESSIBLE
  SEMANTICS: `role="row"` without a `role="table"` ancestor is a lie, so the showcase
  carries neither, and the table announces itself as a stack of rows.
- ~~**A grid line, not a table line, and the caret is why.**~~ and ~~**An UNDO restores the
  value and not the caret.**~~ P11 filed these as two defects with two mechanisms —
  Chromium's caret repair over a non-block formatting context, and a seam between
  `replay`'s caret write and the paint after it. **Both readings are wrong, and they were
  ONE defect** (P11.5). The caret was written, and it reached the DOM; it was written to
  the position the editor last BELIEVED the caret was at. `selectionchange` is delivered
  on a task, so between a caret moving and the browser saying so the stored anchors name
  where it WAS — and an edit is addressed from the DOM, because a `beforeinput` names its
  own span. Core then took two more readings for the same edit off the stale mirror: the
  history entry's `selectionBefore`, and the pre-image a controlled echo maps into a
  post-edit caret. The display value chose nothing: it chose where `userEvent.click`
  landed, since a shrunk `table-cell` box puts a click mid-text where a full-width `block`
  box puts it at the end. Forcing ONE `selectionchange` before the edit takes all six
  display pairs to the same right answer, which is the measurement that separates the two
  stories. Fixed by re-reading the DOM into the stored anchors at the WRITE GATE
  (`createTransactions`' `submit`); pinned per display and per mode in
  `pages/Base/caret.spec.ts` and `pages/Base/history.spec.ts`, both run by both adapters,
  and at core's own layer in `transactions.spec.ts` and `EditController.spec.ts`. The
  showcase's database stays a grid — the template aligns the run, which was always the
  other half of the reason.
- **Three things P11.5's own record got wrong, corrected by measurement.** Kept because a
  later phase will read that commit body and trust it.
  - **The fix reached ONE of the two commit entry points.** It sat on
    `EditController.replace`, and every ROW verb — `splitAt` (Enter), `setDepth` (Tab), a
    retype, a move — reaches `sink.commit` without passing through it. Measured in both
    adapters: split at the DOM's caret 4, undo, caret lands at 0. It sits at the gate every
    verb passes now, and `pages/Base/history.spec.ts`'s Enter case reddens — only it — when
    the old placement is restored.
  - **"The keydown row arms still read the stored anchors" is FALSE for three of its four
    items.** `rowKeys.ts:72`, `:140`, `:188` and `:218` all read
    `domAnchors() ?? selection.anchors()` — DOM first, and have since before the phase. Only
    `isAllSelected` (`input.ts:92`, `:158`) matches the description; the other genuinely
    mirror-only reader, `OverlayController.#findTrigger`, is not in the list. `isAllSelected`
    stays mirror-only DELIBERATELY: its whole reason is that `domAnchors()` declines when the
    DOM selection is gone, which is what lets Backspace clear a fully-selected value instead
    of letting the browser mutate contenteditable behind the model — pinned in `input.spec`.
    Making it DOM-first would delete that.
  - **"No measurement forces it, since real keys arrive a task apart" is FALSE.** Real keys
    reproduce the gap on their own: `{ArrowLeft}{ArrowLeft}{ArrowLeft}X` in ONE
    `userEvent.keyboard` call, then Mod+Z, lands the caret 2-3 characters past where the edit
    was made, in both modes and both adapters, with nothing writing a DOM caret by hand. Now
    a case in `pages/Base/history.spec.ts`.
- **A kind whose component paints no `{children}` is an ATOMIC row, and saying so is a
  CALL.** The properties panel, the table of contents, the metric grid, the board, the
  bookmark, the view bar and the comment thread all render leaves that take STRINGS, so
  their text round-trips and drags and selects. Taking no caret is NOT automatic, and P11
  shipped believing it was: four of the seven had no control root, and measured, a click
  or an ArrowDown put a blinking caret inside a properties grid where every keystroke was
  swallowed. All seven go through one `Atomic` wrapper now, so the rule is a call rather
  than a convention. The rest of the contract is the same shape as "a kind that ignores
  `rows` paints no child rows": core cannot see whether a component reads a prop.
- **An atomic kind's `/` entry must carry `menu.text`, and after it the caret has nowhere
  to go.** An empty atomic body can never be filled, because there is no surface to fill it
  through — seven entries inserted a blank panel or a blank card. Seeds fix that half. The
  half that stays is the one gesture the option API cannot express: `choose` turns THIS ROW
  into the kind, and an atomic row generates no caret position, so nothing a consumer writes
  asks for the trailing empty paragraph Notion leaves under such a block.
- **The COLLAPSED TOGGLE is `hidden="until-found"`, not an unmount and not plain
  `hidden`.** An unpainted row leaves `bind` and takes its anchors with it, so the
  children are always rendered. Plain `hidden` would cost three things a user expects —
  find-in-page cannot see the closed text, the browser cannot scroll to it, and a match
  cannot open the toggle — and `until-found` buys all three back through `beforematch`,
  which the component listens for and opens itself on. What it still costs is declared:
  a closed subtree generates no boxes, so an arrow from the title jumps over it and a
  selection dragged across it takes the closed text with it.
- **OPEN is the DOCUMENT'S fact: `▸` closed, `▾` open.** It was `useState`, which made it a
  fact only the component knew — so `showcase.md`'s open first toggle could not be authored
  (all three rendered closed), openness could not be undone, and it did not survive a drop into
  a different parent. As a KIND it is none of those: the arrow calls `turnInto` onto the sibling
  kind, the shape `todo` and `callout` already use, and the row keeps its id, text, children and
  caret. `meta` is not usable — a row's markup may not begin with a gap, so `'▸-'` is the only
  spelling left. NEW COST, declared: find-in-page landing inside a closed toggle now EDITS the
  document, because `beforematch` opens the row and opening it is a retype.
- **The BOARD is one row, not the nested column-and-card rows the spec drew, and the
  three documents disagree.** `spec.md` has `board`/`column`/`card` as row kinds; P10
  puts cross-axis hit-testing explicitly out of scope in the same breath, and a board's
  columns share one Y span, so a card dragged between columns would land in an arbitrary
  one; `showcase.md`'s final section assigns the board's columns and cards to the
  CONSUMER. The showcase follows `showcase.md`: the board is a raw closed kind whose
  body describes its columns, so the data round-trips and the row drags, while the
  card-between-columns drag is the `Board` component's own. A nested-row board becomes
  available the day a per-kind drag axis does.

- **THREE SPEC DEVIATIONS P11 made and did not declare**, filed here beside the four it
  did. `toc` was spec'd as a SLOT kind (`'@toc __slot__'`, `<nav>{children}</nav>`, editable) and
  shipped as a raw closed kind, which is what makes it atomic; `comment` was spec'd as one
  editable comment per row (`'@comment(__meta__) __slot__'` with `continues`/`indents`) and shipped
  as `comments`, a raw closed thread, which is what `showcase.md` item 16 actually asks for; and
  `bookmark`'s `meta` went from a bare url to `url|description`. All three are defensible and none
  of them was written down.
- **P11's REVIEW closed seven defects the phase's own suite reported as green**, and the
  common shape is worth keeping: every one of the failing gestures was pinned by the VALUE the
  editor emits and by nothing else. The value was right in all seven cases. What was wrong was
  the caret, the focus, the freeze or the row count. A page's proving spec needs at least one
  reading per gesture that only a live caret can produce — "type the next character and assert
  the value" is the cheapest one, and it is what caught the slash menu blurring its own editor.
- **`RowProps.index` has no reader anywhere in the repo, and is KEPT.** P11 was the phase that
  was meant to be its caller and declined it — a numbered run counts through a CSS counter,
  because `index` is the position among ALL siblings. Measured removable: deleting it from
  `RowRender`, both adapters' `RowProps` and both `Rows`/`Block` pairs leaves `pnpm run typecheck`
  at 0 and the suite at 101 files / 1909 passed. Not removed, because it is PUBLISHED consumer
  surface — it has its own page under `docs/api/interfaces/RowProps.md` — and AGENTS.md's rule is
  that published API goes only when its removal is the agreed change. The measurement is here so
  the decision is one word rather than another afternoon.
- **The metric cards are NOT beside the callout, and that is the board's reason again.**
  `showcase.md` item 10 asks for the grid "beside a callout"; they render stacked. Two ROWS cannot
  sit side by side: a document is a vertical list of rows and the drop resolution tiles it by Y, so
  a horizontal composition would offer drags that land in an arbitrary one of the two. CSS could
  fake it and would poison the hit test. It becomes available with a per-kind drag axis, exactly as
  the nested-row board does.

- ~~Checked and NOT filed: the End key. It moves the caret to the end of the VISUAL line, which on a
  wrapped row is mid-row — correct browser behaviour, not a defect.~~ **THE PREMISE WAS NEVER
  MEASURED, and it is false on macOS** (corrected 2026-08-26, `bcb6b5e2`). End mostly does not move
  the caret there at all: measured with no editor in the page, a bare `contenteditable` in a 200vh
  document leaves the caret where it is and smooth-scrolls to the bottom, and a `<textarea>` beside
  it does the same, because macOS binds the key to `scrollToEndOfDocument` and the editing command
  runs only once nothing is left to scroll. That is why the fifth driving session reported the caret
  reaching a line's edge on roughly one press in three — whether the key scrolls or edits depends on
  how far the page is already scrolled. The dismissal was right about the CAUSE it never named (the
  platform's answer, not our defect) and wrong about the action: the platform's answer is the wrong
  one for a field whose content is the thing being navigated, so the editor owns the two bare keys
  now and leaves Cmd+Left/Right and Ctrl+Home to it.

- **P11.6 closed the seven confirmed defects the hardening round left**, each at its
  one owner and each declared in its commit body (`671b18c4`, `2047537d`, `3facbc6e`,
  `c1ee4114`, `e4335eba`). Four of them were ONE cause: what a row selection contains.
  `rowSpan` starts a row at its entry while `sliceNodes` projects the same span with the
  opener put back, so a copy and a replacement wrote different bytes — closed by
  `TokenModel.replaceRows(anchors, rows)`, the one reading paste, cut, Backspace and Enter
  all call, and by the exactness test that keeps a span running from mid-row out of it. The
  other three: a pasted clip's line breaks now open rows through `RowNode.writeRows`, which
  is Enter's own `splitPlan` widened to a span plus the pieces written at it; Tab moves the
  whole selection through the set verb `TokenModel.indentRows`; `movePlan` tells
  `'unchanged'` apart from a refusal, so the gap a row already holds is a drop that can
  decline; and "Add below" is `RowNode.addSibling()`, which carries the lead the bare
  separator never did. Two readings the Fog had sketched did NOT survive measurement and the
  commits say so: a pasted line takes Enter's rule (`'⇥- two'`) rather than
  `continuationDepth`'s (`'⇥two'`), which is what keeps a table's cells cells; and the
  characterization fixture's table kind had to declare `continues: true`, as the showcase's
  own `tableLine` does, before it could express that claim at all. The collateral is
  declared: a selection covering exactly one row's whole body — a triple-click — IS a row
  selection, so cutting or deleting it takes the row away instead of emptying it.
  NARROWED by the review round below: "a pasted clip's line breaks now open rows" held only
  for a paste whose SPAN sits inside one row's body. Over a row selection the clip was still
  spliced raw, and across two rows it still is.

- **The review round on P11.6 found the phase had closed defect 1 through one door only, and
  that its own headline reading shipped twice.** Three reviewers, thirteen findings, ten
  reproduced. What the reproductions said, in the order they were fixed:
  a foreign clip pasted over a ROW SELECTION took none of the row rules — `input.ts` runs
  `replaceRowSelection` before `writeRowsFromInput`, and that arm handed the verb a finished
  STRING, so `Replacement.markup` (invented in the same phase for exactly this question) was
  computed and thrown away; measured, `'one\r\ntwo'` over a selected row left a literal
  carriage return in the value, and `'one⏎two'` over a nested bullet landed both lines at
  depth 0. `replaceRows` now takes `string | readonly string[] | null` and the union IS the
  distinction — a projection is spliced, LINES are opened — with `openedLine` shared with
  `splitPlan` so the caret path and the selection path cannot drift again.
  Tab used `rowsWithin`, the LOOSE reading, while the four gestures the phase unified used the
  exact one: a sweep from mid-`alpha` to the end of `beta` made Tab indent `beta`, a row the
  caret is not in. `TokenModel.rowSelection` publishes the exact reading and the paint, the
  drag, Esc's entry rung and Tab all ask it — `rowsWithin` no longer leaves `tree/`.
  Tab's `indents` gate was read off the ANCHOR's row while the verb moved the whole set, so
  which row happened to be first decided whether a heading got indented under a bullet or the
  key fell through to the browser. It is asked of every row now, all or none.
  `RowNode.addSibling()` answered `true` on a CELL and cut a table line in two; the pre-order
  walk that keeps a cell out of every set verb is the test it was missing.
  `splitPlan` counted the pieces it was handed while the splice opened one row per document
  separator in them, so under a `';;'` separator a pasted `'x;;y⏎z'` grew a lead-less row and
  put the caret in the middle of the clip.
  `dropPlacements` stepped over the rows in flight at the floor and not at the ceiling, so a
  dragged row's own gap offered the indent from the upper half of its line and not the lower.
  TWO REDUCTIONS WERE PROPOSED AND MEASURED, and they did not agree. `#applyDepth` came out
  (−11 lines, suite and typecheck green): its width was a `TreeNode` where a `RowNode` was
  meant. `#enterRow`'s `into === 0` fork did NOT: a green suite is not a proof, and the probe
  found the two arms name different POSITIONS for a MARK entry — `rowSequence` falls back to
  the roots in a document with no rows — so deleting it moved a caret from inside a mark's
  slot to the text before its opener while every existing case, which asserts an OFFSET, stayed
  green. The fork stays and the pin that tells the arms apart types a character.
  THE COST, honestly: production `packages/core/src` +222/−94, of which 133 added lines are
  comment and 30 removed ones were; net +89 lines of code, one mechanism retired, one
  published read added (`rowSelection`) and one removed (`rowsWithin`). Six new pins, five of
  them for behaviour that had none. Three findings were rejected on measurement rather than on
  taste, and are named in the Fog below so they are not re-filed.

## Fog

- **A paste whose SPAN crosses two rows is still spliced raw**, which is the one shape of
  defect 1 left open. MEASURED 2026-08-26 on the tip: `'- alpha⏎⇥- beta'`, DOM selection from
  offset 2 of `alpha` to offset 2 of `beta`, paste `'one⏎two'` → `'- alone⏎twota'` — the second
  line carries neither lead nor opener. `splitPlan` refuses a span that leaves the row's own
  body (`'what sends a paste across several rows back to the ordinary splice'`), and that
  refusal is deliberate: widening it means the head row keeps the text before the span, the
  LAST covered row's tail follows the last piece, and every row between them plus three subtree
  placements are consumed in one plan. That is a contract change to `splitPlan`, not a
  hardening fix, so it is declared in `keyboard-handling.md` rather than half-built.
- **`duplicate` and `insertAfter` on a CARVED PIECE fail open in the shape `addSibling` just
  stopped failing in.** MEASURED 2026-08-26: on `'| a | b⏎after'` the first cell answers
  `duplicate() === true` → `'| a| a | b⏎after'` and `insertAfter('\n') === true` →
  `'| a⏎ | b⏎after'`. PRE-EXISTING and a family rather than a case — the cure is the same
  pre-order membership test, applied where each verb reaches `#applyStructural`. Not taken
  with `addSibling` because that verb was this phase's own and these are not; a cell is
  unreachable from `BlockController` (its target comes from `state.menu`, and `rowAt` treats a
  carved row as a leaf), so both are published-API-only today.
- Three review findings REJECTED on measurement, recorded so they are not re-filed:
  `#enterRow`'s `into === 0` fork is load-bearing (above); `RowNode.writeRows` is not
  misplaced surface — the rule this codebase states is that a verb lives on the MODEL when the
  set it acts on has no owning row (`moveRows`, `indentRows`, `replaceRows`) and on the NODE
  when it does, and `writeRows` writes inside one row's own body exactly as `splitAt`,
  `turnInto` and `setDepth` do; and `replaceRowSelection`'s docstring was wrong about routing
  rather than the routing being wrong (fixed as prose, `e98160d0`).
- What a package on top of this owns: does it wrap `MarkedInput` and ship
  options + components, or does it need core changes first? The ticket list here
  is the input to that decision, not the answer.
- **The gutter `+` of `showcase.md` interaction 1 was never built, and nothing said so.**
  `showcase.md:56` asks for "its **drag grip** and a **+** on the left gutter". MEASURED
  2026-08-26: `packages/react/markput/src/components/BlockControls.tsx` paints exactly ONE
  `<button>` — `aria-label="Drag to reorder or click for options"` — beside a drop indicator and
  the menu popup. There is no add affordance in either adapter, no test names one, and no earlier
  decision retires it. So it is undeclared rather than declined, which is the part being fixed
  here. The row verb it was also blocked on now exists — `RowNode.addSibling()`, P11.6 — so a `+`
  at a nested row's gutter would open its row at the right depth; what is left is the affordance.
- **The showcase net is single-framework, and that is an accepted cost rather than an oversight.**
  MEASURED 2026-08-26: `pnpm -w exec vitest list --project vue | grep -ci notion` → `0`, while
  `pages/` holds nineteen framework-free `*.spec.ts` that BOTH projects run. Five of the ten
  defects the hardening round fixed have their only regression pin in `Notion.react.spec.tsx`.
  Converting the page to AGENTS.md's shared harness would double the net, and it is NOT the cheap
  rename the shape suggests: `Notion.fixtures.vue.ts` has to re-declare the whole vocabulary —
  ~800 lines of `options.tsx` plus sixteen presentational leaves — as Vue components, which is a
  second implementation and its own phase (`spec.md`'s P12, still owed with `useControlRef`).
  What the 2026-08-26 pass did INSTEAD, so the cost is bounded rather than unpaid: the three core
  rules whose only pin was that file — Enter deferring to the suggestions protocol, no trigger in
  a raw closed body, the re-probe on a caret move — now have core unit pins that run once for
  both adapters. The remaining exposure is the ADAPTER arms, which is exactly what P12 buys.
- **One split shape a single window cannot place the caret in: MID-BODY, on a row that KEEPS a
  subtree.** `splitPlan`'s window is trimmed to the changed bytes now, which is what put the caret
  at the tail's start for every childless split (the ordinary Enter). It cannot be trimmed when the
  head keeps its children, because the edit is then two disjoint pieces — bytes leave at the cut,
  bytes arrive past the subtree — and the smallest window covering both is the whole bound, where
  `resolveMappedAnchor` collapses the caret onto its end. MEASURED on the tip, controlled:
  `'abcd⏎⇥child⏎tail'` split at 2 emits `'ab⏎⇥child⏎cd⏎tail'` with the caret at 12, the END of
  `cd`, where the tail's start is 10. At a row's END the two readings agree (the tail is empty), and
  that case is pinned. Closing the last shape needs a post-edit CARET carried through the
  transaction to adoption rather than inferred from window arithmetic — new surface across
  `applyRange`, `CommitSink` and `adopt`, which is a design change and not this repair.
- **A table is a run of independent lines, and three wants hang off that one gap.** Columns cannot
  align, the accessible semantics cannot be a table (one `role="table"` per LINE describes a table
  of one row, which is why the probe carries none), and the header can only be read from the DOM
  run. All three are the same missing thing — a wrapper around consecutive siblings sharing a
  component, `RowSpec.group` — and none of them is a reason to give a cell a node kind of its own.
  The alignment line is a fourth: `'| ---'` is a longer opener than `'| '`, so a kind of its own is
  available to the consumer whenever someone wants it to paint as a rule instead of as dashes.
- Caret ergonomics at document scale — atomic tables and code blocks, Tab
  leaving the field (ADR-0002's accepted cost) — are unmeasured over a document
  this size. Native undo is no longer on that list: the editor owns it (ADR-0012).
- **A value the editor did not write disables undo while it stands** (P8, declared). A parent that
  writes `value` itself, or another author's change arriving through it, leaves every entry naming
  a projection the document no longer holds, and `canUndo` answers `false` until it comes back.
  Mapping recorded windows through foreign changes is the collaborative-editing design, and this
  one does not foreclose it.
- **Nothing scopes the row menu to the trigger that owns it, and that needs a
  decision rather than a default.** `overlay.entries` reads only "is an overlay
  open", never `match.option`, so the two overlay protocols share one state.
  REPRODUCED on the tip: with a `@` mention overlay open on `'hi @'` and four menu
  kinds registered, `entries()` answers `['Heading 1', 'To-do list']`, and
  `choose({option: HEADING})` returns `true` — it cuts the `@` span out of the row
  and retypes the row as a heading. No shipped configuration hits it (each trigger
  option carries its own `Overlay`, and `Suggestions` ignores `entries`), but a
  documented path does: `<MarkedInput Overlay={BlockMenu}>` is a global override
  that paints the row menu on EVERY trigger. Not patched, because every fix needs a
  way to say which trigger owns the menu — new surface with no caller today, or a
  heuristic ("the option with no `data`") that would be worse than the hole. P11 is
  the phase that will have a caller.
  **CLOSED 2026-08-26, and by the heuristic this entry called worse than the hole** — which turned
  out not to be a heuristic. `overlay.entries` is gone; `OverlayListModel.rows` offers the matched
  option's own `overlay.data` when it DECLARES any (`data: []` included, since a list that currently
  offers nothing must not fall through) and the row menu only when it declares none, so the two
  lists can never both be on offer. `data !== undefined` is the option's own declaration rather than
  a guess about it, which is the difference the entry could not see from where it stood. `choose`
  is unchanged: `choose({option})` called directly still retypes the row while a mention overlay
  stands, and that is a consumer calling a verb, not a list offering a row nobody asked for.
- **The showcase's `/` menu is still a flat list of labels.** P11 shipped the page
  without bringing `MenuSpec.section` or an icon back, because the shipped `BlockMenu`
  paints neither and the exit criterion — "the showcase's menu component contains no
  filtering and no insert logic" — is met by there being no such component. Twenty-five
  entries in one unsectioned list is the cost, and it is the first thing a painter would
  fix. `icon?: Slot` is still the version that keeps the criterion.
- **P11 owes a per-entry icon, and `MenuSpec.icon` is not the shape to bring back.**
  The spec's `icon?: unknown` was unrenderable and was rightly dropped inside P7.
  But a showcase menu that wants icons and has no field for one keeps an
  option-to-icon map in the consumer component — which is precisely the shape P7's
  exit criterion forbids. `icon?: Slot` is the version that keeps the criterion, and
  it lands with the painter, as `section` now does.
- **`continues` CARRIES A KIND AND NEVER A DEPTH, so no option can say "Enter opens a CHILD of
  this row" — which is what a CONTAINER wants.** The showcase's toggles declared `continues: true`
  and got the only thing the field can express: another toggle beside this one (`'▾ Why'` + Enter +
  text emitted `'▾ Why⏎▾ text'`), with Tab then nesting a toggle inside a toggle. That word is gone
  (2026-08-26) and the gesture is Enter, Tab — the `/text` in the middle is no longer needed — but
  the Tab is still the user's to press. WHAT A DEPTH-CARRYING FORM WOULD TAKE, measured against the
  code rather than sketched:
  - one more word in `RowSpec` — `continues` is `boolean | CoreOption` today and every reading of it
    goes through `TokenModel.#continues` into `Continuation = {descriptor, meta}`, so the field and
    that type both grow a "one level deeper" answer;
  - `siblings.ts`'s `openedLine` writes `node.lead() + rowMarkup(…)`, the splitting row's OWN lead,
    which is exactly why the tail is always a sibling. It would have to take a lead rather than read
    one, and the deeper lead is `lead + config.indent` — the byte-level primitive already exists as
    `rowKeys.ts`'s `continuationDepth`, which is what Shift+Enter writes;
  - `splitPlan` PLACES the tail past the whole subtree (`head + subtree + separator + written`)
    because a row written between a row and its children adopts them. A child goes on the other side
    of that join, and the `tail` index it returns —
    `index + preorderRows([node]).length + opened.length - 1` — moves with it. That is a contract
    change to the one function whose window arithmetic is already the fragile part (see the mid-body
    split entry above), not a one-field addition;
  - and it inherits two refusals it must not re-derive: the scan's ceiling
    (`AnchoredRow.childDepth`, which an EMPTY row makes 0) and `TokenModel.#nestingIsPainted`, a DOM
    fact that lives at the seam because `tree/` cannot ask whether a kind paints child rows.
- **CLOSED 2026-08-26 (round eight): the arrows are finished, not refused.** The cure below was
  taken, at the SEAM rather than in `DomModel`: `TokenModel.selectRowSpan` is the one write every
  row-selection gesture makes, and an end whose anchor `#dom.reachable` declines falls back on its
  row's `{before}`/`{after}` — the pair `#selectRow` already writes. It is a NO-OP wherever the end
  is painted, so Esc, Mod+A and the drag write byte-identical anchors on ordinary rows and the
  behaviour change is confined to the ends that resolved to nothing. Pinned by
  `caret.react.spec`'s 'grows a frozen row selection by a row, visibly', which reddens when the
  fallback is removed.

- **A ROW SELECTION THAT STARTS AT A FROZEN ROW CANNOT BE GROWN, and the model and the DOM disagree
  in silence while it stands.** A click on a row holding no editable position now SELECTS it
  (2026-08-26), written across the row's own ELEMENT because its text has no surface. MEASURED on
  `'- keep me⏎@toc⏎Launch tasks⏎@end⏎- and me'` in `Notion/Showcase`, controlled: typing replaces
  the row (`'- keep me⏎Z⏎- and me'`), Backspace removes it, Enter puts one blank row in its place,
  Mod+Z restores it, and `getSelection().toString()` carries `'Launch tasks'` — the browser paints
  it. Esc does NOTHING, and that is Esc's own semantics rather than a gap: it escalates and has
  never cleared, and a root row is already the outermost rung. THE ARROWS ARE THE GAP.
  Shift+ArrowDown IS consumed and the stored anchors DO widen, but nothing on screen moves:
  `selectSpan` writes `anchorAt(rowSpan.start)`, a row's ENTRY, and a frozen row's entry resolves to
  no boundary, so `DomModel.selectRange` declines and the DOM selection stays where it was — the
  next keystroke reads DOM truth and replaces the toc row alone. Shift+ArrowUp only appears to work
  because the BROWSER's own extend does it; plain ArrowUp collapses out of the selection and plain
  ArrowDown is a dead key. The cure is the one `#selectRow` already found, generalized: a range END
  that resolves to a row nothing paints falls back to the row's ELEMENT edge, which is a DOM
  question and belongs in `DomModel.#rangeBoundaryAt` — it takes that arm today only for
  `{before}`/`{after}` anchors, and every row gesture hands it entry offsets. NOT TAKEN with the
  click, because it changes what Esc's `'row'` rung, Mod+A's widening and the drag's own reads all
  paint, which is a behaviour change of its own and not a repair confined to the pointer.

- **The fourth driving session's six defects, and four of them were ONE shape: a rule with two
  owners** (2026-08-26). Every one reproduced in the browser first, and each pin was seen to redden
  by mutating the mechanism rather than by re-reading the test.
  - **A CONTROL IS A KEYBOARD TRAP.** A `<input type=checkbox>` or a `<select>` a row kind paints
    takes DOM focus on mousedown and leaves the SELECTION where it was, so the model held a live
    caret it could not act on: a contenteditable emits no `beforeinput` while a descendant control
    has focus, and `isConsumerKeyOrigin` declines the whole keydown tier for a registered control
    root. Measured: tick a to-do, press `X`, nothing moves. The rule was already in the tree TWICE,
    written by hand at `RowController.endDrag` and `runMenuVerb` for the grip alone; it is
    `SelectionDriver.reclaimFocus` now, called from the caret invariant's own settling point
    (`#afterFrame`), so it reaches every control a consumer declares through `useControlRef`.
    A COMMIT is the clock, because a commit is the moment the control's interaction has LANDED in
    the document. `:focus-visible` was measured as a discriminator for keyboard-driven controls and
    REJECTED: Chromium reports `true` for a mouse-clicked `<select>`, which is half the defect.
    Declared cost: a control arrowed with its popup closed, committing per keystroke, loses focus
    after the first commit.
  - **A ROW ELEMENT'S OFFSET 0 RESOLVED TO `{before: row}`.** `Row.tsx`/`Row.vue` hand the same
    element to `consign` and to `children`, so a boundary on it takes `fromHostAnchor`'s arm with an
    EMPTY child list — and the fallback there named the position ahead of the row's lead and opener.
    The rule ("a row's leading edge is its ENTRY") was already written one line below for an edge
    CHILD and was never asked of the OWNER. `'- the slash menu⏎⇥- dragging rows'` + Home + any
    character emitted `'- the slash menu⏎Y⇥- dragging rows'`: the row lost its kind AND its nesting
    to one keystroke. NOTE: Home does not produce `(rowElement, 0)` on macOS Chromium — the pin
    writes the boundary directly, at `domBoundary.spec`, and the anchor is asserted rather than the
    gesture.
  - **TAB AND THE MOVER DISAGREED, over four of the showcase's 35 rows.** `RowSpec.indents` was
    read per KIND while the DROP asked the structural question (`depthPlan` + `nestingIsPainted`) —
    two owners for "may this row nest". Measured before the change: a heading after a callout, the
    table of contents, a bookmark and a heading after a to-do were each offered depth 1 by the drag
    and accepted by the verb, while Tab was not consumed at all and the browser took focus out of
    the editor. `indents` is now ONE answer per editor (`TokenModel.rowsIndent`): it gates the KEY,
    which is a field-level accessibility question (ADR-0002), and `indentRows` alone decides which
    row moves. `lineOwner` came out with it. Re-measured after: zero disagreements over all 35 rows.
  - **THE ROW MENU IGNORED THE KEYBOARD**, which falsified P7's own "one overlay list with one
    keyboard". The protocol is `navigateSuggestions` — the same pure function the `/` list runs, so
    the two cannot drift — and what is per-list is the highlight (`state.menuActive`) and the source
    (`ROW_MENU_ITEMS`). Listened for on `document` beside the menu's existing dismissal, because the
    grip's own click is what leaves focus on the grip.
  - **MENU ORDER WAS DECLARATION ORDER.** Harmless while Enter picked nothing; a wrong commit on the
    first try since `4a11d450` made the first row highlighted. `rankSuggestion` bands a candidate —
    exact label, label prefix, label substring, then the same three over `keywords` — and both
    overlay arms read it, so `/table` offers **Table** and `/to` offers **To-do list**. The keyword
    OFFSET is the half a single band cannot express, and it has its own pin. An empty query is a
    prefix of everything, so nothing is reordered before the first character.
  - **THERE WAS NO WAY BACK TO PLAIN TEXT, and the capability belongs in core while the ENTRY
    belongs to the consumer.** The paragraph is the one kind no option can declare — it is
    `slots.paragraph` — so an option with a `menu` and NO `markup` names it, which is already this
    API's spelling for "inserts nothing itself". `choose`'s option arm calls `turnInto(undefined)`
    there. A DECLARED markup that compiles to no kind still refuses: that is a typo, not a request.
    Core ships no label; the showcase's `text` option is first in `notionOptions`, which is what
    puts **Text** at the head of an untyped `/`.
- **Two judged and NOT filed.** The focus RING around the whole container is correct: the container
  is the one editing host (ADR-0002), so it is the one focus target, and Chromium matches
  `:focus-visible` on a contenteditable even for a click — removing the outline in core would take
  the indicator from every consumer, and a consumer who wants none can style it. The 12px DROP BAND
  did not reproduce: swept at 2px steps over the showcase, every depth band is exactly one MEASURED
  indent unit (24px between two bullets, 48px under a toggle) and the SHALLOWEST depth's band is
  unbounded to the left, which is where the grip's own gutter is.

- **The fifth driving session's five defects, and four of them were ONE shape: a single answer
  standing in for two different questions** (2026-08-26). Same method as the fourth: reproduced in
  the browser first, and the pin seen to redden by mutating the mechanism rather than by re-reading
  the test. Re-measured while recording this, for the last of the five: routing `#claimRow` back
  through `#recoverCaret` fails all three of its pins, and disabling the `pointerdown` latch alone
  fails two. The other four are as their own commits record them.
  - **A CLICK ON FROZEN PRESENTATION LANDED IN A DIFFERENT ROW** (`9ef80374`). The hit test and the
    anchor resolution were both measured correct; the DESTINATION was the defect, and the old pin
    asserted it as if it were the rule — it clicked the table of contents and expected the keystroke
    in the heading four rows below. `#recoverCaret` searches FORWARD from the row it is handed
    because it answers "where next": the row under the caret stopped holding a position a caret may
    occupy, so travel continues where a person's own ArrowDown would. A POINTER asks "where did you
    point", and the one answer that question may never take is a neighbour. `#claimRow` is the other
    answer — the row the gesture landed in, at that row's own entry — and `#recoverCaret`'s
    `undefined` arm went out with it, since a search from index −1 is the same defect aimed at the
    document's first row. AND THE CLAIM HAS TO OUTRANK THE BROWSER, which is why it is latched on
    `pointerdown` rather than read off the selection: MEASURED in a bare `contenteditable` with no
    editor loaded, Chromium answers a mousedown on a `draggable` element inside a frozen island by
    collapsing the caret to the START OF THE EDITING HOST — a perfectly valid anchor in a row the
    pointer is nowhere near, and `selectionchange` carries no pointer, so nothing downstream can
    tell it from an intent. The latch is dropped by the next keydown, because a pointer landing on a
    FOCUSABLE control provokes no `selectionchange` at all and its claim would otherwise be spent on
    an arrow key several keystrokes later. WHERE THE ROW HOLDS NO POSITION AT ALL the click is
    inert, and the caret and the host focus are RELEASED rather than parked: the row's own boundary
    was the other candidate and it is worse, since the anchor space names it, the DOM cannot paint
    it, and the next keystroke would edit the row's hidden text. Dropping the range alone was
    measured insufficient — a focused `contenteditable` with no selection still takes typing and
    Chromium invents the host's start for it.
  - **A ROW THAT CLOSED UNDER THE CARET KEPT IT** (`21976b3f`). `DomModel.painted` answered one
    boolean for two questions — "this frame has not reached the row yet" and "the row's element is
    in the document and generates no box" — and the caret invariant stood down for both, so the
    focus reclaim handed focus back and restored the caret into a toggle that had just closed. It is
    `rowPaint` with three answers now: `'absent'` stands down, `'boxless'` goes straight to the
    recovery, and the forward walk STEPS OVER a boxless row because a collapsed run is exactly what
    a person's own ArrowDown skips. The hidden rows are left where they are — a closed toggle
    renders its host and hides it, which is a kind doing its job.
  - **A RETYPE PUT CHILDREN UNDER A KIND THAT PAINTS NONE** (`358bcfaa`). Tab and the drop already
    refuse, because the would-be parent is on screen to be asked before anything happens; `turnInto`
    writes the new kind UNDER children the row already has, so picking Heading 3 on a bulleted
    parent took both nested bullets off the screen while leaving them in the value. This is the one
    of the five that is not "one answer, two questions" but "asked before the DOM could answer":
    the same defect had been repaired three times at three doors, and it is asked once now at the
    commit's own repair pass, where the destination kind finally has a DOM. Because it runs after
    the write it is a REPAIR rather than a refusal, so one undo takes back the retype and the lift
    together.
  - **`continues: true` CARRIED THE SPLITTING ROW'S `meta`** (`ee8dfe62`, breaking). Enter at the
    end of a ticked to-do opened a second to-do already ticked, and Enter after a callout opened one
    wearing the tone of the row above. `- [x] ` says THIS task is done; it does not say what a new
    task is. The tail takes the kind and the KIND's own seed — `menu.meta`, the value an option
    already declares for the row its menu entry opens — which is what makes the two doors into a new
    row agree.
  - **END AND HOME WERE THE PLATFORM'S KEYS, and the entry that dismissed them is corrected above**
    (`bcb6b5e2`). `DomModel.moveToLineBoundary` runs `Selection.modify(…, 'lineboundary')` rather
    than computing an anchor, because which character ends a LINE is a layout fact and not a tree
    one — a wrapped row is several lines and one row.

- **The eighth driving session's six defects, and the first was ONE rule wearing four faces**
  (2026-08-26). Every one reproduced in the browser or in core first, and every pin was seen to
  redden by MUTATING the mechanism rather than by re-reading the test.
  - **A SELECTION EDGE THAT LANDS ON STRUCTURAL BYTES MUST RESOLVE TO THE CONTENT BOUNDARY IT
    NAMES.** The round-seven fix taught the ROW SELECTION one shape of this — a sibling row — and
    three more were still live, each because the row selection is the wrong set to ask. A parent's
    span covers its whole SUBTREE, so a triple-click on `'- A⏎⇥- B⏎⇥- C⏎- D'`'s first line covers no
    row whole, `store.rows.selected()` is EMPTY, and the raw write emitted `'- ZB⏎⇥- C⏎- D'`. A CELL
    is a piece no gesture may name — `rowsWithin` never descends into a carved body — so
    `'| aaa | bbb | ccc'` typed over at `bbb` ate the `' | '` and the row lost a column, and the same
    gesture on `ccc` ate the row below. The set that answers all four is the LINES: every row's own
    `slotRange` plus every cell's, recursively. `contentSpan` resolves the low edge forward onto the
    next line's entry and the high edge back onto the previous line's end, refuses an edge INSIDE a
    line's content (so a mid-row sweep still merges, unchanged), and only ever SHRINKS — an edit can
    never touch a byte outside the selection. It REPLACED `namesBoundary` and `stepOver` outright,
    and the `'text'` take with them: the exactness test a row selection needs is now "the content
    this span covers is exactly the covered rows' content", which is the same function. Proven over
    sibling, child, cell, last-cell-into-the-next-row and a meta-bearing opener; the whole suite was
    green at the swap, so those two functions were a special case of this one all along.
  - **A KEYSTROKE WAS SWALLOWED WHOLE WHEN THE NEXT ROW'S OPENER CARRIED A `meta`.** `'a⏎- [x]
    todo⏎next'`, triple-click `a`, type `Z`: nothing at all, while `store.rows.selected()` held the
    row and Backspace over it worked. Chromium ends the `beforeinput` target range inside the
    consumer's own decoration for that `meta` — a `contenteditable="false"` span no anchor can name
    — and `anchorsFromInputEvent` failed the whole read closed. It falls back on the LIVE selection
    now, which was correct the whole time.
  - **A CLICK ON THE BOOKMARK SELECTED ITS ROW AND THE LETTER LANDED TWO ROWS UP.** Same function,
    the other precedence rule. A row selection across a frozen row's ELEMENT is not an editable
    extent, so Chromium canonicalizes the target range to the nearest position it CAN name — in the
    row above — and the rule preferred a COLLAPSED target range over a ranged live selection. The
    pin that guarded that preference said in its own comment "this disagreement is not one Chromium
    produces"; it produces it on every atomic row. Reversed and declared.
  - **FOUR DECORATIONS SWALLOWED FOCUS.** The contract stays **a consumer must register**, and the
    showcase already follows it — all five controls are `useControlRef`'d, three of them inside
    their kind's one `Atomic`, which the fix's own success proves (`reclaimFocus` fires only for a
    registered control root). What was missing was the editor's half: the reclaim ran on the COMMIT,
    so it reached exactly the controls that WRITE. The trigger is the CLICK now, for every control
    that does not own a keyboard of its own; a `<select>`, an `<input>`, a `<textarea>` and an
    editable island keep the focus their click gave them — taking it back would close the popup the
    click opened — and give it back on their commit, which is the path that already existed.
  - **ENTER AT A ROW'S START APPLIED `continues` TO THE HALF THAT KEPT THE CONTENT.** Round seven
    rewrote the `/table` pin to press Enter from the LAST cell rather than face this. Restored, seen
    red, and FIXED at the cause: a split OPENS one row and KEEPS the other, and when nothing is
    written at the cut and the head takes none of the body, the row it opens is the empty HEAD. So
    `'|= A | B'` no longer emits `'|= ⏎| A | B'` (an empty header above, the column names demoted to
    a data line — the table's head gone in one keystroke) and `'# a'` no longer emits `'# ⏎a'`. A
    bullet is unchanged, because `continues: true` is the same kind either way. NO PIN ANYWHERE
    COVERED THE INVERSION: the whole suite stayed green with the swap in. What Enter from a seeded
    header now does — an empty row of what the kind CONTINUES INTO, above the header — is declared
    in `guides/keyboard-handling.md` and asserted rather than avoided.
  - **PRE-EXISTING, FLAGGED, NOT FIXED: a kind flip loses the caret's offset.** Clicking the toggle
    arrow reclaims focus correctly and the next character lands at the ROW'S ENTRY rather than where
    the caret was. Measured identical with the click reclaim disabled, so it is not that rule's: a
    flip of the arrow is a flip of the row's KIND, the consumer mints a fresh element for the row,
    and the caret is re-placed at its entry. The to-do's box keeps its offset because a `meta` change
    leaves the component — and the element — in place. Pinned at its actual behaviour in
    `Notion.react.spec`'s 'keeps typing after the toggle arrow'.

- **The ninth driving session: five defects, ONE owner for three of them, and a diagnosis
  re-measured false** (2026-08-27). Every one reproduced in the running showcase before it was
  written, and every pin was seen to redden by MUTATING the mechanism.
  - **THE HANDED-DOWN DIAGNOSIS DID NOT SURVIVE RE-MEASUREMENT.** The session's brief said
    `store.rows.selected()` came back EMPTY while nine rows were painted blue, so "the model had no
    idea a selection existed". Measured on the running page, three ways (fresh load, with a prior
    caret, and typing immediately), it answers `[3]` every time, and `domAnchors()` and the stored
    anchors agree with it: `before#3 .. after#3`, the properties row across its own element. The
    likeliest source of the `[]` is the console it was read in — focusing devtools is a `focusout`,
    which clears the stored pair by design. The DEFECT was real and the CAUSE was somewhere else,
    which is doctrine A.13 paying for itself.
  - **THE MODEL'S READING OUTRANKS THE POINTER'S CLAIM, and a claim answers a LANDING**
    (`SelectionDriver`). A boundary on frozen presentation used to make `anchorFor` DECLINE, and a
    decline is not neutral: it fails the whole PAIR closed, after which the control arm reads the
    gesture as a landing and collapses the caret into that row. MEASURED on
    `'one⏎- [ ] todo item⏎> [!warning] boom'`: Chromium ends a triple-click of the to-do at
    `(the callout's icon span, 0)`, the selection was thrown away, and `'ZZ'` landed in the callout —
    `'> [!warning] ZZboom'` with the row the user selected untouched. Of twelve kinds only the
    callout reached that door, which is exactly what makes it the consumer's paint and not a rule.
    `frozenBoundary` answers the row's ENTRY at both ranged affinities (there is no near/far half to
    read inside frozen presentation), the COLLAPSED reader still declines because "which row did
    this land in" is a question about the gesture, and `#syncRanged` runs before both claim arms.
  - **THE FOCUS GATE WAS A HOLE ON FIRST CONTACT** (same owner). Round eight's reclaim is gated on
    "only where there is a caret to go back to", and a control the browser can FOCUS provokes no
    `selectionchange` at all — so the claim `pointerdown` filed was never consumed and on a page
    nobody had typed in yet there was nothing to fall back on. MEASURED: fresh load, click
    `'+ Add a property'` or a comment thread's `'Reply…'`, ZERO ranges in the document, focus left
    on the BUTTON, the next two characters gone in silence. The CLICK consumes the claim now — and
    ONLY when it actually claims, which is measured: that microtask runs BEFORE the
    `selectionchange` task, so clearing the field unconditionally STOLE the claim and a click on a
    bullet's dot typed into the page title.
  - **HOME IN A TABLE CELL WENT TO THE CELL, NOT THE LINE** (`TokenModel.moveToLineBoundary`).
    `lineboundary` is the browser's question about BOXES and a carved row paints each piece in one.
    MEASURED on `'|= A | B⏎| c | d'` with the caret in the header's `B`: Home stopped at `B`, and the
    Enter after it emitted `'|= A | ⏎| B⏎| c | d'` — the header a column short and the column demoted
    to a data line, from two keys with nothing selected. Round eight's row-start rule reached by a
    different trigger: the split was correct for the position it was given, and the position was the
    browser's. Corrected only inside a carved piece, so wrapped prose keeps the platform's answer.
  - **ONE CLICK PLUS ONE KEYSTROKE ATE A PAGE'S METADATA** (`replaceRowSelection`, breaking). A
    click on frozen presentation is a BLOCK SELECTION by design, and typing over one replaced the
    row WHOLE — "what the reference product does", written in round seven. Composed, those two are a
    data-loss trap armed by the plainest gesture the page has: click the `In progress` chip, a target
    with no behaviour of its own, type `'a'`, and `@properties … @end` is gone — 76 lines to 67,
    nothing on the way saying so, one undo the only mercy. The same for an avatar. DECLARED
    BEHAVIOUR CHANGE: the typed character is CONSUMED AND REFUSED over a row that holds no editable
    position. `false` would not do — it falls through to the ordinary text path, which writes over a
    frozen row's own ELEMENT edges, the same deletion by another door. Backspace, Delete and a paste
    still take the row, because those are the gestures that say so. FOUR PINS in
    `caret.react.spec` encoded the old rule and are restated, each keeping its original claim with
    Backspace as the positive witness.
  - **ENTER ON A DIVIDER DESTROYED IT** (`handleRowEnter`, breaking). `'target row⏎---'`, click the
    rule — which the kind's own comment calls "the row's only large target" — and Enter emitted
    `'target row⏎'`. The demote ladder ran because `slot() === ''`, and a divider's body is empty
    because the KIND has none, not because the user emptied one. Enter's rung is gated on
    `continues` now: a kind that continues into nothing has no run to leave, so it SPLITS and keeps
    its kind (`'target row⏎⏎---'`). NOT the shared ladder — Backspace at a row's entry asks about the
    POSITION, not the run, and un-typing a heading with it is `showcase.md`'s own gesture; gating
    both keys reddened `Notion.react.spec`'s ladder pin, which is how the asymmetry was found.
  - **WHAT THE ONE OWNER DID NOT COVER, stated plainly.** The brief's claim was one cause with four
    shapes. Three of the five belong to the selection reading — the resolver's refusal, the claim
    outranking a reading, and the gate with nothing to restore — and two do not: the frozen-row
    write is `replaceRowSelection`'s composition rule and the divider is Enter's ladder. Naming a
    single owner for all five would have been a story, not a fix.

- **The tenth driving session: five defects, and the rule round nine wrote was HALF backwards**
  (2026-08-27). Every one reproduced in the running showcase first, and every pin was seen to redden
  by MUTATING its mechanism — seven mutations, seven single reds.
  - **THE INVERTED RULE, and what survived the inversion.** Round nine wrote "a reading the model CAN
    make outranks a landing". Inverted: **a pointer claim outranks any reading its own gesture could
    not have produced — a CARET, wherever it is, and an extent with neither end in the row the
    pointer landed in — and defers to the one it could, an extent with an END in that row.** What
    was NOT backwards, and is measured: `document.activeElement === container`. That gate asks whose
    gesture it is, not whether the model can read something — a control the browser FOCUSES answered
    the pointer itself — and dropping it reddened `Notion.react.spec`'s three decoration pins at
    once (`'+ Add a property'`, a view tab, `'Reply…'`). It stays, with the fresh-page arm round nine
    added: with NO reading at all a control's click is a landing too, since there is nothing to go
    back to. The gate that WAS backwards is `!domAnchors()` in the click microtask, which read "the
    user already has a caret" as "there is nothing to claim".
  - **A CHARACTER AFTER CLICKING A RICH BLOCK LANDED IN THE TITLE — two defects, not one.** Clicking
    the same chip, toc entry or metric card TWICE: Chromium empties the selection on the second
    mouse UP, proven by patching `Selection.removeAllRanges` (its only caller was our own paint of
    the first click), and the `selectionchange` listener read "no focus node" as "nothing to do". The
    model still held the row, the screen no longer said so, and the next keystroke was answered with
    the caret Chromium INVENTS at the host's start — `'@title YApollo — Q2 launch plan'`. A
    `selectionchange` that leaves the document with NO selection is the DOM losing what the model
    holds, so the stored pair goes back in; only the re-apply, never the release, because releasing
    BLURS the host and took the board's `Mod+Z` pin red. The second way in is the pointer claim
    above: a `draggable` card moves no caret and fires no `selectionchange`, so the click is the only
    arm its claim reaches, and with a caret already in the page the old gate threw it away —
    `'Apollo Ymoves the collaboration layer'`, three screens from the pointer. 14 of 14 targets green
    on the running page afterwards.
  - **A TRIPLE-CLICK ENDING ON FROZEN PRESENTATION DESTROYED IT** (`contentSpan`, `#offFrozen`). The
    intro paragraph's LAST wrapped line: Chromium ends that range at `(the toc's element, 0)`,
    `store.rows.selected()` is EMPTY the whole time so round nine's refusal never sees it, and one
    keystroke took 76 lines to 74 — `@toc` and its first entry gone, the paragraph truncated. TWO
    halves, and each has its own mutation: `contentSpan` refused the PAIR whenever either edge was
    inside content, where an edge in a structural RUN must resolve whatever the other edge is doing;
    and that range's far end is not in a run at all — it resolves to the toc's own first content
    offset, indistinguishable in the VALUE from the entry of an editable row one line down. Whether
    a kind paints its own text is a DOM fact, so the edge is moved to the row's own boundary
    (`{before}`/`{after}`) before `contentSpan` sees it. The row selection is still read from the
    ORIGINAL pair, which is what keeps round nine's refusal intact.
  - **A COLLAPSED TOGGLE LOST ITS HIDDEN BODY** (`#visibleEnd`). A closed toggle RENDERS its children
    and hides them, so `range.toString()` carries them and the write took them: `'▸ Z'`, 76 lines to
    75, with nothing on screen having shown what went. The span an edit writes is clipped to the last
    line the frame PAINTS — `'boxless'` only, since `'absent'` is a race — so the visible half of the
    selection is still replaced and the invisible half is left alone. The open toggle beside it is
    unchanged under the same gesture, which is what makes this the collapse and not the selection.
  - **A FENCE THREW THE CARET BACK INTO ITS BODY** (`#settleCaret`). Type the fence, a line of code
    and the closing backticks: the model's own post-edit anchor is `{after: row}` and is RIGHT, but a
    row's DOM boundary DESCENDS to its edge child (`DomModel.#entryOf`), which for a closed body is
    the last character of the CODE — Chromium read it back, `syncFromDom` stored it, and Enter after
    it wrote another line inside the fence. `{after: row}` on a raw body travels FORWARD instead
    (`#recoverCaret`), which opens the trailing row where the fence ends the document. NOT the total
    trap the brief described: ArrowDown always escaped, measured both mid-document and at the end.
  - **THE TRIPLE-CLICK IS THE EDITOR'S NOW** (`TokenModel.selectLine`). The platform answers the
    visual LINE, so the same gesture on the same wrapped row selected a different amount of text
    depending on where the window edge fell, and its raw range ends on the next row's own element —
    which is how two of the four defects above were reached. It answers the ROW's content, or the
    CELL's inside a carved row, and falls back on the block selection where the row paints no text of
    its own. `keyboard-handling.md`'s claim that a triple-click "is a row selection by every reading
    this editor has" is true for the first time.
  - **JUDGED CORRECT AS IT STANDS, both reported as surprises.** Typing `'- [ ] pack'` inside a
    bullet gives `'- - [ ] pack'`: a row is typed by the bytes at its START, and the second opener is
    body text — converting would mean the scan re-reads a body as an opener, which is the shape
    `docs/scratch/token-born-edit/issues/08` rejected. And typing on a divider does NOT mutate it
    into text: the showcase's own markup is `'---__slot__'` and its component renders `{children}`,
    so `'---caption'` is still a divider, and the caption is painted and visible (measured: 676×61,
    `checkVisibility()` true). Both are the consumer's vocabulary doing what it declares.

- **The eleventh driving session: four defects, ONE owner for two of them, and the cure it was handed
  was half already in the code** (2026-08-27). Every one reproduced in the running showcase before it
  was written, and every pin was seen to redden by MUTATING its mechanism — nine mutations.
  - **THE CURE, MEASURED.** The twelfth session's brief said "no selection end may sit on a row
    separator or inside a block's opener; clamp it to the row's edge before any edit reads it — that
    one clamp closes breaks 1 and 2 together". Half of it was already shipped and the other half was
    two clauses, not one. The clamp EXISTS (`contentSpan` + `TokenModel.#offFrozen`, rounds eight to
    ten) and it already owned the typed character; what was missing is that an EMPTY clamp answered
    `undefined`, which handed the RAW pair back to the write path — so the resolver refused precisely
    where the structure it protects was all that was selected. Second, it did not own the DELETE
    path at all: `anchorsForDelete` returned the raw pair for any ranged selection, so every byte the
    resolver protects was still deletable through Backspace. Third, "inside a block's opener" needed
    its own clause, because a fence's body IS reachable and reads as ordinary content.
  - **A SELECTION THAT COVERS NO CONTENT IS A POSITION** (`contentSpan`). MEASURED with a driven
    double-click in a row's blank RIGHT MARGIN: Chromium's word expansion past end-of-line answers a
    cross-row range whose own text is EMPTY — `(the row's text, 18) -> (the next row's text, 0)` —
    both edges resolve into the same structural run, `opens > closes`, and the raw span then wrote
    `'\n- '`. `'lead sentence here'` + `'- bullet row'` and one `'Z'` gave
    `'lead sentence hereZbullet row'`: two rows merged and the marker gone, no exception, no
    highlight. Reproduced on a caption, a heading, a quote, a bullet and — eating a cell delimiter
    instead — a table header. It answers a COLLAPSED span now, at the boundary the LOW edge names, so
    the character is inserted at the end of the row the gesture began in and the resolution still only
    shrinks.
