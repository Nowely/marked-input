# Tree Core S1.6b / S1.6c / S1.6d Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** finish the cutover. **S1.6b** proves the storybook browser suites run the
new core and smoke-tests the real editor against a pre-cutover baseline.
**S1.6c** makes selection node-anchored: `SelectionController` stores
`{anchor, head}` `NodeAnchor`s, the numeric `Range` becomes derived, the
`#preferredHandle` stash and the clamp arithmetic die, and caret repair runs
through `selectionBefore` + `map`. **S1.6d** executes the remaining §4.6
deletions with the checklist as the gate. Per spec
`2026-08-08-markput-s1-tree-core-v2.md` (v2.2) §11's S1.6b/S1.6c/S1.6d entries,
D7, D9, §2.3's NodeAnchor model, §4.5 and §4.6.

**Architecture:** the addressing model becomes the selection's storage. Today a
caret is a number that the DOM layer re-resolves after every commit and clamps
against the value length; after S1.6c it is a live node plus a local offset, and
the number is a projection of it. That inversion is what deletes
`#preferredHandle` (the node IS the disambiguator two tokens sharing a boundary
offset needed) and the clamp (an anchor cannot point past its own node, and
`TokenHandle.placeCaret` already bounds the local offset). The adoption that
moves nodes is also what re-derives the anchors — one call, `repair(result)`,
synchronous inside the commit.

**Tech stack:** TypeScript, the shipped `tree/`, `model/` and `selection/`
modules, Vitest (three Chromium browser projects), Storybook 9 + Playwright.

**Prerequisites:** S1.1–S1.6a complete and committed on `b0`
(`12ead317..717ceeba`). Final S1.6a gate: **72 files, 1281 passed, 2 skipped,
13 todo**; `build`, `typecheck`, `lint:check`, `format:check` clean.

## Verification status

**Written** 2026-08-09 against the completed S1.6a. **Verified by
implementation** 2026-08-09: every task below was implemented in a throwaway
worktree off `717ceeba` and every gate was run. Baseline reproduced exactly
(**72 files, 1281 passed, 2 skipped, 13 todo**); with the corrections now folded
into this document the final state is **71 files, 1276 passed**, `build`,
`typecheck`, `lint:check`, `format:check` clean. The pass found four hard stops
(one non-compiling task, one live-editor regression, one wrong decision, one
failing lint gate); all four are fixed in place below and re-verified green.
Everything below is labelled: *measured* claims carry their command or
`file:line`, *hand-traced* claims carry the trace, and the places where no test
can discriminate are named.

**Amendment, 2026-08-09 (post-`465b8211`).** Task 3's recorded "measured blocker"
— a Chromium cross-host selection clamp — was **re-measured and is false**; the
task now lands tests instead of comments. See Task 3 Step 1 for the correction and
the discriminating probe. Gate at `465b8211` with Task 3 implemented: **72 files,
1291 passed, 0 skipped, 7 todo**, `typecheck`, `lint:check`, `format:check` clean
(from the **72 / 1281 / 2 skipped / 13 todo** baseline: +10 passed, −2 skipped,
−6 todo, +2 total tests). The "final state" line above predates this and was
recorded without Task 3's diff; add the same delta to it.

**Four things the executor must know before starting:**

1. **The suite is NOT green at every task boundary, contrary to what the
   revert-unit framing implies.** `pnpm -w exec vitest run packages/core` is
   green at every boundary; the FULL `pnpm test` is **RED at Task 8** and **RED
   again at Task 9** in the un-corrected plan, and the plan only ran the full
   suite at three points — so an executor lands two broken commits before
   finding out. Tasks 8 and 9 now carry a full-suite gate. Keep it.
2. **The browser projects are flaky under parallel load.** Across ~8 full runs,
   three distinct transient *suite-level import* failures were seen in the
   react/vue projects; each passed on re-run and in isolation. Re-run before
   believing a browser failure. **Do NOT dismiss the two failure modes named in
   Task 8 Step 4 and Task 9 Step 5 as flakes** — those are deterministic, name
   specific tests, and reproduce in isolation.
3. **S1.6b really does require no code change, and that is now proven, not
   argued** — see D-j, which carries the measurements.
4. Three of the four hard stops were in S1.6c. Budget the time there.

**Gates.** Every per-task gate LEADS with `pnpm run format` and includes
`pnpm run lint:check`: the pre-commit hook runs `oxfmt --check` and `oxlint`
with `denyWarnings: true`, so a tests-only gate defers the failure to
`git commit`. Tasks 1, 11 and 17 run the FULL `pnpm test`; **Tasks 8 and 9 now
do too** — they are the only two measured to break the browser projects while
the core suite stays green.

**Revert units.** Each sub-phase is its own milestone; each task inside it is
one commit and one revert unit. S1.6c's Task 8 (the stored-form swap) and Task 9
(repair) are the only pair with a stated fold-together escape hatch — read Task
8 Step 8 before starting Task 8.

**Task numbering.** There are **fifteen** tasks — **1–3** (S1.6b), **6–11**
(S1.6c), **12–17** (S1.6d) — producing **twelve or thirteen** commits (S1.6b lands
exactly one, from Task 3; Tasks 8+9 may fold into one). **There is deliberately no
Task 4 and no Task 5**: two S1.6b tasks were cut during writing once D-j
established that S1.6b has no migration work, and the numbers were left in place
so that every cross-reference in this document, in the commit bodies below, and
in any execution log written against an earlier draft keeps pointing at the same
task. Do not renumber.

---

## Decisions taken before writing this plan (do not re-litigate)

### D-a. `map` flips to RIGHT affinity. One `map`, no parameter, no second entry point

The roadmap ("The decision that must be made BEFORE this phase starts") asks for
an affinity parameter or a second entry point. **Neither is built.** The
mapping bias flips wholesale and `map` keeps its one-argument shape.

Today (`tree/adopt.ts:220-224`):

```ts
const mapped =
	offset <= window.start ? offset : offset >= window.end ? offset + delta : window.start + window.insertedLength
```

`offset <= window.start` is LEFT bias at an insertion point: typing `X` at
offset 5 of `abcde` maps a pre-edit caret 5 → 5. Three facts decide it:

