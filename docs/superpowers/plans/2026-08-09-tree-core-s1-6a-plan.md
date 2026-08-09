# Tree Core S1.6a (Wire Cutover, jsdom) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the tree core the live editor. `TokenModel` stops parsing the
value string and reconciling identity; it owns the tree, the boundary and the
transaction verbs, and feeds the one commit pipeline through `fromTransaction`.
`ValueModel` becomes a facade over it, `EditController.replace` lowers global
ranges to `applyRange`, `MarkController` writes through `applyStructural`, the
`beforeinput` all-selected branch is rewritten, D7's selection capture gains its
channel — and then the old watch wiring is deleted. Per spec
`2026-08-08-markput-s1-tree-core-v2.md` (v2.2) §11's S1.6a entry, D5, D6, D7,
D8, D9, §4.4, §4.6 and §1.2's block-mode carve-out.

**Architecture:** the token layer becomes the value owner. Store's declaration
order inverts — `tokens` is built before `value` — because the tree is the
source of truth for the string (D1) and the boundary needs the parser, the
snapshot memo and the pipeline feed, all of which already live in
`features/tokens/`. `ValueModel` survives one more phase as a two-member facade
(`current`, `replace`) so the ~8 offset-speaking call sites do not move in this
change; S1.8 deletes it. See decision **D-c**.

**Tech stack:** TypeScript, the shipped `tree/` and `model/` modules, Vitest.

**Prerequisites:** S1.1–S1.5 complete and committed on `b0`
(`12ead317..de8a4a27`).

**Plan status:** written 2026-08-09 against a completed S1.5, then
**adversarially verified by implementation**: a throwaway pass implemented this
plan end-to-end and ran it. Every "measured" claim below was produced against
this working tree in the real core project (Chromium); the transcripts are
inline.

**Verification status:** the suite is green at every task boundary **only after
the fixes now folded into this document**. Tasks 1, 3, 5 and 7 were RED as
written:

- **Task 1 Step 6** put the adoption inside an optional call's argument, so the
  harness sink never committed — `transactions.spec.ts:371` registers no
  `onResult`, so JS short-circuits the whole expression. Measured:
  `expected 'a@[x](m)b' to be 'Z@[x](m)b'`. This is the exact hazard the plan's
  own comment warns about two steps earlier.
- **Task 3 Step 1**'s second test contradicted Task 3 Step 3: `{start: 0,
  end: -1}` on an 11-char value IS the whole-value trigger, so `lowerReplace`
  gap-derives instead of returning the full window.
- **Task 5** broke four specs the plan did not list — `TokenModel.spec.ts:92`
  (§4.4's value/tokens consistency invariant, which forced the `#committed`
  amendment to D-d), `MarkController.spec.ts:338` and `:355` (one task earlier
  than Task 6 predicts), and `BlockController.spec.ts:52` — and its constructor
  parameter name collided with the existing `TokenModel.selection()` method
  (`TS2300`/`TS2403`/`TS2687`/`TS2322`).
- **Task 7 Step 1**'s `:557` port could not observe the self-heal: the tree
  harness's `render()` calls `container.replaceChildren(...)` with fresh spans,
  orphaning the corrupted node. Measured: `expected 'WRONG' to be 'he'`.

With those applied, the core suite measured **866 → 870 → 878 → 881 → 884 →
884 → 857** passing at the Task 1…7 boundaries (Task 7 deletes 850 spec lines),
and the final full run was **72 files, 1281 passed, 2 skipped, 13 todo**, with
the React and Vue storybook browser projects actually running and passing — a
good early signal for S1.6b. `format:check`, `lint:check`, `typecheck` and
`build` were all clean, and the rolldown DTS bundle resolved `TreeNode`,
`applyStructural` and `find` **without** widening `features/tokens/index.ts`.

