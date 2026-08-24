# Doctrine — structure and primitives

> Extracted from commit history, scratch maps and ADRs on 2026-08-25. A working brief for
> implementing agents, not a decision record: nothing here decides anything, it reports what
> the record already shows.

Scope: `b0`, roughly PRs #263–#301. Every claim below carries a sha or a `file:line`. Where a
rule is **ABSOLUTE** the record shows no counterexample; where it is **DEFAULT** the record shows
the maintainer overriding it with a reason.

---

## A. The doctrine, as rules

### 1. When a mechanism is called irreducible, delete it and run the suite — the verdict is the measurement, not the argument. ABSOLUTE

`258e2149` retired three commit-pipeline concepts the pipeline's own census had listed as *"the
invoice for framework-owned DOM, not removable"*: **both "irreducible" verdicts fell to a deletion
and a test run.** Removing the `pendingStructural` guard line failed 1 test out of 1467 — the test
that pinned the latch itself (`docs/adr/0008-the-id-bridge-does-not-fail-closed.md`). `98fa92c5`
ran the same method at scale: 41 census findings verified by applying the deletion in an isolated
worktree, 0 refuted.

### 2. A refutation is evidence about the code as it stands, never a permanent no. Ask whether the obstacle is ours to remove. DEFAULT

Deleting the `#committed` mirror was refuted twice on 2026-08-20 and both refusals were correct.
Neither saw that the first failure was a bug in **our own event primitive** — `eventReadOper`
consumed a shared dirty flag, so the first subscriber to read cancelled everyone queued behind it.
Fixing that made the atomic commit work and the mirror came out with nothing left to compensate
for (`1f616a69`; the sequence, not the verdict, is recorded at
`packages/core/src/features/tokens/README.md:547`).

### 3. Derive rather than store. A mirror is legal only while the thing it compensates for exists. DEFAULT for existing state, ABSOLUTE for new state

`#seeded` became `roots().length > 0` (`1f616a69`). `BlockStore` stopped taking adapter-fed row
mirrors and reads its index live from the tree (`84a11ab1`). The delta accumulator
(`pendingDelta`/`foldDelta`/`drainDelta`) became a set difference against the flatten `bind`
already walked and threw away — *"the fold's two cancellation rules are not reimplemented — they
fall out of the arithmetic"* (`258e2149`).

### 4. One rule, one owner. Two implementations of one rule are a defect even while both are green. ABSOLUTE

The suggestions state machine was implemented twice, once per adapter; it moved into core as
`SuggestionsModel` and both `Suggestions` collapsed to pure paint (`9024586b`). Four verbatim
per-node repaint thunks became one `renderSubscription` (`42aab099`). `handleBlockBeforeInput` had
drifted from `input.ts`'s replacement table and the drift *was* a shipped defect: dragging text out
of a block row inserted at the target and never deleted the source (`2cb3b93e`, in `98fa92c5`).

### 5. When code forks on a mode, census every site and find the one fact the fork actually reads. DEFAULT

`1235da9a`: a census over twelve production sites found **one** irreducible sort — the parse
policy. The ~fifteen row behaviours already read `kind === 'row'` and no prop at all. The enum
shrank to a single computed, `TokenModel.rowSeparator`, and the proof is a grep with one hit,
which is the computed itself.

### 6. Prefer removing a premise to guarding it. DEFAULT

The row separator moved out of markups and became an editor-level setting, which deleted the repair
chain, both `isSlotLeading` predicates, `filterEmptyText` and `createRowContent` rather than fixing
them (`31fac6d1`, ADR-0009). `36a621c8`: *"the guard's premise disappears rather than being worked
around."* `6be66f5b` closes `row-verbs/issues/01` **not by answering its timing question but by
removing its premise.**

### 7. At a consumer boundary, refuse and carry on; do not throw into a render. ABSOLUTE at the props boundary