1. **`map` has ZERO consumers today.** S1.6c is the first
   (`tree/types.ts:104` says so in the field's own doc). AGENTS.md forbids
   adding a parameter without a current caller, and after this phase every
   caller wants the same bias, so a parameter would have exactly one argument
   value at every call site in the repo.
2. **Every repair case wants right bias** — hand-traced, all four:

   | case | pre-edit | window | left → | right → | want |
   | --- | --- | --- | --- | --- | --- |
   | type `X` at the caret | `{5,5}` on `hello` | `{5,5,1}` | 5 | **6** | 6 |
   | Backspace | `{5,5}` | `{4,5,0}` | 4 | 4 | 4 |
   | Delete forward | `{5,5}` | `{5,6,0}` | 5 | 5 | 5 |
   | overtype `[2,5)` with `X` | `{2,5}` | `{2,5,1}` | anchor 2, head 3 → a 1-char **selection** | 3 / 3 → **collapsed** | collapsed 3 |

   The overtype row is the one that settles it: mapping BOTH endpoints with
   right bias collapses the selection onto the end of the replacement, which is
   AC-3.3/AC-3.4's wording, while left bias leaves a stray one-character
   selection.
3. **D7's "right affinity canonical" is a DIFFERENT axis, and the roadmap
   conflates the two.** D7 cites "the DOM layer's `boundaryFor` affinity
   parameter", which is `'before' | 'after'` *node resolution* at a boundary
   (`tokens/boundary.ts:32`) — already right-affine in `anchorAt`
   (`adopt.ts:226`: "the last text node (document order) containing the
   offset"). The bias `map` gets wrong is *mapping* bias. They are orthogonal;
   D7 never spoke to mapping bias, so the flip is not a spec deviation being
   introduced — it is the axis the spec left implicit, settled by AC-3.3.

**What the flip costs:** one expression, one comment, and the `want` line of the
property that pins it (`adopt.property.spec.ts:433`, with its comment at
`:431-432`), which is a *gate*, not
a casualty — it asserts the formula for every offset of every generated case, so
it goes red on the old formula and green on the new one. That property is why
this decision is cheap to land and impossible to land silently.

New formula (Task 6):

```ts
const mapped =
	offset < window.start ? offset : offset >= window.end ? offset + delta : window.start + window.insertedLength
```

Hand-checked invariants: totality and monotonicity survive (`{2,5,1}`:
0,1→0,1; 2,3,4→3; 5→3; 6→4 — non-decreasing); a pure insertion
(`start === end`) takes the *second* branch, not the third, and both compute
`start + insertedLength`, so the branches agree; `map` after a `reparse`
(`gapWindow(v,v) = {n,n,0}`) is unchanged for every offset below `n`, so
`boundary.spec.ts:272`'s pin (decision D-c of the S1.4 plan) is untouched.

### D-b. `SelectionController` stores anchors; `range` is a derived read-only `Computed` plus an explicit generation

Stored: `#anchors: Signal<{anchor: NodeAnchor; head: NodeAnchor} | undefined>`
with a custom `equals` comparing anchor identity (node object + local offset).
The equality is load-bearing, not an optimization: the DOM sync rebuilds fresh
anchor objects on every `selectionchange`, and today's `range` signal uses
`{equals: shallow}` for exactly that reason (`SelectionController.ts:13`).
Without it, every sweep tick re-enters `#applySelection` and re-places the caret.

Derived: `range: Computed<Range | undefined>` with `{equals: shallow}` (the
signals layer supports `computed(getter, {equals})` —
`shared/signals/signal.ts:513`, `ComputedOptions`), normalized low→high.

**`range` also reads a `#generation` signal, and that is not padding.**
Positions are plain mutable fields written by adoption (spec D3, "render-inert
field writes"), so *nothing* invalidates a computed derived from them. The
discriminating case is AC-3.2 itself — an anchor that survives an edit
*unchanged* while its absolute offset moves:

> fixture `ab@[x]cd` (`@[__value__]`): text `ab`[0,2], mark[2,6], text `cd`[6,8].
> Caret at absolute 7 = `{node: cd, offset: 1}`. Insert `Z` at 0 →
> `map(7)` = 7 + 1 = 8 → `anchorAt(8)` → `cd` now [7,9] → `{node: cd, offset: 1}`
> — the **same node object and the same local offset**, so the `#anchors` write
> is deduped by `equals` and notifies nothing. Only the generation bump makes
> `range()` answer 8 instead of the cached 7.

One writer: `repair()`, once per adoption, unconditionally (positions move
whether or not a selection exists). Nothing watches `#generation`; only `range`
reads it.

### D-c. What survives, what changes shape, what dies

| member | fate |
| --- | --- |
| `range` | **changes shape**: `Signal<Range \| undefined>` → `Computed<Range \| undefined>` (read-only). Every production READ survives untouched (`OverlayController.ts:115` — the only production reader that needs the number; `Store.ts:21`'s capture thunk). There are **zero production writes** outside the class. |
| `position` | **survives, same signature** (`Signal<number \| undefined>`, writable computed). Setter builds an anchor through `tokens.anchorAt(offset)`. Its one production caller, `EditController.ts:28`, keeps working. |
| `isAllSelected` | **survives unchanged** — it reads `range()` and `value.current()`. |
| `isUserSelecting` | **survives unchanged**, including the user-selecting sweep (`#trackUserSelecting`) and the `#applySelection` early return. |
| editable policy (`#applyEditablePolicy` + its two watches) | **survives unchanged** — untouched by this phase. |
| `selectAll()` | **survives, same signature**; body becomes two `anchorAt` calls. Deliberately NOT the `'start'`/`'end'` edge forms: node anchors make `isAllSelected` go false when the value later grows, which is correct; edge anchors would keep it true. |
| `focusFirst()` | **survives unchanged** (it delegates to `placeAtHandle`). |
| `readRaw()` | **survives unchanged** — clipboard, keyboard and `inputRange` consume numeric raw ranges and are untouched. |
| `placeAtHandle(handle, boundary)` | **survives, same signature**, new body: resolve the handle's id to its `TreeNode` and store a node anchor. The "re-apply even when the write dedupes" branch stays (`SelectionController.ts:83`). |
| `#preferredHandle` + `#placeCollapsed`'s stash protocol | **die** (§4.6 item 5). The stored anchor's node is the disambiguator. |
| `#applyRange`'s clamp + clamp write-back | **die** (§4.6 item 5). Nothing global replaces them: an anchor cannot exceed its node, `anchorAt` answers `'end'` for an out-of-range offset, and `TokenHandle.placeCaret` already does `Math.max(0, Math.min(offset, length))` (`model/TokenHandle.ts:159`). |
| **new** `select(anchor, head?)` | internal write verb with four production callers (`selectAll`, `position`, `placeAtHandle`, the DOM sync) — it is not surface-without-a-caller, and S1.7 promotes it to §2.3's `input.select`. |
| **new** `repair(result)` | the `selectionBefore` consumer (D-d). |

### D-d. `selectionBefore`'s consumer: `SelectionController.repair()`, called synchronously from `onResult`

`selectionBefore` has been captured since S1.6a Task 1 and has had no consumer.
It gains one here, wired as follows.

**Channel.** `TokenModel`'s third constructor argument widens from
`() => Range | undefined` to `() => SelectionPort`:

```ts
export interface SelectionPort {
	/** Pre-adoption capture (spec D7), in the TREE's coordinate space. */
	range(): Range | undefined
	/** Post-adoption repair (spec D7): consumes `selectionBefore` + `map`. */
	repair(result: TransactionResult): void
}
```

**It is named `selectionPort`, NOT `selection`. Measured hard stop:** the
obvious rename walks straight into the collision `TokenModel.ts:245-249` already
records as measured-broken — the class has a `selection(): SelectionSnapshot |
undefined` Engine SPI method, so a `private readonly selection` parameter
produces `TS2300` / `TS2403` / `TS2687` on the declaration plus `TS2532` /
`TS2339` at both call sites and `TS2741` in `Store.ts`. Keep that comment
(re-worded for the widened type); the alternative — keeping the name
`selectionBefore` for a port — is worse, because the field no longer answers a
range.

`Store` supplies `() => this.selection` — the same deferred-thunk trick S1.6a
used for the capture, for the same reason (`tokens` is built before
`selection`), and `SelectionController` satisfies the port structurally
(`range` is callable, `repair` is a new public `@internal` method).

**When.** In `TokenModel`'s boundary `onResult`, AFTER `pipeline.apply` and
after `#committed` is written — so the repair sees a consistent view and the
`'end'`-style resolutions read the committed projection.

**What repair does.** Bump the generation; if `selectionBefore` is undefined,
stop; otherwise store `{anchor: map(before.start), head: map(before.end)}`.

**The no-dangling invariant (why there is no "node was removed" branch).**
`selectionBefore` is *derived from the stored anchors* — the capture thunk is
`selection.range()`. So `selectionBefore` is defined **iff** the anchors are
defined, and every adoption that could remove an anchor's node is the same
adoption that re-derives it here. `map` resolves against the POST-adoption roots
(`adopt.ts:201` closes over `out`), and `adopt.property.spec.ts:419-421` already
proves for every generated case that `map` never answers with a dead node. AC-3.3
("including when the anchor node was replaced") therefore needs no special code —
only a test (Task 9).

**Why an imperative caret still wins.** The repair writes `#anchors` inside the
transaction; `EditController.replace` writes `position(...)` after
`value.replace` returns, inside the same `batch`. Last write wins, one watcher
run. That preserves every `caretAt` intent (block reorder, row merge) unchanged
in uncontrolled mode.

### D-e. Controlled mode must stop moving the caret optimistically — repair and the optimistic write double-shift

Hand-traced, controlled `hello`, caret at 2, type `X`:

```
commit (controlled): emits 'heXllo', tree unchanged, no adoption, no repair
EditController:      position(2 + 1) = 3           ← optimistic, in the OLD space
echo arrives:        selectionBefore = {3,3}       ← the optimistic value is captured
                     window {2,2,1}, map(3) = 3+1  = 4                    ✗ want 3
```

The caret is shifted twice. D6 already legislates the fix ("No optimistic caret
move: the caret is repaired once, at echo adoption, via `map`"), so:

```ts
replace(range: Range, replacement: string, caretAt?: number): void {
	batch(() => {
		if (!this.value.replace(range, replacement)) return
		// Controlled mode: the echo's repair owns the DERIVED caret — but NOT an explicit
		// one. `caretAt` is a caller INTENT (block reorder, row merge) that `map` cannot
		// reconstruct, and dropping it deletes the row (see the measured failure below).
		if (this.props.value() !== undefined && caretAt === undefined) return
		this.selection.position(caretAt ?? range.start + replacement.length)
	})
}
```

Re-traced with the guard: no optimistic write → `selectionBefore = {2,2}` →
`map(2)` right-affinity → `2 >= window.end(2)` → 3 ✓. **That single test
discriminates D-a and D-e simultaneously**, end to end (left affinity answers 2;
keeping the optimistic write answers 4) — and it passes no `caretAt`, so the
exemption does not weaken it.

**The `caretAt === undefined` narrowing is not defensive padding — the
unnarrowed guard was MEASURED to break block row deletion.** The first draft of
this decision said "Storybook's controlled block cases assert 'no echo → nothing
changes', which stays true" and "this is not a loss of a working behavior". Both
sentences are false. `PlainTextDrag` is a **controlled** story **with an echo**,
and with the unnarrowed guard `Drag.react.spec` and `Drag.vue.spec` ›
"backspace on empty row › delete the row and reduce count by 1" fail in both
frameworks. Corrected and re-verified green with the narrowing above.

**The re-opened trade-off, named so nobody assumes it away:** `caretAt` callers
in controlled mode **keep the double-shift** D-e was written to remove. Their
imperative write is captured as `selectionBefore` at the echo and shifted again
by `map`. That is the status quo, not a regression — and it is strictly better
than the alternative, which is a deleted row. Row-merge/reorder callers pass a
`caretAt` inside the row they just wrote, and the echo's `map` moves it by the
row-shaped delta; the residual error is bounded by that delta and was there
before this phase. Fixing it properly means teaching the repair to prefer an
explicit intent over `map` (a `caretIntent` channel through the transaction) —
that is S1.7 work, not this plan's, and it is recorded here so the follow-up has
a starting point.

Consequences to name in the commit body:
- `EditController` gains a `PropsModel` dependency (one `Store` line).
- `EditController.spec.ts:56` ("calls onChange and records caret intent in
  controlled mode") pins the behavior being removed and is rewritten with the
  call-out. It is the only core spec that pins it. **The behavioral pin that
  actually catches over-reach is in the storybook Drag suites**, which the core
  gate does not run — see the full-suite gate on Task 9.
- A controlled parent that never echoes and no `caretAt` now leaves the caret
  alone instead of moving it and then having it clamped back — D6's "Rejecting
  parent → nothing happens; no caret drift".
- A controlled `caretAt`-less caret is now supplied by `map` instead of the
  caller. Today it is written and then clamped against the *old* props value, so
  this is not a loss of a working behavior; it is a different approximation.
- Uncontrolled mode is unchanged: for a sub-range op `range.start +
  replacement.length` **equals** `window.start + insertedLength`, so the
  imperative write and the repair agree by construction; where they disagree
  (whole-value ops, which are gap-narrowed) the imperative write still lands
  last and wins, exactly as today.

### D-f. Anchors cannot address an unseeded tree, so `TokenModel.anchorAt` seeds

`anchorAt(offset)` walks `#tree.roots()`. Before the tree materializes those are
empty, so every offset answers `'end'` → 0. Six existing specs write a
selection into an **unmounted** store and read a number back
(`SelectionController.spec.ts:117,122,133,146,152,158`;
`EditController.spec.ts:34,47`), and today they work because the value was a
plain lazily-initialized string. (`:269` and `:285` — the two OOB-clamp cases —
are **mounted**: both append a container and call `store.host.container(...)`.
They are still affected, but by the *clamp deletion*, not by seeding; Task 8
Step 5 handles them and their assertions survive.)

`TokenModel` already has the materialization point for exactly this class of
caller — `#ensureSeeded()`, called by `replace` and `applyStructural` with the
reason written on it ("several specs still edit an unmounted store"). The
offset→anchor direction is on the selection WRITE path, so it seeds too:

```ts
anchorAt(offset: number): NodeAnchor {
	// Seeds for the same reason `replace` does: this is the selection WRITE path, and an
	// unmaterialized tree answers 'end' for every offset. `offsetOf` deliberately does NOT
	// seed — it is a READ, reached from `range`'s computed, and a signal write inside a
	// computed evaluation is a defect, not a convenience.
	this.#ensureSeeded()
	return untracked(() => anchorAt(this.#tree.roots(), offset))
}
```

**Second-order consequence, and it must not be discovered at the gate:** seeding
from `anchorAt` destroys the two named gates of `TokenModel.value`'s `#seeded`
arm (`model/TokenModel.ts:137-144` names `SelectionController.spec`'s
`isAllSelected › returns true when range spans the entire value` and `selectAll ›
retains range intent when the DOM has no target yet` — both read the value on an
unseeded store). After this change both stores are seeded and the mutation
survives them. Task 8 Step 6 re-establishes the gate with one new
`ValueModel.spec` case and rewrites that comment. Do not skip it: the mutation
would then be caught by nothing.

Three `SelectionController.spec` cases use a bare `new Store()` with no value at
all and expect offset 5 to exist. Seeding cannot save those — an empty document
has no offset 5 — so they gain `defaultValue: 'hello'` (Task 8 Step 5). Their
subject (position get/set semantics) is unchanged; only the fixture now contains
the offsets it addresses.

### D-g. `TokenHandle.path()`'s three readers retire in S1.6d, BEFORE the writer, re-keyed on node ids

Verified readers (`grep -rn "\.path()" packages --include="*.ts"`), production
only:

| site | use | retirement |
| --- | --- | --- |
| `keyboard/blockEdit.ts:32` | `handle.path()[0]` as the block ROW INDEX | `tokens.rootIndexOf(handle.id)` — the index of the root whose subtree contains the id |
| `keyboard/arrowNav.ts:35,49-51` | sibling path → `resolvePath(tokens.current(), siblingPath)` | `tokens.siblingOf(handle.id, ±1)` over live nodes, then `tokens.handle(sibling.id)` |
| `model/commit.ts:252` | the divergence error message | the handle id |

Both replacements are strict improvements, not parity moves: `#path` is
bind-generation state on a handle that is reused across binds, so the current
readers can answer from a stale generation — that is the latent bug spec §11
records. Ordering inside S1.6d is Task 12 (readers) then Task 13 (writer), so the
risky change (block row index) reverts independently of the mechanical delete.

### D-h. `TokenHandle#token` SURVIVES S1.6d. Only `update()`/`#path` die

D9 says two things that cannot both be executed: "`TokenHandle` … its `#token`
snapshot and `update()` are deleted — in S1.6d" **and** "handles cache
bind-generation positions (stamped at bind, refreshed with the DOM), and
DOM-boundary reads … resolve against them, not against adoption-fresh
`node.range()`". §4.6's item 4 — the checklist that is the actual gate — says
only "Handle write-latch/captured-token fallback (`MarkController` regime; read
latch survives per D9 with stated rationale)".

Measured reader census (`grep -rn "\.token()" packages/core/src`, production):
`DomModel.ts:95` (feeds `tokens/boundary.ts`: `.type`, `.position`, `.content`),
`model/commit.ts:248` (`.content`, the divergence detector),
`model/TokenModel.ts:230` (`.type`), `keyboard/arrowNav.ts:37` (`.position`),
`MarkController.ts:54` (dies with item 4), `SelectionController.ts:78,121` (die
in S1.6c). So after this plan **five** legitimate bind-generation readers remain,
three of them positional. Narrowing `#token` to a `{start, end}` stamp means
re-pointing `boundary.ts`'s `tokenOf` contract (type/content) at the live tree —
a DOM-layer refactor with no checklist item behind it and a direct conflict with
D9's own read-latch paragraph.

**Decision: S1.6d deletes `update()` and `#path`, keeps `#token`, and rewrites
`TokenHandle`'s header comment** (`model/TokenHandle.ts:45-47`, which currently
promises the narrowing) to record the five readers and hand the narrowing to the
directory regroup / S1.8 with its reason. Reported as a spec contradiction below.

### D-i. §4.6 item 5 is EXECUTED by S1.6c and only VERIFIED by S1.6d

The checklist is the S1.6d review gate (§4.6 heading), not a to-do list of work
S1.6d must perform. Item 5 (`#preferredHandle` + clamp) is S1.6c's scope line in
§11. `model/TokenModel.ts:33-38` currently says S1.6d has four items "left" and
lists 5 among them — true as a gate, misleading as a work list. S1.6d therefore
*executes* items **2, 4 and 6** and *verifies* all four with greps (Task 16).

### D-j. S1.6b flips nothing. The browser suites already run the working tree

**Verified by implementation — every clause below was executed, not argued.**
The source-resolution probe fails as required; `dist` is untracked and
gitignored; CI never builds before `pnpm test`; exactly one storybook spec
touches core, through an API this plan does not change; and after a full run all
69 snapshot entries and `git status` are unchanged. **S1.6b needs no code
change.** Its one open question — the select-all browser gap — is **closed**: see
Task 3, which lands four real tests per adapter and un-skips the Ctrl+A case. (An
earlier draft recorded a "measured blocker" here — a Chromium cross-host selection
clamp. That claim was re-measured and is false; Task 3 Step 1 carries the
correction.)

Three measured facts:

1. **Only one storybook spec touches core at all.**
   `grep -rn "@markput/core" packages/storybook/src` returns exactly one hit
   (`pages/Base/Base.vue.spec.ts:1`, a `TokenPath` type import), and the same
   file deep-imports `Store` from `../../../../core/src/store/Store` (`:10`) for
   one test (`:109-138`) that spies on `store.tokens.children(path)`. That API
   is untouched by S1.6a and by this plan. Every other spec is black-box against
   `@markput/react` / `@markput/vue`.
2. **The suites resolve SOURCE, not `dist`.** `dist` is gitignored
   (`.gitignore:3`, `git ls-files packages/react/markput/dist` → empty) and
   CI's `tests` job runs `pnpm test` immediately after install with **no build
   step** (`.github/workflows/CI.yml:22-35`). A dist-resolving suite could never
   be green on a fresh clone. Task 1 Step 1 turns this argument into a probe
   rather than leaving it as an argument.
3. **They already passed at every S1.6a task boundary** (S1.6a plan, Verification
   status: "the React and Vue storybook browser projects actually running and
   passing").

So S1.6b's honest content is: **one probe, one gate, one manual A/B smoke, and
the browser gate for the select-all branch S1.6a's fix left unpinned.** It is
sized accordingly (three tasks, only the last of which produces a diff).
Inventing suite-migration work here would be theatre.

---

## File structure

### S1.6b

**Modify (at most):**

- `packages/storybook/src/pages/Base/keyboard.react.spec.tsx` (110) and
  `keyboard.vue.spec.ts` (102) — the three `it.todo`s become real tests, a fourth
  is added to gate the S1.6a `insertParagraph` fix, and the Ctrl+A `it.skip` is
  un-skipped with a corrected assertion (Task 3 Step 1). Each file also gains four
  local helpers (`getFirstEditable`, `selectAll`, `dispatchPasteEvent`,
  `dispatchBeforeInput`) — kept local rather than shared, matching the
  `getMarkFocusTarget` duplication these two files already carry.

**Do NOT touch:** anything in `packages/core`; the three stale PNGs under
`pages/Selection/__screenshots__/` (no `toMatchScreenshot` call remains — S1.8
step 1's pre-existing cruft, flag only); `Base.vue.spec.ts`'s deep import
(pre-existing).

### S1.6c

**Create:**

- `packages/core/src/features/tokens/tree/anchors.ts` — `anchorAt` (pure move
  out of `adopt.ts`), `offsetOfAnchor`, `anchorEquals`.
- `packages/core/src/features/tokens/tree/anchors.spec.ts`.

**Modify:**

- `tree/adopt.ts` (248) — the affinity flip; `anchorAt` moves out.
- `tree/adopt.property.spec.ts` (491) — the `want` formula.
- `tree/adopt.spec.ts` (515) — the named affinity fixtures.
- `model/TokenModel.ts` (497) — `anchorAt`/`offsetOf` delegations, the
  `SelectionPort` widening, `repair` in `onResult`, the `#seeded` comment.
- `store/Store.ts` (47) — the port thunk; `EditController` gains `props`.
- `features/edit/EditController.ts` (30) + `EditController.spec.ts` (91).
- `features/selection/SelectionController.ts` (205) — the swap.
- `features/selection/SelectionController.spec.ts` (404) — ~12 cases.
- `features/tokens/TokenModel.index.spec.ts` (160) — one `range(...)` write.
- `features/tokens/model/TokenModel.spec.ts` (393) — `createNew`'s `:66` third
  argument (`() => undefined`) becomes a `SelectionPort` stub (Task 9).
- `features/state/ValueModel.spec.ts` — one added `#seeded` gate.
- `features/selection/README.md` (59) — Public Surface + Watches.
- `packages/website/src/content/docs/guides/keyboard-handling.md` — the
  `store.selection.range({...})` sample (a *public guide* the swap falsifies).

**One unlisted structural consequence, called out because it is a new
cross-feature edge:** `SelectionController` must import `anchorEquals` and the
`NodeAnchor` type from `../tokens/tree/anchors`, and
`features/tokens/index.ts` — the token layer's "canonical export point" — exports
**neither**. So S1.6c either adds a deep import from `features/selection` into
`features/tokens/tree/`, or widens `features/tokens/index.ts`. Prefer widening
the barrel (`export {anchorEquals}` / `export type {NodeAnchor}`): the deep
import is the kind of edge the directory regroup exists to remove, and the
anchor pair is now genuinely part of the token layer's public contract. Either
way it is a decision, not an accident — record which you took.

**Do NOT touch:** `tokens/boundary.ts`, `caret.ts`, `textOffsets.ts`,
`DomModel.ts` (the DOM→offset direction keeps today's precision — see Task 8
Step 4), `clipboard/`, `overlay/`, `block/operations.ts`, any adapter.

### S1.6d

**Modify:**

- `tree/tree.ts` (84) — `rootIndexOf`, `siblingOf`.
- `model/TokenModel.ts` — the two delegations; `removedIds` deleted; the ledger
  comment.
- `keyboard/blockEdit.ts` (281), `keyboard/arrowNav.ts` (60).
- `model/commit.ts` (268) — the message; `removedIds`/`lastDelta`.
- `model/TokenHandle.ts` (230), `model/bind.ts` (257).
- `features/tokens/MarkController.ts` (130) + `MarkController.spec.ts` (397).
- `model/treePipeline.spec.ts` (805), `model/bind.spec.ts` (684),
  `model/TokenHandle.spec.ts` (325), `features/tokens/TokenHandle.spec.ts`
  (180), `model/TokenModel.spec.ts` (393), `TokenModel.index.spec.ts` (160).
- `tree/gapWindow.spec.ts` (99) — the frozen copy dies with its subject.
- `parser/types.ts` (76) — two stale reconcile comments.
- `features/block/BlockController.ts` (comment), `tree/adoptUtils.ts` (comment),
  `model/bind.ts:33` (comment), `features/tokens/README.md` (one section).

**Delete:** `features/tokens/tokenIdentity.ts` (378),
`tokenIdentity.spec.ts` (527), `tokenIdentity.property.spec.ts` (634).

**Size (touch surface, per the spec's instruction):**

| | S1.6b | S1.6c | S1.6d |
| --- | --- | --- | --- |
| Production read + verified | ~1,400 (adapters + storybook harness) | ~1,150 | ~1,500 |
| Production **edited** | 0 | ~260 | ~180 |
| Production **net-new** | 0 | ~120 | ~45 |
| Spec written / edited | ~180 (measured: +182/−18 across the two keyboard specs) | ~350 | ~150 |
| Spec **deleted** | 0 | 0 | ~1,200 |

---

## S1.6b — Browser suite flip (revert unit: Task 3's commit)

### Task 1: prove the browser projects run the working tree, then gate

**Files:** none (a probe that is reverted).

- [ ] **Step 1: The source-resolution probe**

The suites' green is worthless if they import a stale `packages/*/dist`. D-j
argues from CI that they cannot; prove it:

```bash
printf "\nthrow new Error('S1.6b source probe')\n" >> packages/core/src/store/Store.ts
pnpm -w exec vitest run --project react packages/storybook/src/pages/Base/Base.react.spec.tsx
git checkout packages/core/src/store/Store.ts
git status --porcelain   # must be empty for packages/
```

Expected: the run FAILS with `S1.6b source probe`. If it PASSES, stop — the react
project is resolving a built bundle and S1.6b has real work (a resolve alias),
which this plan did not scope.

Record the same for vue only if the react probe is ambiguous; one project is
enough to establish the resolution rule (both use the same workspace links).

- [ ] **Step 2: The full gate, from a clean tree**

Run: `pnpm run format && pnpm test && pnpm run build && pnpm run typecheck && pnpm run lint:check && pnpm run format:check`

Expected (S1.6a's measured final run, re-confirmed at `465b8211`): **72 files,
1281 passed, 2 skipped, 13 todo**. This is the PRE-Task-3 baseline and stays as
written; Task 3 moves it to 72 / 1291 / 0 skipped / 7 todo. Record the actual
numbers. A *much* lower file/test count means a project was filtered — say so
rather than reporting green.

- [ ] **Step 3: Snapshot discipline**

Run: `git status --porcelain`

Expected: empty. The 69 story snapshots (41 react + 28 vue) must not have been
rewritten. If any `.snap` is dirty, AGENTS.md forbids regenerating it: diff the
old and new structure, explain the change, and treat an unexplainable diff as a
regression — the cutover changed no rendering path, so a diff here is a finding,
not a chore.

- [ ] **Step 4: No commit**

Nothing changed. Carry the recorded numbers into Task 3's commit body.

---

### Task 2: manual smoke against a pre-cutover baseline (A/B), incl. the IME parity spot-check

**Files:** none.

The bar for IME is "matches today's behavior" (spec D10 descoped composition), and
**"matches" is only checkable against a baseline** — so this task runs every
scenario twice.

- [ ] **Step 1: Stand up the baseline**

`a35c41bc` is the commit immediately before the cutover (`d1032590`) and after
S1.6a's `beforeinput` fix, so it isolates the cutover from every other change on
`b0`:

```bash
git worktree add ../markput-s16b-baseline a35c41bc
cd ../markput-s16b-baseline && pnpm install
```

- [ ] **Step 2: Run the matrix on the baseline, then on `b0`**

For each side: `pnpm run dev:sb:react` (port 6006), then `pnpm run dev:sb:vue`
(6007). Run the baseline first and write the observations down BEFORE looking at
`b0` — a remembered baseline is not a baseline.

| # | scenario | story | what to record |
| --- | --- | --- | --- |
| 1 | typing | Base | characters appear at the caret; caret after the typed char; no re-render flicker on marks |
| 2 | overlay insert | Overlay | trigger opens; choosing inserts the mark; **where the caret lands** |
| 3 | cut / paste | Clipboard | cut removes and copies markup; paste reconstructs the mark; caret after the pasted mark |
| 4 | block drag | Drag | grip drag reorders; row menu add/delete/duplicate; **caret after a row merge (Backspace at row start)** |
| 5 | readOnly | Drag (readOnly) + Slots | no grips; `contenteditable="false"`; typing does nothing |
| 6 | controlled | any story with a `value` arg | typing in a controlled story: does the character appear, and where is the caret afterwards |
| 7 | **IME parity** | Base | see Step 3 |

- [ ] **Step 3: The IME spot-check procedure**

macOS: System Settings → Keyboard → Input Sources → add *Japanese – Romaji* (or
*Pinyin – Simplified*). In the Base story, for each side:

1. Type `nihon` — the composition should appear underlined; press Space
   (candidates), Enter (commit). Record what the field contains.
2. Start a composition and click OUTSIDE the editor mid-composition. Record what
   is committed and whether anything is duplicated.
3. Compose immediately BEFORE an existing mark. Record the mark's position and
   the caret afterwards.
4. Compose with everything selected (Cmd+A first). Record.

Pass = the two sides behave the same, including if both are bad. Any divergence
is a finding for the report, not a fix here (D10). If you cannot run a real IME,
say so explicitly — AGENTS.md forbids implying a check ran.

- [ ] **Step 4: Tear down**

```bash
cd - && git worktree remove ../markput-s16b-baseline
```

- [ ] **Step 5: No commit** — the output is the recorded matrix.

---

### Task 3: the select-all browser gap and the S1.6b commit — **DONE, tests landed**

**Files:** `packages/storybook/src/pages/Base/keyboard.react.spec.tsx`,
`packages/storybook/src/pages/Base/keyboard.vue.spec.ts`.

S1.6a fixed a live bug in exactly this branch (Enter with everything selected
wiped the value) and its only gate was the core suite. The browser suites carried
three `it.todo`s for it (`keyboard.react.spec.tsx:108-110`,
`keyboard.vue.spec.ts:100-102`) and an `it.skip` for Ctrl+A (`:92`, "It's not
working in browser mode, but works in real").

- [x] **Step 1: CORRECTION — the recorded blocker was WRONG. There is no clamp,
      and the gap is now closed by four real tests per adapter**

**An earlier draft of this task recorded a "measured blocker": that Chromium
clamps a cross-host `setBaseAndExtent` down to the first editing host, making
`isAllSelected()` unreachable from a browser test. That claim is FALSE. It was
re-measured on 2026-08-09 in both browser projects and every clause of it failed:**

1. **No clamp.** After
   `setBaseAndExtent(firstHostText, 0, lastHostText, len)` over the Base story
   (three separate `contenteditable` hosts), `anchorNode` IS the first host's text
   node at offset 0 and `focusNode` IS the last host's text node at its end.
   Measured on react and vue.
2. **Real Ctrl+A works too**, in the vitest-browser harness, with no Playwright
   escape hatch: `userEvent.click(container)` +
   `{ControlOrMeta>}a{/ControlOrMeta}` produces exactly the same cross-host
   selection. So the tests do not even need the programmatic form — they drive
   the real shortcut.
3. **`isAllSelected()` IS true and the branch IS reachable.** Discriminating
   probe (chosen because it cannot be satisfied by any other code path): dispatch
   `beforeinput{inputType:'insertFromPaste', dataTransfer:'PASTED'}` with **no**
   preceding `paste` event, so only the all-selected early return can no-op it.
   Result — full selection: value unchanged, `defaultPrevented: true`; partial
   selection (same probe, three characters selected): value becomes
   `'PASTEDlo @[mark](1)!'`. The branch runs.

**What IS true, and is the useful part of the original finding:
`Selection.prototype.toString()` truncates at the first editing host.** For the
full-editor selection above it answers `'Hello '` while
`getSelection().getRangeAt(0).toString()` answers `'Hello mark!'` —
i.e. `container.textContent`. *That*, not a clamped selection, is why the
`it.skip` at `keyboard.react.spec.tsx:92` failed: its assertion compares
`getSelection()?.toString()` against `container.textContent`. The premise of that
test was always sound; only its read was wrong.

**How the false claim happened, so the next reader can price it:** a single
failing assertion (`toString()` vs `textContent`) was attributed to the
selection rather than to the serializer, and the resulting story was written into
the plan as *measured* without a probe that could distinguish the two. A
behavioral probe on the value — not on the selection's own string form — is what
settles it, and is what the landed tests assert.

- [x] **Step 2: Land the tests (react + vue)**

Both keyboard specs now carry, in place of the three `it.todo`s and with the
`it.skip` un-skipped:

| test | drive | assertion |
| --- | --- | --- |
| `select all text with keyboard shortcut "Ctrl+A"` (was `it.skip`) | real Ctrl+A | `getRangeAt(0).toString() === container.textContent` — the assertion the skip *meant* to make |
| `replace all content when Ctrl+A then type` | real Ctrl+A + `userEvent.keyboard('X')` | `onChange` with `'X'` |
| `replace all content when Ctrl+A then paste` | real Ctrl+A + a `ClipboardEvent('paste')` carrying `text/plain` | `onChange` with `'pasted @[other](2)'` (markup survives) |
| `clear all content when Ctrl+A then delete` | real Ctrl+A + `userEvent.keyboard('{Delete}')` | `onChange` with `''` |
| `keep all content when Ctrl+A then Enter` (**the S1.6a gate**) | real Ctrl+A + synthetic `beforeinput{insertParagraph}` | `defaultPrevented === false`, `onChange` never called, text unchanged |

The Enter case is dispatched synthetically on purpose: an untrusted `beforeinput`
runs no default editing action, so `defaultPrevented` is an uncontaminated read
of what the handler did. Measured with a REAL `{Enter}` instead, the model value
is still intact (`onChange` never fires — the fix holds) but Chromium's own
default action mangles the cross-host DOM to `"\n\nmark!"`, which would make the
test assert the browser's behavior rather than ours.

**Mutation proof — each test dies alone** (`input.ts` mutated, run, reverted):

| mutation | dies |
| --- | --- |
| all-selected `beforeinput` branch reverted to its pre-S1.6a shape (`preventDefault()` + `replace({0,-1}, event.data ?? '')`) | **only** `keep all content when Ctrl+A then Enter`, both adapters |
| all-selected `beforeinput` replacement → `` `${replacement}Z` `` | only `…then type` |
| `handlePaste`'s replacement → `` `${newContent}Z` `` | only `…then paste` |
| `handleDeleteKey`'s all-selected replacement `''` → `'Z'` | only `…then delete` |

The first row is the one that matters: **pre-fix and post-fix are byte-identical
for `insertText`, `insertFromPaste` and the delete keydown**, so the Enter case is
the only one of the four that can gate S1.6a — which is why it exists on top of
the three todos.

**Pre-existing finding, NOT fixed here:** deleting `handleDeleteKey`'s
all-selected branch outright (`input.ts:35-39`) breaks none of the 16 tests in
these two files — the ordinary path below it receives the same full range and
produces the same empty value. The branch is redundant with its fallthrough.
Flagged for S1.6d/S1.8, out of scope for S1.6b.

- [x] **Step 3: Gate**

Run: `pnpm run format && pnpm test && pnpm run typecheck && pnpm run lint:check && pnpm run format:check`

- [x] **Step 4: Commit**

```bash
pnpm run format
git add packages/storybook/src/pages/Base
git commit -m "test(storybook): S1.6b browser suites verified against the tree core

The React and Vue browser projects resolve adapter and core SOURCE (dist is
gitignored and CI never builds before testing) and needed no migration: only
Base.vue.spec.ts touches core at all, through store.tokens.children(path), which
the cutover did not change. Recorded: <N files, N passed, N skipped, N todo>,
build/typecheck/lint/format clean, no story snapshot moved. Manual A/B smoke
against a35c41bc (pre-cutover) covered typing, overlay insert, cut/paste, block
drag, readOnly, controlled typing and an IME parity spot-check: <result>.

Closes the select-all browser gap S1.6a left unpinned: the three it.todos become
real tests and the Ctrl+A it.skip is un-skipped with a corrected assertion.
Chromium does NOT clamp a cross-host selection — what truncates is
Selection.prototype.toString(), which stops at the first editing host; the range's
own serialization is the honest read. A fourth test gates the S1.6a fix directly
(insertParagraph with everything selected must not be preventDefaulted and must
leave the value intact); it is the only one of the four that dies when the
all-selected branch is reverted to its pre-fix shape."
```

**Measured outcome: the commit lands with four real tests per adapter plus one
un-skipped test, not two comments.** The count moves by −6 todo and −2 skipped.

---

## S1.6c — Selection swap (revert unit: Tasks 6–11, individually)

### Task 6: `map` flips to right affinity (tree core, still unconsumed)

**Files:** `tree/adopt.ts`, `tree/adopt.property.spec.ts`, `tree/adopt.spec.ts`.

- [ ] **Step 1: Write the failing tests**

```ts
// append to packages/core/src/features/tokens/tree/adopt.spec.ts
const textAnchorOf = (anchor: NodeAnchor): {node: TextNode; offset: number} => {
	if (typeof anchor === 'string' || !('node' in anchor)) throw new Error('expected a text anchor')
	return anchor
}

describe('adopt: map affinity (spec D7, plan decision D-a)', () => {
	it('maps a caret AT an insertion point to the end of the inserted text', () => {
		// The whole decision in one assertion. LEFT affinity (the S1.3 shape) answered 5,
		// which parks the caret BEFORE the character the user just typed.
		const {result} = editAndAdopt('abcde', 5, 5, 'X')
		const anchor = textAnchorOf(result.map(5))
		expect(anchor.offset).toBe(6)
		expect(anchor.node.text()).toBe('abcdeX')
	})

	it('collapses an overtyped selection: both endpoints land on the replacement end', () => {
		// AC-3.3/3.4. Under LEFT affinity the anchor stays at 2 and the repair would
		// restore a one-character SELECTION instead of a caret.
		const {result} = editAndAdopt('abcde', 2, 5, 'X')
		expect(textAnchorOf(result.map(2)).offset).toBe(3)
		expect(textAnchorOf(result.map(5)).offset).toBe(3)
	})

	it('leaves an offset strictly before the window alone', () => {
		const {result} = editAndAdopt('abcde', 2, 5, 'X')
		expect(textAnchorOf(result.map(1)).offset).toBe(1)
	})

	it('a deletion is unaffected by the affinity', () => {
		// Both biases agree here; the case exists so a future "fix" that special-cases
		// deletions has a pin. Backspace at 5: window {4,5,0}, caret 5 → 4.
		const {result} = editAndAdopt('abcde', 4, 5, '')
		expect(textAnchorOf(result.map(5)).offset).toBe(4)
	})
})
```

`editAndAdopt` already exists (`adopt.spec.ts:14`). Add `NodeAnchor` and
`TextNode` to the existing `import type {MarkNode, TreeNode} from './types'`.

- [ ] **Step 2: Run to verify failure**

Run: `pnpm -w exec vitest run packages/core/src/features/tokens/tree/adopt.spec.ts`
Expected: the first two cases fail (6 vs 5; 3 vs 2), the last two pass.

- [ ] **Step 3: Flip the formula**

```ts
/**
 * Pre-adoption offset → post-adoption anchor (spec D7). RIGHT affinity: an offset AT the
 * window start moves to the end of the inserted text, so typing `X` at offset 5 of
 * `abcde` maps a pre-edit caret 5 to 6 and an overtyped selection collapses onto the
 * replacement (AC-3.3/3.4). Left affinity — what S1.3 shipped, when `map` had no consumer
 * — is what a selection anchor sitting at a foreign insertion point would want; nothing
 * in this codebase is that consumer, so there is ONE map and no affinity parameter
 * (plan decision D-a).
 *
 * A pure insertion (`start === end`) takes the second branch, not the third; both compute
 * `window.start + window.insertedLength`, so the branches agree.
 */
function resolveMappedAnchor(roots: readonly TreeNode[], offset: number, window: Window, delta: number): NodeAnchor {
	const mapped =
		offset < window.start ? offset : offset >= window.end ? offset + delta : window.start + window.insertedLength
	return anchorAt(roots, mapped)
}
```

- [ ] **Step 4: Follow the property — it IS the gate**

`adopt.property.spec.ts:431-433` asserts the formula for every offset of every
generated case (the `want` line is `:433`):

```ts
				// Outside the window the mapping is a pure shift; at or inside it the offset
				// collapses to the end of the inserted text (RIGHT affinity, plan decision D-a).
				const want = offset < c.start ? offset : offset >= c.end ? offset + delta : c.start + c.text.length
```

Run the property BEFORE editing it and confirm it is red on the old `want`; that
is the proof the flip is observable at scale, not just in the four fixtures.

- [ ] **Step 5: Gate**

Run: `pnpm run format && pnpm -w exec vitest run packages/core && pnpm run typecheck && pnpm run lint:check`
Expected: PASS. No production consumer exists yet, so nothing outside `tree/` can
move.

- [ ] **Step 6: Commit**

```bash
pnpm run format
git add packages/core/src/features/tokens/tree/adopt.ts \
        packages/core/src/features/tokens/tree/adopt.spec.ts \
        packages/core/src/features/tokens/tree/adopt.property.spec.ts
git commit -m "feat(tree): S1.6c map uses right affinity at an insertion point

A pre-edit caret at the window start now maps to the end of the inserted text
(AC-3.3/3.4), which is what the S1.6c caret repair needs and what no consumer
needed before — map had none until now. One map, no affinity parameter: nothing
in the repo wants the left bias. The mapping property pinned the old formula and
is updated with it."
```

---

### Task 7: the anchor module — `offsetOfAnchor` and `anchorEquals`

**Files:** create `tree/anchors.ts`, `tree/anchors.spec.ts`; modify
`tree/adopt.ts`, `model/TokenModel.ts`.

- [ ] **Step 1: Pure move**

Move `anchorAt` verbatim out of `adopt.ts` into a new `tree/anchors.ts` and
import it back. It has **no importer outside `adopt.ts`** (S1.8's inventory
listed its `export` as dead surface — it is about to gain a production caller,
which is a finding for that phase, see Contradictions), so the move is a clean
two-file diff.

**Do not try to verify it with `git diff -M --stat`.** Rename detection is
whole-file, and `anchors.ts` is a *new* file containing `anchorAt` plus roughly
35 new lines (`offsetOfAnchor`, `anchorEquals`, their doc comments and imports),
so it will never score as a rename. Verify the move by eye instead: the moved
body must be byte-identical to what left `adopt.ts`.

- [ ] **Step 2: Write the failing tests**

They will not fail on an assertion. `anchors.spec.ts` imports `anchorEquals` and
`offsetOfAnchor`, which do not exist until Step 3, so the **spec fails to import
and `typecheck` fails** — that is the expected red, and it is a weaker signal
than a failing assertion. If you want a real red-then-green, land Step 3's two
function bodies as `throw new Error('not implemented')` stubs first.

```ts
// packages/core/src/features/tokens/tree/anchors.spec.ts
import {describe, expect, it} from 'vitest'

import {Parser} from '../parser/Parser'
import {anchorAt, anchorEquals, offsetOfAnchor} from './anchors'
import {createTokenTree} from './tree'

const parser = new Parser(['@[__value__]'])
const build = (source: string) => createTokenTree(parser.parse(source))

describe('offsetOfAnchor', () => {
	it('resolves a text anchor through its node position', () => {
		const tree = build('ab@[x]cd') // text[0,2] mark[2,6] text[6,8]
		const cd = tree.roots()[2]
		if (cd.kind !== 'text') throw new Error('expected text')
		expect(offsetOfAnchor(tree.roots(), {node: cd, offset: 1})).toBe(7)
	})

	it('resolves the boundary forms to the node edges', () => {
		const tree = build('ab@[x]cd')
		const mark = tree.roots()[1]
		expect(offsetOfAnchor(tree.roots(), {before: mark})).toBe(2)
		expect(offsetOfAnchor(tree.roots(), {after: mark})).toBe(6)
	})

	it("resolves 'end' against the LAST ROOT, not against a captured length", () => {
		// Tree space, not `value.current()` space (plan decision D-d): in controlled mode
		// props.value is already the NEXT value when the echo's capture runs, and a length
		// read there would put `selectionBefore` outside the space `map` is defined on.
		const tree = build('ab@[x]cd')
		expect(offsetOfAnchor(tree.roots(), 'end')).toBe(8)
		expect(offsetOfAnchor(tree.roots(), 'start')).toBe(0)
	})

	it("answers 0 for both edges of an empty tree", () => {
		const tree = createTokenTree([])
		expect(offsetOfAnchor(tree.roots(), 'end')).toBe(0)
	})

	it('round-trips anchorAt for every offset of a document', () => {
		// The two are inverses on anchorable offsets; markup interiors resolve to the
		// mark's trailing boundary, which is why the mark span is excluded (spec §2.3).
		const tree = build('ab@[x]cd')
		for (const offset of [0, 1, 2, 6, 7, 8]) {
			expect(offsetOfAnchor(tree.roots(), anchorAt(tree.roots(), offset)), `offset ${offset}`).toBe(offset)
		}
	})
})

describe('anchorEquals', () => {
	it('compares node identity and local offset', () => {
		const tree = build('ab@[x]cd')
		const ab = tree.roots()[0]
		const cd = tree.roots()[2]
		if (ab.kind !== 'text' || cd.kind !== 'text') throw new Error('expected text')
		expect(anchorEquals({node: ab, offset: 1}, {node: ab, offset: 1})).toBe(true)
		expect(anchorEquals({node: ab, offset: 1}, {node: ab, offset: 2})).toBe(false)
		// SAME OFFSET, DIFFERENT NODE — the case a numeric range cannot express and the
		// reason `#preferredHandle` existed.
		expect(anchorEquals({node: ab, offset: 2}, {node: cd, offset: 0})).toBe(false)
	})

	it('distinguishes the boundary forms and the edges', () => {
		const tree = build('ab@[x]cd')
		const mark = tree.roots()[1]
		expect(anchorEquals({before: mark}, {after: mark})).toBe(false)
		expect(anchorEquals('start', 'start')).toBe(true)
		expect(anchorEquals('start', 'end')).toBe(false)
		expect(anchorEquals(undefined, undefined)).toBe(true)
		expect(anchorEquals(undefined, 'start')).toBe(false)
	})
})
```

- [ ] **Step 3: Implement**

```ts
/**
 * The inverse of {@link anchorAt}: an anchor's absolute offset in the TREE's projection.
 *
 * Tree space, deliberately — not `value.current()`, which is props-first in controlled
 * mode. The two disagree exactly while a parent's `props.value` is ahead of the last
 * arrival, and `selectionBefore` must be captured in the space `map` consumes (spec D7).
 *
 * `'end'` is the last root's end rather than a length, so an out-of-range intent
 * self-limits without arithmetic — that is what replaces the deleted selection clamp
 * (spec §4.6 item 5).
 */
export function offsetOfAnchor(roots: readonly TreeNode[], anchor: NodeAnchor): number {
	if (anchor === 'start') return 0
	if (anchor === 'end') return roots.length > 0 ? roots[roots.length - 1].position.end : 0
	if ('node' in anchor) return anchor.node.position.start + anchor.offset
	if ('before' in anchor) return anchor.before.position.start
	return anchor.after.position.end
}

/**
 * Identity of an anchor: the node OBJECT plus the local offset. This is what the stored
 * selection dedupes on — the DOM sync rebuilds anchors on every `selectionchange`, and
 * without value equality every sweep tick would re-place the caret.
 */
export function anchorEquals(a: NodeAnchor | undefined, b: NodeAnchor | undefined): boolean {
	if (a === b) return true // covers undefined and the two string edges
	if (a === undefined || b === undefined || typeof a === 'string' || typeof b === 'string') return false
	if ('node' in a) return 'node' in b && a.node === b.node && a.offset === b.offset
	if ('before' in a) return 'before' in b && a.before === b.before
	return 'after' in b && a.after === b.after
}
```

**Do NOT rewrite `adopt.property.spec.ts`'s local `resolve` helper
(`:406-418`) to call `offsetOfAnchor`.** Its independence is the point: a
property gated by the production function it is testing is circular. Leave a
one-line comment there saying so, so the next reader does not "deduplicate" it.

- [ ] **Step 4: The `TokenModel` delegations**

```ts
	/**
	 * Spec §2.3: a global offset → the node anchor at it (right affinity). THE
	 * offset→anchor direction for the selection write path.
	 *
	 * Seeds for the same reason {@link replace} does (plan decision D-f): an
	 * unmaterialized tree has no roots, so every offset would answer `'end'`. The bare
	 * function is the module import — this method does not recurse.
	 */
	anchorAt(offset: number): NodeAnchor {
		this.#ensureSeeded()
		return untracked(() => anchorAt(this.#tree.roots(), offset))
	}

	/**
	 * Spec §2.3's `selectionRange` half: an anchor's absolute offset in the tree's
	 * projection. Deliberately does NOT seed — it is a READ reached from
	 * `SelectionController.range`'s computed, and seeding inside a computed evaluation
	 * would write signals during evaluation.
	 */
	offsetOf(anchor: NodeAnchor): number {
		return untracked(() => offsetOfAnchor(this.#tree.roots(), anchor))
	}
```

- [ ] **Step 5: Gate**

Run: `pnpm run format && pnpm -w exec vitest run packages/core && pnpm run typecheck && pnpm run lint:check`

- [ ] **Step 6: Commit**

```bash
pnpm run format
git add packages/core/src/features/tokens/tree/anchors.ts \
        packages/core/src/features/tokens/tree/anchors.spec.ts \
        packages/core/src/features/tokens/tree/adopt.ts \
        packages/core/src/features/tokens/model/TokenModel.ts
git commit -m "feat(tokens): S1.6c anchor resolution — offsetOfAnchor, anchorEquals, and the two TokenModel delegations

anchorAt moves next to its inverse (pure move). offsetOfAnchor resolves in TREE
space, not value space: in controlled mode props.value is already the next value
when an echo's selection capture runs. anchorAt seeds the tree because it is on
the selection write path and an unmaterialized tree answers 'end' for every
offset."
```

---

### Task 8: `SelectionController` stores anchors (`#preferredHandle` and the clamp die)

**Files:** `features/selection/SelectionController.ts`,
`features/selection/SelectionController.spec.ts`,
`features/tokens/TokenModel.index.spec.ts`,
`features/state/ValueModel.spec.ts`, `model/TokenModel.ts` (one comment).

- [ ] **Step 1: The stored form and the derived read**

```ts
type Anchors = {anchor: NodeAnchor; head: NodeAnchor}

export class SelectionController {
	/**
	 * THE stored selection (spec D7/G4): node anchors, not offsets. Equality is anchor
	 * IDENTITY — the DOM sync rebuilds anchors on every `selectionchange`, so without it
	 * a mouse sweep would re-enter placement on every tick (the job today's
	 * `{equals: shallow}` on the numeric range did).
	 */
	readonly #anchors: Signal<Anchors | undefined> = signal<Anchors>({
		equals: (a, b) => anchorEquals(a?.anchor, b?.anchor) && anchorEquals(a?.head, b?.head),
	})

	/**
	 * Bumped once per adoption by {@link repair}. Stored positions are plain fields
	 * (spec D3), so nothing else can invalidate a derived offset when adoption shifts
	 * them — and an anchor that survives an edit UNCHANGED (AC-3.2) must still resolve to
	 * its new absolute offset. This is the only reason `range` is not a pure computed
	 * over `#anchors`.
	 */
	readonly #generation: Signal<number> = signal({initial: 0})

	/**
	 * DERIVED (spec D7): the numeric range every offset-speaking consumer still reads —
	 * `isAllSelected`, `OverlayController`'s trigger probe, the boundary's pre-adoption
	 * capture. Read-only: the stored form is `#anchors`, and `select`/`position` are the
	 * writes.
	 */
	readonly range: Computed<Range | undefined> = computed(
		() => {
			this.#generation()
			const anchors = this.#anchors()
			if (!anchors) return undefined
			const anchor = this.tokens.offsetOf(anchors.anchor)
			const head = this.tokens.offsetOf(anchors.head)
			return anchor <= head ? {start: anchor, end: head} : {start: head, end: anchor}
		},
		{equals: shallow}
	)

	readonly position = computed({
		get: () => this.range()?.start,
		set: value => {
			// The undefined arm is unreachable: a writable computed short-circuits an
			// `undefined` write before the setter runs (shared/signals/signal.ts's
			// `writableComputedOper`), which is why the pre-anchor version's clear branch was
			// dead. Kept as a type narrow only.
			if (value !== undefined) this.select(this.tokens.anchorAt(value))
		},
	})

	/**
	 * @internal THE write (spec D7's stored form). `selectAll`, `position`,
	 * `placeAtHandle` and the DOM sync all go through it; S1.7 promotes it to §2.3's
	 * `input.select`. Returns whether the stored selection actually changed.
	 */
	select(anchor: NodeAnchor, head: NodeAnchor = anchor): boolean {
		return this.#anchors({anchor, head})
	}
```

`isAllSelected` and `isUserSelecting` are copied over untouched.

- [ ] **Step 2: Placement without the stash and without the clamp**

```ts
	selectAll(): void {
		// Node anchors, not the `'start'`/`'end'` edges: a later edit that grows the value
		// must NOT keep `isAllSelected` true, and edge anchors would.
		this.select(this.tokens.anchorAt(0), this.tokens.anchorAt(this.value.current().length))
	}

	placeAtHandle(handle: TokenHandle, boundary: 'start' | 'end' = 'start'): boolean {
		// A dead or mid-window handle fails closed; alive() is the mount check.
		if (!handle.alive()) return false
		const node = this.tokens.find(handle.id)
		if (!node) return false
		// The NODE is the disambiguator two tokens sharing a boundary offset need — the job
		// the consume-once `#preferredHandle` stash did (spec §4.6 item 5). A mark has no
		// anchorable interior (spec §2.3), so it answers with its own boundary.
		const anchor: NodeAnchor =
			node.kind === 'text'
				? // The length comes from `position`, not `text()`: that is the coordinate space
					// the anchor resolves in, and reading the signal would add a dependency.
					{node, offset: boundary === 'end' ? node.position.end - node.position.start : 0}
				: boundary === 'end'
					? {after: node}
					: {before: node}
		// Re-apply even when the write dedupes: the DOM caret may have moved since.
		if (!this.select(anchor)) this.#applySelection()
		return true
	}

	#applySelection(): void {
		if (this.isUserSelecting()) return
		const anchors = this.#anchors()
		if (anchors === undefined) return

		// NO CLAMP (spec §4.6 item 5): an anchor cannot point past its own node, `anchorAt`
		// answers `'end'` for an out-of-range offset, and `TokenHandle.placeCaret` bounds
		// the local offset to the surface it places in. There is nothing left to clamp and
		// nothing to write back.
		this.#isPlacingCaret = true
		try {
			if (anchorEquals(anchors.anchor, anchors.head)) {
				this.#placeAt(anchors.head)
				return
			}
			const range = this.range()
			if (range) this.tokens.selectRange(range.start, range.end)
		} finally {
			this.#isPlacingCaret = false
		}
	}

	/**
	 * Collapsed placement through the anchor's OWN node: the handle places a LOCAL offset
	 * inside its own surface, so it cannot pick the wrong node at a shared boundary and it
	 * never converts to an absolute coordinate (which would resolve against
	 * bind-generation positions, spec D9). The raw fallback covers an anchor whose node
	 * has no bound handle yet — the latch-gated `handle(id)` serves `undefined` during the
	 * pending window, exactly as the old stash did.
	 */
	#placeAt(anchor: NodeAnchor): boolean {
		const target = anchorTarget(anchor)
		if (target) {
			const handle = this.tokens.handle(target.id)
			if (handle?.alive() && handle.placeCaret(target.offset)) return true
		}
		return this.tokens.placeCaret(this.tokens.offsetOf(anchor))
	}
}

/** Id and local offset of an anchor's own node; undefined for the document edges. */
function anchorTarget(anchor: NodeAnchor): {id: number; offset: number} | undefined {
	if (typeof anchor === 'string') return undefined
	if ('node' in anchor) return {id: anchor.node.id, offset: anchor.offset}
	if ('before' in anchor) return {id: anchor.before.id, offset: 0}
	return {id: anchor.after.id, offset: Infinity}
}
```

`TokenHandle.placeCaret` treats a surface-less mark as `offset <= 0 ? 'start' :
'end'` and `Infinity` as "the end of the text surface"
(`model/TokenHandle.ts:148-161`), so `{before}`/`{after}` reproduce today's
`placeAtHandle` outcomes exactly.

- [ ] **Step 3: The watches**

```ts
			watch(this.tokens.changed, () => this.#applySelection())
			watch(this.props.readOnly, () => this.#applyEditablePolicy())
			watch(this.isUserSelecting, () => this.#applyEditablePolicy())
			// The STORED anchors, not the derived `range` — MEASURED, not stylistic. `range`
			// dedupes on `shallow`, so at a shared boundary `placeAtHandle` changes the anchor
			// without changing the number and a `range` watch NEVER FIRES: the caret is simply
			// not placed (6 browser failures across react and vue, the three focus specs).
			// Separately, `range` also moves when adoption shifts positions, and re-placing on
			// that would fight the DOM after every commit; the post-commit re-place is the
			// `tokens.changed` watch above, which fires only once the DOM is consistent.
			watch(this.#anchors, () => this.#applySelection())
```

**This is the single most load-bearing line in the task** (Task 10 mutation 7).
An earlier draft called the choice "a design choice, not a defect boundary" and
predicted the `range` variant survived. It does not.

- [ ] **Step 4: The DOM sync keeps its precision — and MUST NOT clobber an anchor
      it cannot see**

**This is the step that broke the live editor in the verification pass. Read the
mechanism before you write the code.**

```ts
		const sync = (): void => {
			const raw = this.readRaw()?.range
			// GUARD, and it is load-bearing (measured): the DOM→anchor round-trip is NOT
			// idempotent. `readRaw` answers an absolute offset; `anchorAt` is right-affine, so
			// it re-resolves a shared boundary onto the LAST node containing that offset. An
			// anchor deliberately placed on the OTHER side — every `{before}`, every `{after}`,
			// every end-of-text anchor `placeAtHandle` stores — therefore comes back as a
			// DIFFERENT anchor with the SAME number. Without this guard `anchorEquals` says
			// "changed", the `#anchors` watch fires, and the async `selectionchange` drags
			// focus back onto the neighbouring text node. Rewriting only when the NUMBER moved
			// keeps the DOM as the authority for user-driven selection while leaving a
			// programmatic anchor that already agrees with the DOM alone.
			const current = this.range()
			if (raw && current && current.start === raw.start && current.end === raw.end) return
			// STILL a round-trip through absolute offsets: `readRaw` resolves the DOM against
			// BIND-GENERATION positions (spec D9) while `anchorAt` resolves against live ones,
			// so during the adopt→bind window the two spaces can disagree. Improving that means
			// a DOM-node→TreeNode path through `handleAt`, which would have to re-implement
			// `boundaryFor`'s container/child-sequence/mark cases. Out of scope here; recorded
			// so it is a decision, not an oversight.
			this.#anchors(
				raw ? {anchor: this.tokens.anchorAt(raw.start), head: this.tokens.anchorAt(raw.end)} : undefined
			)
		}
```

**Why the guard is mandatory, measured.** Without it, **6 browser tests fail
across React and Vue**: "support ref focusing target", "support focus navigation
between spans", and "move focus to the mark row on Backspace/Delete at mark
boundary". Mechanism: `placeAtHandle` stores `{before: mark}`; the async
`selectionchange` runs `sync()`, which reads the DOM back as an absolute offset
and re-resolves it with the right-affine `anchorAt`, answering
`{node: prevText, offset: len}` — same number, different anchor. The write is
NOT deduped, the watch fires, and focus is dragged onto the text node.

**An earlier draft of this step asserted the opposite** — "that is exactly
today's precision — the numeric range was stored from the same read". That is
false and worth understanding, because it is the trap this whole task walks
into: **today** the stored form IS the number, so the round-trip is a fixed
point by construction. **Anchors are not a fixed point of `anchorAt ∘ offsetOf`
at ANY shared boundary.** Changing the stored form changes what "the same read"
means.

**Task 8 Step 8's fold-in-Task-9 escape hatch does NOT rescue this** — verified
with Task 9 fully present. It is not an arrival-refresh problem; it is a
round-trip identity problem, and only the guard fixes it.

The three `this.range(undefined)` clears in `#trackSelection` become
`this.#anchors(undefined)`. Direction is lost, as it is today.

- [ ] **Step 5: Follow the specs — the mechanical edits**

`range` is no longer writable. Every write becomes `position(n)` (collapsed) or
`select(tokens.anchorAt(a), tokens.anchorAt(b))` (ranged). Hand-traced
expectations, all preserved unless marked:

| spec | change | expected |
| --- | --- | --- |
| `SelectionController.spec.ts:92` | `range({5,5})` ×2 → `placeAtHandle(handle,'start')` ×2 on a mounted store | notify once. **It does NOT gate `anchorEquals`** — an earlier draft claimed it "now gates `anchorEquals` where the numeric version gated `shallow`", which is false: `range` keeps `{equals: shallow}` whatever `#anchors` does, so dropping the anchor equality walks straight through this case. See Task 10 mutation 3 for the case that does gate it. Keep a second case with `position(5)` ×2 for the writable-computed short-circuit. |
| `:102` | `range(undefined)` → `position(undefined)` | still a no-op, still zero notifications |
| `:112-136` (`position` describe) | add `defaultValue: 'hello'` to the three bare stores; `range({5,5})` → `position(5)`; `:131`'s extended range → `selectAll()` then `position(3)` | unchanged assertions |
| `:143-159` (`isAllSelected`) | `range({2,2})` → `position(2)`; `range({1,3})` → `select(anchorAt(1), anchorAt(3))`; `range({0,5})` → `selectAll()` | unchanged assertions |
| `:164`, `:184` (`selectAll`) | **no change** — `anchorAt` seeds (D-f), so the unmounted case still reports `{0,5}` |
| `:205`, `:224`, `:245` | **no change** |
| `:260` | `range({999,999})` → `position(999)` | `{5,5}` — **the assertion survives the clamp's deletion**: `anchorAt(999)` answers `'end'`, which resolves to 5 |
| `:276` | `range({999,1000})` → `select(anchorAt(999), anchorAt(1000))` | `{5,5}` — both anchors are `'end'`, so `anchorEquals` makes it collapsed |
| `TokenModel.index.spec.ts:111` | `range({0,0})` → `position(0)` | still "does not throw" |

- [ ] **Step 6: Re-establish the `#seeded` gate this task destroys**

`model/TokenModel.ts:137-144` names `SelectionController.spec`'s `isAllSelected ›
returns true …` and `selectAll › retains range intent …` as the gates on
`value`'s `#seeded` arm, because both read the value on an UNSEEDED store. After
D-f they seed. Prove it and replace it:

```ts
// packages/core/src/features/state/ValueModel.spec.ts — append
it('an unmounted store reads defaultValue before anything has committed', () => {
	// THE gate on TokenModel.value's `#seeded` arm, which S1.6c took over from two
	// SelectionController cases (they now seed the tree through `anchorAt`). Measured:
	// reducing the getter to `props.value() ?? this.#committed()` returns '' here,
	// because nothing has committed yet.
	const store = new Store()
	store.props.set({defaultValue: 'hello'})
	expect(store.value.current()).toBe('hello')
})
```

Run the mutation (`value` → `props.value() ?? this.#committed()`), confirm THIS
case goes red and the two old ones stay green, revert, and rewrite the comment at
`TokenModel.ts:137-144` to name the new gate.

- [ ] **Step 7: Gate — the FULL suite, not just core**

Run: `pnpm run format && pnpm test && pnpm run typecheck && pnpm run lint:check`

**`pnpm test`, deliberately.** This is one of exactly two tasks measured to leave
`pnpm -w exec vitest run packages/core` green while the browser projects are RED
(the Step 4 round-trip; 6 failures across react and vue). A core-only gate here
lands a broken commit and the executor discovers it two tasks later. If a
browser failure looks transient, re-run it in isolation before acting — the
projects are flaky under parallel load — but the Step 4 failures are
deterministic and name the three specs above.

- [ ] **Step 8: If the suite is red for an ARRIVAL reason, fold Task 9 in**

Without repair the stored anchor is not refreshed by an adoption. Every
DOM-driven edit still refreshes it (`EditController` writes `position(...)`
afterwards), so this task is expected green — but an arrival-driven path
(controlled echo, external `props.value`, `reparse`) has no such write and can
leave the anchor on a removed node, where `#placeAt` falls back to raw placement
against a stale offset. If that is what a red spec shows, **do not patch around
it**: implement Task 9 and commit the two together. Say which you did.

**The measured red in this task is NOT an arrival reason** and folding Task 9 in
does not fix it — verified with Task 9 fully present. If the failures are the
three focus specs named in Step 4, the answer is Step 4's guard.

- [ ] **Step 9: Commit**

```bash
pnpm run format
git add packages/core/src/features/selection packages/core/src/features/tokens/model/TokenModel.ts \
        packages/core/src/features/tokens/TokenModel.index.spec.ts \
        packages/core/src/features/state/ValueModel.spec.ts
git commit -m "refactor(selection): S1.6c node-anchored selection replaces the stored range

SelectionController stores {anchor, head} NodeAnchors; the numeric Range is a
derived read-only computed over them plus a per-adoption generation (positions
are plain fields, spec D3, so nothing else invalidates it). Deleted with the
swap: the #preferredHandle consume-once stash (the anchor's node is the
disambiguator) and #applyRange's clamp plus its write-back (an anchor cannot
exceed its node, 'end' is the document edge, and TokenHandle.placeCaret already
bounds the local offset) — spec §4.6 item 5.

BEHAVIOR: a collapsed caret is now placed through its own node's handle at a
LOCAL offset instead of through an absolute position, so it can no longer pick
the neighbouring token at a shared boundary. An out-of-range caret intent
resolves to the document end instead of being clamped and written back.
selection.range is no longer writable; use position(n) or select(anchor, head)."
```

---

### Task 9: caret repair — `selectionBefore` gains its consumer

**Files:** `model/TokenModel.ts`, `store/Store.ts`,
`features/edit/EditController.ts`, `features/selection/SelectionController.ts`,
`features/edit/EditController.spec.ts`,
`features/selection/SelectionController.spec.ts`,
**`features/tokens/model/TokenModel.spec.ts`** — `createNew` at `:66` constructs
`new TokenModel(propsModel, host, () => undefined)`; the third argument must
become a `SelectionPort` stub (`() => ({range: () => undefined, repair: () => {}})`)
or the file does not typecheck.

- [ ] **Step 1: Write the failing tests**

```ts
// packages/core/src/features/selection/SelectionController.spec.ts — append
describe('caret repair (spec D7, AC-3.2/3.3/3.4)', () => {
	/**
	 * `store.value.replace` — NOT `store.edit.replace`. EditController writes the caret
	 * itself afterwards, which would mask everything these cases assert.
	 */
	it('keeps node and offset when the edit is outside the anchor, and still reports the NEW offset', () => {
		// AC-3.2 and the #generation gate in one case, hand-traced:
		//   'ab@[x]cd' → text[0,2] mark[2,6] text[6,8]; caret 7 = {node: cd, offset: 1}.
		//   insert 'Z' at 0 → window {0,0,1} → map(7) = 8 → anchorAt(8) → cd is now [7,9]
		//   → {node: cd, offset: 1} — the SAME node object and the SAME local offset, so
		//   the `#anchors` write is deduped and notifies nothing. Only the generation bump
		//   makes range() answer 8; without it the computed returns the cached 7.
		const {store} = mountStructuralInlineMark('ab@[x]cd')
		store.selection.position(7)
		expect(store.selection.range()).toEqual({start: 7, end: 7})

		store.value.replace({start: 0, end: 0}, 'Z')

		expect(store.value.current()).toBe('Zab@[x]cd')
		expect(store.selection.range()).toEqual({start: 8, end: 8})
	})

	it('maps a caret inside the edited region to the end of the inserted text', () => {
		// AC-3.3. Caret 7 (inside 'cd'), replace [6,8] with 'ZZZZ' → window {6,8,4} →
		// map(7) → 6 + 4 = 10.
		const {store} = mountStructuralInlineMark('ab@[x]cd')
		store.selection.position(7)

		store.value.replace({start: 6, end: 8}, 'ZZZZ')

		expect(store.selection.range()).toEqual({start: 10, end: 10})
	})

	it('survives the anchor node being REMOVED by the transaction', () => {
		// AC-3.3's second half. Whole-value write: gapWindow('ab@[x]cd','zz') = {0,8,2};
		// adoption pairs by index, so root 0 is retained and the mark AND 'cd' — the
		// anchor's node — are removed. map(7) → inside the window → 0 + 2 = 2.
		const {store} = mountStructuralInlineMark('ab@[x]cd')
		store.selection.position(7)

		store.value.replace({start: 0, end: -1}, 'zz')

		expect(store.value.current()).toBe('zz')
		expect(store.selection.range()).toEqual({start: 2, end: 2})
	})

	it('maps a cross-node replacement spanning a mark to the end of the replacement', () => {
		// AC-3.4. Caret 8 (document end), replace [1,7] with 'Q' → 'aQd', window {1,7,1},
		// delta -5 → map(8) = 3.
		const {store} = mountStructuralInlineMark('ab@[x]cd')
		store.selection.position(8)

		store.value.replace({start: 1, end: 7}, 'Q')

		expect(store.value.current()).toBe('aQd')
		expect(store.selection.range()).toEqual({start: 3, end: 3})
	})

	it('leaves the selection alone when there was none', () => {
		const {store} = mountStructuralInlineMark('ab@[x]cd')
		expect(store.selection.range()).toBeUndefined()
		store.value.replace({start: 0, end: 0}, 'Z')
		expect(store.selection.range()).toBeUndefined()
	})
})

describe('controlled caret (spec AC-4.4)', () => {
	it('repairs at the echo, once, with no optimistic move', () => {
		// THE integration gate for plan decisions D-a AND D-e simultaneously:
		//   left affinity answers 3 → range {2,2} after the echo;
		//   keeping the optimistic write answers {4,4} (the captured caret is already 3).
		const store = new Store()
		store.props.set({value: 'hello', onChange: next => store.props.set({value: next})})
		// … mount with a single text surface (see mountStructuralInline) …
		store.selection.position(2)

		store.edit.replace({start: 2, end: 2}, 'X')

		expect(store.value.current()).toBe('heXllo')
		expect(store.selection.range()).toEqual({start: 3, end: 3})
	})

	it('a rejecting parent moves no caret at all', () => {
		const store = new Store()
		const onChange = vi.fn()
		store.props.set({value: 'hello', onChange})
		// … mount …
		store.selection.position(2)

		store.edit.replace({start: 2, end: 2}, 'X')

		expect(onChange).toHaveBeenCalledWith('heXllo')
		expect(store.value.current()).toBe('hello')
		expect(store.selection.range()).toEqual({start: 2, end: 2})
	})

	it('a transforming parent still repairs, through the gap window', () => {
		const store = new Store()
		store.props.set({value: 'hello', onChange: next => store.props.set({value: next.toUpperCase()})})
		// … mount …
		store.selection.position(2)

		store.edit.replace({start: 2, end: 2}, 'X')

		expect(store.value.current()).toBe('HEXLLO')
		// gapWindow('hello','HEXLLO') = {0,5,6}; map(2) is inside → 0 + 6 = 6. Best effort,
		// which is what AC-4.2/4.4 promise for a transform; assert what it IS, and if the
		// measured number differs from this hand-trace, TRUST THE RUN and fix this line.
		expect(store.selection.range()).toEqual({start: 6, end: 6})
	})
})
```

`mountStructuralInlineMark(value)` exists at `SelectionController.spec.ts:26`
(it configures `{Mark: () => null, options: [{markup: '@[__value__]'}]}` and
builds `before`/`mark`/`after` spans) — the `ab@[x]cd` fixture has exactly that
three-root shape.

- [ ] **Step 2: Run to verify failure**

Expected: the AC-3.2 case fails on `{7,7}` (no generation bump, no repair); the
AC-3.3/3.4 cases fail on stale offsets; the controlled echo case fails on
`{4,4}`.

- [ ] **Step 3: The port**

```ts
// model/TokenModel.ts
/**
 * The selection's two ends of the D7 protocol. A THUNK in `Store` because `tokens` is
 * built before `selection`; invoked only at commit/arrival time, never during
 * construction.
 */
export interface SelectionPort {
	/** Pre-adoption capture (spec D7), in the TREE's coordinate space. */
	range(): Range | undefined
	/** Post-adoption repair (spec D7): consumes `selectionBefore` + `map`. */
	repair(result: TransactionResult): void
}
```

Constructor parameter `selectionBefore: () => Range | undefined` becomes
**`selectionPort: () => SelectionPort`** — **NOT `selection`**; the boundary dep
becomes `selection: () => this.selectionPort().range()`; and:

```ts
		onResult: result => {
			this.#pipeline.apply(fromTransaction(result, this.#memo, this.#tree.roots()))
			this.#committed(this.#tree.value())
			// LAST, and inside the commit: the repair writes the selection the `#anchors`
			// watch then applies, and an imperative post-edit caret (`EditController`) lands
			// later in the same batch and wins by design (plan decision D-d).
			this.selectionPort().repair(result)
		},
```

**Do not "simplify" the parameter name to `selection`.** `TokenModel` already
has `selection(): SelectionSnapshot | undefined` (the Engine SPI method), and
`TokenModel.ts:245-249` records this exact experiment as measured-broken.
Re-measured in the verification pass: `TS2300` / `TS2403` / `TS2687` at `:287`,
`TS2532` / `TS2339` at `:409` and `:424`, and `TS2741` at `Store.ts:21`. The
task does not compile. Re-word that comment for the widened type rather than
deleting it — it is the only thing standing between the next reader and the same
hour.

`Store.ts`: `new TokenModel(this.props, this.host, () => this.selection)` — the
annotation-on-both-sides-of-the-cycle rule (TS7022) is unchanged.

- [ ] **Step 4: `repair`**

```ts
	/**
	 * @internal Post-adoption caret repair (spec D7, §4.5). Called by the token layer
	 * inside the commit, after the pipeline applied — never by anything else.
	 *
	 * The anchor can never dangle: `selectionBefore` is DERIVED from these same anchors
	 * (the capture thunk is this controller's `range`), so it is defined exactly when they
	 * are, and every adoption that could remove an anchor's node re-derives it here.
	 * `map` resolves against the post-adoption roots and is property-proven never to
	 * answer with a dead node (`tree/adopt.property.spec.ts`).
	 */
	repair(result: TransactionResult): void {
		// Unconditional: positions move whether or not there is a selection, and `range`
		// derives from fields no signal covers (spec D3).
		this.#generation(this.#generation() + 1)
		const before = result.selectionBefore
		if (!before) return
		this.select(result.map(before.start), result.map(before.end))
	}
```

- [ ] **Step 5: `EditController` stops moving the caret in controlled mode**

Per D-e, with the `PropsModel` dependency added in `Store`:

```ts
	replace(range: Range, replacement: string, caretAt?: number): void {
		batch(() => {
			// `range.end < 0` is normalized by the offset shim; the caret only ever needed
			// `range.start`, which normalization never touched.
			if (!this.value.replace(range, replacement)) return
			// Controlled mode moves no DERIVED caret here (spec D6): the tree has not changed
			// yet, so this position would be captured as `selectionBefore` at the echo and
			// shifted a SECOND time by `map` — measured 'hello' + 'X' at 2 landing the caret at
			// 4 instead of 3. The echo's repair owns it, and a parent that never echoes now
			// leaves the caret alone instead of moving it and having it clamped back.
			//
			// `caretAt` is EXEMPT and the exemption is measured, not defensive: it is a caller
			// INTENT (block reorder, row merge) that `map` cannot reconstruct. Dropping it made
			// Drag.{react,vue}.spec "backspace on empty row › delete the row and reduce count
			// by 1" fail in both frameworks — PlainTextDrag is controlled AND echoes. Those
			// callers keep the double-shift; see plan decision D-e for the trade-off and the
			// S1.7 follow-up.
			if (this.props.value() !== undefined && caretAt === undefined) return
			this.selection.position(caretAt ?? range.start + replacement.length)
		})
	}
```

Rewrite `EditController.spec.ts:56` ("calls onChange and records caret intent in
controlled mode") to the new contract — it is the only spec that pins the removed
behavior:

```ts
	it('emits without moving the caret in controlled mode — the echo repairs it', () => {
		// BEHAVIOR CHANGE (spec D6): the caret intent used to be written here, in the OLD
		// coordinate space, and then clamped against the un-echoed props value. It is now
		// repaired once, at the echo's adoption, through selectionBefore + map.
		const store = new Store()
		const onChange = vi.fn()
		store.props.set({value: 'hello', onChange})
		store.selection.position(1)

		store.edit.replace({start: 0, end: 5}, 'world')

		expect(onChange).toHaveBeenCalledWith('world')
		expect(store.value.current()).toBe('hello')
		expect(store.selection.range()).toEqual({start: 1, end: 1})
	})
```

Add a second case pinning the exemption, since no core spec covers it and the
storybook Drag suites are the only thing that caught it:

```ts
	it('still honours an explicit caretAt in controlled mode', () => {
		// The D-e exemption. `caretAt` is a caller INTENT map cannot reconstruct; dropping it
		// deleted a block row (Drag.{react,vue}.spec "backspace on empty row"). Controlled +
		// no echo here, so the intent is the only writer.
		const store = new Store()
		store.props.set({value: 'hello', onChange: vi.fn()})
		store.selection.position(0)

		store.edit.replace({start: 0, end: 5}, 'world', 2)

		expect(store.selection.range()).toEqual({start: 2, end: 2})
	})
```

- [ ] **Step 6: Gate — the FULL suite, not just core**

Run: `pnpm run format && pnpm test && pnpm run typecheck && pnpm run lint:check`

**`pnpm test`, deliberately.** This is the second of the two tasks measured to
leave the core suite green while the browser projects are RED: the unnarrowed
D-e guard passes every core spec and deletes a block row in both frameworks. The
core gate cannot see it.

- [ ] **Step 7: Commit**

```bash
pnpm run format
git add packages/core/src/features/selection packages/core/src/features/edit \
        packages/core/src/features/tokens/model/TokenModel.ts packages/core/src/store/Store.ts
git commit -m "feat(selection): S1.6c caret repair through selectionBefore + map

TransactionResult.selectionBefore, captured since S1.6a and consumed by nothing,
gains its consumer: SelectionController.repair(result) runs synchronously inside
the commit, after the pipeline applied, and re-derives both anchors through map.
The stored anchor cannot dangle — the capture and the stored form are the same
datum, so every adoption that could remove its node also rewrites it.

BEHAVIOR CHANGE: in CONTROLLED mode EditController no longer moves the DERIVED
caret optimistically (spec D6). Keeping it double-shifted the caret: the
optimistic position is what the echo captures as selectionBefore, and map shifts
it again (measured: 'hello' + 'X' at 2 → caret 4, want 3). A rejecting parent now
leaves the caret untouched.

An explicit caretAt is EXEMPT and still written. Dropping it too was measured to
break block row deletion (Drag.{react,vue}.spec 'backspace on empty row' —
PlainTextDrag is controlled and does echo), because caretAt is a caller intent
map cannot reconstruct. Those callers keep today's double-shift; teaching the
repair to prefer an explicit intent is S1.7's.

Uncontrolled mode is unchanged — the imperative write still lands last and agrees
with the repair by construction for sub-range ops."
```

---

### Task 10: hardening — mutation proof and the recorded gaps

**Files:** `SelectionController.spec.ts`, comments in
`SelectionController.ts` / `model/TokenModel.ts`.

- [ ] **Step 1: Prove the guards are load-bearing**

Apply each mutation, confirm the NAMED test fails, revert, confirm green.
**Mutations 3, 6 and 7 must be run against `pnpm test`, not just
`packages/core`** — all three are invisible to the core suite, and 7's gate is
entirely in the browser projects.

1. `repair` drops the `#generation` bump → "keeps node and offset when the edit
   is outside the anchor…" must fail (`{7,7}` instead of `{8,8}`). **This is the
   only gate on the generation**, by construction: every other repair case
   changes the anchor too.
2. `repair` skips the `map` rewrite (bump only) → AC-3.3's "maps a caret inside
   the edited region" must fail.
3. `#anchors`'s `equals` is dropped → **survives the core suite** (predicted, and
   confirmed). **The plan's original replacement gate does not work**: two
   identical `selectionchange` events plus a `tokens.placeCaret` spy never
   discriminate, because `#placeAt` calls `handle.placeCaret` first and, under
   Task 8 Step 4's guard, an identical event writes nothing at all. Use this
   discriminator instead — **verified red without the `equals`, green with it**:

   ```ts
   const {store} = mountStructuralInline('hello') // the helper at SelectionController.spec.ts:13
   const spy = vi.spyOn(store.tokens, 'selectRange')
   store.selection.selectAll()
   store.selection.selectAll()
   expect(spy).toHaveBeenCalledTimes(1)
   ```

   Two identical `selectAll()` calls rebuild fresh anchor objects for the same
   two positions; only value equality collapses the second one. Note this is a
   RANGED selection deliberately — `selectRange` is the ranged apply path, and
   the collapsed path would be masked by `placeAtHandle`'s re-apply branch.
4. `map` reverts to left affinity → **two** of the four Task 6 fixtures fail
   (measured: the insertion-point case and the overtype collapse; the
   "strictly before the window" and deletion cases agree under both biases *by
   design* — they exist as pins, which is what Task 6 says), plus the property
   and the controlled echo case: **4 failures total**. The earlier prediction of
   "the four Task 6 fixtures" was wrong. (Both layers, deliberately: the property
   proves the formula, the controlled case proves it is the formula the caret
   needs.)
5. `EditController` keeps the controlled caret write → "repairs at the echo,
   once, with no optimistic move" must fail with `{4,4}`.
6. `placeAtHandle` stores `anchorAt(position.start)` instead of the node anchor
   (i.e. re-introduces the numeric round-trip) → **predicted to SURVIVE the core
   suite**: `#preferredHandle` had zero core-unit coverage before this phase
   (`placeAtHandle` is never called in `SelectionController.spec.ts`), and its
   only behavioral pins are the storybook Drag suites. Either add a core case
   that places at a mark whose start equals the previous text node's end and
   asserts which surface got the caret, or record the gap explicitly. Do not
   leave it unstated.
7. `#applySelection` watches `range` instead of `#anchors` → **FAILS. It is the
   most load-bearing line in Task 8 Step 3, not a design choice.** Measured: it
   survives the core suite but fails **the same browser tests as Task 8 Step 4's
   round-trip** — the three focus specs, 6 failures across react and vue. At a
   shared boundary `placeAtHandle` changes the *anchor* but not the derived
   *number*, so `range` (which dedupes on `shallow`) never notifies and the caret
   is never placed at all. An earlier draft predicted "survives; the difference
   is a redundant re-place per commit" and filed it as an ungatable design
   choice. Both halves were wrong. This mutation must be run against the FULL
   suite, and the reason must be recorded on the watch.
8. `offsetOfAnchor('end')` reads `value.current().length` instead of the last
   root → **SURVIVES the entire suite** (measured: 71 files, 1276 passed). The
   plan's own "fixtures chosen to discriminate" note explains why and then
   contradicts itself: the controlled caret is deliberately mid-document, so an
   `'end'` anchor is never produced on the controlled path. Either add an
   end-of-document controlled fixture (`value: 'hello'`, `position(5)`, type at
   5, assert `{6,6}` after the echo) or record the gap in Step 2 — but do not
   leave the claimed gate standing, because it does not exist.

- [ ] **Step 1b: The offset-shim mutation IS gatable — add the case (was
      contradiction 10)**

S1.6a's mutation 6 (`lowerReplace` narrows EVERY op instead of only whole-value
ops) was recorded as ungatable. **It is not, now that `map` has a consumer.**
Verified red-then-green:

```ts
it('repairs the caret through the EXACT edit window, not a narrowed one', () => {
	// Gates the offset shim's whole-value-only narrowing (S1.6a mutation 6, spec D8).
	// 'hello' + replace [0,3) with 'hey': the exact window {0,3,3} maps a caret at 1 to 3
	// (inside → start + insertedLength). Narrowing to the shared-prefix gap window
	// {2,3,1} maps it to 1 instead, because 1 is then strictly BEFORE the window.
	const {store} = mountStructuralInline('hello')
	store.selection.position(1)

	store.value.replace({start: 0, end: 3}, 'hey')

	expect(store.value.current()).toBe('heylo')
	expect(store.selection.range()).toEqual({start: 3, end: 3})
})
```

Add it. Do not re-record the gap — contradiction 10 is resolved in the
gatable direction.

- [ ] **Step 2: Record what cannot be gated**

Write these into the specs as comments; do not invent tests.

- Mutation 6 if it survives.
- Mutation 8's `'end'` gap, if you chose not to add the end-of-document
  controlled fixture.
- The DOM→anchor round-trip's bind-generation caveat (Task 8 Step 4): no test
  can show it, because the pending window is exactly when no bound surface
  answers. **This is the caveat only** — the round-trip's non-idempotence is
  gated, by the three focus specs Step 4's guard fixes.

**Not on this list any more:** mutation 3 (gated, see above), mutation 7 (gated
by the browser suite) and the offset-shim narrowing (gated by Step 1b). Three of
the five originally-declared gaps closed under measurement; keep the remaining
two honest rather than re-inflating the list.

- [ ] **Step 3: Gate + commit**

Run: `pnpm run format && pnpm -w exec vitest run packages/core && pnpm run typecheck && pnpm run lint:check`

```bash
git add packages/core/src
git commit -m "test(selection): S1.6c hardening — mutation-proven anchors and recorded gaps"
```

---

### Task 11: docs the swap falsifies, and the S1.6c smoke re-run

**Files:** `features/selection/README.md`,
`packages/website/src/content/docs/guides/keyboard-handling.md`,
`model/TokenModel.ts` (the ledger comment).

- [ ] **Step 1: `features/selection/README.md`**

Rewrite "Public Surface" (`:15-31`) and the last two "Watches" bullets. Every
sentence there is now false: `range` is derived and read-only, writes do not
clamp, `placeAtHandle` stores no preferred handle, and the `range` watch is an
`#anchors` watch. Add the two new members (`select`, `repair`) and one sentence
on why the numeric range is derived rather than stored.

- [ ] **Step 2: The public guide**

`packages/website/src/content/docs/guides/keyboard-handling.md:24-25` shows

```ts
store.selection.range({start: …, end: …})
```

as the post-edit caret idiom. It no longer compiles. Replace it with
`store.edit.replace(...)` (which places the caret itself) and, where an explicit
caret is genuinely needed, `store.selection.position(n)`. **Also flag, do not
fix:** `:13` cites `store.selection.rawPositionFromBoundary()`, which has not
existed for some time, and `:12` cites `store.refs.control/children` where the
API is `store.tokens.*` — pre-existing staleness.

- [ ] **Step 3: The ledger comment**

`model/TokenModel.ts:33-38` lists four items "left" for S1.6d. Item 5 is now
done: rewrite it to say items 1, 3 (S1.6a) and 5 (this phase) are complete and
S1.6d executes 2, 4 and 6 (plan decision D-i).

**Write item 6 as plain text, not `{@link removedIds}`.** The current comment
uses the link form (`:38`); Task 15 deletes the method, and the link then
dangles for two whole tasks until Task 17 rewrites the ledger again. A `{@link}`
to a symbol you have already scheduled for deletion is a broken reference
waiting to happen — name it in backticks instead.

- [ ] **Step 4: Re-run the two smoke scenarios the swap can break**

Selection is a DOM behavior and the core suite is not the last word. On both
frameworks (`pnpm run dev:sb:react`, `pnpm run dev:sb:vue`), re-run S1.6b Task 2's
scenarios **2 (overlay insert), 4 (block drag: the caret after a row merge) and
6 (controlled typing)**, and additionally: click between a text node and a mark
and type — the caret must stay on the side you clicked. Compare against the
S1.6b baseline notes. The controlled scenario is expected to CHANGE (the caret
now lands at the echo, not optimistically); record what that looks like.

- [ ] **Step 5: Full gates + commit**

Run: `pnpm run format && pnpm test && pnpm run typecheck && pnpm run lint:check && pnpm run format:check && pnpm run build && pnpm -F @markput/website run build`

The website build is in this gate because a public guide changed.

```bash
pnpm run format
git add packages/core/src/features/selection/README.md \
        packages/core/src/features/tokens/model/TokenModel.ts \
        packages/website/src/content/docs/guides/keyboard-handling.md
git commit -m "docs(selection): S1.6c the selection surface is node-anchored

selection/README.md and the keyboard-handling guide described a writable,
clamped numeric range; both are rewritten for the derived read. Flagged and NOT
fixed (pre-existing): the guide's store.refs.* and rawPositionFromBoundary
citations, and architecture.md's step 6, which still describes the pre-cutover
reparse watch — spec §11 assigns the doc sweep to S1.8 step 7."
```

---

## S1.6d — Deletions & ledger review (revert unit: Tasks 12–17, individually)

### Task 12: retire the three `TokenHandle.path()` readers

**Files:** `tree/tree.ts`, `model/TokenModel.ts`, `keyboard/blockEdit.ts`,
`keyboard/arrowNav.ts`, `model/commit.ts`, `model/treePipeline.spec.ts`.

This is the latent-bug half of S1.6d (spec §11's ADDED note) and it lands BEFORE
the writer deletion so it reverts on its own.

- [ ] **Step 1: Write the failing tests**

There is no core spec for `arrowNav` or `blockEdit`
(`packages/core/src/features/keyboard/` contains only `input.spec.ts`), and the
stale-path bug is precisely what has no coverage. Add the two tree helpers'
tests, which is where the behavior now lives:

```ts
// packages/core/src/features/tokens/tree/tree.spec.ts — append
describe('rootIndexOf', () => {
	it('answers the ROOT index for a nested node, not the node index', () => {
		// The block row index (`keyboard/blockEdit.ts`): a caret inside a row's slot child
		// must resolve to the ROW.
		const tree = createTokenTree(new Parser(['#[__slot__]']).parse('a#[bc]d'))
		const mark = tree.roots()[1]
		if (mark.kind !== 'mark') throw new Error('expected a mark')
		expect(rootIndexOf(tree.roots(), mark.children()[0].id)).toBe(1)
		expect(rootIndexOf(tree.roots(), tree.roots()[2].id)).toBe(2)
		expect(rootIndexOf(tree.roots(), 9999)).toBeUndefined()
	})
})

describe('siblingOf', () => {
	it('walks the node OWN sibling list, not the flattened document', () => {
		const tree = createTokenTree(new Parser(['#[__slot__]']).parse('a#[bc]d'))
		const mark = tree.roots()[1]
		if (mark.kind !== 'mark') throw new Error('expected a mark')
		expect(siblingOf(tree.roots(), mark.id, -1)).toBe(tree.roots()[0])
		expect(siblingOf(tree.roots(), mark.id, 1)).toBe(tree.roots()[2])
		// A slot's only child has no sibling — it must NOT escape into the roots.
		expect(siblingOf(tree.roots(), mark.children()[0].id, 1)).toBeUndefined()
		expect(siblingOf(tree.roots(), tree.roots()[0].id, -1)).toBeUndefined()
	})
})
```

- [ ] **Step 2: Implement the helpers**

```ts
/** Index of the ROOT whose subtree contains `id` — the block row index, off ids instead of a handle's frozen path. */
export function rootIndexOf(roots: readonly TreeNode[], id: Id): number | undefined {
	for (let index = 0; index < roots.length; index++) {
		if (containsNode(roots[index], id)) return index
	}
	return undefined
}

function containsNode(node: TreeNode, id: Id): boolean {
	if (node.id === id) return true
	return node.kind === 'mark' && node.children().some(child => containsNode(child, id))
}

/** The node's previous (-1) or next (+1) sibling within its OWN parent's child list. */
export function siblingOf(roots: readonly TreeNode[], id: Id, direction: -1 | 1): TreeNode | undefined {
	const found = locateSiblings(roots, id)
	return found ? found.siblings[found.index + direction] : undefined
}

function locateSiblings(
	nodes: readonly TreeNode[],
	id: Id
): {siblings: readonly TreeNode[]; index: number} | undefined {
	for (let index = 0; index < nodes.length; index++) {
		const node = nodes[index]
		if (node.id === id) return {siblings: nodes, index}
		if (node.kind === 'mark') {
			const found = locateSiblings(node.children(), id)
			if (found) return found
		}
	}
	return undefined
}
```

plus the two `TokenModel` delegations (`untracked`, like `find`).

- [ ] **Step 3: Repoint the readers**

`keyboard/blockEdit.ts:27-36`:

```ts
function findActiveRow(store: KbCtx): ActiveRow | undefined {
	const active = document.activeElement
	if (!active) return undefined
	const handle = store.tokens.handleAt(active)
	if (!handle || handle === 'control') return undefined
	// The ROW index off the live tree. `handle.path()` was bind-generation state on a
	// handle that is reused across binds, so it could answer from a stale generation —
	// the latent bug spec §11 records for this phase.
	const index = store.tokens.rootIndexOf(handle.id)
	if (index === undefined) return undefined
	const row = rowHandle(store, index)
	if (!row) return undefined
	return {handle: row, index}
}
```

`keyboard/arrowNav.ts:35,49-53`:

```ts
	const sibling = store.tokens.siblingOf(handle.id, direction === 'prev' ? -1 : 1)
	const siblingHandle = sibling ? store.tokens.handle(sibling.id) : undefined
	if (!siblingHandle) return
```

and drop the `resolvePath` import (`arrowNav.ts:4`). `handle.token()` stays —
its `position` reads are legitimately bind-generation (plan decision D-h).

`model/commit.ts:250-254`:

```ts
			throw new Error(`TokenModel divergence at #${handle.id}: DOM "${actual}" ≠ model "${expected}"`)
```

`treePipeline.spec.ts:356-370` asserts `toContain('[0]')`; replace with the id it
now prints:

```ts
		const head = harness.pipeline.byPath().get('0')
		expect(message).toContain(`#${head?.id}`)
```

and rename the case ("still throws with the NODE ID on an untouched surface").

- [ ] **Step 4: Gate**

Run: `pnpm run format && pnpm -w exec vitest run packages/core && pnpm run typecheck && pnpm run lint:check`

Then `grep -rn "\.path()" packages/core/src --include="*.ts" | grep -v spec` —
expected: **exactly one hit, and it is a comment**: `keyboard/blockEdit.ts:32`,
the "`handle.path()` was bind-generation state…" comment this very step
dictates. (The earlier "no hits" expectation was self-contradicting.) If you see
any other hit, or a hit that is not a comment, stop. Note that
`treePipeline.spec.ts:196` also carries a `.path()` comment; it is filtered out
here by `grep -v spec` but reappears in Task 17's unfiltered ledger grep.

- [ ] **Step 5: Commit**

```bash
pnpm run format
git add packages/core/src/features/tokens/tree packages/core/src/features/tokens/model \
        packages/core/src/features/keyboard
git commit -m "fix(keyboard): S1.6d re-key the TokenHandle.path() readers on node ids

The block ROW INDEX (blockEdit) and arrow-key sibling resolution (arrowNav) read
a handle's #path, which is written at construction and refreshed only by
TokenHandle.update — a handle is reused across binds, so both could answer from a
stale generation. They now walk the live tree by id (rootIndexOf / siblingOf).
The divergence detector prints the node id instead of a path. Prerequisite for
deleting the writer, which spec §11 forbids shipping alone."
```

---

### Task 13: delete `TokenHandle.update()` and `#path`

**Files:** `model/TokenHandle.ts`, `model/bind.ts`, and the six spec files that
assert paths.

- [ ] **Step 1: Delete**

- `TokenHandle`: drop `#path`, `path()`, `update()`, the `TokenPath` import and
  the constructor's third parameter.
- `bind.ts:85-87`: `new TokenHandle(id, token)` and
  `if (existing) existing.refresh(token)`. `path` stays in `bind` — it keys
  `byPath`, which the pipeline and `setEditable` consume; only the handle's copy
  dies.

- [ ] **Step 2: Rewrite `TokenHandle`'s header (plan decision D-h)**

Replace `model/TokenHandle.ts:45-47` ("S1.6d narrows this to a plain
`{start, end}` stamp") with the measured reason it does not:

```
 * `#token` SURVIVES this narrowing (S1.6d, plan decision D-h): five production
 * readers legitimately want the bind generation — `DomModel`/`tokens/boundary.ts`
 * (type, position, content), `commit.ts`'s divergence detector (content),
 * `TokenModel.setEditable` (type) and `keyboard/arrowNav.ts` (position). D9 keeps
 * exactly this read latch; narrowing to `{start, end}` would move the boundary
 * layer's type/content reads onto the live tree, which is a DOM-layer refactor no
 * §4.6 item asks for.
```

- [ ] **Step 3: Follow the specs — and mind the CONSTRUCTOR arity, which the
      first draft of this list missed entirely**

Two mechanically separate edits. Do the arity one first; otherwise the
assertion deletions land on a file that does not compile.

**(a) The constructor's third parameter.** Removing it breaks **every**
`new TokenHandle(id, token, path)` call. Measured: **13 `TS2554`s** in
`model/TokenHandle.spec.ts` alone at
`:98,109,123,151,179,187,200,209,232,249,258,272` (and more surface after the
first pass — the file has **15** construction sites in total, at
`:67,79,88,98,109,123,151,179,187,200,209,232,249,258,272`; three of them sit
inside cases that are being deleted outright, which is why they do not show in
the first `tsc` run). Strip the third argument at all of them. The original
enumeration below listed only *assertion* lines and was short by 13 sites.

**(b) The path assertions and path-only cases.** Delete
`features/tokens/TokenHandle.spec.ts:78,162`;
`model/TokenHandle.spec.ts:73,82,94,104,283,298,310` (the `update()` cases go
whole — `:91`, `:298`); `model/bind.spec.ts:76,394,462`;
`model/TokenModel.spec.ts:239`; `TokenModel.index.spec.ts:93`. Where a case
asserted "a moved token's handle reports the new path", the surviving claim is
"the same handle object is reused" — keep that half, and say in the commit body
which cases lost coverage and which kept it.

**Do not delete assertion lines mechanically.** At least one leaves an orphan:
`features/tokens/TokenHandle.spec.ts:77` is `const handle = store.tokens.handle(id)`
and `:78` is its only reader, so deleting `:78` alone yields an unused binding →
`oxlint` `no-unused-vars` → `denyWarnings: true` → the task gate AND the
pre-commit hook fail. That case ("handle(id) returns the bound handle for a
token id") should keep its subject and assert `expect(handle).toBeDefined()`,
or go whole.

- [ ] **Step 4: Gate + commit**

Run: `pnpm run format && pnpm -w exec vitest run packages/core && pnpm run typecheck && pnpm run lint:check && pnpm run build`

```bash
git add packages/core/src/features/tokens
git commit -m "refactor(tokens): S1.6d delete TokenHandle.update() and #path

The only #path writer outside the constructor dies with its last reader (retired
in the previous change). bind now calls refresh(token); byPath keys still come
from bind's own tree walk. #token stays: five production readers want the bind
generation and D9's read latch is explicit about keeping it — recorded on the
class."
```

---

### Task 14: `MarkController` off the write latch and the captured token (§4.6 item 4)

**Files:** `features/tokens/MarkController.ts`,
`features/tokens/MarkController.spec.ts`.

- [ ] **Step 1: Implement — written out in full, because the public API changes
      shape in two non-obvious places**

```ts
import {joinNodes} from './tree/tree' // NEW: slot text is derived, not stored

export class MarkController {
	constructor(
		private readonly store: Store,
		private readonly id: number
	) {}

	static fromToken(store: Store, token: MarkToken): MarkController {
		// The `captured` third argument goes: reads no longer need a fallback, because
		// `find(id)` has no pending window. The id check stays — a token with no id is
		// genuinely foreign.
		if (token.id === undefined) throw new Error('Cannot create MarkController for a token without an id')
		return new MarkController(store, token.id)
	}

	/** The live mark node at this id, or undefined once it leaves the tree. */
	#node(): MarkNode | undefined {
		const node = this.store.tokens.find(this.id)
		return node?.kind === 'mark' ? node : undefined
	}

	get value(): string {
		return this.#node()?.value() ?? ''
	}

	get meta(): string | undefined {
		return this.#node()?.meta()
	}

	/**
	 * Slot TEXT, derived. `MarkNode.slot` stores POSITIONS only — `tree/types.ts` is
	 * explicit that slot text is deliberately not stored ("a stored copy would be an
	 * unread mirror nothing resyncs"), so where the token had `slot?.content` ready-made
	 * the node needs the children joined. `undefined` for a markup with no slot, matching
	 * the token contract.
	 */
	get slot(): string | undefined {
		const node = this.#node()
		if (!node?.descriptor.hasSlot) return undefined
		return joinNodes(node.children())
	}

	get readOnly(): boolean {
		return this.store.props.readOnly()
	}

	remove(): boolean {
		const node = this.#resolve()
		if (!node) return false
		return this.store.tokens.applyStructural(node, '')
	}

	update(patch: MarkPatch): boolean {
		const node = this.#resolve()
		if (!node) return false

		// Patch defaults come off the NODE now, not off a handle's bind-generation token.
		const value = patch.value ?? node.value()
		const meta =
			patch.meta?.kind === 'clear' ? undefined : patch.meta?.kind === 'set' ? patch.meta.value : node.meta()
		const slot =
			patch.slot?.kind === 'clear'
				? undefined
				: patch.slot?.kind === 'set'
					? patch.slot.value
					: node.descriptor.hasSlot
						? joinNodes(node.children())
						: undefined

		return this.store.tokens.applyStructural(node, this.#serialize(node, {value, meta, slot}))
	}

	/** Unchanged except for its source: the descriptor now comes off the node. */
	#serialize(node: MarkNode, fields: {value: string; meta?: string; slot?: string}): string {
		return annotate(node.descriptor.markup, {
			value: fields.value,
			meta: node.descriptor.gapTypes.includes('meta') ? (fields.meta ?? '') : undefined,
			slot: node.descriptor.hasSlot ? (fields.slot ?? '') : undefined,
		})
	}

	/**
	 * ONE resolution now, where there were two. The latch-gated handle was the write
	 * PERMISSION check and the node was the write TARGET; §4.6 item 4 retires the
	 * permission, so only the target remains. Read-only still fails closed, and a mark
	 * that has left the tree still fails closed — `find(id)` misses.
	 */
	#resolve(): MarkNode | undefined {
		if (this.store.props.readOnly()) return undefined
		return this.#node()
	}
}
```

Drop the now-unused `MarkToken` value import (the type is still needed by
`fromToken`) and the `#liveMark` helper.