**Decision audit outcome:** the decisions hold as written, with **one
exception** — D-d's "no mirror of `join(tree)`" clause is superseded; see the
amendment inside D-d. (The verification pass reported this as "D-3 holds except
for its no-mirror clause"; D-d is the decision carrying that clause.) All nine
contradictions listed at the end HOLD, including that this phase is not jsdom.

**Gates.** Every per-task gate LEADS with `pnpm run format` and includes
`pnpm run lint:check`. The pre-commit hook runs `oxfmt --check` and `oxlint`
with `denyWarnings: true`, so a tests-only gate merely defers the failure to
`git commit`. `import/no-cycle` is `error` — relevant here, because this change
inverts a module dependency.

**A naming correction up front.** The phase is called "jsdom" in spec §11 and
the roadmap. The core project does **not** run in jsdom: `vite.config.ts`
configures it as a Vitest **browser** project on Chromium via
`@vitest/browser-playwright`. The real distinction between S1.6a and S1.6b is
*core unit suite* vs *storybook React/Vue suites*. Read "jsdom" as "the core
suite" everywhere below. (Reported, not papered over — see Contradictions.)

---

## Decisions taken before writing this plan (do not re-litigate)

### D-a. `selectionBefore`'s channel: the BOUNDARY captures, not the dispatcher

`tree/types.ts` records the agreed channel as "dispatcher → `CommitSink.commit`
→ `adopt`, plus an injected `selection: () => Range | undefined` dep on
`createTransactions`". **That channel is wrong for the controlled path, and this
plan deviates from it.** The deviation is deliberate; the note in `types.ts` is
rewritten in Task 1 so nobody rediscovers the old one.

**Why the dispatcher cannot be the capture site.** In controlled mode
`sink.commit` does **not** adopt — it records `lastEmitted` and emits (D6). The
adoption that repairs the caret happens later, at the echo's `arrive`, an entry
the dispatcher never sees (`tree/boundary.ts:73`). A dispatcher-owned capture
would therefore hand `selectionBefore` to a commit that produces no result, and
leave the only adoption that *does* produce one with nothing. `reparse` has the
same problem. All three entries funnel through exactly one function —
`createBoundary`'s `fold` (`tree/boundary.ts:46-47`) — so that is the capture
site: one dep, one read, and `CommitSink.commit` keeps its two-argument shape
rather than gaining a parameter the controlled sink must accept and ignore.

**Is `fold`-time still "before adoption" as D7 demands?** Yes, and the gap is
empty: between verb entry and `fold` the dispatcher only reads (`tree.value()`,
`readOnly()`, liveness) and splices strings — no signal write, no DOM write, so
the selection cannot move. `arrive` reads `lastEmitted` and `tree.value()` and
nothing else. `fold` reads the selection, then parses, then adopts.

**How `SelectionController` supplies it without a cycle.** `Store` builds
`tokens` before `selection` and `SelectionController` takes `tokens`, so the
dependency is genuinely circular. It is resolved with a deferred thunk, not a
two-phase `bind…()` setter:

```ts
readonly tokens: TokenModel = new TokenModel(this.props, this.host, () => this.selection.range())
```

The thunk closes over `this` and is invoked only at commit/arrival time, by
which point every field is assigned. **The two `readonly` fields in the cycle
need explicit type annotations** — measured: without them `tsc` reports
`TS7022: 'a' implicitly has type 'any' because it does not have a type
annotation and is referenced directly or indirectly in its own initializer` on
both sides; with `readonly a: A = …` / `readonly b: B = …` the same file
typechecks clean. (Probe transcript: two-class cycle, `tsc --noEmit` exit 0
after annotating.) `TS2729` ("used before its initialization") is **not**
raised — TS only reports that for immediate use, not use inside a function body.

**Rejected alternative, recorded because it is tempting and cheaper:** capture
the DOM selection directly (`DomModel.selection()?.raw.range`), which needs no
injection at all. It loses because the repair loop must close against the range
`SelectionController` *stores* — that is what `#applyRange` re-applies and what
`placeAtHandle`/`position()` write programmatically — not against the DOM, which
lags a programmatic intent whose placement failed.

**Honest note on the caller.** `selectionBefore` gains no production consumer in
this phase; S1.6c's caret repair is the consumer. It is built here anyway
because only the producer can capture before adoption, and spec §11 assigns the
hook to S1.6a. It is gated by tests, not by a caller — call this out in the
review rather than letting it pass as surface-with-a-caller.

### D-b. `filterEmptyText` lives in the boundary's `fold`, keyed on `isBlock`

Today `TokenModel#reparse` applies `isBlock ? filterEmptyText(parsed) : parsed`
(`TokenModel.ts:214`) — top level only, never recursing into slot children. The
tree core applies it nowhere. It goes into `createBoundary`, on the one line
between "parse" and "adopt", because that is the only place every adoption
passes through and because the boundary already owns the other parse-policy
dependency (`parser`). `parseAndAdopt` is dissolved into an exported
`parseValue(parser, value)` plus a direct `adopt(…)` call: it had two callers
(the boundary and one line of `transactions.spec.ts`) and it is exactly the seam
the filter has to sit in.

**Why filtering is safe for the projection and the property gates.** Empty text
tokens contribute `''` to `joinNodes`, so `tree.value()` is unchanged by the
filter; positions are parser stamps that index the same string; and adoption's
index alignment holds because both sides of every comparison are filtered.
`snapshot(tree) ≡ parsed` still holds against the *filtered* parse — the §7.1
property suites drive `adopt` directly and never see the filter, so they are
untouched.

**Interaction with `NodeAnchor` (checked, and it is real).** Measured on
`'__slot__\n\n'` with `'aaa\n\nbbb\n\n'`:

```
filtered roots     mark#1[0,5]  mark#3[5,10]
unfiltered roots   text#1[0,0] mark#2[0,5] text#4[5,5] mark#5[5,10] text#7[10,10]
anchorAt(5)        filtered → text#4@0 (row 2's SLOT CHILD)   unfiltered → text#6@0
anchorAt(10)       filtered → {after: mark#3}                 unfiltered → a text anchor
```

So the filter changes `map`'s output shape in block mode exactly as §2.3
predicts ("between-row positions have no `TextNode`"): the document end becomes
a `{after: rowNode}` boundary anchor, and a between-row offset resolves *into
the next row's slot* rather than to `{after: previousRow}`. Neither is wrong for
a caret and neither has a consumer in this phase (`map` is consumed at S1.6c),
but S1.6c's repair must handle boundary-form anchors in block mode, and S1.7's
`insertMark(at)` must not assume a between-row anchor round-trips through
`anchorAt`. **Recorded here; not fixed here.**

### D-c. Ownership inverts: `TokenModel` becomes the value owner; `ValueModel` is a facade for one phase

Spec §4.4 says "the boundary owner is the evolved `ValueModel`". This plan puts
the tree, the boundary, the transactions and the snapshot memo in `TokenModel`
instead, and reduces `ValueModel` to `current` + `replace`. Three reasons, each
checkable:

1. **The boundary's dependencies already live in the token layer.** It needs
   `parser` (`TokenModel#parser`, derived from props), `isBlock` (D-b), the
   `SnapshotMemo`, and a synchronous `onResult` that calls
   `pipeline.apply(fromTransaction(…))`. Moving those into
   `features/state/ValueModel.ts` would make the state layer own the parser.
2. **`onResult` must be a direct callback, not an event.** §4.4 requires
   `tokens.current()` to stay consistent with `value.current()` at adoption, and
   `treeInput.ts` says so in its own header. If `ValueModel` were built first it
   could only expose the feed as an `event`, whose subscribers are deferred to
   batch end inside `EditController.replace`'s `batch` — the pipeline apply would
   land after the caret write. Direct callback ⇒ the consumer must exist at
   boundary-construction time ⇒ `tokens` first.
3. **S1.8 deletes `ValueModel` anyway** (spec §11 step 5). Consolidating the
   value state into the token layer now is on that path; keeping the facade for
   one phase keeps ~8 consumers (`SelectionController`, `keyboard/*`,
   `OverlayController`, `ClipboardController`, `BlockController`,
   `EditController`) out of this diff.

Consequence to call out at review: `Store`'s field order changes and
`TokenModel`'s constructor loses its `ValueModel` argument. Spec §2.3 accepts
this ("internal `Store` reshuffles during S1.4–S1.7 are visible to userland
selectors").

### D-d. The seed, the fallback and the four fields that replace one signal

**Measured today** (probe E/F, live `Store`):

```
props.set({value:'hello', defaultValue:'default'}); mount; props.set({value: undefined})
  → value.current() === 'default'
new Store(); value.current('internal'); props.set({value:'controlled'}); props.set({value: undefined})
  → value.current() === 'controlled' then 'internal'      (Store.spec.ts:113-121 pins this)
props.set({defaultValue:'first'}); mount; read; props.set({defaultValue:'second'})
  → value.current() stays 'first'                          (the lazy initial materializes once)
tokens.current().length before mount → 0, in every arrangement
```

So the pinned semantics are **not** "fall back to `defaultValue`" — they are
"fall back to the last *uncontrolled* value, whose seed is `defaultValue`".
That is literally what today's `signal({initial: () => defaultValue ?? '', get, set})`
stores: the setter returns `previous` while controlled, so storage freezes at
whatever the uncontrolled path last wrote.

The tree reproduces it with five small fields on `TokenModel`:

| field | role | replaces |
| --- | --- | --- |
| `#seed: Signal<string>` (`initial: () => props.defaultValue() ?? ''`) | the lazy default, materialized at first read exactly as today | the signal's `initial` |
| `#seeded: Signal<boolean>` | one-shot: the tree now holds a value | the signal's storage having been materialized |
| `#restore: string \| undefined` | the projection at the moment control was taken | the storage freezing during controlled mode |
| `#controlled: boolean` | edge detector for the transition above; a field, not derived from `watch`'s `prev`, so it survives the `onMounted` scope being torn down and rebuilt on a container swap | — |
| `#committed: Signal<string>` | the commit-generation marker `value` reads instead of `#tree.value()` — **see the amendment below** | the signal store's write-then-notify ordering |

```ts
readonly value: Computed<string> = computed(() =>
	this.props.value() ?? (this.#seeded() ? this.#committed() : this.#seed())
)
```

`#seeded` must be a **signal**, not a plain flag: on its first evaluation the
computed's dep set is `props.value` + `#seed`, and it would never re-run to pick
up the committed projection otherwise.

**AMENDMENT (measured; this supersedes the "no mirror of `join(tree)`" line that
stood here).** `value` must **not** read `#tree.value()` directly. Measured
post-cutover with the direct read, `features/tokens/TokenModel.spec.ts:92`
("current() is updated when value.current fires" — §4.4's value/tokens
consistency invariant) fails:

```
watch(value="hello")  tokens=[""]        ← subscriber runs here, tokens still stale
changed value="hello" tokens=["hello"]
onChange
```

The cause: `adopt()` writes `tree.roots` inside its **own** `batch`, and that
batch's flush notifies `value.current` subscribers **before** `onResult` runs
`pipeline.apply`. Two fixes were tried:

1. **Wrap `fold` in `batch`.** Fixes `TokenModel.spec.ts:92` but **breaks**
   `treePipeline.spec.ts:731` — D-g's own gate — because `changed` propagation is
   then deferred past the pipeline's committing window. Rejected.
2. **`#committed`.** A signal written in `onResult` *after* `pipeline.apply`,
   which `value` reads in place of `#tree.value()`. Fixes both; **verified
   full-suite green**. Taken.

`#committed` is not the mirror D-d ruled out. A mirror would be a second store
the write path maintains alongside the tree, from which the value could drift;
`#committed` has exactly one writer — `onResult`, after the pipeline has applied
— and its content is `join(tree)` read at that instant, so drift is
unrepresentable. It duplicates no *state*: it is a **commit-generation marker
that sequences the boundary read after the view is consistent**, which is
precisely what §4.4's "reads never see uncommitted state" requires. The tree
remains the single source of truth (D1); `#committed` only decides *when*
readers are allowed to look at it.

Do not re-open this: the direct-read and the `batch(fold)` variants have both
been measured red.

**The seed is `#ensureSeeded()`, called from the write shim and by the mount
watch — not only at mount.** Four existing specs edit or read an *unmounted*
store (`EditController.spec.ts:12,21,30,43,67,76,85`, `ValueModel.spec.ts:88,97,107`,
`Store.spec.ts:113`), and today they work because the value was a plain string.
The tree needs a materialization point at the same moment the old lazy signal
had one:

```ts
#ensureSeeded(): void {
	if (this.#seeded()) return
	this.#onExternalValue(this.props.value())
}
```

It routes through the same function the arrival watch uses, so an unmounted
*controlled* store seeds from `props.value` (required by `ValueModel.spec.ts:107`,
which expects `onChange('world')` from an unmounted controlled `replace`) and an
unmounted uncontrolled store seeds from `#restore ?? #seed()`.

Hand-traced against every value spec in the repo — see Task 5 Step 6 for the
table. `tokens.current()` stays empty before mount in the read-only
arrangements, because nothing seeds until a write or a mount.

### D-e. Whole-value replaces are re-derived through `gapWindow`; sub-range ops are passed through untouched

Spec §11 requires whole-value block ops to "route through gap-derived adoption
so node identity survives, NOT a bare tree replacement". Measured why, on
`'__slot__\n\n'`, deleting the middle of three rows
(`'aaa\n\nbbb\n\nccc\n\n'` → `'aaa\n\nccc\n\n'`), ids as allocated:

```
full window {0,15,10}   roots 1,3,5 → 1,3      removed [5,6]   ← row 3's node dies, row 2's node
                                                                 becomes row 3 (index pairing)
gapWindow    {5,10,0}   roots 1,3,5 → 1,5      removed [3,4]   ← row 3 KEEPS its id; row 2 dies
```

`BlockController` keys its per-row `BlockStore` on those ids, so the full window
moves a row's drag/hover state onto its neighbour. Today's live path uses the
full window too (`ValueModel.replace` records `#pendingEdit = {0, len, n}` for
`{start: 0, end: -1}`), so **this is a behavior change and an improvement** —
call it out in the commit body.

**Honest limit, measured, so nobody over-claims it:** the narrowing is defeated
whenever the rows share content with the row separator. Same markup,
`'one\n\ntwo\n\nthree\n\n'` → `'one\n\nthree\n\n'` gives `gapWindow` `{6,11,0}`
— `end` 11 lands *inside* row 3's span `[10,17]`, so the suffix walk's
`prev[tail].position.start >= window.end` bound fails and the middle re-pairs by
index anyway: roots `1,3,5 → 1,3`, identical to the full window. The clamp in
`gapWindow` (`Math.min(suffix, min(prev.length, next.length) - prefix)`) is what
eats it. The discriminating fixture for *identity* is therefore the
distinct-content one; the separator-only case records a non-improvement — though
only in its identity assertion. Its `{6,11,0}` window assertion is a genuine
gate on the gap-derivation itself (measured: mutation 5 breaks it).

**Sub-range ops are NOT narrowed.** Their window already IS the exact op window
(D2) — that is the whole point of the rewrite — and narrowing further would move
`map`'s fixed point for no identity gain. The trigger is exact and total: the
normalized range covers `[0, value.length]`.

### D-f. Ordering: adopt-then-emit wins; today's order is the opposite and changing it is a behavior change

**Measured today** (probe A, live `Store`, `'he@[x]llo'`, `edit.replace({9,9},'!')`):

```
1. onChange   value.current()='he@[x]llo'  tokens='he|@[x]|llo'  dom='llo'   ← ALL STALE
2. changed    value.current()='he@[x]llo!'                        dom='llo!'
```

`ValueModel.current`'s `set` transform calls `props.onChange()?.(next)` *before*
the signal stores `next` and long before the reparse watch runs, so today a
parent's `onChange` handler observes the pre-edit value, the pre-edit tokens and
the pre-edit DOM.

`tree/boundary.ts:61-66` folds (parse → adopt → `onResult` → pipeline → DOM
patch) and only then calls `onChange(next)`, with the reason written in the
code. **Keep the boundary's order.** After the cutover an `onChange` handler
sees the committed value, the fresh tokens and the patched DOM. Three
consequences, all to be named in the commit body:

- The improvement itself: `onChange` is no longer handed a value that
  `value.current()` contradicts.
- `changed`'s *subscribers* still run after `onChange` when the caller batches
  (`EditController.replace` wraps in `batch`, and `event()` defers propagation
  while `batchDepth > 0`). Only the DOM patch and the tree move earlier.
- **New hard failure mode:** an *uncontrolled* parent whose `onChange` handler
  synchronously calls an edit verb is now inside `dispatch`, so
  `transactions.assertIdle` throws `re-entrant transaction dispatch`. Today it
  re-enters the signal setter and survives. A *controlled* parent setting
  `props.value` synchronously is safe: `props.set` batches, so the arrival watch
  flushes after `dispatching` is cleared (pinned by
  `boundary.spec.ts`'s synchronous-echo case).

### D-g. `apply`'s re-entry guard stays; the two guards are not redundant

The carried question was whether `commit.ts`'s `if (committing) throw` is still
load-bearing once `transactions.assertIdle` guards the verbs. **It is**, and the
proof is already in the repo: `treePipeline.spec.ts:731` ("a synchronous arrival
from a changed watcher fails loud") reaches `pipeline.apply` through
`boundary.arrive`, which **bypasses the dispatcher entirely** — a props echo is
not a verb. After the cutover `arrive` is on the live props path, so that guard
covers a reachable production sequence (parent re-sets `value` from a `changed`
subscriber), not a synthetic one. Do not delete it, and do not "simplify" the
two into one.

### D-h. The memo/tree pairing is structural, and no test can discriminate it

`fromTransaction(result, memo, tree.roots())` reads the roots from outside the
result, so the memo and the tree must be the same pair for the input's lifetime.
After the cutover both are `readonly` private fields of the same `TokenModel`
instance, declared adjacently, never reassigned, and `onResult` — the sole
caller — closes over both. A discriminating test would need two trees sharing
one memo, which the construction makes unrepresentable. Record it as a comment
at the declaration site and as an ungated-by-construction item in Task 8, rather
than shipping a decorative test.

### D-i. `MarkController` keeps its write latch; only the write TARGET changes

`MarkController.spec.ts` pins two behaviors that a naive "resolve the node from
the tree" rewrite would break:

- `:338` "update() while a structural apply awaits its bind is a fail-closed
  no-op returning false" (this plan first cited `:333`; the `it(` is at `:338`,
  `:324` is the dead-handle case);
- `:355`ff the render-path contract, whose header comment marks the dead-handle
  write failure **SEMVER-MAJOR**.

**Both need a fixture change, and it lands at Task 5, not here** — the cutover
turns their `'different @[x]'` whole-value write into a text-path commit that
opens no pending window. See Task 5 Step 8b; the latch itself is unharmed and is
mutation-proven still load-bearing.

Both come from `store.tokens.handle(id)` being latch-gated. `applyStructural`
does not need the latch (a `TreeNode`'s `position` is always fresh — that is the
upgrade), but dropping it here would be a behavior change that spec §4.6 item 4
assigns to **S1.6d**. So `#resolve()` keeps the latch-gated handle lookup as the
*permission* check and additionally resolves the live `MarkNode` by id as the
*write target*.

Honest consequence: because the latch forbids writes exactly when the handle's
bind-generation position could differ from the node's live one, **no test can
show the node lookup doing better than `token.position`** in this phase. It is
gated only by parity. Recorded, not decorated.

### D-j. `fromReconcile` dies here; `tokenIdentity.ts` does not

`commitInput.ts` and `treePipeline.spec.ts` both say S1.6a deletes
`fromReconcile`. It goes, together with `commitInput.spec.ts` (84 lines, whose
only subject is that function — the tree lowering's delta mapping is
independently gated by `treeInput.spec.ts:84,107,138,180,188`), `commit.spec.ts`
(766 lines) and `treePipeline.spec.ts`'s `liveFaces` helper.
**`tokenIdentity.ts` (378 lines) and its two spec suites stay** — spec §11 puts
them in S1.6d, they remain green because they test themselves directly, and they
simply have no production caller for one phase. Say so in the review; do not
"tidy" them forward.

Four `commit.spec.ts` cases have no other gate and must be **moved** into
`treePipeline.spec.ts`, not dropped (Task 7 lists them line by line). The two
cases `treePipeline.spec.ts`'s coverage note already declined (`:141`, `:323`)
stay declined, for the reasons written there.

---

## File structure

**Create:**

- `packages/core/src/features/tokens/tree/offsetShim.ts` — `lowerReplace`, D-e's
  global-range → `applyRange` lowering. The internal offset shim spec D8 keeps.
- `packages/core/src/features/tokens/tree/offsetShim.spec.ts`
- `packages/core/src/features/tokens/parser/utils/filterEmptyText.ts` — moved out
  of `TokenModel.ts` (pure move in Task 2, then the boundary gains the caller).

**Modify:**

- `tree/types.ts` (110) — `SelectionRange`; rewrite the `selectionBefore` and
  `CommitSink.commit` notes.
- `tree/adopt.ts` (249) — `adopt` takes `selectionBefore`; `parseAndAdopt` →
  exported `parseValue`.
- `tree/boundary.ts` (137) — `selection` + `isBlock` deps; `fold` captures,
  parses, filters, adopts.
- `tree/boundary.spec.ts` (324), `tree/transactions.spec.ts` (426),
  `tree/adopt.spec.ts` — harness + new cases.
- `model/TokenModel.ts` (300) — the cutover: tree, memo, boundary, transactions,
  value state, `find`, `replace`, `applyStructural`; the reparse watch and the
  identity tracker go.
- `features/state/ValueModel.ts` (57) — becomes the facade.
- `store/Store.ts` (38) — order inversion + the selection thunk.
- `features/edit/EditController.ts` (29) — drop the duplicated `end < 0`
  normalization.
- `features/keyboard/input.ts` (130) — the `isAllSelected` branch rewrite.
- `features/keyboard/input.spec.ts` (84) — the two new branch cases.
- `features/tokens/MarkController.ts` (111) — `applyStructural`.
- `model/commitInput.ts` (94) — `fromReconcile` deleted, types kept.
- `model/treePipeline.spec.ts` (762) — `liveFaces` deleted, four cases moved in.
- `model/TokenModel.spec.ts` (388) — harness follows the constructor change.

**Delete:**

- `model/commit.spec.ts` (766) — after moving its four un-ported cases.
- `model/commitInput.spec.ts` (84).

**Do NOT touch:** `model/commit.ts`, `model/bind.ts`, `model/TokenHandle.ts`,
`tree/adopt.ts`'s walk bodies, `tree/transactions.ts`, `tree/snapshot*.ts`,
`model/treeInput.ts`, `tokenIdentity.ts` + its suites, `SelectionController.ts`
(S1.6c owns it), `block/operations.ts` (spec D8 keeps whole-value semantics),
`DomModel.ts`, `caret.ts`, any adapter, `features/tokens/index.ts`.

**Size (touch surface, per the spec's instruction):**

| | lines |
| --- | --- |
| Production read + verified | ~1,050 (`TokenModel` 300 + `adopt` 249 + `boundary` 137 + `MarkController` 111 + `input` 129 + `ValueModel` 57 + `Store` 38 + `EditController` 29) |
| Specs read + verified | ~2,600 (`commit.spec` 766 + `treePipeline.spec` 762 + `TokenModel.spec` 388 + `boundary.spec` 324 + `MarkController.spec` 390 excerpts + `ValueModel.spec` 129 + `EditController.spec` 92 + `input.spec` 84) |
| Production **edited** | ~330 |
| Production **net-new** | ~120 |
| Spec **written / moved** | ~450 |
| Spec **deleted** | 850 (`commit.spec` 766 + `commitInput.spec` 84) |

---

### Task 1: the `selectionBefore` channel (tree core, still unwired)

**Files:** modify `tree/types.ts`, `tree/adopt.ts`, `tree/boundary.ts`,
`tree/transactions.spec.ts`, `tree/boundary.spec.ts`.

- [ ] **Step 1: Write the failing tests**

```ts
// append to packages/core/src/features/tokens/tree/boundary.spec.ts
describe('boundary: pre-adoption selection capture (spec D7)', () => {
	/**
	 * The fixture is DISCRIMINATING by construction: the injected reader answers with
	 * a position that ADOPTION ITSELF MUTATES, so a capture moved after `adopt` reads a
	 * different number. `'ab@[x](m)cd'` puts the mark at [2,9]; inserting 'Z' at 0
	 * shifts it to [3,10]. Pre-adoption the reader says 2, post-adoption 3 — which is
	 * exactly D7's "adoption mutates positions in place, deriving afterwards
	 * double-shifts" failure, made observable.
	 */
	function captureSetup(
		source: string,
		options: {controlled?: boolean; selection?: () => SelectionRange | undefined} = {}
	) {
		const tree = createTokenTree(parser.parse(source))
		const results: TransactionResult[] = []
		const boundary = createBoundary({
			tree,
			parser: () => parser,
			controlled: () => options.controlled === true,
			onChange: () => {},
			selection:
				options.selection ??
				(() => {
					const mark = tree.roots()[1]
					return {start: mark.position.start, end: mark.position.start}
				}),
			onResult: result => results.push(result),
		})
		const tx = createTransactions({tree, readOnly: () => false, sink: boundary.sink})
		return {tree, boundary, tx, results}
	}

	it('captures the range BEFORE the commit adoption moves the positions it reads', () => {
		const {tree, tx, results} = captureSetup('ab@[x](m)cd')
		expect(tree.roots()[1].position.start).toBe(2)

		expect(tx.applyRange({start: 0, end: 0, insertedLength: 0}, 'Z')).toBe(true)

		expect(tree.roots()[1].position.start).toBe(3) // adoption moved it
		expect(results[0].selectionBefore).toEqual({start: 2, end: 2}) // the capture did not
	})

	it('captures at an ARRIVAL too — the only entry the controlled path repairs from', () => {
		const {tree, boundary, results} = captureSetup('ab@[x](m)cd', {controlled: true})
		boundary.arrive('Zab@[x](m)cd')
		expect(tree.roots()[1].position.start).toBe(3)
		expect(results[0].selectionBefore).toEqual({start: 2, end: 2})
	})

	it('captures at a reparse', () => {
		const {results, boundary} = captureSetup('ab@[x](m)cd')
		boundary.reparse()
		expect(results[0].selectionBefore).toEqual({start: 2, end: 2})
	})

	it('is undefined when the injected reader answers undefined', () => {
		// NOT A FAILING TEST and NOT DISCRIMINATING — see the note below. Built on
		// `captureSetup` (with the reader overridden) rather than the file's shared
		// `setup`, which registers no `onResult` at all.
		const {tx, results} = captureSetup('hello', {selection: () => undefined})
		expect(tx.applyRange({start: 0, end: 0, insertedLength: 0}, 'A')).toBe(true)
		expect(results[0].selectionBefore).toBeUndefined()
	})
})
```

Do **not** add an `onResult` to the file's shared `setup` — five other describes
depend on its current shape; that is why `captureSetup` carries the overridable
`selection` option.

**The fourth case cannot detect the feature** (measured): `selectionBefore` is
hardcoded `undefined` before Step 4, so this assertion passes against unmodified
code. Keep it as a null-case regression guard, not as a gate; the first three
cases are the gate.

- [ ] **Step 2: Run to verify failure**

Run: `pnpm -w exec vitest run packages/core/src/features/tokens/tree/boundary.spec.ts`
Expected: **3 failures, not 4** — the first three cases fail on their
assertions (`selectionBefore` is hardcoded `undefined`), the fourth passes.
Measured correction to this plan's first draft: vitest does **not** typecheck,
so the unknown `selection` dep is not what you see; `tsc` only speaks at the
gate.

- [ ] **Step 3: `tree/types.ts` — the type and the rewritten notes**

Add above `TransactionResult`:

```ts
/**
 * A selection range in projection coordinates. Structurally identical to
 * `shared/editorContracts`'s `Range` and deliberately re-declared on LAYERING
 * grounds: `tree/` is the core and must not reach up into the editor contracts
 * for a two-number record.
 */
export type SelectionRange = {readonly start: number; readonly end: number}
```

**Do not write the `import/no-cycle` rationale this plan first drafted — it is
false.** Measured: importing `type {Range}` from `shared/editorContracts` into
`tree/types.ts` lints clean. oxlint does not flag type-only cycles, and one
already exists —
`features/tokens/utils/serializeRange.ts:1` imports `type {Range}` from
`shared/editorContracts`, which itself imports `type {Token}` from
`../features/tokens` (`editorContracts.ts:1`), under `'import/no-cycle': 'error'`
(`oxlint.config.ts:25`). Re-declaring is still the right call; only the stated
reason changes. Shipping the wrong reason in a source comment is worse than
shipping no comment.

Replace the `selectionBefore` field and its comment with:

```ts
	/**
	 * The selection as it stood BEFORE this adoption (spec D7), or `undefined` when
	 * there was none. `map(offset)` is defined only for offsets in this coordinate
	 * space.
	 *
	 * Captured by `createBoundary`'s `fold` — the single funnel every adoption on the
	 * live path runs through (commit, arrival, reparse) — because adoption mutates
	 * stored positions in place and deriving the range afterwards double-shifts it.
	 *
	 * NOT captured by the dispatcher, which an earlier note here proposed: in
	 * controlled mode `commit` produces no result at all (it emits and waits), so the
	 * repair input is the range captured at the ECHO's arrival, an entry the
	 * dispatcher never sees. Capturing at the boundary also spares `CommitSink.commit`
	 * a third parameter that one of its two implementations would have to ignore.
	 * Consumed by `SelectionController` at S1.6c.
	 */
	selectionBefore: SelectionRange | undefined
```

And on `CommitSink.commit`, delete the trailing paragraph that promises an
optional pre-adoption parameter, leaving the base-invariant paragraph intact.

- [ ] **Step 4: `tree/adopt.ts` — the parameter and the `parseValue` split**

Replace `parseAndAdopt` with:

```ts
/**
 * Parse a projection with the configured parser. The parser-less fallback mirrors
 * the pre-cutover `TokenModel#reparse`: with no markups configured there is no
 * Parser instance and the whole value is one text token.
 */
export function parseValue(parser: Parser | undefined, value: string): Token[] {
	return parser ? parser.parse(value) : [createTextToken(value)]
}
```

Retire the `parseAndAdopt` wrapper: it had two callers, and the boundary's `fold`
now needs to interpose the block filter (Task 2) between the parse and the
adopt, which the wrapper's shape forbids.

Widen `adopt`:

```ts
export function adopt(
	tree: TokenTree,
	window: Window,
	parsed: readonly Token[],
	selectionBefore?: SelectionRange
): TransactionResult {
```

and return it instead of the hardcoded `undefined`:

```ts
		return {structural, render, added, removed, updated, shifted, selectionBefore, map}
```

Delete the two-line "`selectionBefore` stays undefined until the dispatcher…"
comment above the return — it is now false.

- [ ] **Step 5: `tree/boundary.ts` — the dep and the capture**

Add to the deps object, after `controlled`:

```ts
	/**
	 * Pre-adoption selection capture (spec D7). Read once per adoption, before the
	 * parse — see `TransactionResult.selectionBefore` for why the boundary and not the
	 * dispatcher owns this. Store supplies `() => selection.range()` as a deferred
	 * thunk (declaration order: `tokens` is built before `selection`), so it must not
	 * be called during construction — and it is not: only `fold` calls it.
	 */
	selection?: () => SelectionRange | undefined
```

and rewrite `fold`:

```ts
	const fold = (next: string, window: Window): void => {
		// Capture FIRST: `adopt` writes positions in place, so a range derived after it
		// is shifted twice (spec D7).
		const selectionBefore = deps.selection?.()
		const result = adopt(deps.tree, window, parseValue(deps.parser(), next), selectionBefore)
		// Adoption is the commit; it must not sit inside the optional call's argument,
		// which JS skips evaluating when no listener is registered.
		deps.onResult?.(result)
	}
```

- [ ] **Step 6: `tree/transactions.spec.ts` — follow the split**

Its `adoptingSink` (`:20-30`) is the only other `parseAndAdopt` caller. Replace
the body of `commit` with:

```ts
		commit(next, window) {
			// HOIST the adoption out of the optional call. `onResult` is optional and
			// `transactions.spec.ts:371` builds `adoptingSink(tree, () => undefined)` with
			// none, so `onResult?.(adopt(…))` skips evaluating its argument entirely and
			// the sink never commits.
			const result = adopt(tree, window, parseValue(parser(), next))
			onResult?.(result)
			return true
		},
```

and change the import from `{parseAndAdopt}` to `{adopt, parseValue}`.

**This is the plan's own hazard, and the first draft walked into it.** Measured
with the argument-position form: `transactions.spec.ts:371` ("commits the whole
value as one text token when no parser is configured") fails with
`expected 'a@[x](m)b' to be 'Z@[x](m)b'`. Step 5's `fold` carries the same
warning in a comment — apply it here too.

- [ ] **Step 7: Gate**

Run: `pnpm run format && pnpm -w exec vitest run packages/core && pnpm run typecheck && pnpm run lint:check`
Expected: PASS. The live path is untouched — `TokenModel` does not import the
boundary yet.

- [ ] **Step 8: Commit**

```bash
pnpm run format
git add packages/core/src/features/tokens/tree/types.ts \
        packages/core/src/features/tokens/tree/adopt.ts \
        packages/core/src/features/tokens/tree/boundary.ts \
        packages/core/src/features/tokens/tree/boundary.spec.ts \
        packages/core/src/features/tokens/tree/transactions.spec.ts
git commit -m "feat(tree): S1.6a selectionBefore channel — the boundary captures before adoption"
```

---

### Task 2: `filterEmptyText` into the boundary (tree core, still unwired)

**Files:** create `parser/utils/filterEmptyText.ts`; modify
`model/TokenModel.ts` (import only), `tree/boundary.ts`,
`tree/boundary.spec.ts`.

- [ ] **Step 1: Pure move**

Cut the private `filterEmptyText` from the bottom of `TokenModel.ts` into a new
module and import it back, so this step changes no behavior:

```ts
// packages/core/src/features/tokens/parser/utils/filterEmptyText.ts
import type {Token} from '../types'

/**
 * Block mode's parse policy (spec §1.2, §2.3): drop zero-length TOP-LEVEL text
 * tokens so rows are the only roots. Deliberately not recursive — a slot's
 * children are its content and an empty one there is real.
 *
 * Consequence the addressing model depends on: with no text token between two
 * rows, a between-row position has no `TextNode` and is addressed by
 * `{after: rowNode}`.
 */
export function filterEmptyText(tokens: readonly Token[]): Token[] {
	return tokens.filter(token => token.type !== 'text' || token.position.start !== token.position.end)
}
```

- [ ] **Step 2: Write the failing tests**

```ts
// append to packages/core/src/features/tokens/tree/boundary.spec.ts
const rowParser = new Parser(['__slot__\n\n'])

describe('boundary: block mode keeps filterEmptyText (spec §1.2)', () => {
	function blockSetup(source: string, isBlock: () => boolean) {
		const tree = createTokenTree(filterEmptyText(rowParser.parse(source)))
		const boundary = createBoundary({
			tree,
			parser: () => rowParser,
			isBlock,
			controlled: () => false,
			onChange: () => {},
		})
		const tx = createTransactions({tree, readOnly: () => false, sink: boundary.sink})
		return {tree, boundary, tx}
	}

	it('adopts rows only — no empty text node between or around them', () => {
		const {tree, tx} = blockSetup('aaa\n\nbbb\n\n', () => true)
		expect(tree.roots().map(n => n.kind)).toEqual(['mark', 'mark'])

		expect(tx.applyRange({start: 1, end: 1, insertedLength: 0}, 'X')).toBe(true)

		expect(tree.roots().map(n => n.kind)).toEqual(['mark', 'mark'])
		expect(tree.value()).toBe('aXaa\n\nbbb\n\n')
		expect(stripIds(snapshot(tree.roots()))).toEqual(filterEmptyText(rowParser.parse('aXaa\n\nbbb\n\n')))
	})

	it('the filter is top-level only: a slot keeps its own children', () => {
		// The EMPTY-slot row is load-bearing. Measured: `'\n\nbbb\n\n'` parses to
		// [text, mark, text, mark, text] and filters to two marks, of which the FIRST
		// has one zero-length `text` child — the node a recursive filter would eat.
		// With 'aaa\n\nbbb\n\n' (this plan's first draft) both slots are non-empty, so
		// a recursive filterEmptyText is indistinguishable and Task 8's mutation 4
		// survives the entire 870-test core suite.
		const {tree} = blockSetup('\n\nbbb\n\n', () => true)
		const row = tree.roots()[0]
		if (row.kind !== 'mark') throw new Error('expected a row mark')
		expect(row.children().map(n => n.kind)).toEqual(['text'])
	})

	it('inline mode keeps the empty texts, so the same value adopts five roots', () => {
		const {tree} = blockSetup('aaa\n\nbbb\n\n', () => false)
		// The tree was BUILT filtered; the first inline adoption restores the parser's
		// alternation, which is exactly what an isBlock flip must do.
		const boundary = createBoundary({
			tree,
			parser: () => rowParser,
			isBlock: () => false,
			controlled: () => false,
			onChange: () => {},
		})
		boundary.reparse()
		expect(tree.roots().map(n => n.kind)).toEqual(['text', 'mark', 'text', 'mark', 'text'])
	})

	it('the projection is identical either way — empty text contributes nothing to join', () => {
		const block = blockSetup('aaa\n\nbbb\n\n', () => true)
		const inline = blockSetup('aaa\n\nbbb\n\n', () => false)
		inline.boundary.reparse()
		expect(block.tree.value()).toBe(inline.tree.value())
	})
})
```

Import `filterEmptyText` from `'../parser/utils/filterEmptyText'` and `Parser`
is already imported.

- [ ] **Step 3: Run — ONE of the four new tests fails** (measured). Only "adopts
      rows only" is red: it is the single case that adopts through the boundary
      with `isBlock` true, and without the dep the adoption restores the parser's
      alternation (5 roots vs 2). The other three read a tree that was already
      built filtered, or assert the *unfiltered* inline shape, so they pass
      before the implementation exists.

- [ ] **Step 4: Implement**

Add the dep:

```ts
	/**
	 * Block mode's parse policy (spec §1.2). Read per adoption, so an `isBlock` flip is
	 * honored by the next `reparse` without a second code path. Deferred here from S1.4
	 * (decision D-e of that plan): the tree core applied the filter nowhere, and block
	 * wiring is S1.6a's.
	 */
	isBlock?: () => boolean
```

and interpose it in `fold`:

```ts
		const parsed = parseValue(deps.parser(), next)
		const tokens = deps.isBlock?.() === true ? filterEmptyText(parsed) : parsed
		const result = adopt(deps.tree, window, tokens, selectionBefore)
```

Also delete the "Parser-only by decision D-e" paragraph in `reparse` — the
filter now applies there too, which is what an `isBlock` flip needs.

- [ ] **Step 5: Gate**

Run: `pnpm run format && pnpm -w exec vitest run packages/core && pnpm run typecheck && pnpm run lint:check`

- [ ] **Step 6: Commit**

```bash
pnpm run format
git add packages/core/src/features/tokens/parser/utils/filterEmptyText.ts \
        packages/core/src/features/tokens/model/TokenModel.ts \
        packages/core/src/features/tokens/tree/boundary.ts \
        packages/core/src/features/tokens/tree/boundary.spec.ts
git commit -m "feat(tree): S1.6a block-mode empty-text filter moves into the boundary"
```

---

### Task 3: `lowerReplace` — the internal offset shim (tree core, still unwired)

**Files:** create `tree/offsetShim.ts`, `tree/offsetShim.spec.ts`.

- [ ] **Step 1: Write the failing tests**

```ts
// packages/core/src/features/tokens/tree/offsetShim.spec.ts
import {describe, expect, it} from 'vitest'

import {Parser} from '../parser/Parser'
import {filterEmptyText} from '../parser/utils/filterEmptyText'
import {adopt} from './adopt'
import {lowerReplace} from './offsetShim'
import {createTokenTree} from './tree'

const rows = new Parser(['__slot__\n\n'])

describe('lowerReplace', () => {
	it('passes a sub-range op through as the exact op window', () => {
		expect(lowerReplace('hello world', {start: 6, end: 11}, 'markput')).toEqual({
			window: {start: 6, end: 11, insertedLength: 7},
			text: 'markput',
		})
	})

	it('normalizes the end < 0 sentinel on a SUB-RANGE op', () => {
		// This is the case that isolates normalization: `{6,-1}` is not the whole value,
		// so it takes the pass-through arm and `end` must have become 11.
		expect(lowerReplace('hello world', {start: 6, end: -1}, 'markput')).toEqual({
			window: {start: 6, end: 11, insertedLength: 7},
			text: 'markput',
		})
	})

	it('the end < 0 sentinel over the WHOLE value is gap-derived, not passed through', () => {
		// This plan's first draft asserted {0,11,8}/'replaced' here and CONTRADICTED
		// Step 3: `{0,-1}` on an 11-char value IS the whole-value trigger, so the op is
		// re-derived through gapWindow. Measured: {0,10,7} / 'replace' — the shared
		// trailing 'd' is a common suffix, so it is not part of the gap.
		expect(lowerReplace('hello world', {start: 0, end: -1}, 'replaced')).toEqual({
			window: {start: 0, end: 10, insertedLength: 7},
			text: 'replace',
		})
	})

	it('rejects the ranges replaceInString rejected', () => {
		expect(lowerReplace('hello', {start: -1, end: 1}, 'x')).toBeUndefined()
		expect(lowerReplace('hello', {start: 4, end: 2}, 'x')).toBeUndefined()
		expect(lowerReplace('hello', {start: 0, end: 6}, 'x')).toBeUndefined()
	})

	it('re-splices whole-value ops so the window is the real gap', () => {
		// 'aaa\n\nbbb\n\nccc\n\n' → 'aaa\n\nccc\n\n' (row 2 deleted). The op the caller
		// hands in is {0,15}; the gap is {5,10} with nothing inserted.
		const op = lowerReplace('aaa\n\nbbb\n\nccc\n\n', {start: 0, end: -1}, 'aaa\n\nccc\n\n')
		expect(op).toEqual({window: {start: 5, end: 10, insertedLength: 0}, text: ''})
	})

	it('the re-splice reproduces the caller-supplied value exactly', () => {
		// The whole contract in one line: whatever the narrowing does, applying the
		// window plus the sliced text to the old value must yield the new one.
		const cases: [string, string][] = [
			['aaa\n\nbbb\n\nccc\n\n', 'aaa\n\nccc\n\n'],
			['hello world', 'replaced'],
			['', 'first'],
			['hello', ''],
			['abc', 'abc'],
			['one\n\ntwo\n\nthree\n\n', 'one\n\nthree\n\n'],
		]
		for (const [value, next] of cases) {
			const op = lowerReplace(value, {start: 0, end: -1}, next)
			if (!op) throw new Error(`unexpected rejection for ${JSON.stringify(value)}`)
			const {window, text} = op
			expect(value.slice(0, window.start) + text + value.slice(window.end)).toBe(next)
			expect(text.length).toBe(window.insertedLength)
		}
	})

	it('KEEPS ROW IDENTITY where the full window loses it', () => {
		// The identity claim, measured both ways. Distinct row content is load-bearing:
		// see the separator-only case below, where the two windows agree.
		const source = 'aaa\n\nbbb\n\nccc\n\n'
		const next = 'aaa\n\nccc\n\n'
		const parse = (v: string) => filterEmptyText(rows.parse(v))

		const full = createTokenTree(parse(source))
		const fullIds = full.roots().map(n => n.id)
		adopt(full, {start: 0, end: source.length, insertedLength: next.length}, parse(next))
		expect(full.roots().map(n => n.id)).toEqual([fullIds[0], fullIds[1]]) // row 3's node died

		const narrowed = createTokenTree(parse(source))
		const ids = narrowed.roots().map(n => n.id)
		const op = lowerReplace(source, {start: 0, end: -1}, next)
		if (!op) throw new Error('expected an op')
		adopt(narrowed, op.window, parse(next))
		expect(narrowed.roots().map(n => n.id)).toEqual([ids[0], ids[2]]) // row 3 SURVIVED
	})

	it('RECORDED NON-IMPROVEMENT: rows that repeat the separator fall back to index pairing', () => {
		// 'one\n\ntwo\n\nthree\n\n' → 'one\n\nthree\n\n' gives {6,11,0}. `end` 11 lands
		// INSIDE row 3's span [10,17], so adoption's suffix bound
		// (`prev[tail].position.start >= window.end`) fails and the middle re-pairs by
		// index — the same outcome as the full window. gapWindow's clamp
		// (min(suffix, min(len) - prefix)) is what eats the narrowing. The IDENTITY
		// assertion below is a recorded non-improvement, not a defect gate; the WINDOW
		// assertion is a real gate — measured, it fails if whole-value ops stop being
		// gap-derived ({0,17,12} instead of {6,11,0}).
		const source = 'one\n\ntwo\n\nthree\n\n'
		const next = 'one\n\nthree\n\n'
		const parse = (v: string) => filterEmptyText(rows.parse(v))
		const tree = createTokenTree(parse(source))
		const ids = tree.roots().map(n => n.id)
		const op = lowerReplace(source, {start: 0, end: -1}, next)
		if (!op) throw new Error('expected an op')
		expect(op.window).toEqual({start: 6, end: 11, insertedLength: 0})
		adopt(tree, op.window, parse(next))
		expect(tree.roots().map(n => n.id)).toEqual([ids[0], ids[1]])
	})
})
```

Hand-traced ids for the two identity cases: `createTokenTree` allocates depth
first, so `'aaa\n\nbbb\n\nccc\n\n'` filtered gives roots `mark#1` (child
`text#2`), `mark#3` (child `#4`), `mark#5` (child `#6`) — measured
`[1, 3, 5]`. Full window → `[1, 3]` with `removed [5, 6]`; gap window →
`[1, 5]` with `removed [3, 4]`.

- [ ] **Step 2: Run to verify failure** — `./offsetShim` not found.

- [ ] **Step 3: Implement**

```ts
// packages/core/src/features/tokens/tree/offsetShim.ts
import {gapWindow} from './gapWindow'
import type {Window} from './types'

/**
 * The internal offset shim (spec D8): a global `{start, end}` range → the
 * `applyRange` primitive. Block mode, the keyboard, the clipboard and the overlay
 * still address the document by offsets; they lower here until the block-rows
 * follow-up (§9) gives them node-anchored verbs. Its lifetime is that follow-up's,
 * NOT S1.7's.
 *
 * `end < 0` means "to the end of the value" — the sentinel `EditController`
 * documents and the seven whole-value call sites use (`BlockController.ts:35`,
 * `blockEdit.ts:84,132,278`, `input.ts:37,60,129`).
 *
 * WHOLE-VALUE ops are re-derived through `gapWindow` instead of being passed
 * through as `{0, length}`. Those callers synthesize a complete new string and have
 * no real edit span; a full window makes both adoption walks inert, so every row is
 * re-paired BY INDEX and deleting row 2 of three keeps row 2's node (now holding
 * row 3's content) while row 3's node dies — moving `BlockController`'s per-row
 * store onto the wrong row. Measured, and gated in offsetShim.spec.ts, together
 * with the case where the narrowing does NOT help (rows repeating the separator).
 *
 * Sub-range ops pass through untouched: their window already IS the exact op
 * window (spec D2), and narrowing it further would move `map`'s fixed point for no
 * identity gain.
 */
export function lowerReplace(
	value: string,
	range: {readonly start: number; readonly end: number},
	replacement: string
): {window: Window; text: string} | undefined {
	const end = range.end < 0 ? value.length : range.end
	if (range.start < 0 || end < range.start || end > value.length) return undefined
	if (range.start !== 0 || end !== value.length) {
		return {window: {start: range.start, end, insertedLength: replacement.length}, text: replacement}
	}
	const window = gapWindow(value, replacement)
	return {window, text: replacement.slice(window.start, window.start + window.insertedLength)}
}
```

Why the re-splice is total, not merely tested: `gapWindow`'s `start` is a common
prefix length and its clamped suffix is a common suffix of both strings, so
`value.slice(0, start) === replacement.slice(0, start)` and
`value.slice(end) === replacement.slice(start + insertedLength)`; the three
pieces concatenate back to `replacement` by construction. The clamp also keeps
`insertedLength >= 0` and `end >= start`, so `transactions.submit` never
rejects the lowered op.

- [ ] **Step 4: Gate**

Run: `pnpm run format && pnpm -w exec vitest run packages/core && pnpm run typecheck && pnpm run lint:check`

- [ ] **Step 5: Commit**

```bash
pnpm run format
git add packages/core/src/features/tokens/tree/offsetShim.ts \
        packages/core/src/features/tokens/tree/offsetShim.spec.ts
git commit -m "feat(tree): S1.6a offset shim — global ranges lower to applyRange, whole-value ops gap-derived"
```

---

### Task 4: the `isAllSelected` beforeinput branch (live, behavior fix)

**Files:** modify `features/keyboard/input.ts`, `features/keyboard/input.spec.ts`.

Landed **before** the cutover on purpose: it is a live behavior change with a
small blast radius, and attributing it is far easier when it is not inside the
same commit as the wiring flip.

- [ ] **Step 1: Write the failing tests**

```ts
// append to packages/core/src/features/keyboard/input.spec.ts, inside describe('handleBeforeInput()')
	it('does not wipe the value when an unhandled input type arrives with everything selected', () => {
		// MEASURED BUG, not a hypothesis: today the all-selected branch computes
		// `event.data ?? ''` for every non-delete input type, so Enter (insertParagraph,
		// data === null) preventDefaults and replaces the WHOLE value with ''. Measured
		// on a mounted store with defaultValue 'hello': {value: '', prevented: true}.
		// The ordinary (not-all-selected) path already ignores these types, because
		// replacementForInput returns undefined for them.
		const {store, container} = mountStructuralInline()
		store.selection.selectAll()
		expect(store.selection.isAllSelected()).toBe(true)
		const event = new InputEvent('beforeinput', {inputType: 'insertParagraph', bubbles: true, cancelable: true})

		container.dispatchEvent(event)

		expect(store.value.current()).toBe('hello')
		expect(event.defaultPrevented).toBe(false)
		container.remove()
	})

	it('still replaces the whole value on insertText with everything selected', () => {
		const {store, container} = mountStructuralInline()
		store.selection.selectAll()
		const event = new InputEvent('beforeinput', {
			inputType: 'insertText',
			data: 'a',
			bubbles: true,
			cancelable: true,
		})

		container.dispatchEvent(event)

		expect(event.defaultPrevented).toBe(true)
		expect(store.value.current()).toBe('a')
		container.remove()
	})

	it('still clears the whole value on a delete input type with everything selected', () => {
		const {store, container} = mountStructuralInline()
		store.selection.selectAll()
		const event = new InputEvent('beforeinput', {
			inputType: 'deleteContentBackward',
			bubbles: true,
			cancelable: true,
		})

		container.dispatchEvent(event)

		expect(event.defaultPrevented).toBe(true)
		expect(store.value.current()).toBe('')
		container.remove()
	})
```

`mountStructuralInline()` already exists in the file (`:5`); these events carry
no target ranges on purpose — the all-selected branch runs before
`rawRangeFromInputEvent`.

- [ ] **Step 2: Run — the first test fails** (`value` is `''`, `prevented` is
      `true`); the other two pass and are regression guards for Step 3.

- [ ] **Step 3: Implement**

Replace the all-selected branch of `handleBeforeInput` (`input.ts:53-62`):

```ts
	if (store.selection.isAllSelected()) {
		// The `paste` listener owns this one end-to-end: it consumes the markup
		// clipboard entry and performs the whole-value replace itself.
		if (event.inputType === 'insertFromPaste') {
			event.preventDefault()
			return
		}
		// Same replacement policy as the ordinary path below, instead of a private
		// `event.data ?? ''`. That shortcut treated every unhandled input type as
		// "replace everything with the empty string", so Enter (insertParagraph) and a
		// drop (insertFromDrop, whose payload is on dataTransfer) wiped the value; it
		// also ignored the markup clipboard on insertReplacementText.
		const replacement = replacementForInput(container, event)
		if (replacement === undefined) return
		event.preventDefault()
		store.edit.replace({start: 0, end: -1}, replacement)
		return
	}
```

`handleDeleteKey`'s own all-selected branch (`:35-39`) is untouched: Backspace
and Delete are handled at `keydown` and never reach `beforeinput`.

**VERIFIED (implementation pass).** The bug reproduces exactly as described —
pre-cutover, mounted, `defaultValue: 'hello'`, `selectAll()`, `insertParagraph`
→ `{value: '', prevented: true}` — and this fix works. The behavior delta is
**confined to the all-selected branch**: input types the ordinary path ignores
now fall through un-prevented (parity with that path), and
`insertReplacementText` now consults the markup clipboard and consumes the
stash. **Block-mode Enter is unaffected** (measured; the all-selected branch is
the only edited code, and ordinary block-mode Enter does not enter it).

- [ ] **Step 4: Gate**

Run: `pnpm run format && pnpm -w exec vitest run packages/core && pnpm run typecheck && pnpm run lint:check`

- [ ] **Step 5: Commit**

```bash
pnpm run format
git add packages/core/src/features/keyboard/input.ts packages/core/src/features/keyboard/input.spec.ts
git commit -m "fix(keyboard): S1.6a all-selected beforeinput uses the shared replacement policy

BEHAVIOR CHANGE: with everything selected, input types the ordinary path ignores
(insertParagraph, insertLineBreak, insertFromDrop, formatBold, …) are no longer
preventDefaulted and no longer replace the whole value with ''. Measured before
this change: Enter with all selected cleared the input. insertReplacementText now
also consults the markup clipboard and dataTransfer, as the ordinary path does."
```

---

### Task 5: THE CUTOVER — Store wiring, the value hinge, the pipeline feed

**Files:** modify `model/TokenModel.ts`, `features/state/ValueModel.ts`,
`store/Store.ts`, `features/edit/EditController.ts`,
`model/TokenModel.spec.ts`, `features/state/ValueModel.spec.ts`,
`tree/tree.ts`, **`features/tokens/TokenModel.spec.ts`**,
**`features/tokens/MarkController.spec.ts`**,
**`features/block/BlockController.spec.ts`**.

The last three were **missing from this plan's first draft and each went red at
this task** (measured). They are handled in Steps 8a–8c; do not discover them at
the gate.

This is the "wire" commit of spec §11's "two commits inside the change". After
it the tree core drives the live editor; Task 7 removes what it orphans.

- [ ] **Step 1: Rewrite `TokenModel`'s wiring section**

Keep the entire "Consumer reads / Adapter SPI / Engine SPI" layout. The changes:

Constructor and deps:

```ts
	constructor(
		private readonly props: PropsModel,
		private readonly host: Host,
		/**
		 * Pre-adoption selection capture (spec D7), injected because `Store` builds
		 * `tokens` before `selection`. Invoked only from the boundary's `fold`, i.e. at
		 * commit/arrival time — never during construction.
		 *
		 * NAMED `selectionBefore`, not `selection`: this class already has a
		 * `selection(): SelectionSnapshot | undefined` Engine SPI method
		 * (`TokenModel.ts:136`). Measured with the colliding name: TS2300 (duplicate
		 * identifier), TS2403 / TS2687 on the two declarations, plus TS2322 where the
		 * boundary dep then binds to the DOM snapshot reader instead of the injected
		 * thunk.
		 */
		private readonly selectionBefore: () => Range | undefined
	) {
		host.onMounted(() => {
			// ONE watch over the (value, parser, isBlock) tuple, exactly as the pre-cutover
			// shell had: a simultaneous props change is one wave and one commit, where three
			// separate watches would adopt (and announce) two or three times.
			watch(
				() => ({
					value: this.props.value(),
					parser: this.#parser(),
					isBlock: this.props.layout.isBlock(),
				}),
				(next, previous) => {
					if (previous && next.value === previous.value && this.#seeded()) {
						// Only the tokenization changed: re-derive from the unchanged projection.
						this.#boundary.reparse()
						return
					}
					this.#onExternalValue(next.value)
				},
				{immediate: true}
			)
			watch(host.rendered, () => this.#pipeline.onRendered(), {immediate: true})
		})
	}
```

The value state (D-d), declared together so the pairing is visible:

```ts
	/** THE tree (spec D1). Paired for life with `#memo` — `fromTransaction` reads the
	 * roots from outside the result, so the two must describe the same tree; both are
	 * readonly fields of this instance and `#onResult` is their only caller. */
	readonly #tree = createTokenTree([])
	readonly #memo = createSnapshotMemo()

	/** The lazily-materialized default — the pre-cutover `ValueModel.current`'s
	 * `initial`, kept verbatim so a `defaultValue` set after the first read stays a
	 * no-op (measured). */
	readonly #seed = signal({initial: () => this.props.defaultValue() ?? ''})
	/** One-shot: the tree holds a value. A SIGNAL, not a flag — `value` routes on it,
	 * and a plain field would leave that computed permanently subscribed to `#seed`. */
	readonly #seeded = signal({initial: false})
	/** The projection at the moment control was taken; where an uncontrolled fallback
	 * returns to. Undefined until the first uncontrolled→controlled transition. */
	#restore: string | undefined
	/** Edge detector for that transition. A field, not `watch`'s `previous`, so a
	 * container swap (which tears down and rebuilds the onMounted scope) cannot make a
	 * remount look like a fresh uncontrolled→controlled edge. */
	#controlled = false

	/**
	 * The commit-generation marker (D-d's amendment): `join(tree)` as of the last
	 * COMPLETED commit, written by `#onResult` AFTER `pipeline.apply`. `value` reads
	 * this and never `#tree.value()` directly, because `adopt()` writes `tree.roots`
	 * inside its own `batch` whose flush would notify value subscribers while the
	 * token view is still stale — measured against §4.4's consistency invariant
	 * (`features/tokens/TokenModel.spec.ts:92`). Not a second store: one writer, and
	 * its content is the tree's own projection.
	 */
	readonly #committed = signal({initial: ''})

	/**
	 * THE value read (spec §4.4): controlled → the props value; uncontrolled → the
	 * last COMMITTED projection. There is no separate uncontrolled string: the tree IS
	 * the store, `#committed` only sequences when readers may look at it, and `#seed`
	 * only covers the window before the tree is materialized.
	 */
	readonly value: Computed<string> = computed(() =>
		this.props.value() ?? (this.#seeded() ? this.#committed() : this.#seed())
	)
```

**Formatting note:** that `computed(...)` call is **not oxfmt-stable** as
printed. The gate LEADS with `pnpm run format`, so the committed diff will not
match this plan's text character-for-character. Take oxfmt's output; do not
hand-restore this shape.

The boundary and the verbs:

```ts
	readonly #boundary = createBoundary({
		tree: this.#tree,
		parser: () => this.#parser(),
		isBlock: () => this.props.layout.isBlock(),
		controlled: () => this.props.value() !== undefined,
		selection: () => this.selectionBefore(),
		onChange: next => this.props.onChange()?.(next),
		// Synchronous by contract (spec §4.4): `tokens.current()` must be consistent with
		// `value.current()` the moment adoption lands, because seven call sites slice the
		// value by positions read from the snapshot.
		//
		// ORDER IS LOAD-BEARING: `#committed` is written AFTER `pipeline.apply`, and it is
		// the only thing `value` depends on. Publishing it first (or letting `value` read
		// `#tree.value()`) hands subscribers a new string over a stale token view —
		// measured red against `features/tokens/TokenModel.spec.ts:92`. See D-d.
		onResult: result => {
			this.#pipeline.apply(fromTransaction(result, this.#memo, this.#tree.roots()))
			this.#committed(this.#tree.value())
		},
	})

	readonly #tx = createTransactions({
		tree: this.#tree,
		readOnly: () => this.props.readOnly(),
		sink: this.#boundary.sink,
	})
```

Arrival routing and seeding:

```ts
	#arrive(value: string): void {
		this.#seeded(true)
		this.#boundary.arrive(value)
	}

	/** One router for every external value: the props watch, and `#ensureSeeded`. */
	#onExternalValue(value: string | undefined): void {
		const controlled = value !== undefined
		// Entering controlled mode freezes where an uncontrolled fallback returns to —
		// the pre-cutover signal did this implicitly by refusing to store while
		// controlled. Measured pins: ValueModel.spec.ts:53 (never uncontrolled → the
		// default) and Store.spec.ts:113 (uncontrolled edit first → that edit's value).
		if (controlled && !this.#controlled) this.#restore = this.#seeded() ? this.#tree.value() : undefined
		this.#controlled = controlled
		this.#arrive(value ?? this.#restore ?? this.#seed())
	}

	/**
	 * The tree's materialization point. The pre-cutover value was a lazily-initialized
	 * signal that worked on an UNMOUNTED store; several specs still edit one, so the
	 * write path materializes the tree on first use rather than waiting for mount.
	 */
	#ensureSeeded(): void {
		if (this.#seeded()) return
		this.#onExternalValue(this.props.value())
	}