`layout="block"` with `separator: ''`, and a typo'd `markup`, both threw out of `props.set`, which
both adapters call from a hook that runs on every render — React tore down the whole render root,
Vue rendered a stale tree. A tolerance census over 13 bad prop values established that
refuse-and-carry-on was already the house rule and that these two were the **only** prop values in
the surface that threw (`c1796e14`, `a252512c`, `1fdd9280`; summary in `1235da9a`).

### 8. Zero in-repo callers is not dead code if the symbol is published or documented. ABSOLUTE

`SelectionSnapshot.anchor` was kept against the audit's own advice: *"A documented read with no
in-repo caller is a contract, not dead code — the reasoning that keeps `api.focus()`"* (`8752d27d`).
The focus family survived `0883d325` on the same grounds. The mirror image also holds: internal
symbols with zero importers go without ceremony — `trigger()`, seven barrel re-exports, a dead
`Range` type (`17c13475`).

### 9. Public API is decided from the outside, on usage, not from an internal resolver's convenience. ABSOLUTE

The 2026-08-22 decision to fold `props.Mark` into a node-kind-keyed `slots` registry was **reversed**
because *"it was reached from the inside, from two resolvers and a `RowNode` throw, and let those
problems shape the public API"*; counted across the storybook and both demo apps, `Mark=` 73 uses
against `slots=` 9 (`494a7222`; `docs/scratch/row-mark-unification/map.md:69-81`). Same shape in
`1235da9a`: deleting `layout` outright was designed and measured green and **not taken**, because
it is a published-API question, not an architectural one.

### 10. Every observable change is declared in the commit body — including strict improvements. ABSOLUTE

`AGENTS.md:57-59`. `d2cfb350` lists eight behaviour changes under its own heading; `98fa92c5` heads
a section *"Behavior changes (called out per AGENTS.md)"*; `31fac6d1`, `36a621c8`, `494a7222` and
`93d84a3f` each carry one. `36a621c8` goes further and labels a change with no test on either side
as *"a choice, not a fix"*.

### 11. A structural change is a pure move, and you measure that it moved nothing. ABSOLUTE

`874ec0b6` collapsed 1324 → 861 lines of fixtures across 13 commits and reports *"the single most
useful fact: neither `.snap` moved, at any commit"*. `36a621c8` replaced snapshot memoisation with
per-node subscriptions and measured render counts against the old design **before** the swap: 1 vs
1 in all four scenarios. `AGENTS.md:67-69` states the rule.

### 12. A green suite proves nothing. Break the mechanism and check that the pin reddens. ABSOLUTE for any load-bearing claim

`36a621c8` audited one branch with 28 mutants, 27 red, and found the final fallthrough silently
ungated. `258e2149` found the `∩ announced` clause covered by **no** test in either implementation.
The reusable failure is written up at `docs/scratch/row-mark-unification/map.md:312-331`: two of
three shipped fixes carried **decorative** pins — one asserted against a fixture the mechanism did
not govern, one raced the layer's own mount. *"A pin asserted against a shape the mechanism does not
actually govern reads exactly like a pin that works. Mutating the mechanism — not re-reading the
test — is what tells them apart."*

### 13. Re-measure an inherited "known defect" before designing around it. DEFAULT

Three of them dissolved in one week: the row-interior boundary (produced only by a test helper), the
caret destroyed by a layout change (the raw DOM offset moves; the position does not), and
"ADR-0009 says remount" (it says reparse). *"All three had travelled several rounds of retelling
without ever being re-measured"* (`docs/scratch/row-mark-unification/map.md:400-404`; `1235da9a`).

### 14. State the honest cost, including when the change adds lines. ABSOLUTE

`d2cfb350` moved the row controls out of the rows and says so plainly: *"**It is not a code
reduction** — measured, `features/block/` 160 → 182, React 152 → 137, Vue 156 → 170, net +21"*; the
case is the runtime numbers (44 → 18 ms, 1005 → 403 DOM nodes, 1608 → 7 listeners at 200 rows) and
the concept count. `8752d27d` lands at net **+26** production lines: *"The file did not get smaller;
it got truer, which is what the audit predicted: the size is not the defect."*