Two mechanisms die here: the latch-gated `handle(id)` **write** permission and
the `captured` construction-time token used as a **read** fallback. Both existed
because `handle(id)` fails closed during the adopt→bind window; `find(id)` reads
the tree, which has no such window.

**Note the new import direction:** `features/tokens/MarkController.ts` now
imports from `features/tokens/tree/tree`. That is inward within the same
feature, so it is fine — but it is the first non-`model/` file to do it, so
expect it in the diff rather than being surprised by it.

- [ ] **Step 2: Re-fixture the two pinned latch cases and say what changed**

**Verified by implementation:** the two predicted inversions at `:338` and
`:355` are exactly right, `:324` does stay green, and **no read case regresses**
— so the "name each one in the commit body" list at the end of this step is
**empty**. Say so rather than hunting for one.

Expectations, from reading `MarkController.spec.ts`:

- `:324` "update() against a dead handle is a fail-closed no-op returning false"
  — **stays green unchanged**: the mark is genuinely removed, so `find(id)`
  misses. The SEMVER-MAJOR dead-write contract survives, re-keyed on the node.
- `:338` "update() while a structural apply awaits its bind is a fail-closed
  no-op returning false" — **inverts**. The write now succeeds and folds into the
  pending structural pass (the pipeline's fold guard, `commit.ts:135`). Rewrite
  the case to assert the new contract and rename it.
- `:355`ff the render-path contract — its READ half stays green (the fresh node
  answers `'x'`, same as the captured token did), its mid-window WRITE half
  inverts with `:338`. Keep the post-bind half verbatim.
- Any read case that expects a *dead* mark to still answer with its captured
  value would now get `''`/`undefined`. **Measured: there is no such case.** The
  suite has none, so this bullet produces no edits — record that fact in the
  commit body instead of an empty list.

- [ ] **Step 3: Gate**

Run: `pnpm run format && pnpm -w exec vitest run packages/core && pnpm run typecheck && pnpm run lint:check`

`typecheck` may rewrite `packages/website/src/content/docs/api/classes/MarkController.md`
(astro check re-runs typedoc; measured in S1.6a Task 6) — stage it with the
commit rather than leaving it dirty.

- [ ] **Step 4: Commit**

```bash
pnpm run format
git add packages/core/src/features/tokens/MarkController.ts \
        packages/core/src/features/tokens/MarkController.spec.ts \
        packages/website/src/content/docs/api/classes/MarkController.md
git commit -m "refactor(tokens): S1.6d MarkController reads and writes the live node (§4.6 item 4)

The handle write latch and the captured-token read fallback both go: the latch
existed because handle(id) fails closed during the adopt→bind window, and
find(id) reads the tree, which has no such window.

BEHAVIOR CHANGES: update()/remove() during the pending window now SUCCEED (they
fold into the pending structural pass) where they used to return false — the
SEMVER-MAJOR-flagged spec case is rewritten to the new contract. Reads are now
always fresh instead of one generation stale, and a read against a REMOVED mark
answers '' instead of the construction-time value. A write against a removed mark
still fails closed."
```

---

### Task 15: delete `removedIds()` (§4.6 item 6)

**Files:** `model/TokenModel.ts`, `model/commit.ts`,
`model/treePipeline.spec.ts`, `features/block/BlockController.ts` (comment).

- [ ] **Step 1: Delete**

- `TokenModel.removedIds` (`:181-187`) — no production consumer
  (`grep -rn "removedIds" packages --include="*.ts"`: the only non-core hits are
  the generated `dist` bundles).
- `CommitPipeline.removedIds` (the type at `commit.ts:46-51` and the
  implementation at `:263`), and with it the `lastDelta` field (`:121`): it
  exists solely to answer that call, so both branches become
  `changed(drainDelta(pendingDelta))`.
- **`EMPTY_DELTA` (`commit.ts:65`) — delete it in the same edit.** It is
  `lastDelta`'s only initializer and has no other reader, so removing
  `lastDelta` alone orphans it. `tsc` stays silent (it is a module-local const),
  but `oxlint`'s `no-unused-vars` errors under `denyWarnings: true`, which fails
  **this task's own `lint:check` gate** and then the pre-commit hook. Measured.
- `treePipeline.spec.ts:792` ("removedIds() still answers, now off the payload").
  S1.6a moved that case in specifically so this deletion stays a pure delete —
  it goes with the method.
- `BlockController.ts:38`'s comment already says the payload replaced it; trim
  the reference to a past tense that does not name a live symbol.

- [ ] **Step 2: Gate + commit**

Run: `pnpm run format && pnpm -w exec vitest run packages/core && pnpm run typecheck && pnpm run lint:check && pnpm run build`

`grep -rn "removedIds" packages/core/src` → **"no hits" is impossible at this
point and was a wrong expectation.** `tokenIdentity.ts` has its own unrelated
`removedIds` (its type field at `:48` and ~6 uses) plus its two spec suites, and
none of that dies until Task 16. `features/tokens/README.md` also documents the
method at `:95,127`. The correct expectation here is: **no hits in
`model/` or `features/block/`**, i.e.

```bash
grep -rn "removedIds" packages/core/src --include="*.ts" | grep -v tokenIdentity
```

→ empty. Two further leftovers this task creates and does not clean, both
handled later — say so in the commit body rather than letting Task 17 find them:
`{@link removedIds}` in `TokenModel.ts`'s ledger comment now dangles (Task 17
rewrites that comment), and `features/tokens/README.md:95,127` still document
`removedIds()` as a live API **with a signature** (see Task 16 Step 3, which now
covers them).