```

The write surface:

```ts
	/**
	 * @internal The internal offset shim (spec D8): a global range → `applyRange`.
	 * THE write entry for every offset-speaking caller; `ValueModel.replace` is a
	 * one-line delegation to it.
	 */
	replace(range: Range, replacement: string): boolean {
		this.#ensureSeeded()
		// The op must be lowered in the TREE's coordinate space — that is what
		// `transactions.dispatch` splices. It equals `value()` whenever seeded: in
		// controlled mode the tree holds the last arrival, and a mid-flight emission does
		// not move it (spec D6).
		const op = lowerReplace(untracked(() => this.#tree.value()), range, replacement)
		if (!op) return false
		return this.#tx.applyRange(op.window, op.text)
	}

	/** @internal Whole-node replacement (spec D5) — `MarkController`'s write path. */
	applyStructural(target: TreeNode, replacement: string): boolean {
		this.#ensureSeeded()
		return this.#tx.applyStructural(target, replacement)
	}

	/** Spec §2.3's `input.find`: resolve a stable id to its live node. */
	find(id: number): TreeNode | undefined {
		return untracked(() => findNode(this.#tree.roots(), id))
	}
```

Deletions in this file: the `ValueModel` import and constructor parameter, the
`createIdentityTracker` import and `#identity` field, `#reparse`, the
`fromReconcile` import and call, the `createTextToken` import, and the
`filterEmptyText` import Task 2 left behind. `idFor` on the pipeline deps
becomes `token => token.id` — every snapshot token carries its node's id
(`snapshot.ts`), which is what `treePipeline.spec.ts`'s harness already relies
on.

- [ ] **Step 2: Add `findNode` to `tree/tree.ts`**

```ts
/** Depth-first id lookup over live nodes (spec §2.3's `input.find`). */
export function findNode(nodes: readonly TreeNode[], id: Id): TreeNode | undefined {
	for (const node of nodes) {
		if (node.id === id) return node
		if (node.kind === 'mark') {
			const found = findNode(node.children(), id)
			if (found) return found
		}
	}
	return undefined
}
```

- [ ] **Step 3: `ValueModel` becomes the facade**

```ts
// packages/core/src/features/state/ValueModel.ts
import type {Range} from '../../shared/editorContracts'
import {computed} from '../../shared/signals'
import type {TokenModel} from '../tokens'

/**
 * Facade over the token layer's value. The tree is the source of truth and the
 * string is its projection (spec D1), so this class owns nothing: it exists for one
 * more phase because ~8 call sites read `value.current()` and moving them all in the
 * cutover commit would bury the wiring change. S1.8 deletes it (spec §11 step 5)
 * and repoints them at the token layer.
 */
export class ValueModel {
	readonly current = computed({
		get: () => this.tokens.value(),
		set: next => void this.tokens.replace({start: 0, end: -1}, next),
	})

	constructor(private readonly tokens: TokenModel) {}

	/** Global-range write. Gating (readOnly, bounds) lives in the transaction layer. */
	replace(range: Range, replacement: string): boolean {
		return this.tokens.replace(range, replacement)
	}
}
```

`#pendingEdit`, `takePendingEdit` and the `replaceInString` import go with it —
§4.6 item 1 (the consume-once hint protocol) is therefore already complete at
the end of this task rather than at S1.6d; note it for that phase's checklist.
`replaceInString` itself stays in `shared/utils` (still exercised directly by
`ValueModel.spec.ts:120-128`; S1.8 sweeps it).

- [ ] **Step 4: `Store` — order and the thunk**

```ts
export class Store {
	readonly host = new Host()
	readonly props = new PropsModel()

	// Explicit type annotations on BOTH SIDES OF THE CYCLE — `tokens` and `selection`
	// — are REQUIRED, not stylistic: without them `tsc` fails with TS7022 ("implicitly
	// has type 'any' because it is referenced directly or indirectly in its own
	// initializer"). Measured: TS7022 fires only when both lack an annotation.
	readonly tokens: TokenModel = new TokenModel(this.props, this.host, () => this.selection.range())
	// NOT in the cycle — `value` depends on `tokens` only, so its annotation is
	// ordinary style, not a TS7022 workaround. Keep it or drop it; just do not file it
	// under the comment above.
	readonly value: ValueModel = new ValueModel(this.tokens)

	readonly slots = new SlotsFeature(this.props)

	// Built AFTER `tokens`, which is why the capture above is a thunk: it is invoked
	// only from the boundary's `fold`, at commit/arrival time (spec D7).
	readonly selection: SelectionController = new SelectionController(this.host, this.tokens, this.value, this.props)
	readonly edit = new EditController(this.value, this.selection)
	// … the rest unchanged
}
```

- [ ] **Step 5: `EditController` sheds its duplicate normalization**

```ts
	replace(range: Range, replacement: string, caretAt?: number): void {
		batch(() => {
			// `range.end < 0` is normalized by the offset shim; the caret only ever needed
			// `range.start`, which normalization never touched.
			if (!this.value.replace(range, replacement)) return
			this.selection.position(caretAt ?? range.start + replacement.length)
		})
	}
```

Update the class JSDoc: the `end < 0` sentence now points at the shim.

- [ ] **Step 6: Run the value hinge against the existing specs**

This is the task's real gate. Hand-traced expectations, all from specs that
exist today — check each one individually if the suite goes red, because they
exercise different arms of D-d:

| spec | arrangement | expected |
| --- | --- | --- |
| `ValueModel.spec.ts:19` | `new Store()`, read | `''` (tree empty, unseeded → `#seed()` = `''`) |
| `ValueModel.spec.ts:27` | controlled + mount | `'hello'` from props; seed arrival adopts it |
| `ValueModel.spec.ts:35` | `defaultValue` + mount | mount's immediate run seeds `#seed()` = `'hello'` |
| `ValueModel.spec.ts:53` | controlled+default, mount, drop | `#restore` is `undefined` (unseeded at the controlled edge) → `#seed()` = `'default'` |
| `ValueModel.spec.ts:64` | readOnly, `current('world')` | `#ensureSeeded` arrives `'hello'` (arrivals are not readOnly-gated), `applyRange` refuses, no `onChange` |
| `ValueModel.spec.ts:76` | readOnly + controlled echo | arrival adopts `'world'`; no `onChange` |
| `ValueModel.spec.ts:88` | **unmounted**, `replace({6,11})` | `#ensureSeeded` → `'hello world'`, sub-range op → `'hello markput'` |
| `ValueModel.spec.ts:97` | invalid range | `#ensureSeeded` runs first, `lowerReplace` returns undefined → `false`, no `onChange` |
| `ValueModel.spec.ts:107` | **unmounted controlled** `replace` | `#ensureSeeded` arrives `props.value` = `'hello'`; commit emits `'world'`, tree untouched, `current()` = `'hello'` |
| `Store.spec.ts:113` | unmounted: edit → controlled → drop | `'internal'` → `'controlled'` → `'internal'` (no watch; the tree still holds the edit) |
| `EditController.spec.ts:76,85` | `{0,-1}` unmounted | `'replaced'` / `'first'`; caret `8` / `5` |

If any row disagrees, do **not** widen `value`'s getter to paper over it — find
which of the four fields is wrong.

- [ ] **Step 7: Add the tests the cutover itself needs**

```ts
// packages/core/src/features/state/ValueModel.spec.ts — append
describe('value hinge (S1.6a)', () => {
	it('an uncontrolled edit before control is taken is what dropping control returns to', () => {
		// The measured pin for #restore. ValueModel.spec.ts:53 covers the OTHER arm
		// (never uncontrolled → the default); this one covers the frozen-storage arm and
		// is the only test that fails if #restore is replaced by `#seed()`.
		const store = new Store()
		store.props.set({defaultValue: 'default'})
		mount(store)
		store.value.replace({start: 0, end: -1}, 'edited')
		expect(store.value.current()).toBe('edited')

		store.props.set({value: 'controlled'})
		expect(store.value.current()).toBe('controlled')

		store.props.set({value: undefined})
		expect(store.value.current()).toBe('edited')
	})

	it('onChange runs AFTER the commit, with the value, the tokens and the DOM already new', () => {
		// BEHAVIOR CHANGE, measured before: onChange used to fire from inside the signal
		// setter, so it saw value 'he@[x]llo', tokens 'he|@[x]|llo' and dom 'llo' while
		// emitting 'he@[x]llo!'.
		const store = new Store()
		const seen: {value: string; tokens: string}[] = []
		store.props.set({
			defaultValue: 'he@[x]llo',
			options: [{markup: '@[__value__]'}],
			Mark: () => null,
			onChange: () => seen.push({value: store.value.current(), tokens: store.tokens.current().map(t => t.content).join('|')}),
		})
		mount(store)

		store.edit.replace({start: 9, end: 9}, '!')

		expect(seen).toEqual([{value: 'he@[x]llo!', tokens: 'he|@[x]|llo!'}])
	})

	it('a live edit carries the pre-edit selection on its TransactionResult', () => {
		// The channel's only end-to-end gate until S1.6c consumes it.
		const store = new Store()
		store.props.set({defaultValue: 'hello'})
		mount(store)
		store.selection.position(2)
		let captured: {start: number; end: number} | undefined
		// The result feed is internal; assert through the observable proxy instead —
		// see the note below if this cannot be reached without new surface.
		store.edit.replace({start: 5, end: 5}, '!')
		expect(store.value.current()).toBe('hello!')
		expect(captured).toBeUndefined()
	})
})
```

**The third test as written cannot assert anything** — `onResult` is private and
`TransactionResult` has no public exit. Two honest options, decide and record
which you took: (a) drop it from `ValueModel.spec.ts` and rely on Task 1's
boundary-level capture tests, which are strictly more discriminating (they
detect a post-adoption capture; a Store-level test could only detect *no*
capture); or (b) keep a Store-level smoke test by asserting through a temporary
spy on `store.tokens` internals, which means new surface — do not do this. **The
plan's recommendation is (a): delete the third test and record in the review that
the channel's Store-level wiring is gated only by "it does not throw", because
`this.selection.range()` being called during construction would be a TypeError.**
Add that as an explicit assertion instead:

```ts
	it('constructing a Store and editing immediately does not touch selection during construction', () => {
		// The thunk in Store.ts closes over a field declared BELOW it. If anything called
		// it during construction this would be a TypeError, not a failed assertion.
		const store = new Store()
		store.props.set({defaultValue: 'hello'})
		expect(() => mount(store)).not.toThrow()
		expect(() => store.edit.replace({start: 0, end: 0}, 'X')).not.toThrow()
		expect(store.value.current()).toBe('Xhello')
	})
