# One Fresh Truth — Phase 0: Empty-Row Fix + Handshake Warning Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the unpinned empty-row re-render bug at its root (TreeBuilder's empty-slot collapse), pin it with new render-count gates in both adapters, pin the `mergeDragRows` side effect, and add the dev-mode `rendered()`-timeout warning.

**Architecture:** One-line root-cause fix in `TreeBuilder.createSlotSourceInfo` (empty slot ≠ no slot — emit a zero-width slot window instead of `undefined`), which lets the existing deep-descend machinery route the first keystroke into a fresh empty row down the text path. Empirically pre-verified: the empty row already has an empty text child (1:1 pairing) and an empty contenteditable span (patch target); exactly 2 existing specs pin the old behavior and get rewritten. The handshake warning is a dev-only timer in `commit.ts` cleared by `bindAndAnnounce`.

**Tech Stack:** TypeScript, vitest in REAL Chromium browser mode. Run patterns: `pnpm -F core test -- <pattern>`, `pnpm -F storybook test -- <pattern>`. Conventions: tabs, single quotes, no semicolons, `import type`, **no trailing newline**.

**Spec:** `docs/superpowers/specs/2026-06-13-tokenmodel-one-fresh-truth-design.md` (Phase 0 + Graft B amendment).

**Background facts (probe-verified, do not re-derive):**
- `parse('a\n\n\n\n')` with `new Parser(['__slot__\n\n'])` yields the empty second row as `MARK "\n\n" [3-5]` with `slot: undefined` but `children: [TEXT "" [3-3]]` — the empty text child EXISTS; only the `slot` field collapses (`TreeBuilder.ts` `createSlotSourceInfo`, falsy check on `slotContent`).
- Typing 'b' into that empty row produces changeset `{textChanged: [rowMarkId], added: [], removed: [], updated: […]}` — routing passes the added/removed gate; escalation happens at `commit.ts` `commitText`'s `entry.token.type !== 'text'` check (refused descend at tryDescend condition 3: `if (!prevSlot || !nextSlot) return false`).
- The empty row's DOM already contains `<span contenteditable="true"></span>` (the empty text child's Span) — a bound textElement patch target.
- Under the fix the changeset becomes `{textChanged: [childTextId], added: [], removed: [], updated: […, rowMarkId]}` and the end-to-end gate passes with 0 re-renders.

---

### Task 1: New empty-row render-count gate (React) — red

**Files:**
- Modify: `packages/storybook/src/pages/renderCount.react.spec.tsx` (append inside `describe('Render-count gates: block layout')`)

- [x] **Step 1: Write the failing gate test**

Append after the existing `it('block keystroke into a row …')` block, inside the same `describe`:

```tsx
	it('first keystroke into a freshly-Enter-created empty row rides the text path', async () => {
		const markRender = vi.fn()
		const spanRender = vi.fn()
		const RowMark = ({children, value}: MarkProps) => {
			markRender()
			return <span>{children ?? value}</span>
		}
		const Span = ({value}: MarkProps) => {
			spanRender()
			return <span>{value}</span>
		}
		// oxlint-disable-next-line no-unsafe-type-assertion -- raw markup literal, as in the Drag fixtures
		const options: Option[] = [{markup: '__slot__\n\n' as Markup, Mark: RowMark}]

		const {container} = await render(
			<MarkedInput Span={Span} options={options} defaultValue={'First row\n\n'} layout="block" draggable />
		)
		expect(getAllRows(container)).toHaveLength(1)

		await focusAtEnd(getEditableInRow(getAllRows(container)[0]))

		// Enter at the row end creates an EMPTY row with the caret inside it —
		// structural, re-renders. The gate below is a delta from AFTER it settled.
		await userEvent.keyboard('{Enter}')
		expect(getAllRows(container)).toHaveLength(2)
		const markBaseline = markRender.mock.calls.length
		const spanBaseline = spanRender.mock.calls.length

		// Gate: the FIRST keystroke into the fresh empty row rides the text path —
		// the empty slot Span is patched in place, zero component re-renders.
		// (Pre-fix: TreeBuilder collapsed the empty slot to undefined, tryDescend
		// refused, and the keystroke escalated to a full framework re-render.)
		await userEvent.keyboard('x')
		await expect.element(page.getByText('x')).toBeInTheDocument()
		expect(spanRender.mock.calls.length).toBe(spanBaseline)
		expect(markRender.mock.calls.length).toBe(markBaseline)
	})
```