```bash
git add packages/core/src/features
git commit -m "refactor(tokens): S1.6d delete the removedIds side channel (§4.6 item 6)

The wave-scoped read had no production consumer left — BlockController migrated
to the changed payload in S1.5 — and its last spec was ported in S1.6a precisely
so this could be a pure delete. The pipeline's lastDelta field goes with it."
```

---

### Task 16: delete `tokenIdentity` and its suites (§4.6 item 2)

**Files:** delete `features/tokens/tokenIdentity.ts`,
`tokenIdentity.spec.ts`, `tokenIdentity.property.spec.ts`; modify
`tree/gapWindow.spec.ts`, `parser/types.ts`, `tree/adoptUtils.ts`,
`model/bind.ts`, `model/treePipeline.spec.ts`, `tree/adopt.spec.ts`,
`features/tokens/README.md`.

- [ ] **Step 1: Confirm the delete is pure, then delete**

```bash
grep -rn "tokenIdentity\|createIdentityTracker" packages --include="*.ts" --include="*.tsx" --include="*.vue" | grep -v /dist/
```

Expected (measured today): every hit is either inside the three files being
deleted or a COMMENT (`tree/adoptUtils.ts:5`, `tree/adopt.spec.ts:353`,
`model/bind.ts:33`, `model/treePipeline.spec.ts:446,451`, `parser/types.ts:13,24`,
`tree/gapWindow.spec.ts:9-13`, `README.md:259-294`). **Zero production callers.**
If that is not what you see, stop and report.