```

- [ ] **Step 8: Follow the constructor change in `model/TokenModel.spec.ts`**

`createNew` (`:57-64`) builds `new TokenModel(value, propsModel, host)` and a
`ValueModel(propsModel)`. It becomes:

```ts
function createNew(props: CoreProps) {
	const propsModel = new PropsModel()
	const host = new Host()
	const model: TokenModel = new TokenModel(propsModel, host, () => undefined)
	const value = new ValueModel(model)
	propsModel.set(props)
	return {model, value, props: propsModel, host}
}
```

Note the order flip (the model before the value) and that `props.set` still runs
**after** construction, which is what makes `#seed`'s laziness pick up
`defaultValue`.

- [ ] **Step 8a: `features/tokens/TokenModel.spec.ts:92` — the §4.4 invariant**

**Do not edit this spec.** It is the gate that forced D-d's `#committed`
amendment, and it goes green only when Step 1's `onResult` writes `#committed`
*after* `pipeline.apply`. If it is red here, the ordering is wrong; measured
symptom:

```
watch(value="hello") tokens=[""]   →   changed value="hello" tokens=["hello"]   →   onChange
```

It is listed in this task's files so it is in the gate, not so it is rewritten.

- [ ] **Step 8b: `features/tokens/MarkController.spec.ts` — re-fixture the two
      pending-latch cases**