- [x] **Step 2: Run it — verify it fails for the right reason**

Run: `pnpm -F storybook test -- renderCount.react`
Expected: the NEW test FAILS on the two final assertions (render counts grew — currently mark and span each re-render on the first keystroke); the pre-existing tests still pass. If it fails on anything before the keystroke assertions (row counts, focus), STOP and report — the harness assumption is wrong, not the gate.

- [x] **Step 3: Commit the red gate**

```bash
git add packages/storybook/src/pages/renderCount.react.spec.tsx
git commit -m "test(storybook): failing gate — first keystroke into a fresh empty row must not re-render"
```

---

### Task 2: TreeBuilder root-cause fix + rewrite the two pinning specs — green

**Files:**
- Modify: `packages/core/src/features/tokens/parser/core/TreeBuilder.ts:173-193, 235-247`
- Modify: `packages/core/src/features/tokens/tokenIdentity.spec.ts:485-497`
- Modify: `packages/core/src/features/tokens/parser/Parser.spec.ts` (one inline snapshot)

- [x] **Step 1: The fix — empty slot ≠ no slot**

In `TreeBuilder.ts`, `createMarkToken` currently converts an empty slot string to `undefined` before delegating:

```ts
		// Convert empty strings to undefined for slot, but meta can be empty string
		const slotContent = slotStr || undefined
		const meta = match.gaps.meta !== undefined ? metaStr : undefined
```

Replace those two lines with:

```ts
		const meta = match.gaps.meta !== undefined ? metaStr : undefined
```

and change the `slot:` field initializer in the returned object from `slot: this.createSlotSourceInfo(match, slotContent),` to:

```ts
			slot: this.createSlotSourceInfo(match, slotStr),
```

Then replace `createSlotSourceInfo` (keeping its position in the file):

```ts
	/**
	 * Creates children source info object if the markup has a slot gap.
	 * An EMPTY slot is still a slot: a fresh empty row ('\n\n') keeps a
	 * zero-width window so reconcile can descend into it — the first keystroke
	 * into the row stays on the text path instead of re-rendering.
	 */
	private createSlotSourceInfo(match: Match, slotContent: string): MarkToken['slot'] {
		if (match.gaps.slot === undefined) {
			return undefined
		}
		return {
			content: slotContent,
			start: match.gaps.slot.start,
			end: match.gaps.slot.end,
		}
	}
```

Note: `hasSlotContent` and `getContentBounds` already key off `match.gaps.slot` — leave them untouched.

- [x] **Step 2: Run the core suite to surface the two pins**

Run: `pnpm -F core test`
Expected: exactly 2 failures —
1. `tokenIdentity.spec.ts` → `refusal: a slotless mark pair (empty slot) → mark-level textChanged with id inheritance`
2. `Parser.spec.ts` → the `handles __label__ and __slot__ with empty nested content` inline snapshot (gains `slot` on `MARK "@[user]()"`)

If anything ELSE fails, STOP and report before touching specs.

- [x] **Step 3: Rewrite the tokenIdentity pin — refusal becomes descend success**

In `tokenIdentity.spec.ts`, replace the whole `it('refusal: a slotless mark pair (empty slot) → mark-level textChanged with id inheritance', …)` block (currently lines 485–497) with:

```ts
	it('empty slot descends: zero-width window pairs the empty text child (first keystroke into a fresh row)', () => {
		const tracker = createIdentityTracker()
		// '#[]' keeps a zero-width slot range — empty slot ≠ no slot (parser
		// contract since the Phase 0 empty-row fix), so descend scopes its window
		// and the empty text child pairs 1:1 with the typed-into child.
		const first = tracker.reconcile(slotParser.parse('#[]')).tokens
		const mark = asMark(first[1])
		const markId = tracker.idOf(mark)
		const childId = tracker.idOf(mark.children[0])

		const result = tracker.reconcile(slotParser.parse('#[a]'), {start: 2, end: 2, insertedLength: 1})
		const changeset = delta(result)

		expect(result.tokens).toEqual(slotParser.parse('#[a]'))
		// Text-path shape: the child carries the change, the mark is an update.
		expect(changeset.textChanged).toEqual([childId])
		expect(changeset.added).toEqual([])
		expect(changeset.removed).toEqual([])
		expect(changeset.updated).toContain(markId)
		expect(tracker.idOf(asMark(result.tokens[1]))).toBe(markId)
		expect(tracker.idOf(asMark(result.tokens[1]).children[0])).toBe(childId)
	})
```

(`slotParser`, `asMark`, `delta` already exist in this file — reuse them.)

- [x] **Step 4: Update the Parser inline snapshot**

Run: `pnpm -F core test -- Parser.spec -u`
Then inspect the diff: the ONLY change must be the empty-slot mark in `handles __label__ and __slot__ with empty nested content` gaining a slot entry (e.g. `slot: ''` / a zero-width slot object on `MARK "@[user]()"`). If the `-u` flag is not accepted by the browser-mode runner, edit the inline snapshot by hand to match the new parse output. Revert anything else `-u` touched.

- [x] **Step 5: Verify green — core + the new gate**

Run: `pnpm -F core test`
Expected: full pass (724 passed, 1 todo).
Run: `pnpm -F storybook test -- renderCount.react`
Expected: ALL tests pass, including Task 1's gate.

- [x] **Step 6: Commit**

```bash
git add packages/core/src/features/tokens/parser/core/TreeBuilder.ts packages/core/src/features/tokens/tokenIdentity.spec.ts packages/core/src/features/tokens/parser/Parser.spec.ts
git commit -m "fix(parser): empty slot keeps a zero-width window — first keystroke into a fresh row rides the text path"
```

---

### Task 3: Vue parity gate

**Files:**
- Modify: `packages/storybook/src/pages/renderCount.vue.spec.ts` (append inside `describe('Render-count gates: block layout')`)

- [x] **Step 1: Write the Vue mirror of Task 1's gate**

Append after the existing `it(…)` block, inside the same `describe`:

```ts
	it('first keystroke into a freshly-Enter-created empty row rides the text path', async () => {
		const markRender = vi.fn()
		const spanRender = vi.fn()
		const RowMark = defineComponent({
			props: {value: String},
			setup(props, {slots}) {
				return () => {
					markRender()
					return h('span', {}, slots.default?.() ?? props.value)
				}
			},
		})
		const Span = defineComponent({
			props: {value: String},
			setup(props) {
				return () => {
					spanRender()
					return h('span', {}, props.value)
				}
			},
		})
		// oxlint-disable-next-line no-unsafe-type-assertion -- raw markup literal, as in the Drag fixtures
		const options: Option[] = [{markup: '__slot__\n\n' as Markup, Mark: RowMark}]
		const Fixture = defineComponent({
			setup() {
				return () =>
					h(MarkedInput, {
						Span,
						options,
						defaultValue: 'First row\n\n',
						layout: 'block',
						draggable: true,
					})
			},
		})

		const {container} = await render(Fixture)
		expect(getAllRows(container)).toHaveLength(1)

		await focusAtEnd(getEditableInRow(getAllRows(container)[0]))

		// Enter creates an EMPTY row (caret inside it) — structural, re-renders.
		await userEvent.keyboard('{Enter}')
		expect(getAllRows(container)).toHaveLength(2)
		const markBaseline = markRender.mock.calls.length
		const spanBaseline = spanRender.mock.calls.length

		// Gate: the FIRST keystroke into the fresh empty row rides the text path —
		// the empty slot Span is patched in place, zero component re-renders.
		await userEvent.keyboard('x')
		await expect.element(page.getByText('x')).toBeInTheDocument()
		expect(spanRender.mock.calls.length).toBe(spanBaseline)
		expect(markRender.mock.calls.length).toBe(markBaseline)
	})
```