```bash
git rm packages/core/src/features/tokens/tokenIdentity.ts \
       packages/core/src/features/tokens/tokenIdentity.spec.ts \
       packages/core/src/features/tokens/tokenIdentity.property.spec.ts
```

- [ ] **Step 2: `gapWindow.spec.ts` — the frozen copy dies with its subject**

Its own header says so: "Delete this copy together with that file; the literal
expectations outlive it." Remove `hintFromValues` (`:15-24`), the now-unused
`findGap` import, and the two `toEqual(hintFromValues(...))` assertions (`:75`
and `:98`). **Keep everything else**, especially the generated-pairs case's
`applied === next` reconstruction — that is the real gate, and the eleven literal
window expectations stay as they are.

`utils/findGap.ts` itself is a TRAP (spec §11): `tree/gapWindow.ts:1` imports it.
Do not touch it.

- [ ] **Step 3: Comments that now cite a deleted file**

- `parser/types.ts:13,24` — "Stable identity id, stamped by reconcile
  (tokenIdentity) — NOT by the parser" → stamped by the tree's snapshot
  (`tree/snapshot.ts`), absent on freshly parsed trees. **This changes the DTS
  output**, so `pnpm run build` is in this task's gate and the typedoc pages may
  regenerate.
- `tree/adoptUtils.ts:5`, `model/bind.ts:33`, `tree/adopt.spec.ts:353`,
  `model/treePipeline.spec.ts:446,451` — keep the *fact* each comment carries
  (they explain a ported fixture or a parity boundary) and re-word the citation
  so it does not point at a file that no longer exists.