Measured: post-cutover, `:338` ("update() while a structural apply awaits its
bind is a fail-closed no-op returning false") and `:355` (the SEMVER-MAJOR
render-path contract) both return `true` where they expect `false`. The plan's
first draft attributed this to Task 6; it happens **here**, at the cutover,
because the write path changes under them.

*Why:* both drive the structural commit with `store.value.current('different
@[x]')`. Adoption pairs roots BY INDEX, and `'he@[x]llo'` → `'different @[x]'`
keeps every root id (measured `removed: []`), so the commit takes the TEXT path
and opens no pending window at all — where `tokenIdentity.reconcile` used to
call it structural. The tests stop testing the latch rather than the latch
breaking.

*Fix:* change the fixture in both cases to
`store.value.current('he@[x]llo@[y]')` — it adds two roots, so the commit stays
structural, while the first mark keeps its id. Follow the value-string
assertions through: `:355`'s mid-window and post-bind reads become
`'he@[x]llo@[y]'` and its final `update({value: 'ok'})` yields
`'he@[ok]llo@[y]'`. Verified green.

*The latch is still load-bearing after the re-fixture* — verified by mutation:
removing `#liveMark()` from Task 6's `#resolve()` kills both cases again. Note
this in the review; it is the honest answer to Task 6 Step 2's
"green-for-the-wrong-reason" question.