### 15. Make the invariant checkable — a grep or a spec, not a paragraph. DEFAULT

ADR-0003's one-address-space rule is enforced by `packages/core/src/addressSpace.spec.ts`, which
scans every core source outside `features/tokens/` and fails on a `.position` read, and its
allowlist is **gone** — *"the rule is now the directory boundary, with no exceptions to keep in
sync."* `874ec0b6` took `data-testid` from 21 references to 0 and installed
`no-restricted-properties` to hold it. `1235da9a` ships the grep whose output is one line.

---

## B. The moves

The recurring transformations, each with a real before/after. This is the section to copy.

**1. Delete the flag; the state that motivated it becomes derivable.**
`pendingStructural` latch → absence is the only refusal, because a node born by the commit has no
handle at all (`258e2149`, ADR-0008). Stored `#seeded` → `roots().length > 0` (`1f616a69`). Mode
enum → one computed `rowSeparator` (`1235da9a`).

**2. Two call paths merge into one owner.**
`enableBlockEdit` and its second keydown/beforeinput listener pair deleted; `input.ts` carries block
arms after its own shared checks. `blockEdit.ts` 229 → 58 lines and the 46-line "which row is the
caret in" tier died entirely — a row-boundary delete now expands onto the separator, so deleting
that span *is* the merge (`d2cfb350`).

**3. A rule implemented twice above the seam moves below it.**
Both adapters' suggestions machines → one `SuggestionsModel` in core, adapters reduced to paint;
public `OverlayHandler` shape unchanged (`9024586b`, +246/−135 — two implementations became one).

**4. Thin wrapper inlined; single-consumer file folded into its caller.**
`findGap.ts`, `editableState.ts`, `adoptUtils.ts`, `markPatch.ts` deleted into their callers; five
single-call-site wrappers inlined (`f86832cf`, net **−384** lines in `packages/`; `2542aa96`,
+22/−52).

**5. A record shrinks to the fields production actually reads — proven with a probe, not a grep.**
`TransactionResult` → `{selectionAfter}`; the `added`/`removed`/`updated`/`structural`/`render`/`map`
feed had zero runtime readers, **proven with a throwing-getter probe**, and the spec oracles moved to
`tree/__testing__/diff.ts` (`79b6f94c`). `domSelection()` → `{range, focusNode}`, which also takes an
unconditional `getBoundingClientRect` off the `selectionchange` path (`565b084d`).

**6. Machinery whose only callers are its own spec is deleted.**
`tx()` and its Batch/overlap/hull machinery: all 16 callers were its own spec, single-op dispatch is
algebraically identical, +19/−263 (`26585187`).

**7. A second write path is withdrawn, and its coverage moves rather than dying.**
The component `ref` went from a fourteen-member editor API to `container` + `focus()`; the
withdrawal stranded five internals, each with exactly one non-test caller. Four gates that lived on
the public surface moved to where the behaviour is and **each was re-measured after the move**
(`6be66f5b`, +411/−1516).

**8. A special arm folds into the general arm, with end states probed identical.**
The empty-row Backspace arm was subsumed by the merge arm — editable end states byte-identical,
probed pre/post — −11 lines (`04c617ac`).

**9. An accumulator is replaced by arithmetic against the truth.**
`pendingDelta`/`foldDelta`/`drainDelta`/`deltaOf`'s subtree walk → a difference against the flattened
tree; `commit.ts` loses 83 lines and keeps only the routing (`258e2149`).

