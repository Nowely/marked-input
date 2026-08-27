# The Notion-like effort — the honest account

> Written 2026-08-26 for the maintainer, who has not seen the work. Every number here was
> re-measured on `b0` at `c6b681ce` unless it is attributed to a record, in which case it is quoted
> as recorded and named as such. Where I could not measure something I say so instead of rounding
> it into a claim.
>
> The range is `1235da9a..HEAD` — 240 commits, `08997bf0` (the probe's tracker) through
> `c6b681ce`. `pnpm test`: **107 files, 2096 passed, 6 todo**, exit 0. `pnpm run typecheck`: 0
> errors. `lint:check` and `format:check`: clean. Those four are the only "green" claims in this
> document; everything else has a caveat.
>
> **The working tree is not clean and that is not mine.** 22 tracked files are modified and
> `packages/website/samples/` is untracked — a doc-sample type-check harness written by a separate
> agent and not yet committed. It runs (`vitest --project docs`: 2 files, 57 tests, green) and
> covers **208 fences, of which 8 are declared sketches and 200 are type-checked against package
> source, 0 errors** — re-measured here. Its findings are folded into the list below; its code is
> the maintainer's to accept or drop.

---

## What it can do

Each line is a gesture and the file that reddens if the gesture breaks. Nothing here is claimed
from a docstring.

| Capability | The gesture | Pinned at |
| --- | --- | --- |
| A row has a KIND, compiled from the same `Markup` an inline mark uses | type `# ` at a row's start and the row becomes a heading; type `5# ` mid-line and it stays text | `Base/rowKinds.spec.ts`, `parser/core/RowKind.spec.ts`, ADR-0010 |
| Rows nest by indentation, in the one value string | Tab on a bullet writes `⇥` into the value and the row re-parses as a child | `Base/rowNesting.spec.ts`, `tree/rowVerbs.spec.ts` |
| A row kind carves its own body into cells | type `\|` into a table line and the piece after it becomes its own Row | `Notion.react.spec.tsx:769`, `tree/rowNode.spec.ts` |
| A row keymap of four keys, each one a row verb | Enter splits, Tab indents, Backspace demotes then merges, Esc selects | `Base/rowKeymap.spec.ts`; the verbs at `tree/rowVerbs.spec.ts` |
| A `/` menu assembled from the options that declare one | type `/quo`, click "Quote", the row converts and keeps its text | `Notion.react.spec.tsx:332`, `:403` |
| An `@` picker with arrow/Enter navigation | ArrowDown then Enter writes `@[Name](id)` into a cell | `Notion.react.spec.tsx:780`, `:801` |
| A row selection that IS the text selection | Esc, Shift+Down, then Tab indents both rows | `Notion.react.spec.tsx:538`, `Base/rowKeymap.spec.ts` |
| Nested drag with a depth chosen by the pointer's X | drag a Shift-selected pair and drop it at a depth | `Notion.react.spec.tsx:921`, `Base/rowDrag.spec.ts` |
| The editor's own undo stack | Mod+Z after a keystroke restores the value; Mod+Shift+Z puts it back | `Base/history.spec.ts`, `HistoryModel.spec.ts`, ADR-0012 |
| The caret an edit is recorded against is the DOM's | `{ArrowLeft}×3` then `X`, then Mod+Z, lands where the edit was | `Base/history.spec.ts`, `Base/caret.spec.ts` |
| A consumer's own control is not document content | tick a to-do's checkbox; the value changes and nothing is typed | `Notion.react.spec.tsx:584`, `:574` |
| The whole showcase is options and components | a grep: no import leaves the directory, no `.edit`, no `.tokens`, no `useMarkput` | `Notion/boundary.spec.ts` — three arms recorded as seen to redden |

The showcase is **26 row kinds and 7 inline marks** in one array (`notion/options.tsx`, 802 lines),
over an 87-line document, driven by a 995-line spec. `docs/scratch/notion-like/showcase.md`'s
seventeen blocks all render.

The acceptance test the effort was aimed at is `boundary.spec.ts`, and it is worth reading rather
than trusting: it greps its own directory, strips comments first so its own prose cannot fail it,
and it names the two files that must be in scope so a narrowed glob cannot turn it into decoration.

---

## What it cost

### Lines

Measured over `1235da9a..HEAD`, 289 files, **+27 834 / −4 932**.

| Slice | Added | Removed | Net |
| --- | ---: | ---: | ---: |
| `packages/core/src` + both adapters' `src`, production only | 6 182 | 1 771 | **+4 411** |
| `packages/core/src` production alone | 5 483 | 1 485 | +3 998 |
| `packages/core/src` specs and `__testing__` | 7 798 | 1 785 | +6 013 |
| `packages/storybook/src/pages/Notion` | 5 136 | 0 | +5 136 |
| `packages/website` | 2 647 | 1 061 | +1 586 |
| `docs/adr` + `docs/scratch` + `CONTEXT.md` | 3 614 | 31 | +3 583 |

"Production only" excludes `*.spec.*`, `__testing__`, `__snapshots__`, `README.md` and `*.md`.

**This is not a code reduction and no phase pretended it was.** ADR-0010 states the inversion's own
cost as net **+418** production lines and says "It is not a code reduction" in bold. P6 recorded
**+370 / −103, net +267** and noted that no commit body in the phase had stated it. P7 recorded
**+447 / −217**, of which 166 deletions were the probe's own — so core and the adapters grew by
roughly 390 lines to ship two menu components. The P11.6 review round recorded **+222 / −94** in
`packages/core/src`, of which 133 added lines were comment: **net +89 lines of code**.

Nine files were deleted outright: `BlockController.{ts,spec.ts}`, `blockEdit.{ts,spec.ts}`,
`RowBuilder.ts`, `features/block/{index.ts,README.md}`, `react/Block.tsx`, `vue/Block.vue`. Ten
production files were added to `packages/core/src`, including `RowScanner.ts`, `RowKind.ts`,
`InlineRules.ts`, `tree/rows.ts`, `rowKeys.ts`, `HistoryModel.ts` and `rows/RowController.ts`.

### Mechanisms retired versus introduced

**Retired.** `rowPass`'s fixpoint, `findSeparators` and `groupRows` — the mutual dependence between
separators and matches, which was the whole reason the fixpoint existed. The `layout` enum, its
signal, `isBlock` and `TokenModel.rowSeparator`. The stored row terminator in four places
(`RowNode.terminator`, `RowToken.terminator`, `rowTokenTerminator`, `movePlan`'s normalization) →
a pre-order join. `TextNode.moveTo` and `MarkNode.moveTo`. `rowsWithin` (no longer leaves `tree/`),
`rootIndexOf`, `setValue`'s `enterRoot`, `depthPlan`'s `landsAt` clamp, `#applyDepth`, `replay`'s
`#ensureSeeded`, `overlay.mode`, `MenuSpec.section`/`icon`, `MenuEntry.section`. Two consumer
components in the probe, `SlashMenu.tsx` (60 lines) and `MentionOverlay.tsx` (54), deleted rather
than refactored — which is how P7 measured that the menu had actually moved into core.

**Introduced.** A row scanner with three sub-modes, a nest pass, a split pass and a position-shift
step. Ten row verbs (`turnInto`, `splitAt`, `setDepth`, `moveTo`, `addSibling`, `writeRows`,
`replaceRows`, `indentRows`, `moveRows`, `rowSelection`). An undo stack. A row keymap. A hit test
that descends. A drop resolver that plans every candidate depth through the mover. Nine new
published types.

The concept count improved in the parser and got worse everywhere else. That trade was declared at
the time (ADR-0010, "what shrinks is what has to be held in the head") and it is still the honest
summary.

### Published API broken

**83 of the 240 commits carry `!`.** The breaks a consumer would feel:

- `layout` is **deleted** (ADR-0011). `separator?: string | null` is the only fact that splits a
  document.
- **The default separator moved from `'\n\n'` to `'\n'`**, so an editor that configures nothing is
  now a row editor with a block box, a permanently mounted controls layer and a grip on hover.
  ADR-0011 measures the DOM shape both ways and states this as cost (a). It is a breaking change
  for every consumer who relied on the old `layout="inline"` default. **Coverage of the new default
  is thin on purpose**: 214 in-repo call sites spell `separator: null` (measured today; ADR-0011
  recorded 206), so the flip is exercised by `Base/rowDefault.spec`, a handful of seam pins and the
  showcase.
- The whole "block" vocabulary was renamed (2026-08-26): `slots.block` → `slots.paragraph`,
  `slotProps.block` → `slotProps.row`, `BlockMenu` → `RowMenu`, `BLOCK_MENU_ITEMS` →
  `ROW_MENU_ITEMS`, `BlockController` → `RowController`, `store.block` → `store.rows`, `.Block` →
  `.Row`, `.BlockControls` → `.RowControls`.
- `moveTo(number)` → `moveTo({parent, index})`; `TextNode.moveTo`/`MarkNode.moveTo` gone.
- `history` prop added; Vue's boolean cast was turning it off on arrival, so undo shipped working
  in React and dead in Vue until the shared spec caught it.

### ADRs superseded

- **ADR-0010** supersedes ADR-0009's deferral of typed rows. ADR-0009 is now marked "partly
  superseded" in its own file.
- **ADR-0011** supersedes `1235da9a`'s deferral of the `layout` question — which had to be
  answered rather than re-deferred, because P2's default flip destroyed the discriminator the
  deferral rested on.
- **ADR-0012** fills the hole ADR-0006 left: the guard swallows native undo, and until this the
  editor had none.
- **ADR-0002's accepted cost is preserved, not fixed — and it is an EDITOR's answer now, not a
  row's.** Tab leaves the field in an editor where NO option declares `indents`; where one does,
  every row consumes the key even where the verb then refuses the depth (`TokenModel.rowsIndent`,
  2026-08-26). `RowSpec.indents` still gates the KEY rather than the verb, deliberately.

### Where the design was wrong and measurement corrected it

This is the part the commit titles hide. Every phase shipped, was reviewed, and the review found
real defects — thirteen rounds, and the shape repeated.

- **P4** — four defects, all one shape: a reading widened but not widened enough. The worst was
  that a row kind was resolved by option REFERENCE, which Vue rebuilds on every prop sync: `turnInto`
  could never succeed in Vue, and no adapter test called it.
- **P5** — one defect in three faces, and the third was found by the corpus rather than a reviewer.
  The lesson generalised: **a property exhaustive over PLACEMENTS is not exhaustive over
  DOCUMENTS.** The generator rendered every row canonically, so it was structurally incapable of
  holding the class all three defects lived in.
- **P6** — `setDepth` had the same hole in two faces; the second was found by measuring the verb
  rather than reading it. The first continuation draft built a staircase: `'- a'` soft-broken three
  times emitted four nesting levels for one list item.
- **P7** — three members shipped with **zero readers** and were deleted on measurement.
- **P8** — two places an undo stack rots, both real: records held live `Anchors`, so undoing a row
  merge restored the right string with a caret in a detached node; and the stack moved on the CALL
  rather than the landing, so one refusal by a controlled parent cost every entry underneath it.
- **P10** — five defects, all in the seam between a gesture and its span. The commonest drag there
  is — pick a row up, drop it at its own gap to change depth — offered no outdent at all.
- **P11** — **seven defects that the phase's own suite reported as green.** Every failing gesture
  was pinned by the VALUE the editor emits and by nothing else, and the value was right in all seven
  cases. What was wrong was the caret, the focus, the freeze or the row count.
- **P11.5** — filed two defects with two mechanisms; both readings were wrong and they were ONE
  defect (a stale caret mirror). Then **three claims in P11.5's own record were themselves
  falsified** by the next round, including one that was false for three of its four items.
- **P11.6 + review** — three reviewers, thirteen findings, ten reproduced. The phase had closed its
  headline defect through one door only: a foreign clip pasted over a row selection took none of the
  row rules, and `Replacement.markup` — invented in the same phase for exactly that question — was
  computed and thrown away.
- **The driving sessions, fourth and fifth** — eleven more defects that the automated suite did not
  see, and two shapes between them. The fourth's was a rule with TWO OWNERS: `indents` read per kind
  by the key and structurally by the drop, and the focus reclaim written by hand at two grip verbs
  instead of at the control contract. The fifth's was ONE ANSWER standing in for two questions:
  `painted` for "not yet" and "never", `#recoverCaret` for "where next" and "where did you point",
  `continues` for the kind and the row's own `meta`, and End for scrolling the page and moving the
  caret. **The pins were the tell in both.** Every one of these gestures had a green suite over it,
  and the click-on-frozen-presentation pin asserted the defect itself as the contract.

Two mutation audits are worth naming because they are the only thing that separated a real pin from
a decorative one: a pin that asserts against a shape the mechanism does not govern reads exactly
like a pin that works. Four P4 mechanisms and four P10 mechanisms survived deletion with the suite
green and had to be pinned afterwards, each seen to redden.

---

## What the probe proved

The probe filed eleven tickets. Seven are closed, four stand.

| # | Ticket | Status |
| --- | --- | --- |
| 01 | A markup cannot be anchored to a row's start | **Closed** — the scan runs before the inline pass and only ever looks at a row's own start (P1, ADR-0010) |
| 02 | No repeatable placeholder, so no table structure | **Closed** — `RowSpec.split: {at, as}`; a cell is an ordinary Row born from its parent's carve, with no fifth node kind (P9) |
| 05 | One separator per editor, so a list item cannot be a row | **Closed** — one line is one row; the default moved to `'\n'` (P2, ADR-0011) |
| 06 | A row markup re-matches inside its own slot, so repeats nest | **Closed** — same inversion as 01 |
| 07 | A closing literal may not begin with a newline | **Closed** — same inversion as 01 |
| 09 | A `\n`-delimited fence matches only at offset 0 | **Closed** — same inversion as 01 |
| 11 | An overlay can insert only its own markup, and its data is `string[]` | **Closed in all three halves** — `CoreOption.menu` IS the registration; `choose` gained an option arm; `overlay.data` carries an identity beside a label (P7) |
| 03 | A consumer cannot name a Row | **Half.** `RowNode`, `RowProps`, `RowSpec`, `RowPlacement`, `MenuSpec`, `MenuEntry`, `Suggestion`, `OverlayPick` and `RowConfig` are all published now. `Store` is still **not** re-exported from either adapter, so a consumer typing a selector adds `@markput/core` as a second dependency. |
| 04 | A bare `@Name` mention is impossible | **Untouched.** Mentions are still `@[Name](id)` in the value the caret walks through. Neither of the ticket's two sketches was taken. |
| 08 | A soft break is invisible | **Split, and half of it needs re-measuring.** The representation half is answered — a soft break is a CONTINUATION ROW and `softBreak` is not built (ADR-0011 amendment). The visibility half rests on a grep of `packages/core/src` that missed `packages/core/styles.module.css:176-179`, which has set `white-space: pre-wrap` on `.Container span` since PR #115. The showcase's own comment repeats the false claim ("core sets none"). **Whether that rule is sufficient for every row shape is unmeasured** — I read the stylesheet, I did not drive it. |
| 10 | Reaching a controller through `useMarkput` needs an object literal | **Untouched.** `useMarkput(s => s.rows)` still does not compile, and the error still names index signatures rather than the rule. |

**Four of the seven closures are one decision.** Tickets 01, 06, 07 and 09 were filed against four
different symptoms and all four fell to the scan-first inversion. That is the strongest evidence the
effort produced, and it is also why the effort was so large: one primitive answered four complaints
and then required thirteen phases of consequences. The other three closures cost a primitive each —
`split` for 02, the separator-as-whole-model for 05, `CoreOption.menu` for 11.

**The four that stand are all cheap and none of them was refused.** 03's second half is a barrel
line. 04 is a design sketch nobody chose between. 08's open half rests on a grep whose premise I
could not confirm. 10 is a type overload or a documented spelling. They stand because thirteen
phases of consequences left no room, not because anything about them is hard.

---

## What is declared but not built

Everything below is an accepted cost or an open hole, gathered here so nothing hides in a commit
body. Each is real today.

Every open item now names the ticket that carries it — `issues/12` onward, filed 2026-08-27 and
indexed in `issues/README.md`. The tickets quote these measurements rather than re-deriving them,
so this list stays the evidence and the tracker stays the queue. Two items name no ticket, and say
why in place.

1. **`softBreak` is not built.** Under `'\n'` a soft break is a continuation ROW, with four declared
   costs: Backspace at its start outdents before it merges (two presses to rejoin); a consumer
   cannot tell it from a Tab-nested row; typed into a row that has children it lands before them and
   shifts their ids; and a kind whose component ignores the `rows` prop paints no continuation at
   all. (ADR-0011 amendment.)
   Ticket: [37](issues/37-softbreak-stays-unbuilt.md).
2. **A kind whose component drops the `rows` prop drops every child row it has** — continuation,
   Tab-nested, moved and pasted alike. Core cannot see whether a component reads a prop, so this is a
   contract on the kind and nothing enforces it. **NARROWED 2026-08-26**: such a kind registers no
   child-rows host, and the commit's own repair pass now lifts the children OUT of it — one level up,
   in the same undo step as the write that produced the shape — so a retype, a paste or a replayed
   edit can no longer take rows off the screen while leaving them in the value. What stands: a value
   merely HANDED to the editor is left alone, deliberately, since rewriting a consumer's own bytes on
   mount would emit an edit nobody made.
   Ticket: [23](issues/23-row-component-contract-is-silent.md).
3. **An atomic kind leaves the caret nowhere to go.** `choose` turns THIS ROW into the kind and an
   atomic row generates no caret position, so nothing a consumer can write asks for the trailing
   empty paragraph Notion leaves under such a block. On a one-row document the editor has no caret
   target at all. Declared in the showcase's own docblock. **AMENDED 2026-08-26**: what a CLICK on
   such a row does is decided now — nothing moves, and where the editor holds no caret at all the DOM
   selection is dropped and the editing host gives up focus, so the click is inert rather than
   stranding. The hole itself is untouched: there is still no way to ask for the row after.
   Ticket: [16](issues/16-trailing-paragraph.md) — the decision this item wants, with `Code`'s
   missing seed and the `+ New` caret gap folded into it.
4. **A paste whose SPAN crosses two rows is spliced raw.** Recorded in the map's Fog, measured
   2026-08-26: `'- alpha⏎⇥- beta'`, selection from `alpha`+2 to `beta`+2, paste `'one⏎two'` →
   `'- alone⏎twota'`. `splitPlan` refuses deliberately; widening it is a contract change.
   Ticket: [17](issues/17-cross-row-paste-is-spliced-raw.md).
5. **`duplicate` and `insertAfter` on a carved PIECE fail open.** Map's Fog, measured 2026-08-26: on
   `'| a | b⏎after'` the first cell answers `duplicate() === true` and corrupts the line.
   Pre-existing, published-API-only, a family rather than a case.
   Ticket: [18](issues/18-carved-piece-verbs-fail-open.md).
6. **One split shape cannot place the caret**: mid-body, on a row that keeps a subtree. Map's Fog:
   `'abcd⏎⇥child⏎tail'` split at 2 puts the caret at 12 where the tail's start is 10. Closing it
   needs a post-edit caret carried through the transaction — new surface across three modules.
   Ticket: [19](issues/19-mid-body-split-loses-the-caret.md).
7. ~~**Nothing scopes the row menu to the trigger that owns it.**~~ **FIXED 2026-08-26** as a side
   effect of the list collapse: `OverlayListModel.rows` answers the matched option's `overlay.data`
   when it declares any and the row menu ONLY when it does not, so the two lists can no longer both
   be on offer. `choose` is unchanged.
8. **`RowSpec.group` is not built**, and three wants hang off that one gap: table columns cannot
   align, the accessible semantics cannot be a table (the showcase carries no `role="table"` because
   one per line would be a lie), and the header can only be read from the DOM run.
   Ticket: [20](issues/20-rowspec-group.md) — the ONE ticket for `RowSpec.group`. The table's own
   gesture gaps are [21](issues/21-table-gestures.md).
9. **The `+` in the hover gutter was never built and nothing said so** until 2026-08-26.
   `RowControls.tsx` paints exactly one `<button>`. `showcase.md:56` asks for both.
   Ticket: [27](issues/27-four-missing-affordances.md).
10. **`ROW_MENU_ITEMS` is three entries** — Add below, Duplicate, Delete. No "Turn into".
    Ticket: [27](issues/27-four-missing-affordances.md).
11. **The `/` menu is a flat list of 23 unsectioned labels.** `MenuSpec.section` and `MenuSpec.icon`
    were deleted for having zero readers; they come back with the painter that needs them, and
    `icon?: Slot` is the shape that keeps P7's exit criterion.
    Ticket: [27](issues/27-four-missing-affordances.md).
12. ~~**`RowMenu` has no keyboard navigation.**~~ **FIXED 2026-08-26**, and by deletion rather
    than by addition: `SuggestionsModel` and `OverlayController.entries` were the same list twice,
    so they became one `OverlayListModel` whose `rows` come from the matched option's
    `overlay.data` when it declares any and from the options' own `menu` specs when it does not.
    Both adapters now ship ONE component, `OverlayList`, which is also the DEFAULT overlay — so
    `{overlay: {trigger: '/'}}` is the whole wiring of a row menu and `RowMenu` is gone from the
    published surface, as is `MenuEntry` (`OverlayRow` replaces it).
13. ~~**The overlay opens downward only.**~~ **FIXED 2026-08-26.** `shared/utils/fitPopup` is one
    rule for both popups: below the anchor when it fits, above it when it does not, clamped inside
    the viewport when it fits neither way. It needs the popup's measured size, so both positions
    now read the popup's own element signal — which uncovered a second defect underneath: BOTH
    adapters' `useOverlay` read `overlay.position()` non-reactively (React's `useMarkput` calls its
    selector once; a Vue `computed` cannot see a core signal), so the popup had been frozen at the
    position it opened at and did not follow the caret as the user typed.
14. ~~**Nothing scrolls the caret into view.**~~ **FIXED 2026-08-26.** `SelectionDriver` reveals the
    caret after each successful collapsed placement; the walk is `dom/caret.ts`'s `revealCaret`,
    innermost scrollable ancestor first and then the viewport, re-measuring per step. Gated on the
    container holding focus; not applied to a ranged selection.
15. ~~**The shipped popup is hardcoded light.**~~ **FIXED 2026-08-26.** Every colour in
    `styles.module.css` that a consumer can see is now `var(--markput-…, <the old value>)` — eight
    names covering the popup, its highlighted row, the grip and the drop line — so the shipped look
    is unchanged and a page can retheme it without touching a hashed class. The showcase maps all
    eight onto its own tokens in `notion/theme/tokens.css`.
16. **`.Container` sets no `outline`**, so the UA focus ring paints around the whole editor. `.Row`
    sets `outline: none`; the container does not.
    Ticket: none — the ring was judged and KEPT (`map.md:853-856`): the container is the one editing
    host (ADR-0002), so it is the one focus target, and a consumer can style it.
17. **Tab leaves the field only in an editor where NO option declares `indents`** (ADR-0002's
    accepted cost, narrowed 2026-08-26 from "wherever no KIND declares it" — the per-kind reading was
    itself the defect, since it disagreed with the drop over four of the showcase's 35 rows). 7 of
    the showcase's 26 kinds declare it, so Tab never leaves the field there: a row of any kind
    consumes the key and `indentRows` alone decides whether the depth moves. A ROOT paragraph has no
    parent to inherit from, so a paragraph outdented to depth 0 cannot be indented again.
    Ticket: [28](issues/28-gestures-the-first-session-left-standing.md), item 3.
18. **A row selection is painted as a text selection.** There is no block band; the row's own text
    highlights and nothing else.
    Ticket: none — **NO LONGER TRUE.** `36404009` paints it in the editor: `.RowSelected::after`
    (`styles.module.css:146`) plus both adapters' `Row`, an overlay rather than a background,
    because a kind's own backgrounds hid the platform highlight.
19. **A collapsed toggle costs two things**: an arrow from the title jumps over the closed subtree,
    and a selection dragged across it takes the closed text with it. New cost added when openness
    became the document's fact: **find-in-page landing inside a closed toggle now EDITS the
    document**, because `beforematch` opens the row and opening it is a retype.
    Tickets: the find-in-page half is [31](issues/31-find-in-page-edits-the-document.md); the
    selection half is [13](issues/13-collapsed-body-lost-on-a-row-cover.md); the arrow over a closed
    subtree is the RULE now (`map.md:889-896`), not a gap.
20. **A cross-parent drop keeps the NODE and loses the COMPONENT**, measured in both adapters.
    `store.rows.collapsed` — a core-owned per-row view store — is what would fix it and was not
    built.
    Ticket: [32](issues/32-no-per-row-view-state.md).
21. ~~**The board is one row and its card drag is the consumer's own.**~~ **FIXED 2026-08-26**, in
    the showcase, where it belonged: `Board` is controlled now — the arrangement is the prop, a drop
    announces the next one, and the option writes it back with `node.turnInto(board, {text})`, the
    same one splice the checkbox and the callout icon already use. The reading that produced the
    defect ("not owned by core" = "keep it in the component") is corrected in `showcase.md`.
    The metric cards are still stacked, not beside the callout: two rows cannot sit side by side
    while the drop tiles the document by Y.
    Ticket for what is left: [38](issues/38-per-kind-drag-axis.md).
22. **A value the editor did not write disables undo while it stands.** `canUndo` answers `false`
    until the document comes back.
    Ticket: [30](issues/30-foreign-value-disables-undo.md).
23. **The showcase net is single-framework.** `vitest list --project vue` piped through
    `grep -ci notion` answers `0`, re-measured today.
    Five of the ten defects the hardening round fixed have their only regression pin in
    `Notion.react.spec.tsx`. P12 — the Vue vocabulary, ~800 lines plus sixteen leaves, and Vue's
    `useControlRef` — is owed.
    Ticket: [26](issues/26-vue-showcase-p12.md).
24. **`RowProps.index` has no reader anywhere in the repo and is kept**, because it is published
    surface with its own generated API page. Measured removable: typecheck 0, suite green.
    Ticket: [36](issues/36-published-surface-leftovers.md).
25. **The grip's `aria-label` still reads "Block options"** when `draggable` is false — user-visible
    text, so changing it is a behaviour change rather than a rename.
    Ticket: [36](issues/36-published-surface-leftovers.md).
26. **`Store` carries an open rename TODO** in `store/Store.ts`, and it is published, so renaming it
    is a public change.
    Ticket: [36](issues/36-published-surface-leftovers.md).
27. **Caret ergonomics at document scale are unmeasured** — atomic tables and code blocks, Tab
    leaving the field, over a document this size.
    Ticket: [33](issues/33-nothing-is-measured-at-document-scale.md).
28. **`OverlayHandler.ref` is `RefObject<HTMLElement | null>`**, unassignable to any concrete element
    ref. The repo already works around it in two places and the docs now cast in eight.
    **`MarkedInputProps.Span` is `ComponentType<MarkProps>`** but a Span component is handed a `ref`
    that `MarkProps` does not declare. Both are published-type corrections wanting their own
    decision.
    Ticket: [25](issues/25-published-type-corrections.md).
29. **The doc-sample check reads fenced code only.** `effectScope` and `store.bus` also sat in prose
    backticks, where nothing checks them. **`CONTEXT.md`'s own `_Avoid_` and DELETED words are
    unenforced** — nothing stops a rename re-introducing `block` or `lexeme`.
    Ticket: [34](issues/34-rot-guards-do-not-cover-prose.md).
30. **Row-verb runtime is uncharacterised.** `rowOf` is a full pre-order walk now run on every Enter,
    Tab and Backspace, with no benchmark. The one figure that exists is the drop tick: **~1.5 ms
    per `dragover` at 4000 rows, 9% of a frame**, kept because the alternative is a depth rule
    restated outside the mover.
    Ticket: [33](issues/33-nothing-is-measured-at-document-scale.md).

**And three that were NOT declared**, found by driving the page and traced to their owner here, so
the list above is the whole of what is open rather than the whole of what was written down.
(Items 13–16 belong in the same category: nobody decided them, they are simply what the CSS and the
positioning arithmetic do.)

31. ~~**A control root refuses the browser's editing and not the caret.**~~ **FIXED 2026-08-26.** A
    `pointerdown` inside a control root is a CLAIM on the row that control is painted in, latched
    before the browser answers and outranking whatever it answers — including Chromium's collapse to
    the START of the editing host on a `draggable` element, measured with no editor in the page.
    Where the row holds no editable position the click is inert and the caret and the host's focus
    are released. Arrows were already answered: a run of atomic rows is walked past, pinned.
    Item 3's trailing-paragraph hole is what is left of this.
32. ~~**The editor's own clip is spliced verbatim at any caret, not only at a line start.**~~
    **FIXED 2026-08-26** (`4f365608`). The distinction is the SHAPE handed to `RowNode.writeRows` —
    an array is pieces, a string is this editor's own markup — which is the convention `replaceRows`
    already read over a row selection, so the caret arm and the selection arm now spell it the same
    way. New declared cost in its place: a markup clip copied from the middle of a row and across a
    row boundary opens its first fragment as a row of its own, because the payload does not say
    where the copy began.
33. ~~**Nesting depth is unpainted except by the kinds that indent their own children.**~~
    **FIXED 2026-08-26** (`43a99df9`), in the showcase's theme; core was never involved, since the
    depth was always in the document. A kindless child row of a paragraph stays flush on purpose: it
    is that paragraph's continuation line, and only the kind it carries tells the two apart.

---

## What it is like to use

A driving session on the showcase, 2026-08-26. Unvarnished, and it is the section that matters most.

**Seven things broke.** The report is the driver's and stays unedited; the **STATUS** line under
each is what has happened to it since, with the commit that did it.

1. **`/` + Enter writes garbage.** Typing `/h2` then Enter left the literal `/h2` in the row and
   split it into a new row. The menu is click-only (item 12 above), and Enter falls through to
   `splitAt` because nothing claims it. This is the single worst gesture on the page, and it is the
   first thing a new user tries.
   **STATUS: closed** (`3435d3ad`, `4a11d450`, `07e9aa81`). One list with one keyboard, its first row
   highlighted from the moment it opens, and the rows ranked by what was typed. Pinned by the
   gesture itself: type `/page t`, press Enter alone, assert the value AND the highlight.
2. **Clicking an atomic block strands the caret.** A TOC entry, a properties value, a metric card,
   the bookmark title — the anchor parks in a `contenteditable=false` node, ArrowDown does not move
   it, and every keystroke after is silently dropped until you click elsewhere. `control()` writes
   `element.contentEditable = 'false'` and nothing else: it answers "the browser edits it" and does
   not answer "the caret enters it". The showcase's own docblock claims it answers both.
   **This is P11's lesson repeating, one round later.** The freeze has two pins and neither drives
   the failing gesture: `Notion.react.spec.tsx:645` asserts that each of the seven kinds has a
   `contenteditable="false"` ancestor — structure, not behaviour — and `:677` drives ArrowDown but
   then dispatches its `beforeinput` on the OUTER editing host, so it proves the model's anchor
   advanced and not that a real keystroke would be delivered. The one test that does use a real
   `userEvent.click` plus real keys (`:693`) is the divider, which is not one of the seven.
   **STATUS: closed in two steps, and the first step's answer was itself a defect.** `9c781d4a` took
   the caret out of the control root; WHERE it put it was the next editable row — four rows from the
   pointer for a table of contents entry — and its pin asserted exactly that as the contract.
   `9ef80374` corrected the destination: the row the pointer landed IN, at that row's own entry,
   claimed on `pointerdown` so the browser's own answer cannot outrank it. A row that holds no
   position at all is inert, and the focus goes with the caret.
3. **Typing blind into a closed toggle.** Enter after a `▸` title, then Tab, puts the caret inside
   the hidden subtree — 11 characters landed in the value with no caret box and nothing on screen.
   **STATUS: closed** (`9c781d4a`, then `21976b3f` for the same reading in the other direction — a
   row that closes UNDER the caret). A row whose element is in the document and generates no box
   holds no caret the invariant will accept: it walks out, stepping over the whole collapsed run.
   Pinned in the collapse direction; the Enter-then-Tab direction this report describes follows from
   the same rule and has no pin of its own.
4. **Pasting a two-row block selection at a caret leaks markup.** At the end of a paragraph it
   produced `Flights are cheapest midweek.⇥- Adapters` — a raw tab and a literal `- ` as prose.
   Clean on an empty row. The mechanism is `writeRowsFromInput`'s first line, `if
   (replacement.markup) return false`: the editor's own clip is "the value's own projection" and is
   spliced verbatim, which is right at a line start and wrong everywhere else. This is a **different
   shape** from the declared cross-row hole (item 4 in the list above) and was not declared.
   **STATUS: closed** (`4f365608`). Both languages reach `RowNode.writeRows` and the SHAPE says which
   one a clip is in: an array is pieces, opened at the caret row's lead and kind; a string is this
   editor's own markup, whose lines are already whole rows. Its own declared cost: a markup clip
   copied from the MIDDLE of a row and across a boundary opens its first fragment as a row.
5. **An atomic block as the last row is a dead end.** After `/code` at the end, ArrowDown, Enter and
   clicking below all fail to make a row after it. Declared (item 3), but the declaration reads as a
   footnote and the experience is a trap: only the grip menu escapes.
   **STATUS: half closed** (`9c781d4a`). A document ending in a RAW CLOSED BODY — a fence,
   frontmatter — grows a blank row after it while the caret is in that row, so `/code` at the end is
   no longer the trap this describes. An atomic row that is not a raw body still is, and that is
   item 3 of the list above: it wants the trailing-paragraph decision, not a patch.
6. ~~**A board card dragged between columns never reaches the document.**~~ **FIXED 2026-08-26**;
   see item 21.
7. **Drag and paste can nest a row under a paragraph, invisibly.** Dropping a quote on "Pack list"
   wrote `⇥> …`; the drop indicator promised the indent, and the result rendered flat. The depth is
   real in the value and unpainted: the showcase's general depth rule (`.blockIndent` ×
   `--notion-block-depth`) is applied by **no component** — grep returns only its own definition and
   two comments claiming a component sets it. Only kinds that indent their own children
   (`.toggleChildren`, `.listItemNested`) paint depth at all, and a paragraph is not one of them.
   **STATUS: closed** (`43a99df9`), in the showcase's own theme where it belonged. A KINDED row
   nested under a paragraph paints one indent step; a kindless child row stays flush deliberately,
   because that is the paragraph's own continuation line and the two are the same bytes.

**Thirteen things felt wrong.** In the driver's words, compressed:

`@` is fully keyboard-driven and `/` is not — same trigger grammar, opposite contract. Both popups
open downward only; at the bottom of the page the menu was measured at top 836, height 196, in a
900px viewport. The editor never scrolls the caret into view — typing at the end pushed the caret to
y=882/900 while `scrollY` stayed put. Every overlay is white-on-light inside a dark page and reads
as browser chrome. **Tab leaving the editor was "the worst moment of the session"** — the next
keystroke goes nowhere and Cmd+Z still fires, from outside. Nesting is a one-way door for
paragraphs. A block selection looks exactly like a text selection, so you cannot tell whether the
next character replaces a word or a block. First Cmd+A selected the entire document — one keystroke
from wiping everything. `/` → Table gives a header row only. Backspace at the start of a row after
an atomic block is a total no-op. The grip menu opens over the text to its right and has no "Turn
into". **Undo granularity is uneven: 57 undos to unwind ~30 gestures, splitting mid-word** — though
57 undos landed byte-exact on the original and 57 redos byte-exact on the driver's version, which is
the strongest single result in the session. And the editor wears a blue focus ring around the whole
column, so it reads as a form field rather than a page.

**Amended 2026-08-26**, in the order they were closed: `/` and `@` are one list with one keyboard
(`3435d3ad`); both popups flip above the anchor when they do not fit below (`b92a8db0`); the editor
follows its own caret onto the screen (`638c7a46`); every popup colour a consumer can see is a
themeable default (`5167f690`); **Tab no longer leaves the editor** in a document any of whose kinds
indent, which is what "the worst moment of the session" was (`07595912`); the grip menu takes the
keyboard (`84872488`); and Home and End move the caret on the first press rather than scrolling the
page (`bcb6b5e2`). The FOCUS RING was judged and kept: the container is the one editing host
(ADR-0002), so it is the one focus target, and a consumer who wants none can style it. NO COMMIT
SINCE NAMES the rest, so they stand where the driver left them: a row selection painted as a text
selection, the first Cmd+A taking the whole document, `/` → Table giving a header row only,
Backspace at the start of the row after an atomic block, the grip menu's missing "Turn into"
(`ROW_MENU_ITEMS` is still Add below / Duplicate / Delete), nesting as a one-way door for a root
paragraph, and undo granularity.

Tickets: [28](issues/28-gestures-the-first-session-left-standing.md) carries Cmd+A, the Backspace
no-op, the one-way nesting and the undo granularity; the Table header-only seed is
[21](issues/21-table-gestures.md); the missing "Turn into" is
[27](issues/27-four-missing-affordances.md). The row selection is painted by the EDITOR now
(`36404009`), so that one is closed rather than standing.

**Seven things are missing** against `showcase.md` and against Notion: the gutter `+`; a trailing
empty paragraph and click-below-to-append; a selection toolbar (bold, italic, link and colour are
unreachable except by typing markup); "Turn into" and any set-wide verb beyond indent and drag;
grouping and icons in the `/` menu; a table worth the name (no column model, no Tab-creates-row, and
a pipe typed in prose silently becomes a cell boundary); and Notion's toggle entry, where the first
Enter opens the toggle and drops the caret inside as a child.

Tickets: the gutter `+`, "Turn into" and any set-wide verb, `/` menu grouping and icons, and the
selection toolbar are [27](issues/27-four-missing-affordances.md); the trailing empty paragraph and
click-below-to-append are [16](issues/16-trailing-paragraph.md); a table worth the name is
[21](issues/21-table-gestures.md) over [20](issues/20-rowspec-group.md); Notion's toggle entry is
[22](issues/22-continues-carries-no-depth.md).

The blunt summary: **the document model is good and the editing experience is not.** Every
structural gesture the maintainer asked for exists and is pinned. Nearly every gesture a person
performs without thinking — Enter on a menu, click on a block, Tab, paste, scroll — is either
missing, silent, or wrong. The gap between those two sentences is the whole finding.

**Amended 2026-08-26**, and the amendment is the finding's second half rather than its refutation.
Every one of those five gestures now works and is pinned: Enter on a menu, a click on a block, Tab,
the internal-clip paste, and the scroll that follows the caret. It took **two more driving sessions
and eleven defects** to get there, not one of which the suite could see, and one of them — the
click's destination — shipped with a green pin asserting the defect itself as the contract. So the
gap was real and it closed by DRIVING rather than by testing harder; what stays open is the list
above this one, with the trailing paragraph at the head of it.

---

## What I would do next

Ranked by (breaks a core gesture) × (cheap) × (nothing else is blocked on it first).

1. ~~**Give `RowMenu` the keyboard.**~~ **DONE 2026-08-26**, and the "two overlays, one protocol"
   reading went further than planned: there is one MODEL (`OverlayListModel`), one COMPONENT
   (`OverlayList`, which is the default overlay), and `RowMenu`/`MenuEntry` are gone from the
   published surface. Items 12-15 and the board (21) landed with it.
2. ~~**Stop the caret entering a control root, and pin it with a real click.**~~ **DONE 2026-08-26**,
   in two commits, and the second exists because the first got the destination wrong: `9c781d4a`
   moved the caret out of the control root and into the next editable row, `9ef80374` made it the
   row the pointer landed IN. "Pin it with a real click" was the load-bearing half of this item and
   it held both ways — the first pin drove a real click and asserted the wrong row as the contract,
   which is how a defect shipped with a green suite over it. The three pins now over it were each
   seen to redden under a mutated mechanism.
3. **Decide the trailing paragraph.** An atomic row generates no caret position, so the editor can
   end in a state with no caret target at all. This is a design question, not a repair: either the
   editor guarantees a trailing empty row, or `choose` gains an insert-after contract beside its
   turn-into one. Ranks third because the driving session's item 5 dissolves into it entirely — the
   `Empty` story's "no caret target at all" is the same hole — and because it is a published-contract
   change that should be decided once rather than patched twice.
4. ~~**Fix the internal-clip paste at a non-line-start caret.**~~ **DONE 2026-08-26** (`4f365608`),
   and it was not the predicate this item imagined: the two languages are told apart by the SHAPE
   handed to `RowNode.writeRows` — array of pieces versus this editor's own markup string — which
   `replaceRows` had always read that way over a row selection.
5. ~~**Paint depth.**~~ **DONE 2026-08-26** (`43a99df9`), in the showcase's theme. `:not(.paragraph)`
   is the rule rather than an exclusion: a kindless child row of a paragraph is that paragraph's
   continuation line and must stay flush, and the kind it carries is the only thing that tells them
   apart.
6. ~~**Flip the overlay, and scroll the caret into view.**~~ **DONE 2026-08-26** (`b92a8db0`,
   `638c7a46`). The flip uncovered a second defect underneath it: both adapters read
   `overlay.position()` non-reactively, so the popup had been frozen where it opened and did not
   follow the caret as the user typed.
7. **Convert the showcase to the shared harness (P12).** ~800 lines of Vue vocabulary plus Vue's
   `useControlRef`. Ranks seventh despite being the largest item, because five of the ten defects
   the last hardening round fixed have their only pin in a React-only file — so **every fix above
   ships half-measured until this lands**. It should be reconsidered upward the moment an adapter
   defect escapes.
8. **Theme the shipped popup** — ~~and drop the container's focus ring~~. **HALF DONE 2026-08-26**
   (`5167f690`): eight `var(--markput-…, <old value>)` names cover the popup, its highlighted row,
   the grip and the drop line, and the showcase maps all eight onto its own tokens. The FOCUS RING
   was judged and kept rather than dropped — the container is the one editing host, so it is the one
   focus target, and removing the indicator in core would take it from every consumer.
9. **Extend the doc-sample check to prose backticks.** Highest-value of the three rot-guard
   follow-ups, and the one that is not trivial: it needs a filter that tells `` `store.rows` `` from
   English in backticks. The other two — a grep spec over `CONTEXT.md`'s avoid-list, and the link
   check that is already built — are afternoon work and can ride along.
10. **Decide the two published-type corrections** (`OverlayHandler.ref`, `MarkedInputProps.Span`).
    Ranks last not because it is unimportant but because it is a decision, not a task: the repo
    already works around both in three places, and the docs now cast in eight.

**Where the list stands after two driving sessions** (2026-08-26): 1, 2, 4, 5 and 6 are done and 8 is
half done, so **the trailing paragraph (3) is the top open item** and it is still a decision rather
than a task — every repair since has walked around it, and the click-claim's "a row with no position
is inert" is the closest anything has come to answering it. **P12 (7) has not fallen**: the last two
sessions did put most of their new pins at core level or in specs both projects run
(`Base/keyboard.spec.ts`, `Base/rowKeymap.spec.ts`, `Drag/Drag.spec.ts`), but the showcase's own net
is still three React-only files — `Notion.react.spec.tsx`, `caret.react.spec.tsx`,
`structure.react.spec.tsx` — and the caret rules the last two pin are exactly where an adapter can
differ.

**Not recommended yet, and why.** A selection toolbar, "Turn into" in the grip menu, `RowSpec.group`
and a per-kind drag axis are all real gaps, and every one of them adds published surface. The
doctrine's own test asks what a proposal deletes; none of these delete anything, and all of them
land better after items 1–4 have proven the gestures underneath them work. The one exception is
`RowSpec.group`, which three separate wants are blocked on (column alignment, table semantics,
header runs) — when a fourth turns up, it stops being a feature and becomes the missing primitive.