- [ ] **Step 8c: `features/block/BlockController.spec.ts:52` — assert the
      outcome, not the write channel**

Measured: `expect(currentSpy).toHaveBeenCalledWith('beta\n\n')` (in "commits
drag edits through the live token read and writes caret.selection", `:37`) fails
post-cutover. It only ever held because `ValueModel.replace` wrote through
`this.current(next)`; the facade delegates straight to `tokens.replace`, so
`value.current` is now only *read*. The spy asserted the implementation, not the
behavior.

*Fix:* drop the `const currentSpy = vi.spyOn(store.value, 'current')` line
(leaving it makes the binding unused, which oxlint rejects) and assert
`expect(store.value.current()).toBe('beta\n\n')`. The `:28` spy in "does not
leak a watcher when props toggle" is a `not.toHaveBeenCalled()` assertion and
stays green — leave it alone.

- [ ] **Step 9: Gate — the whole core suite, plus build**

Run: `pnpm run format && pnpm -w exec vitest run packages/core && pnpm run typecheck && pnpm run lint:check && pnpm run build`

`build` is in this gate because `Store` and `TokenModel` are root exports whose
shapes changed, and the rolldown DTS bundle (`codeSplitting: false`) must be
proven to resolve `TreeNode` and `Computed<string>` from their new positions. If
it cannot, export the types from `features/tokens/index.ts` **only** if the DTS
bundle genuinely needs them — S1.7 narrows that barrel and this change must not
widen it gratuitously.

**Measured outcome:** it can. The DTS bundle resolves `TreeNode`,
`applyStructural` and `find` with `features/tokens/index.ts` left **unwidened**.
If you find yourself adding an export there, stop and re-check — that is not
what this change needs.

- [ ] **Step 10: Commit**

```bash
pnpm run format
git add packages/core/src/features/tokens/model/TokenModel.ts \
        packages/core/src/features/tokens/model/TokenModel.spec.ts \
        packages/core/src/features/tokens/tree/tree.ts \
        packages/core/src/features/tokens/MarkController.spec.ts \
        packages/core/src/features/block/BlockController.spec.ts \
        packages/core/src/features/state/ValueModel.ts \
        packages/core/src/features/state/ValueModel.spec.ts \
        packages/core/src/features/edit/EditController.ts \
        packages/core/src/store/Store.ts
git commit -m "feat(core): S1.6a cutover — the tree core drives the live editor

The token layer becomes the value owner: TokenModel holds the tree, the string
boundary, the transaction verbs and the snapshot memo, and feeds the one commit
pipeline through fromTransaction. ValueModel is a facade over it (S1.8 deletes
it) and Store builds tokens before value.

BEHAVIOR CHANGES, all intentional:
- onChange now runs AFTER the commit. Measured before: it fired from inside the
  signal setter, so a handler saw the pre-edit value, the pre-edit tokens and the
  pre-edit DOM while being handed the new string.
- An uncontrolled parent that calls an edit verb synchronously from onChange now
  throws 're-entrant transaction dispatch' instead of re-entering the setter.
- Whole-value replaces (block row add/delete/merge/reorder, select-all input) are
  re-derived through gapWindow, so a deleted row no longer hands its identity —
  and BlockController's per-row store — to its neighbour.
- A whole-value replace that keeps the root COUNT is now a text-path commit, not
  a structural one: adoption pairs roots by index, so 'he@[x]llo' →
  'different @[x]' removes nothing and opens no pending window, where
  tokenIdentity.reconcile called it structural. Two MarkController latch specs
  were re-fixtured to keep exercising the latch.
- Store's field order and TokenModel's constructor changed; useMarkput selectors
  that reach into them are affected (spec §2.3 accepts this)."
```

---

### Task 6: `MarkController` onto `applyStructural`

**Files:** modify `features/tokens/MarkController.ts`.

- [ ] **Step 1: Implement (the existing suite is the gate)**

`MarkController.spec.ts` (390 lines) already pins every read and write arm,
including the two fail-closed cases D-i names. Keep `#liveMark()` exactly as it
is — it is both the read source and the write *permission* — and change only
the write target:

```ts
	remove(): boolean {
		const target = this.#resolve()
		if (!target) return false
		return this.store.tokens.applyStructural(target.node, '')
	}

	update(patch: MarkPatch): boolean {
		const target = this.#resolve()
		if (!target) return false
		const {token, node} = target

		const value = patch.value ?? token.value
		const meta =
			patch.meta?.kind === 'clear' ? undefined : patch.meta?.kind === 'set' ? patch.meta.value : token.meta
		const slot =
			patch.slot?.kind === 'clear'
				? undefined
				: patch.slot?.kind === 'set'
					? patch.slot.value
					: token.slot?.content

		return this.store.tokens.applyStructural(node, this.#serialize(token, {value, meta, slot}))
	}

	/**
	 * The live mark to mutate, or undefined in read-only mode / against a dead or
	 * mid-window handle.
	 *
	 * TWO resolutions, deliberately: the latch-gated HANDLE is the permission check
	 * (spec §4.6 item 4 retires that regime at S1.6d, not here — `MarkController.spec`
	 * pins the mid-window and dead-handle failures, one of them flagged SEMVER-MAJOR),
	 * while the tree NODE is the write target. The node's `position` is always fresh,
	 * where the handle's is the bind generation; the latch means they cannot disagree
	 * at write time today, so this is a correctness upgrade that only becomes
	 * observable when S1.6d drops the gate.
	 */
	#resolve(): {token: MarkToken; node: MarkNode} | undefined {
		if (this.store.props.readOnly()) return undefined
		const token = this.#liveMark()
		if (!token) return undefined
		const node = this.store.tokens.find(this.id)
		return node?.kind === 'mark' ? {token, node} : undefined
	}
```

Both write verbs now return the transaction's own boolean instead of an
unconditional `true`. That is a strictly better contract (a refused splice used
to report success) and it does not change any pinned outcome: every path that
reaches `applyStructural` has already passed readOnly and liveness.

- [ ] **Step 2: Gate**

Run: `pnpm run format && pnpm -w exec vitest run packages/core && pnpm run typecheck && pnpm run lint:check`

Expected: `MarkController.spec.ts` green with **no assertion changed *by this
task***. The first draft's "no assertion changed" was false: `:338` and `:355`
were already re-fixtured at **Task 5 Step 8b**, because the cutover — not this
task — is what turned their whole-value write into a text-path commit. Read that
step before you interpret a red here.

The green is **not** green-for-the-wrong-reason: verified by mutation, removing
`#liveMark()` from `#resolve()` kills both cases against the Step 8b fixture. The
latch remains load-bearing.

**`typecheck` rewrites a tracked file here** (measured, plan-attributable):
`packages/website/src/content/docs/api/classes/MarkController.md` — `astro
check` re-runs the typedoc generation and the line links shift. Stage it with
the commit (see Step 3); do not leave it dirty for the next task to pick up.

- [ ] **Step 3: Commit**

```bash
pnpm run format
git add packages/core/src/features/tokens/MarkController.ts \
        packages/website/src/content/docs/api/classes/MarkController.md
git commit -m "refactor(tokens): S1.6a MarkController writes through applyStructural

The write target is now the live MarkNode (always-fresh positions) instead of the
bind-generation token's range. The latch-gated handle lookup stays as the
permission check — spec §4.6 item 4 retires that regime at S1.6d, and
MarkController.spec pins both fail-closed arms today. update()/remove() now return
the transaction's result rather than an unconditional true."
```

---

### Task 7: delete the old wiring

**Files:** modify `model/commitInput.ts`, `model/treePipeline.spec.ts`;
delete `model/commit.spec.ts`, `model/commitInput.spec.ts`.

This is the "delete" commit of spec §11's pair.

- [ ] **Step 1: Move the four cases that lose their only gate**

`treePipeline.spec.ts`'s coverage note lists what was and was not ported. Four
cases in `commit.spec.ts` have no other gate and must land in
`treePipeline.spec.ts` before it is deleted:

| `commit.spec.ts` | title | port shape |
| --- | --- | --- |
| `:490` | *a textChanged id absent from the new tree routes structural (conservative stale-tree guard)* | **verbatim minus `fromReconcile`** — it hand-builds the input and exercises no lowering, which is exactly why it survives. Build the `CommitInput` literal directly: `{tokens, render: false, changes: [{id: 99999, token: tokens[0], patch: true}], delta: {added: [], removed: [], updated: []}}` |
| `:557` | *the structural branch self-heals corruption instead of throwing (bind rewrites every surface)* | tree harness: `mount(harness)`, corrupt `text1.textContent`, `harness.splice(2, 6, '@[y]')` (render bit set), then **`harness.pipeline.onRendered()`** — NOT `harness.render()` — expect no throw and `text1.textContent === 'he'` |
| `:566` | *normal applies and renders never throw* | tree harness: a text splice and a structural splice each followed by `render()`, wrapped in `expect(...).not.toThrow()` |
| `:730` | *removedIds() still answers, now off the payload* | tree harness: `mount`, `harness.splice(2, 6, '')`, `harness.render()`, `expect(pipeline.removedIds()).toContain(markHandle.id)` — `removedIds()` survives to S1.6d (§4.6 item 6) |

Read each original before porting; the `:557`/`:566` bodies depend on
`createHarness`'s repaint shape.

**`:557` does NOT survive `harness.render()`** (measured: `expected 'WRONG' to
be 'he'`). `treePipeline.spec.ts`'s `render()` does
`container.replaceChildren(...spans)` with FRESH span elements
(`treePipeline.spec.ts:127-128`), so the node you corrupted is orphaned before
bind can heal it and you assert against a detached DOM node. Use
`harness.pipeline.onRendered()`, which re-binds the surfaces that are already
there — that is the sequence the original `commit.spec.ts` case was written
against. `:566` and `:730` are fine with `render()`; only `:557` holds a
reference across the repaint.

`:141` (*touches only the changed nodes*) and `:323` (*pending() spans exactly
the structural apply → rendered window*) stay unported, for the reasons already
written in `treePipeline.spec.ts`'s header. Do not silently revisit that.

**Softening one claim, measured.** "`:490` has no other gate" is slightly
overstated: mutating `commit.ts`'s `if (!handle) return false`
(`commit.ts:179`) to `continue` kills the ported case **and** the pre-existing
`treePipeline.spec.ts:351` ("a text change whose handle vanished abandons the
branch and self-heals through a bind"). Moving `:490` was still right — it is
the only case that hand-builds a stale-tree `CommitInput` — but it is not the
sole guard on that line, and the review should not say it is.

- [ ] **Step 2: Delete `liveFaces` and inline the face it measured**

`treePipeline.spec.ts:160-188` is the only importer of the live lowering
(`createIdentityTracker` + `fromReconcile`) and its own comment schedules its
death here. Its single consumer is the length-preserving in-slot case
(`:444-476`). Replace the two comparisons with the measured constants the helper
was producing and keep `tokenFace` (still used):

```ts
		// `liveFaces` is gone with `fromReconcile` (its own note scheduled this); the
		// measured live-path faces for '#[ab]t' → '#[cb]t' are inlined here. They are the
		// point of the case: the tree path once answered '#[ab]' / slot 'ab', and only a
		// side-by-side run said which was right.
		expect(tokenFace(markHandle.token())).toEqual({
			type: 'mark',
			content: '#[cb]',
			position: {start: 0, end: 5},
			value: '',
			meta: undefined,
			slot: {content: 'cb', start: 2, end: 4},
		})
		expect(tokenFace(childHandle.token())).toEqual({
			type: 'text',
			content: 'cb',
			position: {start: 2, end: 4},
		})
```

**RE-MEASURED AND CORRECT** (implementation pass): the two literals above match
what `liveFaces` produces for `'#[ab]t'` → `'#[cb]t'`, including `value: ''` on
the slot-only markup and the `{content: 'cb', start: 2, end: 4}` slot shape. You
may still re-run `live.get('1')` / `live.get('1.0')` before deleting the helper
— it costs one print — but this plan's reconstruction is no longer the
unverified part.

- [ ] **Step 3: Delete `fromReconcile` and its spec**

In `model/commitInput.ts`: remove the `ReconcileResult` import and the
`fromReconcile` function. `CommitChange`, `TokenDelta` and `CommitInput` stay —
`commit.ts` and `treeInput.ts` consume them. Trim the `TokenDelta` doc's
reconcile citations (`tokenIdentity.ts:154`) to the surviving producer.

```bash
git rm packages/core/src/features/tokens/model/commitInput.spec.ts
git rm packages/core/src/features/tokens/model/commit.spec.ts
```

`commitInput.spec.ts` was the only gate on `fromReconcile`'s delta mapping; the
tree lowering's mapping is independently gated by `treeInput.spec.ts:84,107,138,180,188`.
Confirm that by reading those five assertions before deleting, not after.

**`tokenIdentity.ts` and its two spec suites stay** (spec §11 puts them in
S1.6d). They keep passing because they test themselves; they simply have no
production caller for one phase. State that in the review.

- [ ] **Step 4: Gate**

Run: `pnpm run format && pnpm -w exec vitest run packages/core && pnpm run typecheck && pnpm run lint:check && pnpm run build`

Also run `grep -rn "fromReconcile\|createIdentityTracker" packages/`. **The
literal instruction "the only hits are inside `tokenIdentity.ts` and its own
specs" is unachievable** (measured): four `fromReconcile` mentions survive in
`treePipeline.spec.ts`'s header prose, which narrates the two-lowering era. They
are stale *documentation*, not callers. Confirm there is no remaining
**import or call site** outside `tokenIdentity.ts` and its specs, and fix the
four header mentions in Task 8 Step 3.

- [ ] **Step 5: Commit**

```bash
pnpm run format
git add -A packages/core/src/features/tokens/model
git commit -m "refactor(tokens): S1.6a delete the reconcile lowering and its pipeline suite

fromReconcile, commitInput.spec.ts and commit.spec.ts go with the live watch path;
treePipeline.spec.ts absorbs the four cases that had no other gate (the stale-tree
guard, structural self-heal, never-throws, removedIds) and drops the liveFaces
helper, inlining the face it measured. tokenIdentity.ts and its suites stay — spec
§11 deletes them at S1.6d — and now have no production caller."
```

---

### Task 8: hardening — mutation proof, recorded gaps, full checks

**Files:** modify `tree/boundary.spec.ts`, `tree/offsetShim.spec.ts`,
`model/treePipeline.spec.ts`, `features/state/ValueModel.spec.ts`; comments in
`model/TokenModel.ts`.

- [ ] **Step 1: Prove the guards are load-bearing (mutation testing)**

Apply each mutation, confirm the NAMED test fails, revert, confirm green. If a
mutation survives, the suite has a hole — add the test or record the gap.

1. `fold` captures the selection **after** `adopt` → "captures the range BEFORE
   the commit adoption moves the positions it reads" must fail (2 vs 3).
2. `fold` captures only on the commit path, not on `arrive` → "captures at an
   ARRIVAL too" must fail.
3. `fold` drops the `isBlock` filter → "adopts rows only — no empty text node
   between or around them" must fail (2 roots vs 5).
4. `filterEmptyText` is made recursive → "the filter is top-level only" must
   fail. (A row whose slot is empty is a real, addressable row.) **Requires Task
   2's corrected `'\n\nbbb\n\n'` fixture.** Measured with the first draft's
   `'aaa\n\nbbb\n\n'`: the mutation SURVIVES the entire 870-test core suite,
   because that fixture has no empty slot child, so "the filter is top-level
   only" is decoration. With `'\n\nbbb\n\n'` the mutation is killed.
5. `lowerReplace` passes whole-value ops through as `{0, length}` → "KEEPS ROW
   IDENTITY where the full window loses it" must fail. **This is the gate on
   D-e.** Correction to this plan's side-claim: the separator-only "RECORDED
   NON-IMPROVEMENT" test does **not** stay green under this mutation — it
   asserts `op.window` is `{6,11,0}`, which the mutation turns into `{0,17,12}`.
   So it IS partly a gate: it gates the *window derivation*, and only its
   identity assertion (`[ids[0], ids[1]]`) is the non-improvement record. Say it
   that way; do not claim it is inert.
6. `lowerReplace` narrows EVERY op (drop the sub-range early return) → nothing
   in this plan's suite fails. **Expected to survive** — record it. The rule is a
   design choice (keep the exact op window, D2), not a defect boundary, and no
   assertion in the repo distinguishes the two until S1.6c consumes `map`.
7. `TokenModel.value` reads the tree unconditionally (drop the `#seeded` arm, so
   the getter is `props.value() ?? this.#committed()`) → **caught**, but NOT by
   the test this plan first named. Measured: `ValueModel.spec.ts:35`
   ("initializes from defaultValue when uncontrolled") stays **GREEN**, because
   that case mounts, and the mount watch seeds the tree from `#seed()` before the
   read. Record which case actually goes red when you run it; fix the
   attribution, not the conclusion — the mutation is caught.
8. `#seeded` is a plain boolean field instead of a signal → the computed never
   re-evaluates after the seed. Same correction as 7: `ValueModel.spec.ts:35`
   stays **GREEN** (measured), and the kill comes from elsewhere in the suite.
   Re-run this one specifically and write down the real killer — it is the
   subtlest field in D-d and it deserves a named gate, not a guessed one.
9. `#onExternalValue` uses `#seed()` instead of `#restore` on the fallback →
   "an uncontrolled edit before control is taken is what dropping control returns
   to" must fail, while `ValueModel.spec.ts:53` stays green (it covers the other
   arm).
10. `#ensureSeeded` is removed from `TokenModel.replace` → `ValueModel.spec.ts:88`
    and `EditController.spec.ts:12` must fail (the op is refused against an empty
    tree).
11. The boundary emits before it folds (swap the two lines in the uncontrolled
    sink) → "onChange runs AFTER the commit…" must fail, and
    `boundary.spec.ts`'s "emits after the commit" must fail too.
12. The three watches are split (value / parser / isBlock) instead of one tuple
    watch → **predicted to survive** unless a spec counts `changed` for a
    simultaneous props change. Check `TokenModel.changed.spec.ts`; if nothing
    counts it, record the gap rather than inventing a test — the tuple watch is
    kept for wave parity with the pre-cutover shell, and that parity is
    unobserved.
13. `commit.ts`'s `if (committing) throw` is deleted → `treePipeline.spec.ts`'s
    "a synchronous arrival from a changed watcher fails loud" must fail (D-g).
14. `value` reads `#tree.value()` instead of `#committed()`, **or** `#onResult`
    writes `#committed` before `pipeline.apply` instead of after →
    `features/tokens/TokenModel.spec.ts:92` ("current() is updated when
    value.current fires") must fail. Already measured red in both forms — this
    is the gate that produced D-d's amendment, so it is confirmed load-bearing,
    not predicted. Also re-run `treePipeline.spec.ts:731` against the rejected
    `batch(fold)` alternative if anyone proposes it again: that variant fixes
    `:92` and breaks `:731`.

- [ ] **Step 2: Record the mutations that cannot be gated**

Write these into the specs as comments; do not invent tests for them.

- **D-h, the memo/tree pairing.** Unrepresentable: a second tree needs a second
  `TokenModel`, which brings its own memo.
- **D-i, `MarkController`'s node target.** The latch forbids writes exactly when
  the node and the bind-generation token could disagree, so parity is the only
  available gate until S1.6d drops the latch.
- **Mutation 6** above (narrow everything).
- **Mutation 12** above, if it survives.

- [ ] **Step 3: Update the stale docs this phase falsified**

- `tree/types.ts`'s `CommitSink.commit` note — done in Task 1; re-read it.
- `model/commitInput.ts`'s `CommitInput` header still says "The live path lowers
  a `ReconcileResult` here" — rewrite: one producer remains.
- `model/treeInput.ts`'s header says "`fromTransaction` … has no live caller" in
  spirit; check and correct.
- **`model/treePipeline.spec.ts`'s header still mentions `fromReconcile` four
  times** (measured: they survive Task 7 Step 4's grep and are the reason that
  step's "only hits" instruction cannot be met literally). They narrate the
  two-lowering era; rewrite them for the one that remains.
- `TokenModel`'s class JSDoc still says "parses the value, reconciles token
  identity, and feeds the one commit pipeline". Rewrite: it owns the tree and the
  boundary; the parse is the boundary's and identity is adoption's.
- `features/tokens/README.md` is 459 lines and states the opposite of D11.
  **Out of scope** — spec §11 assigns it to S1.8 step 7. Do not start it; note in
  the review that S1.6a widened the gap.

- [ ] **Step 4: Full gates**

Run: `pnpm run format && pnpm test && pnpm run typecheck && pnpm run lint:check && pnpm run format:check && pnpm run build`

`pnpm test` runs the react and vue **storybook browser** projects as well; they
need `pnpm exec playwright install chromium`. **They are S1.6b's gate, not this
one** — but they run here anyway, so record their result honestly. If they go
red, that is S1.6b's work surfacing early: report it with the failure list and do
**not** fix it inside this change. If a project is skipped, say so explicitly;
AGENTS.md forbids implying everything passed.

Reference point from S1.5's completed run: `pnpm test` — 73 files, 1267 tests.

**This plan's first draft predicted "~71 files and a lower test count". Both
halves are wrong — measured:** the real result is **72 files** (two spec files
are deleted, one — `tree/offsetShim.spec.ts` — is created) and the test count
**ROSE** to **1296** (1281 passed, 2 skipped, 13 todo), because the ~850 deleted
lines were a small number of long cases while this phase adds many short ones.
Use those numbers as the expectation; a *much* lower count still means something
was filtered.

The React and Vue storybook browser projects **ran and passed** in that run.

- [ ] **Step 5: Commit**

```bash
pnpm run format
git add packages/core/src
git commit -m "test(core): S1.6a hardening — mutation-proven cutover guards and recorded gaps"
```

---

## Contradictions found while writing this plan (report, do not paper over)

**All nine were re-checked by the implementation pass and all nine HOLD**,
including #1: all three Vitest projects run Chromium browser mode, so nothing in
this phase is jsdom.

1. **The phase name is wrong.** Spec §11 and the roadmap call S1.6a "jsdom". The
   core Vitest project runs in **Chromium** (`vite.config.ts`, `browser.enabled`
   with `@vitest/browser-playwright`); there is no jsdom environment anywhere in
   the repo. The real S1.6a/S1.6b split is *core unit suite* vs *storybook
   suites*. Rename it in the spec when convenient.
2. **`tree/types.ts`'s recorded `selectionBefore` channel does not work for the
   controlled path.** The dispatcher never sees the echo's arrival, which is the
   only adoption a controlled edit produces. D-a deviates and rewrites the note.
   S1.4's decision D-b, which recorded that channel, was right that four
   mechanical sites were involved and wrong about which four.
3. **Spec §4.4 names `ValueModel` the boundary owner; the boundary's own
   dependencies live in the token layer.** D-c resolves it the other way and
   explains why (`onResult` must be a synchronous callback, so the consumer must
   exist when the boundary is constructed). The spec's §4.4 sentence should be
   amended or explicitly overridden at S1.6a review.
4. **The spec's whole-value/gap-derivation requirement is only half-true.**
   Measured: gap-derivation preserves row identity for distinct row content and
   is **defeated** — reduced to exactly the full-window outcome — whenever the
   rows repeat the separator (`gapWindow`'s clamp pulls `end` inside the next
   row's span, so adoption's suffix bound fails). §11's phrasing implies identity
   simply "survives". It survives *more often*, not always.
5. **Today's `onChange` is fired against stale state, and no spec pins it.**
   Measured: the handler sees the pre-edit value, tokens and DOM. Fixing it is a
   user-visible change that the roadmap did not flag (it flagged only §4.4's
   ordering question). Called out in Task 5's commit body.
6. **A live bug the phase fixes as a side effect, reproduced not inferred:**
   `beforeinput` with everything selected replaces the whole value with `''` for
   every input type the ordinary path ignores. Measured on a mounted store with
   `defaultValue: 'hello'` and `inputType: 'insertParagraph'` →
   `{value: '', prevented: true}`. Enter with all selected clears the input.
   Task 4 fixes it with its own commit and call-out.
7. **`filterEmptyText` changes `map`'s anchor shape in block mode**, exactly as
   §2.3 predicts but nowhere schedules: the document end resolves to
   `{after: rowNode}` and a between-row offset resolves *into the next row's
   slot*, not to `{after: previousRow}`. S1.6c's caret repair and S1.7's
   `insertMark(at)` both meet this; neither phase's scope line mentions it.
8. **The roadmap's S1.6a decision 3 states the fallback wrong.** It says
   "dropping `value` falls back to `defaultValue`". Measured, and pinned by
   `Store.spec.ts:113-121`, it falls back to the *last uncontrolled value*, whose
   seed happens to be `defaultValue`. Designing for the roadmap's version would
   have broken that spec.
9. **§4.6's checklist items 1 and 3 complete in S1.6a, not S1.6d.** Rewriting
   `ValueModel.replace` necessarily deletes `#pendingEdit`/`takePendingEdit`, and
   the cutover necessarily deletes the reparse-watch edit path. S1.6d's gate
   should expect four remaining items, not six.

---

## Self-review notes (spec → plan)

- Covers S1.6a's scope line: Store wiring, `beforeinput` → verbs including the
  `isAllSelected` rewrite, the `EditController.replace` shim with gap-derived
  whole-value routing, `MarkController` on `applyStructural`, the selection
  capture hook, then the deletion — as two commits (Task 5 wires, Task 7
  deletes), with four preparatory tree-core tasks that keep the cutover commit
  readable.
- Every carried concern from S1.5 is placed: `commit.spec.ts:490` is **moved**
  (Task 7 Step 1); `liveFaces` dies with `fromReconcile` and its measured face is
  inlined (Task 7 Step 2, with an instruction to re-measure before trusting this
  plan's literals); `apply`'s re-entry guard is proven still load-bearing (D-g,
  mutation 13); the memo/tree pairing is answered structurally and recorded as
  ungatable (D-h); `TokenModel.removedIds()` is neither deleted nor re-acquired —
  Task 7 ports its spec so S1.6d's deletion stays a pure delete.
- Every task leaves the suite green and is one commit, so the revert unit is that
  commit. Tasks 1–3 are additive to the unwired tree core; Task 4 is a standalone
  behavior fix; Task 5 is the flip; Tasks 6–8 are incremental on top of it.
- **Deliberately deferred, with reasons above:** node-anchored selection and
  `map` consumption (S1.6c); `#preferredHandle`/clamp deletion (S1.6c); the
  handle write latch and `#token`/`update()` (S1.6d); `tokenIdentity` + its
  suites (S1.6d); `block/operations.ts`'s whole-value semantics (spec D8, gated
  on the block-rows follow-up); `features/tokens/README.md` (S1.8 step 7);
  `anchorAt`'s block-mode boundary anchors (S1.6c/S1.7, contradiction 7).
- **The adversarial pass has now run** (see Verification status at the top). Of
  the three places this plan predicted would break, one did (Task 7 Step 1's
  `:557` port) and two did not: the `#seeded`/`#seed`/`#restore` table in Task 5
  Step 6 held row for row, and the inlined `liveFaces` literals in Task 7 Step 2
  re-measured correct. What broke instead was unpredicted: the `value`/tokens
  notification ordering (D-d's `#committed` amendment), a constructor name
  collision, the `onResult?.(adopt(…))` short-circuit, the `end < 0`
  self-contradiction, and three specs the file list never mentioned
  (`features/tokens/TokenModel.spec.ts`, `MarkController.spec.ts`,
  `BlockController.spec.ts`).
- **Residual weakness after that pass:** mutations 7 and 8 are known to be caught
  but their killers are unnamed (Task 8 Step 1), mutations 6 and 12 are recorded
  as ungated, and D-h/D-i remain gated only by construction and by parity.