- [x] **Step 2: Run both adapter gates**

Run: `pnpm -F storybook test -- renderCount`
Expected: all pass (react + vue, old gates + both new ones).

- [x] **Step 3: Commit**

```bash
git add packages/storybook/src/pages/renderCount.vue.spec.ts
git commit -m "test(storybook): vue parity gate for the fresh-empty-row text path"
```

---

### Task 4: Pin the mergeDragRows side effect

The fix gives an empty row a zero-width `slot`, so `mergeDragRows` (`packages/core/src/features/block/operations.ts:73`: `prev.slot ? prev.slot.end : prev.position.end`) now slices at the slot start instead of after the suffix — merging INTO an empty row actually merges (old behavior: no-op). All existing drag specs pass either way; this pins the new, intended semantics.

**Files:**
- Modify: `packages/core/src/features/block/operations.spec.ts`

- [x] **Step 1: Add the pin**

Add imports at the top of the file (alongside the existing ones):

```ts
import {Parser} from '../tokens/parser/Parser'
import {mergeDragRows} from './operations'
```

(`mergeDragRows` may instead be added to the existing `./operations` import list — match the file's style.) Then append a new describe at the end of the file:

```ts
describe('mergeDragRows', () => {
	it('merging into an EMPTY previous row drops its suffix (zero-width slot)', () => {
		// rows: '' and 'b' — the empty row's slot is a zero-width window at its
		// start (Phase 0 parser fix), so the merge removes the empty row's '\n\n'
		// suffix entirely. Old behavior (slot undefined → slotEnd = position.end)
		// was a silent no-op.
		const rowParser = new Parser(['__slot__\n\n'])
		const value = '\n\nb\n\n'
		const rows = rowParser.parse(value).filter(token => token.type === 'mark')
		expect(rows).toHaveLength(2)

		const result = mergeDragRows(value, rows, 1)

		expect(result).toEqual({value: 'b\n\n', caret: 0})
	})
})
```

Note: `Parser(['__slot__\n\n'])` needs the markup cast used elsewhere in core specs if `Markup` is a branded type — copy the cast style from `tokenIdentity.spec.ts`'s parser construction if the typecheck complains.

- [x] **Step 2: Run**

Run: `pnpm -F core test -- operations`
Expected: all pass, including the new pin.

- [x] **Step 3: Commit**

```bash
git add packages/core/src/features/block/operations.spec.ts
git commit -m "test(block): pin mergeDragRows into an empty row — zero-width slot merges, not no-ops"
```

---

### Task 5: rendered()-timeout dev warning

A structural publish whose `rendered()` never arrives is a silent adapter-handshake failure (the T5 React ref-shadowing bug class: tree published, nothing ever binds, the editor sits stale with no error). Dev/test-only timer, cleared by the bind.

**Files:**
- Modify: `packages/core/src/features/tokens/model/commit.ts`
- Modify: `packages/core/src/features/tokens/model/commit.spec.ts`

- [x] **Step 1: Write the failing spec**

In `commit.spec.ts`, first make the harness accept the new dep — change the `createHarness` signature and pipeline construction (lines 19, 27-35):

```ts
function createHarness(overrides?: {renderedTimeoutMs?: number}) {
```

and add to the `createCommitPipeline({...})` argument object:

```ts
		renderedTimeoutMs: overrides?.renderedTimeoutMs,
```

Then append a new describe at the end of the top-level `describe('createCommitPipeline')`:

```ts
	describe('rendered() timeout warning (dev)', () => {
		it('warns when a structural publish never gets rendered(); a timely handshake stays silent', async () => {
			const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
			try {
				const harness = createHarness({renderedTimeoutMs: 20})
				harness.apply('he@[x]llo')
				await new Promise(resolve => setTimeout(resolve, 60))
				expect(warn).toHaveBeenCalledTimes(1)
				expect(String(warn.mock.calls[0][0])).toContain('rendered()')

				harness.render()
				harness.apply('he@[x]llo@[y]')
				harness.render()
				await new Promise(resolve => setTimeout(resolve, 60))
				expect(warn).toHaveBeenCalledTimes(1)
			} finally {
				warn.mockRestore()
			}
		})
	})
```

- [x] **Step 2: Run to verify it fails**

Run: `pnpm -F core test -- commit.spec`
Expected: the new test FAILS (typecheck error on the unknown `renderedTimeoutMs` dep, or zero warn calls). Existing tests pass.

- [x] **Step 3: Implement the warning**

In `commit.ts`:

Add to `CommitDeps` (after `isBlock`):

```ts
	/** Dev-only: ms before warning that a structural publish never got rendered(). Test seam; defaults to 2000. */
	renderedTimeoutMs?: number
```

In `createCommitPipeline`, after the `let committing = false` declaration:

```ts
	// Dev-only handshake tripwire: a structural publish whose rendered() never
	// arrives leaves the editor silently stale (e.g. a shadowed container ref).
	const renderedTimeoutMs = deps.renderedTimeoutMs ?? 2000
	let renderedTimer: ReturnType<typeof setTimeout> | undefined
```

In `commitStructural`, after `tree(tokens)` (before the `if (!selfHeal) return`):

```ts
		if (VERIFY_DOM) {
			clearTimeout(renderedTimer)
			renderedTimer = setTimeout(() => {
				if (pendingStructural && deps.container()) {
					console.warn(
						`[markput] rendered() was not called within ${renderedTimeoutMs}ms of a structural update — ` +
							'the adapter handshake is broken (host.rendered must run after every paint)'
					)
				}
			}, renderedTimeoutMs)
		}
```

In `bindAndAnnounce`, as its first line:

```ts
		clearTimeout(renderedTimer)
```

The timer body re-checks `pendingStructural` and `deps.container()`: an unmounted container is the legitimate cold-start state, not a broken handshake. Production bundles strip the whole branch via `VERIFY_DOM`.

- [x] **Step 4: Run to verify green**

Run: `pnpm -F core test -- commit.spec`
Expected: all pass. (Other commit.spec scenarios that latch without rendering may emit the warning after their test ends — harmless console noise in dev/test, never an assertion failure.)

- [x] **Step 5: Commit**

```bash
git add packages/core/src/features/tokens/model/commit.ts packages/core/src/features/tokens/model/commit.spec.ts
git commit -m "feat(tokens): dev warning when rendered() never follows a structural publish"
```

---

### Task 6: Full verification

- [x] **Step 1: All suites + guards**

Run, expecting full pass on each:
```bash
pnpm -F core test          # 724 passed, 1 todo
pnpm -F react test         # 218
pnpm -F vue test           # 200
pnpm -F storybook test     # incl. both new gates
pnpm run typecheck         # recursive tsc --noEmit
pnpm run check:encapsulation
```

- [x] **Step 2: Commit anything outstanding (should be nothing) and report**

`git status` must be clean. Report the suite numbers.

---

### Task 7: Write the Phase 1 plan (phase chaining)

- [x] **Step 1: Invoke the superpowers:writing-plans skill** to produce `docs/superpowers/plans/2026-06-13-one-fresh-truth-phase1.md` for **Phase 1 — identity unification** from the spec (`docs/superpowers/specs/2026-06-13-tokenmodel-one-fresh-truth-design.md`): stamp `token.id` at reconcile (keep the WeakMap as an internal shim for one phase), `keyOf()` on the adapter SPI, switch both adapters' Containers off KeyGenerator, re-key BlockController `#stores` by id, verify the suffix-remount fix in storybook. Ground the plan by reading `tokenIdentity.ts`, both `Container` components, `Store.key`/KeyGenerator, and `BlockController.ts` first — no placeholder steps.

- [x] **Step 2: Commit the plan**

```bash
git add docs/superpowers/plans/2026-06-13-one-fresh-truth-phase1.md
git commit -m "docs(plan): one-fresh-truth phase 1 — identity unification"
```