- `features/tokens/README.md:259-294` — delete the "Identity tracker
  (`tokenIdentity.ts`)" section. The other 400+ lines are S1.8 step 7's; do
  not start them — **with two named exceptions, because nothing else in this
  plan covers them and they document a symbol that no longer exists:**
  - `:95` — "`removedIds()` still exists as the last …": rewrite to past tense,
    citing the `changed` payload.
  - `:127` — `removedIds(): readonly number[] // … deleted in S1.6d` sits in a
    **signature list**, i.e. it reads as live public API. Delete the line.

  (`:310`, which mentions `removedIds` as an *adoption* concept and not as the
  deleted method, stays. So does `:270`/`:292` — they are inside the section
  being deleted anyway.) Without these two edits Task 17's ledger grep reports
  hits and the README ships a signature for a deleted method.

- [ ] **Step 4: Gate + commit**

Run: `pnpm run format && pnpm -w exec vitest run packages/core && pnpm run typecheck && pnpm run lint:check && pnpm run build`

Expected: the core file count drops by two and the test count by roughly the
tokenIdentity suites' cases. Record the numbers.

```bash
pnpm run format
git add -A packages/core/src/features/tokens packages/website/src/content/docs/api
git commit -m "refactor(tokens): S1.6d delete tokenIdentity and its suites (§4.6 item 2)

1,539 lines: the heuristic per-edit diff and its two spec suites. It has had zero
production callers since the S1.6a cutover; adoption replaced both its roles and
its key fixtures were ported in S1.3 (adopt.spec.ts's ported-fixtures section).
gapWindow.spec.ts's frozen hintFromValues copy goes with it, as its own header
scheduled — the literal window expectations and the reconstruction property stay."
```