**10. Stop re-deriving a fact the framework already holds — have it hand the fact over.**
Core walked the painted DOM in lockstep with the tree to pair elements to tokens. Now the framework
consigns each element as it paints it and a ref binds that one token; the epoch → render → "I
painted" round trip is gone. Shipped behind a **shadow registry first** (A1: consignment beside the
walk with a dev assertion that they agree; zero disagreements over the whole browser suite), then
the walk was deleted (`93d84a3f`).

**11. Written twice → written once, with a shared oracle policing the difference.**
Storybook pages: framework-specific spec files 24 of 24 → 2 of 14, story snapshots shared by both
frameworks 0 of 27 → 32 of 32 in one file; *"a divergence between the adapters is a failing test
instead of a difference nobody diffs."* It found seven latent defects on the way (`e7055ac8`,
+7678/−13375). The fixture layer followed onto the same seam (`874ec0b6`).

**12. A parameter no reachable document can exercise is deleted, and the invariant it hid gets a pin.**
`anchorAt(offset, side?)` → `anchorAt(offset)`. A throwing probe fired in 1 of 1533 tests — a
hand-assembled tree; a corpus probe over 326 documents parsed five ways took the fallback 20139
times in 159105 offsets and never at an owner's start. The reachability argument moved into code,
and `tree/anchors.spec.ts` gained the invariant that replaced the parameter (`2006cd5e`, `7a6e4a95`).

**13. A local repair is escalated into a structural rule.**
Rows were markups carrying their own delimiter, and two defects were unfixable in that shape. The
separator became one editor-level setting and `RowNode` became block layout's only root kind — which
deleted the repair chain, both predicates, the empty-text filter, the `rowElement` registry and the
`project`/`compose` drag composition (`31fac6d1`, ADR-0009).

