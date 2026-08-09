# Tree Core S1.4 (String Boundary) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the string boundary — the module that decides commit policy
(uncontrolled: adopt now; controlled: emit and wait for the echo), routes
external value arrivals into adoption with the right window, and owns the
`lastEmitted` record — per spec `2026-08-08-markput-s1-tree-core-v2.md` (v2.1,
Reviewed) §4.4 and D6.

**Architecture:** One new module `tree/boundary.ts`, built **alongside** the
live pipeline (spec §11 transition mechanics: S1.2–S1.5 build new modules not
wired into the live path; nothing is deleted before S1.6a). It supplies a
`CommitSink` to `createTransactions` and exposes the arrival entry points that
S1.6a will wire to `props`.

**Tech stack:** TypeScript, the existing `tree/` modules (`adopt`, `gapWindow`,
`snapshot`, `tree`, `transactions`), Vitest.

**Prerequisites:** S1.1–S1.3 complete (commits `12ead317..6fbe8e88` on `b0`).

**Plan status:** verified before execution by an adversarial pass that
implemented the boundary and ran every snippet. It found two hard stops (a
lint-rejected disable directive; unused imports blocking Task 1's commit) and
three "load-bearing" mutations that survived the original tests, plus a false
premise in the original decision D-c. All are fixed above; the surviving-gap
cases are now recorded as gaps rather than papered over. Per-task gates
include `pnpm run lint:check` from Task 1 onward, because the pre-commit hook
runs lint and a task that only gates on tests will fail at commit time.

---

## Decisions taken before writing this plan (do not re-litigate)

**D-a. `base` needs no new parameter.** D6 says the controlled sink records
`lastEmitted = {base, value, window}` where `base` is the projection it
spliced. `CommitSink.commit(next, window)` does not receive it — but it does
not need to: the dispatcher computes `next` from the tree's current projection
and mutates nothing before calling the sink, so at commit time `tree.value()`
*is* the base. That invariant is already documented on `CommitSink` in
`types.ts`. The controlled sink reads it itself.

**D-b. `selectionBefore` stays unimplemented in S1.4.** The recorded channel
(dispatcher → `commit` → `adopt`, plus an injected `selection` dep on
`createTransactions`) is documented in `types.ts`. Adding the optional
parameter now would be public surface with no caller, which AGENTS.md forbids.
The ripple when S1.6a adds it is four mechanical sites (two sinks, `adopt`,
the dispatcher) — cheap, and the decision is already written down so S1.6a
does not rediscover it. **This is a deliberate choice, not an oversight.**

**D-c. A parser change reparses with `gapWindow(v, v)`, NOT a full window.**
An earlier draft of this plan claimed the opposite. Verification disproved it
by execution: adoption is **equality-driven, not window-driven** — the window
only *bounds* the prefix/suffix walks, and the middle region rebuilds whatever
the walks did not claim. With the value unchanged, `gapWindow(v, v)` is
`{n, n, 0}`, both walks are inert, and the middle re-derives every token from
the new parse. Measured: the reparse test passes identically under both
windows. The full window is actively WORSE, because
`resolveMappedAnchor` sends every offset strictly inside `(start, end)` to
`window.start + window.insertedLength` — with `{0, n, n}` that is the document
end, so a parser change would park the caret at the end of the document once
S1.6c consumes `map`. Measured on `'a@[x](m)b'`: full window sends offset 1 to
the doc end; gap window keeps it at `text#1 @1`.
*Consequence:* there is no window choice left to gate here, so the earlier
"mutation #4" is deleted. Pin the `map` behavior instead (see Task 4).

**D-d. The boundary needs no separate value state — GIVEN that S1.6a seeds
and re-arrives from props.** §4.4 says `value.current()` is "controlled →
committed props projection; uncontrolled → `join(tree)`". In the steady state
the tree only ever holds an ARRIVED value in controlled mode, so `join(tree)`
already is that projection. Two cases are NOT covered by construction and are
S1.6a's responsibility, named here so they are not lost: the **initial seed**
(the tree must be built from `value ?? defaultValue`), and the
**controlled→uncontrolled fallback** — measured today, `props.set({value:
'hello', defaultValue: 'default'})` then `props.set({value: undefined})`
leaves `value.current()` as `'default'`, whereas `join(tree)` would report
`'hello'` unless S1.6a explicitly arrives with the default.

**D-e. `filterEmptyText` and layout arrivals are OUT of S1.4.** Today
`TokenModel#reparse` applies `isBlock ? filterEmptyText(parsed) : parsed`, and
the spec keeps that for block mode. The tree core does not apply the filter
anywhere yet, and `createBoundary` takes no `isBlock` dependency. `reparse()`
in this phase is **parser-only**; D6's "isBlock change" arrival and the filter
itself belong to S1.6a, which owns block wiring. Say so in the code comment so
the gap is a recorded scope decision, not an oversight.

---

## File structure

- Create `packages/core/src/features/tokens/tree/boundary.ts` — the whole
  phase. One responsibility: commit policy + arrival routing. It owns
  `lastEmitted`; it does not own transactions (S1.3) or adoption (S1.3).
- Create `packages/core/src/features/tokens/tree/boundary.spec.ts`.
- Modify nothing else. In particular do NOT touch
  `packages/core/src/features/state/ValueModel.ts` — the live boundary is
  replaced at S1.6a, not here.

Target surface:

```ts
export interface Boundary {
	/** Hand to createTransactions. Adopts (uncontrolled) or emits (controlled). */
	readonly sink: CommitSink
	/** An external value arrived (props.value, defaultValue). Routes into adoption. */
	arrive(value: string): void
	/** Parser or layout changed: re-derive every token from the unchanged projection. */
	reparse(): void
	/** The committed projection — see D-d. */
	value(): string
}

export function createBoundary(deps: {
	tree: TokenTree
	parser: () => Parser | undefined
	controlled: () => boolean
	onChange: (value: string) => void
	onResult?: (result: TransactionResult) => void
}): Boundary
```

---

### Task 1: Uncontrolled path

**Files:**
- Create: `packages/core/src/features/tokens/tree/boundary.ts`
- Test: `packages/core/src/features/tokens/tree/boundary.spec.ts`

- [ ] **Step 1: Write the failing tests**

```ts
// packages/core/src/features/tokens/tree/boundary.spec.ts
import {describe, expect, it} from 'vitest'

import {Parser} from '../parser/Parser'
import {createBoundary} from './boundary'
import {createTokenTree} from './tree'
import {createTransactions} from './transactions'
// NOTE: `snapshot`/`stripIds` are NOT imported here — Task 1 does not use them
// and oxlint's no-unused-vars is error-level with a pre-commit hook, so an
// early import blocks Task 1's commit. Add them in Task 2.

const parser = new Parser(['@[__value__](__meta__)'])

function setup(source: string, options: {controlled?: boolean} = {}) {
	const tree = createTokenTree(parser.parse(source))
	const emitted: string[] = []
	const boundary = createBoundary({
		tree,
		parser: () => parser,
		controlled: () => options.controlled === true,
		onChange: value => emitted.push(value),
	})
	const tx = createTransactions({tree, readOnly: () => false, sink: boundary.sink})
	return {tree, boundary, tx, emitted}
}

describe('boundary: uncontrolled', () => {
	it('commits the edit and emits the new projection', () => {
		const {tree, tx, emitted} = setup('hello')
		expect(tx.applyRange({start: 1, end: 3, insertedLength: 0}, 'XY')).toBe(true)
		expect(tree.value()).toBe('hXYlo')
		expect(emitted).toEqual(['hXYlo'])
	})

	it('emits after the commit, so the tree is already consistent when onChange runs', () => {
		const tree = createTokenTree(parser.parse('hello'))
		const seen: string[] = []
		const boundary = createBoundary({
			tree,
			parser: () => parser,
			controlled: () => false,
			onChange: () => seen.push(tree.value()),
		})
		const tx = createTransactions({tree, readOnly: () => false, sink: boundary.sink})
		tx.applyRange({start: 0, end: 0, insertedLength: 0}, 'A')
		expect(seen).toEqual(['Ahello'])
	})

	it('value() reports the committed projection', () => {
		const {boundary, tx} = setup('hello')
		tx.applyRange({start: 0, end: 0, insertedLength: 0}, 'A')
		expect(boundary.value()).toBe('Ahello')
	})
})
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm -w exec vitest run packages/core/src/features/tokens/tree/boundary.spec.ts`
Expected: FAIL — `./boundary` not found.

- [ ] **Step 3: Implement the uncontrolled path only**

Write `boundary.ts` with `createBoundary` returning `{sink, arrive, reparse,
value}`, where for now `arrive`/`reparse` may be present but minimal (they get
their behavior and tests in Tasks 2–3 — do NOT leave them as empty stubs at
the end of the phase). The uncontrolled `commit` must: parse `next` (with the
same parser-less fallback `createUncontrolledSink` uses — with no markups
configured there is no `Parser` and the whole value is one text token), adopt
with the given window, forward the result to `onResult`, and only THEN call
`onChange(next)` — after the tree is consistent, matching the second test.

Reuse `createUncontrolledSink` from `transactions.ts` rather than duplicating
its body if that keeps the two honest; if wrapping it makes the emission
ordering awkward, inline the logic and say so in your report.

- [ ] **Step 4: Run tests + typecheck**

Run: `pnpm -w exec vitest run packages/core/src/features/tokens/tree/boundary.spec.ts && pnpm run typecheck && pnpm run lint:check`
Expected: PASS. (Lint is in every gate: the pre-commit hook runs it, so a
tests-only gate just defers the failure to `git commit`.)

- [ ] **Step 5: Commit**

```bash
pnpm run format
git add packages/core/src/features/tokens/tree/boundary.ts packages/core/src/features/tokens/tree/boundary.spec.ts
git commit -m "feat(tree): S1.4 boundary — uncontrolled commit and emission"
```

---

### Task 2: Controlled path — emit without committing, record `lastEmitted`

**Files:** modify both files from Task 1.

- [ ] **Step 1: Write the failing tests**

```ts
// append to boundary.spec.ts
describe('boundary: controlled', () => {
	it('emits without committing — the tree keeps the old value', () => {
		const {tree, tx, emitted} = setup('hello', {controlled: true})
		expect(tx.applyRange({start: 1, end: 3, insertedLength: 0}, 'XY')).toBe(true)
		expect(emitted).toEqual(['hXYlo'])
		expect(tree.value()).toBe('hello') // NOT committed
	})

	it('adopts the echo with the exact recorded window', () => {
		// REPEATED CONTENT IS LOAD-BEARING. With a unique fixture the gap-derived
		// window is byte-identical to the recorded one, so this test cannot tell
		// them apart (verified: it passes even when `arrive` always gap-derives).
		// Here they disagree: deleting the FIRST of two identical marks has exact
		// window {0,7,0} — keeping the SECOND mark — while gapWindow returns
		// {7,14,0} and keeps the FIRST.
		const {tree, boundary, tx} = setup('@[x](m)@[x](m)', {controlled: true})
		const secondMarkId = tree.roots()[3].id
		tx.applyRange({start: 0, end: 7, insertedLength: 0}, '')
		boundary.arrive('@[x](m)')
		expect(tree.value()).toBe('@[x](m)')
		expect(tree.roots()[1].id).toBe(secondMarkId) // the survivor is the one the exact window implies
	})

	it('reports the arrived value through value()', () => {
		const {boundary, tx} = setup('hello', {controlled: true})
		tx.applyRange({start: 0, end: 0, insertedLength: 0}, 'A')
		expect(boundary.value()).toBe('hello')
		boundary.arrive('Ahello')
		expect(boundary.value()).toBe('Ahello')
	})

	it('a transforming parent still adopts, via a gap-derived window', () => {
		const {tree, boundary, tx} = setup('hello', {controlled: true})
		tx.applyRange({start: 5, end: 5, insertedLength: 0}, 'x')
		boundary.arrive('HELLOX') // parent uppercased — nothing matches lastEmitted
		expect(tree.value()).toBe('HELLOX')
		expect(stripIds(snapshot(tree.roots()))).toEqual(stripIds(parser.parse('HELLOX')))
	})

	it('a rejecting parent leaves the tree untouched', () => {
		const {tree, tx, emitted} = setup('hello', {controlled: true})
		tx.applyRange({start: 0, end: 0, insertedLength: 0}, 'A')
		expect(emitted).toEqual(['Ahello'])
		expect(tree.value()).toBe('hello') // no arrival → nothing happens
	})
})
```

- [ ] **Step 2: Run — the new tests fail.**

- [ ] **Step 3: Implement**

Controlled `commit(next, window)`: do NOT adopt. Read `base = tree.value()`
(valid per decision D-a), record `lastEmitted = {base, value: next, window}`,
call `onChange(next)`, return `true` (accepted and emitted — matching today's
`replace()` contract).

`arrive(value)`: TAKE and CLEAR `lastEmitted` unconditionally (matched or not
— D6 is explicit), then adopt once:
- exact window **iff** `value === lastEmitted.value && tree.value() === lastEmitted.base`;
- otherwise `gapWindow(tree.value(), value)`.
Parse `value` (parser-less fallback as above), adopt, forward to `onResult`.
Adoption is always continuity-preserving — there is no destructive branch.

`arrive` must be safe in uncontrolled mode too (S1.6a routes `defaultValue`
and external resets through it); an arrival equal to the current projection
should be a cheap no-op adoption, not a rebuild.

- [ ] **Step 4: Run tests + typecheck + lint.**

- [ ] **Step 5: Commit** — `feat(tree): S1.4 boundary — controlled emit, lastEmitted and echo adoption`

---

### Task 3: The interleaving matrix and resets

**Files:** modify both files.

- [ ] **Step 1: Write the failing tests**

```ts
// append to boundary.spec.ts
describe('boundary: interleaving', () => {
	it('edit → edit → echo: the second edit recomputes from the committed projection', () => {
		const {tree, boundary, tx, emitted} = setup('hello', {controlled: true})
		tx.applyRange({start: 0, end: 0, insertedLength: 0}, 'A')
		tx.applyRange({start: 0, end: 0, insertedLength: 0}, 'B')
		expect(emitted).toEqual(['Ahello', 'Bhello']) // both spliced from 'hello'
		boundary.arrive('Bhello')
		expect(tree.value()).toBe('Bhello')
	})

	it('a stale echo does not clobber: it adopts through the gap window', () => {
		const {tree, boundary, tx} = setup('hello', {controlled: true})
		tx.applyRange({start: 0, end: 0, insertedLength: 0}, 'A')
		tx.applyRange({start: 0, end: 0, insertedLength: 0}, 'B')
		boundary.arrive('Ahello') // stale: lastEmitted holds 'Bhello'
		expect(tree.value()).toBe('Ahello')
		expect(stripIds(snapshot(tree.roots()))).toEqual(stripIds(parser.parse('Ahello')))
	})

	it('a second arrival after the record was consumed still adopts correctly', () => {
		const {tree, boundary, tx} = setup('hello', {controlled: true})
		tx.applyRange({start: 0, end: 0, insertedLength: 0}, 'A')
		tx.applyRange({start: 0, end: 0, insertedLength: 0}, 'B')
		boundary.arrive('Ahello') // tree is now 'Ahello'; lastEmitted was cleared here
		boundary.arrive('Bhello') // no record left → gap-derived, still correct
		expect(tree.value()).toBe('Bhello')
		expect(stripIds(snapshot(tree.roots()))).toEqual(stripIds(parser.parse('Bhello')))
	})

	it('an echo that matches the value but not the base gap-adopts (mode flip mid-flight)', () => {
		// The `base` check is only REACHABLE when the value matches while the tree
		// has moved. In pure controlled mode every arrival clears the record, so
		// the only real path is a controlled→uncontrolled flip: the edit commits
		// locally (moving the tree) and the parent's echo lands afterwards.
		let controlled = true
		const tree = createTokenTree(parser.parse('hello'))
		const boundary = createBoundary({
			tree,
			parser: () => parser,
			controlled: () => controlled,
			onChange: () => {},
		})
		const tx = createTransactions({tree, readOnly: () => false, sink: boundary.sink})
		tx.applyRange({start: 0, end: 0, insertedLength: 0}, 'A') // controlled: emits, records base 'hello'
		controlled = false
		tx.applyRange({start: 0, end: 0, insertedLength: 0}, 'C') // uncommitted → commits: tree is 'Chello'
		boundary.arrive('Ahello') // value matches the record, base does not
		expect(tree.value()).toBe('Ahello')
		expect(stripIds(snapshot(tree.roots()))).toEqual(stripIds(parser.parse('Ahello')))
	})

	it('a parent that echoes synchronously inside onChange is handled on the same path', () => {
		// NOTE: this does NOT hit the dispatcher's re-entrancy throw — `assertIdle`
		// guards the verbs, and `arrive` calls adoption directly. It pins that the
		// synchronous round-trip completes, nothing more.
		const tree = createTokenTree(parser.parse('hello'))
		const boundary: Boundary = createBoundary({
			tree,
			parser: () => parser,
			controlled: () => true,
			onChange: value => boundary.arrive(value),
		})
		const tx = createTransactions({tree, readOnly: () => false, sink: boundary.sink})
		expect(tx.applyRange({start: 0, end: 0, insertedLength: 0}, 'A')).toBe(true)
		expect(tree.value()).toBe('Ahello')
	})
})

describe('boundary: resets', () => {
	it('reparse() re-derives every token from the unchanged projection', () => {
		// Adoption is equality-driven: with the value unchanged both walks are inert
		// and the middle rebuilds from the new parse, so gapWindow(v, v) suffices
		// (decision D-c). `createTextToken` is the repo idiom for a parser-less tree.
		const tree = createTokenTree([createTextToken('a@[x](m)b')])
		let active: Parser | undefined
		const boundary = createBoundary({
			tree,
			parser: () => active,
			controlled: () => false,
			onChange: () => {},
		})
		expect(tree.roots()).toHaveLength(1) // parsed as plain text
		active = parser
		boundary.reparse()
		expect(tree.roots().map(n => n.kind)).toEqual(['text', 'mark', 'text'])
		expect(stripIds(snapshot(tree.roots()))).toEqual(stripIds(parser.parse('a@[x](m)b')))
	})

	it('an arrival identical to the current projection is a no-op', () => {
		const {tree, boundary} = setup('a@[x](m)b')
		const ids = tree.roots().map(n => n.id)
		boundary.arrive('a@[x](m)b')
		expect(tree.roots().map(n => n.id)).toEqual(ids)
	})
})
```

Import `createTextToken` from `../parser/utils/createTextToken` (already used
this way in `transactions.spec.ts`).

- [ ] **Step 2: Run — the new tests fail.**

- [ ] **Step 3: Implement**

`reparse()`: read `value = tree.value()`, parse it with the CURRENT parser,
adopt with `gapWindow(value, value)` (decision D-c), forward the result. Do
not emit `onChange` — no value changed. Add the D-e comment: this is
parser-only; `isBlock`/`filterEmptyText` arrivals belong to S1.6a, and the
tree core applies no empty-text filter anywhere yet.

- [ ] **Step 4: Run all tree tests + typecheck + lint.**

- [ ] **Step 5: Commit** — `feat(tree): S1.4 boundary — interleaving matrix and parser/layout resets`

---

### Task 4: Hardening pass

**Files:** modify both files.

- [ ] **Step 1: Prove the guards are load-bearing (mutation testing)**

For each behavior below, apply the mutation, confirm a NAMED test fails, revert,
confirm green. If any mutation survives, the suite has a hole — add the test.

1. Controlled `commit` adopts instead of emitting → the "emits without
   committing" test must fail.
2. `arrive` always uses `gapWindow`, never the exact window → the
   repeated-content exact-window test must fail. (With a UNIQUE fixture this
   mutation survives — verified — which is why that test uses `@[x](m)@[x](m)`.)
3. `onChange` fires BEFORE the adoption in the uncontrolled path → the
   "tree is already consistent" test must fail.
4. The `base` equality check is dropped from `arrive` → the mode-flip test
   must fail.
5. `lastEmitted` is NOT cleared on a mismatched arrival → **expected to
   SURVIVE at the projection level.** Verification proved adoption converges
   to the same string under both windows, so no value-level assertion can
   gate it; if your mode-flip fixture happens to catch it via ids, say so,
   and if it does not, record the gap in a comment rather than inventing a
   test that does not discriminate.
6. `map` after `reparse` (decision D-c's real consequence): assert
   `result.map(1)` resolves to an anchor inside the FIRST text node, not the
   document end. This is what would break if someone "fixes" `reparse` to use
   a full window.

- [ ] **Step 2: Add whatever tests the mutations proved missing, and record
      any mutation you could not gate.** An honest recorded gap beats a test
      that passes under the defect.

- [ ] **Step 3: `untracked` discipline**

`adopt` and the transaction verbs are wrapped in `untracked` because a caller
inside an effect must not subscribe to the projection or to arbitrary nodes.
Facts established by verification, so you do not have to rediscover them:
- the `commit`-path `tree.value()` read is ALREADY covered — the dispatcher
  wraps `sink.commit` in `untracked` (`transactions.ts`);
- `arrive` and `reparse` are the ones that need it, because S1.6a wires them
  to a props `watch` (an effect), and an unwrapped `tree.value()` there would
  subscribe that watcher to the very projection it is about to mutate;
- `value()` is a public READ a consumer may legitimately want to track, so it
  must NOT be wrapped.
Implement accordingly and pin the `arrive`/`reparse` choice with an
effect-count test, as `transactions.spec.ts` does.

- [ ] **Step 4: Decide the no-op emission question**

`transactions.ts` documents that a splice changing nothing still reaches the
sink, and explicitly hands the phase adding the CONTROLLED sink the decision
of whether an unchanged value may still fire `onChange`. That is this phase.

**Parity baseline (measured today, both modes):** `value.replace({start:2,
end:2}, '')` DOES fire `onChange('hello')` and returns `true` —
`ValueModel.current`'s set transform runs before the signal's equality
short-circuit. So suppressing the emission is a user-visible behavior change,
which AGENTS.md requires you to call out explicitly in the commit body rather
than bury as cleanup.

Whichever way you decide: the verb must still return `true` (D6: "accepted and
emitted"), so a suppressing sink skips `onChange` while still returning `true`
— it must not return `false`. Document the decision where `transactions.ts`
points at it, and pin it with a test either way.

- [ ] **Step 5: Full gates + commit**

Run: `pnpm -w exec vitest run packages/core/src/features/tokens/tree && pnpm -F @markput/core run test && pnpm run typecheck && pnpm run lint:check && pnpm run format:check`

```bash
git add packages/core/src/features/tokens/tree/boundary.ts packages/core/src/features/tokens/tree/boundary.spec.ts
git commit -m "test(tree): S1.4 boundary hardening — mutation-proven guards and no-op emission policy"
```

---

## Self-review notes (spec → plan)

- Covers S1.4's scope line: controlled CommitSink (emit + record), arrival
  routing with the `value`/`base` validity checks, resets, controlled
  verb-return semantics.
- D6 matrix rows covered: edit→echo (exact window), edit→edit→echo, stale
  echo, echo-of-second-emission (base check), transform, reject, re-entrant.
- **Deliberately deferred, with reasons above:** `selectionBefore` (D-b);
  `insertMark` returning `undefined` in controlled mode (that verb does not
  exist yet — it arrives with the public API in S1.7); caret repair via `map`
  (S1.6c owns selection).
- Not in this plan: any change to the live `ValueModel`, Store wiring, or the
  view pipeline. Those are S1.5/S1.6a.