---

### Task 17: the ledger review (the phase gate)

**Files:** `model/TokenModel.ts` (the ledger comment) only.

- [ ] **Step 1: Walk §4.6's checklist with evidence, not assertion**

**Read this before running the greps.** The "→ empty" column was wrong for
**five** of the seven rows. Every one of items 1, 4, 5, 6 and the `.path()` gate
returns **comment hits** — including, for item 5, the ledger comment being
rewritten in this very step. That is not a failure; a mechanism is dead when no
*code* names it. The corrected expectation is per row below, and the discipline
is: **read every hit and confirm it is prose.** A grep whose stated expectation
is unachievable teaches the executor to ignore the grep.

| # | mechanism | where it died | evidence command | expected |
| --- | --- | --- | --- | --- |
| 1 | consume-once hint protocol (`#pendingEdit`/`takePendingEdit`) | S1.6a Task 5 | `grep -rn "pendingEdit\|takePendingEdit" packages/core/src` | **1 comment hit** (`TokenModel.ts`'s ledger, "the write path deleted `#pendingEdit`/`takePendingEdit`"). No code. |
| 2 | heuristic per-edit diff (`tokenIdentity` + suites) | S1.6d Task 16 | `grep -rn "tokenIdentity" packages/core/src` | comments only, none citing a live file |
| 3 | reparse-watch edit path | S1.6a Task 5 | the props watch routes arrivals explicitly (`TokenModel.ts`'s tuple watch); no watch on `value.current` remains in the token layer | — |
| 4 | handle write latch / captured-token fallback | S1.6d Task 14 | `grep -n "captured\|handle(this.id)" packages/core/src/features/tokens/MarkController.ts` | comment hits from the class header only, if you keep its history paragraph; **no field, no call** |
| 5 | `#preferredHandle` + clamp arithmetic | **S1.6c Task 8** | `grep -rn "preferredHandle\|Math.min(range" packages/core/src` | comment hits only — and if the ledger sentence you write in Step 2 names `#preferredHandle`, this grep hits the sentence itself. Expected, not a finding. |
| 6 | `removedIds()` | S1.6d Task 15 | `grep -rn "removedIds" packages/core/src` | comments and `README.md:310`'s *adoption* usage. **`README.md:95,127` must NOT appear** — Task 16 Step 3 removes them; if they do, that step was skipped. |

Plus spec §11's extra S1.6d gate: `grep -rn "\.path()" packages/core/src` →
**two comment hits, no call sites**: `keyboard/blockEdit.ts:32` (the
stale-generation rationale Task 12 dictates) and
`model/treePipeline.spec.ts:196` (an S1.6a mutation note). Both are prose about
a method that no longer exists, which is the point of the gate.

- [ ] **Step 2: Record what did NOT die, and why**

The ledger comment in `model/TokenModel.ts` becomes the phase's written record:
all six items are gone; `TokenHandle#token` survives as D9's read latch with its
five readers named (plan decision D-h); the internal offset shim survives by D8
(gated on the block-rows follow-up); `ValueModel`, `MarkputHandler` and the path
layer survive for S1.8.

- [ ] **Step 3: Full gates**

Run: `pnpm run format && pnpm test && pnpm run build && pnpm run typecheck && pnpm run lint:check && pnpm run format:check && pnpm -F @markput/website run build`

Record the file/test counts against S1.6b Task 1's baseline and explain the delta
(two deleted spec files, plus the cases added in S1.6c and removed in Tasks
13–16). A count that moved for an unexplained reason is a finding.

**Measured target: 71 files, 1276 passed** (from the baseline's 72 / 1281), all
gates clean. A materially different number is worth understanding before you
call the phase done.

- [ ] **Step 4: One last manual pass**

Re-run S1.6b Task 2's scenarios 1, 3, 4 and 5 on both frameworks. Task 14 changed
mark writes and Task 12 changed the block row index; both are DOM behaviors the
core suite only partly covers (there is no core spec for `blockEdit` at all).

- [ ] **Step 5: Commit**

```bash
pnpm run format
git add packages/core/src/features/tokens/model/TokenModel.ts
git commit -m "docs(core): S1.6d mechanism ledger — all six §4.6 items retired

Items 1 and 3 died with the S1.6a cutover, item 5 with S1.6c's node-anchored
selection, and items 2, 4 and 6 in this sub-phase. Recorded as surviving, each
with its reason: TokenHandle#token (D9's read latch, five bind-generation
readers), the internal offset shim (D8, gated on block rows), ValueModel /
MarkputHandler / the path layer (S1.8)."
```

---

## Contradictions found while writing this plan (report, do not paper over)

1. **The roadmap conflates two different affinities.** Its S1.6c section reads
   D7's "right affinity canonical" as being about `map`'s insertion-point bias.
   D7 cites `boundaryFor`'s `'before' | 'after'` parameter, which is *node
   resolution* at a boundary — already right-affine in `anchorAt`
   (`adopt.ts:226`). The bias `map` gets wrong is *mapping* bias, on which D7 is
   silent. The flip is still right (AC-3.3 demands it), but "the spec already
   says so" is not the reason. (D-a.)
2. **The roadmap's framing "one `map` cannot serve both a selection anchor and a
   post-insertion caret" has no in-repo second consumer.** `map` had zero
   consumers; after this plan it has one, which wants right bias everywhere,
   including for a selection's anchor (mapping both endpoints right is what
   collapses an overtyped selection correctly). Adding a parameter would have
   shipped an argument value nothing passes. (D-a.)
3. **D9 contradicts itself about `TokenHandle#token`**, and `TokenHandle`'s own
   header repeats the losing half. "Its `#token` snapshot and `update()` are
   deleted — in S1.6d" cannot coexist with "handles cache bind-generation
   positions … and DOM-boundary reads resolve against them". §4.6 item 4 — the
   actual gate — names only the MarkController regime. Resolved per D-h with the
   five-reader census; the class comment is rewritten rather than left promising
   a narrowing nobody scheduled. **Added on verification:** §11's S1.6d scope
   line repeats D9's losing half too, so the contradiction is in three places,
   not two — the spec text needs the same correction as the class comment, and
   D-h's resolution should be cited from both.
4. **§4.6 item 5 is S1.6c's work, not S1.6d's.** Spec §11 puts
   `#preferredHandle`/clamp deletion in S1.6c's scope line, while
   `model/TokenModel.ts:33-38` (written at S1.6a) lists it among the four items
   "left" for S1.6d. Both are right about different things — the checklist is
   S1.6d's *review gate* — but the comment reads as a work list. Rewritten in
   S1.6c Task 11. (D-i.)
5. **"Flip the storybook browser suites onto the new core" describes work that
   does not exist.** They were never on anything else: `dist` is gitignored, CI
   never builds before `pnpm test`, and exactly one spec imports core at all.
   S1.6b is verification plus one timeboxed gap-closing attempt. (D-j.)
6. **S1.6a's recorded `#seeded` gates do not survive S1.6c.** `TokenModel.ts`
   names two `SelectionController.spec` cases as the gates on `value`'s `#seeded`
   arm because they read an unseeded store; anchors force those stores to seed.
   A replacement gate is added in Task 8 Step 6 — without it, mutation 7 from
   S1.6a's hardening pass would become uncaught.
7. **`anchorAt`'s `export` is on S1.8 step 1's dead-surface list** ("pre-existing
   dead-surface sweep: … `anchorAt`'s `export`"). S1.6c gives it a production
   caller and moves it into `tree/anchors.ts`. Remove that row from S1.8's scope.
8. **`architecture.md` is stale from S1.6a, not from this phase.** Its edit-flow
   step 6 still says "TokenModel reactively reparses and reconciles — it had
   already subscribed to value.current", which the cutover deleted, and step 5
   still credits `ValueModel` with owning uncontrolled state. S1.6c only fixes
   the sentences the *selection* swap falsifies; the rest is S1.8 step 7's, and
   it is now two phases stale. (Reported, not fixed.)
9. **The block-mode `filterEmptyText` gap S1.6a recorded is REAL for S1.6c and
   is not fixed here.** With filtered roots, a between-row offset resolves into
   the NEXT row's slot and the document end answers `{after: rowNode}` instead of
   a text anchor. Both are legal `NodeAnchor`s and `#placeAt` handles them (a
   `{after}` anchor places at the row handle's end), so caret placement is
   *defined*; what is not fixed is that a between-row caret cannot be
   distinguished from a caret at the start of the next row's content. No
   production path addresses a between-row position today (block Enter/merge pass
   explicit offsets through the shim), so this plan takes the anchor forms as
   first-class in the DOM layer and leaves the addressing question to S1.7's
   `insertMark(at)`. Recorded, measured by S1.6a, not re-measured here.
10. **RESOLVED — the offset shim's "splice-then-narrow" mutation is now
    GATABLE.** S1.6a mutation 6 (`lowerReplace` narrows EVERY op instead of only
    whole-value ops) was recorded as surviving because nothing consumed `map`.
    S1.6c is the consumer, and the re-run settles it: the mutation still
    survives the core suite as it stands, but a caret-repair case discriminates
    it. Verified red-then-green: `defaultValue 'hello'`, caret 1,
    `value.replace({0,3}, 'hey')` — the exact window `{0,3,3}` gives
    `map(1) = 3` (inside the window → `start + insertedLength`), while the
    narrowed shared-prefix gap window `{2,3,1}` gives `map(1) = 1` (now strictly
    before the window). **Task 10 ADDS this test** (Step 1b); do not re-record
    the gap. Two lessons worth keeping: the two windows agree for most edits, so
    the discriminating fixture needs a caret *inside* the prefix the narrowing
    shaves off — and "ungatable" claims are worth re-testing whenever a consumer
    arrives.

---

## Self-review notes (spec → plan)

- Covers S1.6b's scope line (browser suites + the six manual smoke scenarios +
  IME parity against a real baseline), S1.6c's (node-anchored selection,
  `#preferredHandle`/clamp deletion, AC-3.2/3.3/3.4 and AC-4.4 tests) and
  S1.6d's (the remaining §4.6 deletions with the checklist as the gate, plus
  §11's added `path()`-reader requirement).
- **Three sub-phase milestones, FIFTEEN tasks (numbered 1–3, 6–11, 12–17 — there
  is no Task 4 or 5, see "Task numbering"), twelve or thirteen commits**: S1.6b
  1 (measured outcome: 1, a comment-only commit), S1.6c 6, S1.6d 6. Every task
  leaves the **core** suite green and is its own revert unit, with one named
  exception (Task 8 → Task 9's fold-together escape hatch). **Tasks 8 and 9 do
  NOT leave the FULL suite green unless their corrections are applied** — that
  is why both now carry a `pnpm test` gate.
- **Where a test cannot discriminate, it is said so, not decorated.** After the
  verification pass the list is **two** items, not five: `placeAtHandle`'s node
  disambiguation (mutation 6 — `#preferredHandle` never had core coverage) and
  the DOM→anchor bind-generation *caveat*, plus the memo/tree and MarkController
  parity gaps inherited from S1.6a. **Closed under measurement:** the `#anchors`
  equality (mutation 3 — gated by the double-`selectAll` case), the
  `#anchors`-vs-`range` watch choice (mutation 7 — not a design choice at all;
  it fails 6 browser tests), and the offset shim's narrowing (contradiction 10 —
  gated by Task 10 Step 1b). Mutation 8 (`'end'` resolution) moves ONTO the list
  unless the end-of-document controlled fixture is added.
- **Fixtures chosen to discriminate:** `ab@[x]cd` with the caret in the trailing
  text (same node, same local offset, moved absolute offset — the only shape
  that gates `#generation`); `abcde` overtype for the collapse; the whole-value
  write for a genuinely removed anchor node; a caret inside a shared prefix for
  the offset shim (Task 10 Step 1b).
  **One fixture choice is a self-inflicted gap, now named:** the controlled echo
  puts the caret in the MIDDLE, on the reasoning that "an end-of-document caret
  self-corrects through the `'end'` anchor and would pass under both bugs". True
  — and the direct consequence is that **mutation 8 survives the entire suite**
  (measured), because no controlled path ever produces an `'end'` anchor. The
  original text asserted this fixture choice as a strength while listing
  mutation 8's gate as existing. It cannot be both. Either add the
  end-of-document controlled case *in addition* (not instead) or accept the gap
  in writing.
- **Deliberately deferred, with reasons above:** the DOM-node→`TreeNode` sync
  path (Task 8 Step 4); `TokenHandle#token`'s narrowing (D-h); `input.select` /
  `input.caret` / `selectionRange` as public API (S1.7); the offset shim (D8);
  `architecture.md` and `features/tokens/README.md` (S1.8 step 7); block
  between-row addressing (contradiction 9).
- **VERIFIED by implementation** (see the header). The three places the plan
  flagged as most likely to break were *not* where it broke: `TokenModel.anchorAt`
  seeding (D-f) perturbed nothing; the `range` computed's `{equals: shallow}`
  against `updateComputed`'s `oldValue !== undefined` guard
  (`shared/signals/signal.ts:123`) behaved as reasoned; and the controlled-echo
  batching order held. **What actually broke was in none of those:** the
  DOM→anchor round-trip's non-idempotence (Task 8 Step 4), the
  `selection` parameter name collision (Task 9 Step 3, which the codebase had
  already documented), D-e's controlled-`caretAt` claim, and an orphaned
  `const` failing `oxlint` (Task 15). Three of the four were **invisible to
  `pnpm -w exec vitest run packages/core`**. Standing lesson for the next plan in
  this series: the risk is not in the reasoning the author already found hard —
  it is in the sentences asserted in passing, and in the gates that do not run
  the browser projects.

---

## Decision audit (after the implement-and-run pass)

| decision | verdict |
| --- | --- |
| D-a `map` flips to right affinity | **HOLDS.** The property and fixtures behave as traced; only the "four fixtures go red" count in Task 10 mutation 4 was wrong (two do). |
| D-b anchors stored, `range` derived + `#generation` | **HOLDS.** |
| D-c what survives / changes / dies | **HOLDS.** |
| D-d `repair()` as `selectionBefore`'s consumer | **HOLDS — with the C2 caveat**: the port parameter must be named `selectionPort`, not `selection`. The channel design itself is unchanged. |
| D-e controlled mode stops moving the caret | **WRONG AS ORIGINALLY STATED.** Correct only when narrowed to `caretAt === undefined`; the unnarrowed guard deletes block rows in both frameworks. Rewritten above. |
| D-f `anchorAt` seeds | **HOLDS** (modulo the `:269,285` citation, corrected). |
| D-g `path()` readers retire before the writer | **HOLDS.** |
| D-h `TokenHandle#token` survives | **HOLDS.** |
| D-i §4.6 item 5 executed by S1.6c | **HOLDS.** |
| D-j S1.6b flips nothing | **HOLDS** for the "no code change" claim, and is proven rather than argued. **Its Task 3 rider was WRONG:** the select-all browser gap was recorded as blocked by a Chromium cross-host selection clamp; there is no such clamp, the branch is reachable, and the gap is now closed by four tests per adapter plus one un-skipped test. See Task 3 Step 1. |

All ten contradictions hold. Two gained corrections: **#3** (§11's S1.6d scope
line repeats D9's losing half too, so it is a three-way contradiction) and
**#10** (resolves the *other* way — the mutation is gatable; Task 10 adds the
test).