**14. Per-item chrome leaves the item for one layer per editor.**
Grip, drop indicator and menu stopped rendering inside each row; one absolutely positioned layer
paints all of them, addressed by row id and resolved geometrically. Two classes plus four components
per adapter → one controller plus one layer per adapter (`d2cfb350`; ADR-0007's amendment).

---

## C. The anti-patterns

Removed on sight, with evidence.

- **Mirrored or derived state held as a field.** `#committed` (`1f616a69`), adapter-fed row-index
  mirrors (`84a11ab1`), `BindResult.bound` returning a per-bind copy of a map the model already owns
  (`0883d325`), `TokenHandle`'s four parallel element fields → one record (`0883d325`).
- **A flag whose refusal is already structural.** The pending-structural latch *"refused precisely
  the case that would have worked"* (ADR-0008).
- **Single-call-site wrappers, single-consumer files, thin delegations.** `f86832cf`, `2542aa96`;
  `placeCaret`/`selectRange`/`domSelection`/`placeAtHandle` were one-line delegations with no
  production caller (`1f616a69`).
- **Internal exports with no importer, and barrels re-exporting them.** `trigger()`, seven
  tokens-barrel re-exports, dead `Range` type, utils/classes/slots barrel trims (`17c13475`); two
  zero-importer barrels in each adapter (`b475d732`, `ae53e6bd`).
- **Dead guards.** A tautological guard and an unread field, proven by instrumentation — 2278
  evaluations, 0 false (`166d57f7`); an optional path nobody takes, branch replaced with a throw,
  18728 real calls across a 20000-input fuzz (`c4886754`); an unreachable mark arm, duplicate
  control-root checks, a fossil bounds check (`41fdacca`).
- **Test-only identity shipped to consumers.** `data-testid` 21 → 0; every one was another query
  spelled twice — `[data-depth]` was already on the element, `flat-mark` is `getByRole('mark')`
  (`874ec0b6`, `6f4833ec`). Attributes carrying the value **under assertion** stay.
- **Comments that narrate, eulogise or cite a phase.** 391 of `TokenModel.ts`'s 741 lines were
  comment, including a 27-line ledger eulogising eight mechanisms that no longer exist and ~26 lines
  of `S1.x`/`S2.x` citations. Where a comment stood in for a missing spec, **the spec was written
  instead** (`0883d325`).
- **False claims in prose.** Nine stale claims in `architecture.md` (`1f616a69`); five in
  `TokenModel.ts`, including a comment citing a spec file that had **never existed** (`8752d27d`).
- **A permanent test guarding an unbuilt design.** The Chromium atomicity probe was deleted, not
  kept — *"it measures Chromium, not markput"* (`258e2149`).
- **A second copy of a fact, shipped through the DOM.** A private MIME type to tell two editors apart
  was measured and rejected: it needs an id minted for that one purpose, and it can be the wrong one
  (`packages/core/src/features/block/README.md:51`).
- **A discarded metric, reported as discarded.** `caretRangeFromPoint` said "inside the mark" for all
  four shapes including the known-good baseline, so it measures hit-testing, not atomicity — dropped
  rather than reported (`258e2149`).

### Vocabulary avoid-lists (`CONTEXT.md`)

Use the left word; never the right ones.

| Use | Avoid |
| --- | --- |
| Token | node, element, item (`node` belongs to the DOM) |
| Mark | tag, chip, widget, entity, annotation |
| Row | line, paragraph, block, item |
| Separator | terminator, delimiter (as terms) |
| Anchor | offset, index, position, caret position, coordinate |
| Container | host, editor element, root element, field |
| Surface | span, text element, text node |
| Value | text, content, document string |
| Markup | pattern, template, syntax, format |
| Option | config, mark type, definition, plugin |
| Slot | children, body, inner content |
| Meta | data, payload, attributes, props |
| Pairing | mapping, matching, reconciliation, diff |
| Lexeme | token (for anything a consumer or adapter touches) |
| Controlled / Uncontrolled | managed, bound, external / internal, self-managed, local |

Naming rules with teeth: **"chrome" is not available** — it collides with Chromium, which this repo
reasons about on nearly every page (`docs/scratch/row-mark-unification/map.md:112-115`). Name a class
for its **role**, not its type: `Api` → `Handle`, because *"`Api` names a class by type, which is the
vague label AGENTS.md's naming rule rejects"* (`6be66f5b`, `AGENTS.md:100-102`). And do not rename
without a concrete reason — `store.block` survived a two-hop rename and the release-to-release diff
does not contain it (`d2cfb350`).

---

## D. Recorded rejections — do not re-propose

One line each, with its source. Re-proposing any of these without **new evidence** is a wasted round.

1. **Row as a parser Markup / mark == row** — designed in full, four keystroke-reachable holes plus a
   doubled public-contract migration — `docs/scratch/token-born-edit/issues/08-the-separator-is-structural.md:55`;
   *"never re-propose"* at `docs/scratch/row-mark-unification/map.md:16-17`.
2. **O1 — core builds the DOM skeleton** — maintainer, 2026-08-19, verbatim; consequence accepted
   whole: `bind`'s walk, `renderEpoch` and `onRendered` stay permanently and the commit pipeline is
   only ever shrunk — `docs/scratch/pending-window/spec.md:124`.
3. **The full O4 split of `CommitPipeline` into two objects** — grows the interface 6 → 9 members and
   its new query is `pending()` under a new name — `docs/scratch/pending-window/spec.md:118-122`,
   `258e2149`.
4. **Folding `EditController` into `tokens.replaceBetween`** — the seam *is* the contract: user edits
   move the caret, programmatic writes are repair-only — `packages/core/src/features/tokens/README.md`
   (refuted list), pinned by `selection.spec` AC-3.x.
5. **`domBoundary` vs `valueBoundary` as "duplication"** — one is DOM-domain, the other string-domain,
   zero shared computation — same list.
6. **A ZWSP filler in the gap between marks** — it is real text: it reaches `range.toString()` and the
   clipboard, and costs an extra arrow press — ADR-0004.
7. **A private MIME type to discriminate drag sources** — `packages/core/src/features/block/README.md:51`,
   `BlockController.ts:412`.
8. **A tree-derived grip gutter** — `containerProps` is read during SSR, where the tree is empty —
   `docs/scratch/row-mark-unification/map.md:140-144`.
9. **A per-node `v-if` in Vue's `Container`** — each `<template v-for>` item gets its own Fragment and
   a Fragment mounts two empty text anchors, pushing 2N stray text nodes into the editing host — same
   lines.
10. **A `slots` registry keyed by node kind, absorbing `props.Mark`** — reversed 2026-08-23; it let
    internals dictate the public API — `docs/scratch/row-mark-unification/map.md:69-81`.
11. **`{flush: 'post'}` in place of Vue's `await nextTick()`** — reads as the direct spelling of the
    same intent and is not: 136 red. Recorded in the code comment so it is not retried — `258e2149`.
12. **Removing the focus family or `SelectionSnapshot.anchor` on a zero-caller grep** — published or
    documented surface — `0883d325`, `8752d27d`.
13. **The incremental-parser shortcuts**: "touch the neighbours and verify" read literally → up to 35%
    wrong trees; the ported inert-outside guard → up to 77%; a simpler root-boundary predicate →
    19.8% wrong at a 0% bail rate — `docs/scratch/incremental-parser/spec.md:211-214`.
14. **A row-interior `domBoundary` arm, naively added** — took Vue's `Drag.spec` from 9 failures to 13
    and flips the documented contract at `domBoundary.spec.ts:395`; latent by decision, and if ever
    wanted it lands alone with its own gate — `docs/scratch/row-mark-unification/map.md:259-295`.

Deferred, **not** rejected (different thing — these may be reopened with a reason): deleting the
`layout` prop outright, designed and measured green, held as a published-API decision (`1235da9a`);
the incremental commit bind, costed at ~14 lines and ~1.1 ms with reopening conditions written down
(`docs/scratch/consigned-surfaces/issues/01-incremental-commit-bind.md`).

---

## E. The test of a design

A review rubric. Ordered by how often each one has actually killed a proposal in this repo.

1. **What did you delete, and did you run the suite with it deleted?** An argument that a thing is
   irreducible is not evidence; two of two such verdicts fell to a deletion and a test run
   (`258e2149`). If the proposal only adds, say why nothing came out.
2. **Has this already been answered?** Check section D, `packages/core/src/features/tokens/README.md`'s
   refuted list, and the map for the area. If it was refuted, name what changed since — a refutation
   is about the code as it stood (`1f616a69`), so the acceptable answer is "the obstacle was ours and
   it is gone", not "I disagree".
3. **Is the premise still true — measured today, not inherited?** Three "known defects" dissolved on
   re-measurement in one week (`docs/scratch/row-mark-unification/map.md:400-404`).
4. **After this lands, how many places hold this fact?** If the answer is more than one — a mirror, a
   counter, a second implementation, a copy shipped through the DOM — the design is not finished
   (`84a11ab1`, `9024586b`, `block/README.md:51`).
5. **Can it be derived instead of stored?** State, flag, counter, latch and accumulator are all
   suspects; the arithmetic usually already exists somewhere that walks the truth (`258e2149`,
   `1f616a69`).
6. **Does your pin redden when you break the mechanism?** Mutate it, don't re-read it — a decorative
   pin is indistinguishable from a real one by reading
   (`docs/scratch/row-mark-unification/map.md:312-331`, `36a621c8`).
7. **What observable behaviour changes, and is every one of them listed?** Including strict
   improvements, including the ones no test covers — those are declared as choices, not fixes
   (`AGENTS.md:57-59`, `36a621c8`).
8. **What does it cost, honestly?** Lines, concepts, runtime — stated even when the change grows the
   code, and with the case made on the number that actually improved (`d2cfb350`, `8752d27d`). If an
   internal shape is driving a public name, stop and count the call sites first (`494a7222`).
