# One Fresh Truth — Phase 1: Identity Unification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Unify the three parallel identity systems on `token.id`: stamp the id as a plain field at reconcile (WeakMap kept as an internal shim for one phase), expose `keyOf()` on the adapter SPI, switch both adapters' token keying off the object-keyed KeyGenerator, and re-key BlockController's per-row stores by id — fixing the two verified latent defects (suffix-shifted tokens get spurious framework remounts; per-row drag/hover state silently resets).

**Architecture:** `createIdentityTracker`'s `ensureId`/`inherit` mirror every WeakMap write onto a new optional `id` field on `TextToken`/`MarkToken` (the parser never stamps it; only reconciled trees carry it). `TokenModel.keyOf(token)` returns `token.id` (idOf fallback for totality) and becomes the one source of framework keys: both Containers and both Token components key by it, so a suffix-shifted token — a NEW object with an INHERITED id — keeps its key and is reconciled in place instead of remounted. `BlockController.#stores` becomes a `Map<number, BlockStore>` keyed by the same id, pruned on the `changed` event's `removed` ids. `Store.key` (KeyGenerator) survives ONLY for the OverlayRenderers' option keying.

**Tech Stack:** TypeScript, vitest in REAL Chromium browser mode. Run patterns: `pnpm -F core test -- <pattern>`, `pnpm -F storybook test -- <pattern>` (the storybook `test` script expands to `pnpm -w exec vitest run --project react --project vue`; per-framework: `pnpm -F storybook test:react` / `test:vue`). **WARNING: `pnpm -F react test` and `pnpm -F vue test` are silent no-ops** — `@markput/react`/`@markput/vue` have NO test script and pnpm exits 0 with no output; the react/vue vitest projects are the storybook page specs. Conventions: tabs, single quotes, no semicolons, `import type`, **no trailing newline at end of files**.

**Spec:** `docs/superpowers/specs/2026-06-13-tokenmodel-one-fresh-truth-design.md` (Phase 1 + Graft A).

**Background facts (probe-verified, do not re-derive):**
- The suffix-remount defect's mechanism: `tokenIdentity.ts`'s suffix walk (`tokensEqualShifted` with `shiftDelta !== 0`) keeps the NEXT-parse object and `inherit`s the previous id onto it — a new object every time anything before it changes length. `KeyGenerator.get` is a per-OBJECT WeakMap counter, so the shifted token gets a brand-new framework key and React/Vue unmount+remount it (component-local state and DOM focus die silently).
- The drag-state defect is the same shape: `BlockController.#stores` is `WeakMap<object, BlockStore>`, so a suffix-shifted row's BlockStore is silently abandoned and recreated empty.
- `reconcile`'s final `out.forEach(ensureId)` plus `ensureId`'s mark-children recursion guarantee every token of the OUTPUT tree passes through `ensureId` — stamping the field there (and in `inherit`) covers the whole tree with no extra walk.
- Stamping an enumerable `id` field breaks every `toEqual` between a reconciled tree and a fresh parse / token literal (vitest `toEqual` rejects extra DEFINED properties on the received value; `toMatchObject` tolerates them and still checks array lengths and every expected field recursively). The complete site list is in Task 1 Step 5 — verified by grep, nothing else in the repo deep-compares reconciled trees (parser specs compare unreconciled parses; `expect.objectContaining` sites are immune).
- Default options (`shared/constants.ts`): one markup `'@[__value__](__meta__)'` with overlay trigger `'@'`. Typing `@[new](3)` completes a mark exactly once, at the final `)` — there is no intermediate parse state that mounts a transient mark (the markup needs both bracket pairs). The existing renderCount gate types `'@[[struct](2)'` through the same path.
- `tokens.changed` (`Event<Changeset>`) fires once per commit after the DOM is consistent; its delta `removed` bucket carries the ids of removed tokens and all their descendants — exactly the prune feed the id-keyed store map needs.

---

### Task 1: `token.id` plain field, stamped at reconcile

**Files:**
- Modify: `packages/core/src/features/tokens/parser/types.ts:6-31`
- Modify: `packages/core/src/features/tokens/tokenIdentity.ts:75-99`
- Modify: `packages/core/src/features/tokens/tokenIdentity.spec.ts` (append tests; rewrite 5 equality pins)
- Modify: `packages/core/src/features/tokens/tokenIdentity.property.spec.ts:418-420`
- Modify: `packages/core/src/features/tokens/TokenModel.spec.ts` (6 equality pins)
- Modify: `packages/core/src/features/state/ValueModel.spec.ts` (6 equality pins)
- Modify: `packages/core/src/store/Store.spec.ts` (2 equality pins)

- [ ] **Step 1: Write the failing tests**

Append at the end of `tokenIdentity.spec.ts` (after the closing `})` of `describe('deep reconcile (descend)')`), as a new top-level describe. `parser` is the module-level `new Parser(['@[__value__]'])`; the local slot parser is constructed inline because the existing `slotParser` is scoped to the descend describe:

```ts
describe('token.id plain field (identity unification, phase 1)', () => {
	it('stamps id on every reconciled token, mirroring idOf', () => {
		const tracker = createIdentityTracker()
		const slotted = new Parser(['#[__slot__]'])
		const result = tracker.reconcile(slotted.parse('#[ab]tail'))

		const assertIdField = (tokens: readonly Token[]): void => {
			for (const token of tokens) {
				expect(token.id).toBe(tracker.idOf(token))
				if (token.type === 'mark') assertIdField(token.children)
			}
		}
		expect(result.tokens).toHaveLength(3)
		assertIdField(result.tokens)
	})

	it('a suffix-shifted token carries its inherited id as a field', () => {
		const tracker = createIdentityTracker()
		const first = tracker.reconcile(parser.parse('he@[x]llo')).tokens
		const markId = first[1].id

		// edit before the mark: 'he@[x]llo' → 'hAe@[x]llo' — the mark suffix-
		// shifts into a NEW object; the id field must travel with the identity
		const result = tracker.reconcile(parser.parse('hAe@[x]llo'), {start: 1, end: 1, insertedLength: 1})

		expect(typeof markId).toBe('number')
		expect(result.tokens[1]).not.toBe(first[1])
		expect(result.tokens[1].id).toBe(markId)
	})
})
```

- [ ] **Step 2: Run to verify they fail**

Run: `pnpm -F core test -- tokenIdentity.spec`
Expected: the 2 new tests FAIL (`token.id` is `undefined` — the field does not exist yet); all pre-existing tests pass.

- [ ] **Step 3: Implement the field**

In `parser/types.ts`, add the same optional field to BOTH interfaces. `TextToken` becomes:

```ts
export interface TextToken {
	type: 'text'
	content: string
	position: {
		start: number
		end: number
	}
	/** Stable identity id, stamped by reconcile (tokenIdentity) — NOT by the parser. Absent on freshly parsed, never-reconciled trees. */
	id?: number
}
```

and `MarkToken` gains the identical two lines (doc comment + `id?: number`) directly after its `position` block.

In `tokenIdentity.ts`, replace `ensureId` (lines 75-83) with:

```ts
	const ensureId = (token: Token): number => {
		let id = ids.get(token)
		if (id === undefined) {
			id = nextId++
			ids.set(token, id)
		}
		// Phase 1 shim: the WeakMap stays the internal source of truth for one
		// phase; the plain field mirrors it so consumers (keyOf, adapters) read
		// token.id without reaching into the tracker.
		token.id = id
		if (token.type === 'mark') token.children.forEach(ensureId)
		return id
	}
```

and in `inherit` (lines 91-99), change the first two lines of the body from:

```ts
		const id = ids.get(from)
		if (id !== undefined) ids.set(to, id)
```

to:

```ts
		const id = ids.get(from)
		if (id !== undefined) {
			ids.set(to, id)
			to.id = id
		}
```

(`tryDescend`'s direct `ids.set(nextMark, id)` at line 167 needs no mirror: `pairSlotChildren` + the trailing `updated.push(ensureId(nextMark))` stamp it immediately after.)

- [ ] **Step 4: Run the core suite to surface the equality pins**

Run: `pnpm -F core test`
Expected: the 2 new tests pass; the ONLY failures are deep-equality pins comparing a reconciled tree against a fresh parse or a token literal (extra `id` field on the received value) — the exact 20 sites listed in Step 5. If anything ELSE fails, STOP and report.

- [ ] **Step 5: Rewrite the equality pins — `toEqual` → `toMatchObject`**

Mechanical rule: at each site below, change `.toEqual(` to `.toMatchObject(` (same arguments; `toMatchObject` still pins array lengths and every parser-produced field, while tolerating the stamped `id`).

`tokenIdentity.spec.ts` — 5 sites:
- line ~216: `expect(result.tokens).toEqual(slotParser.parse('#[aXb]tail'))`
- line ~248: `expect(result.tokens).toEqual(slotParser.parse('#[a #[bX] c]'))`
- line ~280: `expect(result.tokens).toEqual(rowParser.parse('aXbc\n\ndef\n\n'))`
- line ~390: `expect(result.tokens).toEqual(slotParser.parse('#[a c]'))`
- line ~498: `expect(result.tokens).toEqual(slotParser.parse('#[a]'))`

`TokenModel.spec.ts` (`features/tokens/TokenModel.spec.ts`) — 6 sites (lines ~29, 35, 40, 52, 79, 98), all of the shape `expect(store.tokens.tree()).toEqual([{type: 'text', …}])` (the line-98 one asserts `tokensAtChangeTime`). Leave lines 59 and 67-71 untouched (`arrayContaining`/`objectContaining` are immune).

`features/state/ValueModel.spec.ts` — 6 sites (lines ~32, 40, 50, 61, 73, 85), all `expect(store.tokens.tree()).toEqual([{type: 'text', …}])`.

`store/Store.spec.ts` — 2 sites (lines ~138, 159), same shape. Leave line 11's `toEqual([])` alone (no tokens, nothing stamped).

`tokenIdentity.property.spec.ts` — replace lines 418-420 (the comment + assertion inside `assertReconcileEquivalence`):

```ts
	// 1. Output equivalence: the reconciled tree must match a fresh parse on
	//    every parser-produced field. toMatchObject (not toEqual) because
	//    reconcile stamps the extra `id` field on its output — `fresh` carries none.
	expect(result.tokens).toMatchObject(fresh)

	// 1b. Identity-field coherence: every reconciled token carries its id as a
	//     plain field, equal to the tracker's answer (the phase-1 WeakMap shim).
	const assertIdField = (tokens: readonly Token[]): void => {
		for (const token of tokens) {
			expect(token.id, 'reconciled token must carry its id as a plain field').toBe(tracker.idOf(token))
			if (token.type === 'mark') assertIdField(token.children)
		}
	}
	assertIdField(result.tokens)
```

- [ ] **Step 6: Run the full core suite to verify green**

Run: `pnpm -F core test`
Expected: full pass (728 passed, 1 todo — the pre-phase-1 726 + the 2 new tests; if the baseline differs, the delta must be exactly +2 and zero failures).

- [ ] **Step 7: Commit**

```bash
git add packages/core/src/features/tokens/parser/types.ts packages/core/src/features/tokens/tokenIdentity.ts packages/core/src/features/tokens/tokenIdentity.spec.ts packages/core/src/features/tokens/tokenIdentity.property.spec.ts packages/core/src/features/tokens/TokenModel.spec.ts packages/core/src/features/state/ValueModel.spec.ts packages/core/src/store/Store.spec.ts
git commit -m "feat(tokens): stamp token.id at reconcile — plain field mirrors the WeakMap shim"
```

---

### Task 2: `keyOf` on the adapter SPI

**Files:**
- Modify: `packages/core/src/features/tokens/model/TokenModel.ts` (one property after `changed`)
- Modify: `packages/core/src/features/tokens/TokenModel.spec.ts` (append a describe)
- Modify: `packages/core/src/store/Store.ts:14` (comment only)

- [ ] **Step 1: Write the failing test**

Append inside `TokenModel.spec.ts`'s top-level `describe('TokenModel')` (after the `block layout empty text filtering` describe), reusing the file's `store` from `beforeEach`:

```ts
	describe('keyOf (adapter SPI)', () => {
		it('returns the stable identity id — a suffix-shifted token keeps its key', () => {
			store.props.set({Mark: () => null, options: [{markup: '@[__value__]'}], defaultValue: 'he@[x]llo'})
			store.host.container(document.createElement('div'))
			const mark = store.tokens.tree()[1]
			const markKey = store.tokens.keyOf(mark)

			// edit BEFORE the mark: 'he@[x]llo' → 'Xhe@[x]llo' — the mark suffix-
			// shifts into a NEW object with an INHERITED id; the framework key
			// must not change (object-keyed counters remounted it, the defect)
			store.value.current('Xhe@[x]llo')

			const shifted = store.tokens.tree()[1]
			expect(shifted).not.toBe(mark)
			expect(store.tokens.keyOf(shifted)).toBe(markKey)
		})
	})
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm -F core test -- TokenModel`
Expected: the new test FAILS (`store.tokens.keyOf is not a function`); everything else passes.

- [ ] **Step 3: Implement `keyOf`**

In `model/TokenModel.ts`, directly after the `changed` field declaration (`readonly changed: Event<Changeset> = this.#pipeline.changed`), add:

```ts
	/**
	 * Adapter SPI: the framework key of a render-tree token — its stable
	 * identity id, so a suffix-shifted token (new object, inherited id) keeps
	 * its key and is reconciled in place instead of remounted. Arrow property:
	 * adapters pass it around unbound. Total like the KeyGenerator it replaces;
	 * the idOf fallback covers tokens that predate reconcile stamping (and
	 * allocates for foreign tokens, exactly as the old per-object counter did).
	 */
	readonly keyOf = (token: Token): number => token.id ?? this.#identity.idOf(token)
```

In `store/Store.ts`, annotate the surviving KeyGenerator (line 14) so nobody re-adopts it for tokens:

```ts
	/** Overlay OPTION keying only (OverlayRenderer) — token framework keys come from tokens.keyOf (stable identity ids). */
	readonly key = new KeyGenerator()
```

- [ ] **Step 4: Run to verify green**

Run: `pnpm -F core test -- TokenModel`
Expected: all pass, including the new test.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/features/tokens/model/TokenModel.ts packages/core/src/features/tokens/TokenModel.spec.ts packages/core/src/store/Store.ts
git commit -m "feat(tokens): keyOf on the adapter SPI — framework keys from stable identity ids"
```

---

### Task 3: React remount gate — red

**Files:**
- Modify: `packages/storybook/src/pages/renderCount.react.spec.tsx` (append a top-level describe; add `useEffect` import)

- [ ] **Step 1: Write the failing gate**

Add to the react imports at the top of the file:

```tsx
import {useEffect} from 'react'
```

Append at the end of the file (after the `Render-count gates: block layout` describe):

```tsx
/**
 * Remount gate (identity unification, phase 1): framework keys come from the
 * stable identity id (`tokens.keyOf`), not per-object WeakMap counters — a
 * suffix-shifted token (NEW object after an edit before it, INHERITED id)
 * must keep its key, so React reconciles it in place instead of
 * unmount+remount (which silently drops component-local state and DOM focus).
 * The spy records each Mark MOUNT (empty-deps effect), keyed by value, so
 * transient renders cannot skew it — only real unmount/remount cycles count.
 */
describe('Remount gates: identity keys', () => {
	it('a structural edit before a mark does not remount the suffix marks', async () => {
		const mounts: string[] = []
		const Mark = ({value}: MarkProps) => {
			useEffect(() => {
				mounts.push(String(value))
			}, [])
			return <mark>{value}</mark>
		}
		const Span = ({value}: MarkProps) => <span>{value}</span>

		await render(<MarkedInput Mark={Mark} Span={Span} defaultValue="Hello @[a](1) and @[b](2)!" />)
		await expect.element(page.getByText('b')).toBeInTheDocument()
		expect(mounts.filter(v => v === 'a')).toHaveLength(1)
		expect(mounts.filter(v => v === 'b')).toHaveLength(1)

		// Structural edit BEFORE both marks: completing a markup inserts a new
		// mark token at the caret; @[a] and @[b] suffix-shift — NEW token
		// objects carrying INHERITED ids.
		await focusAtEnd(getElement(page.getByText('Hello')))
		await userEvent.keyboard('@[[new](3)')
		await expect.element(page.getByText('new')).toBeInTheDocument()

		// Gate: the shifted marks keep their framework keys — only the inserted
		// mark mounts. (Pre-fix: the object-keyed KeyGenerator handed the
		// shifted marks brand-new keys, so React unmounted and remounted them.)
		expect(mounts.filter(v => v === 'new')).toHaveLength(1)
		expect(mounts.filter(v => v === 'a')).toHaveLength(1)
		expect(mounts.filter(v => v === 'b')).toHaveLength(1)
	})
})
```

- [ ] **Step 2: Run it — verify it fails for the right reason**

Run: `pnpm -F storybook test -- renderCount.react`
Expected: the NEW test FAILS on the post-edit `'a'`/`'b'` filters (length 2 — the shifted marks remounted under the object-keyed KeyGenerator); the pre-existing tests still pass. If it fails BEFORE the keyboard step (initial mounts, focus), STOP and report — the harness assumption is wrong, not the gate.

- [ ] **Step 3: Commit the red gate**

```bash
git add packages/storybook/src/pages/renderCount.react.spec.tsx
git commit -m "test(storybook): failing gate — a structural edit before a mark must not remount it (react)"
```

---

### Task 4: React adapter off KeyGenerator — green

**Files:**
- Modify: `packages/react/markput/src/components/Container.tsx:9-16, 39-40`
- Modify: `packages/react/markput/src/components/Token.tsx:15-19, 26`

- [ ] **Step 1: Switch Container.tsx to keyOf**

In the `useMarkput` selector, replace the line `key: s.key,` with:

```tsx
		keyOf: s.tokens.keyOf,
```

change the destructuring from `const {host, isBlock, tokens, key, Component, props} = …` to `const {host, isBlock, tokens, keyOf, Component, props} = …`, and replace both map lines:

```tsx
				? tokens.map((t, i) => <Block key={keyOf(t)} token={t} blockIndex={i} />)
				: tokens.map((t, i) => <Token key={keyOf(t)} token={t} path={[i]} />)}
```

- [ ] **Step 2: Switch Token.tsx to keyOf**

Same shape: in the selector replace `key: s.key,` with `keyOf: s.tokens.keyOf,`, the destructuring `const {resolveMarkSlot, key, store} = …` with `const {resolveMarkSlot, keyOf, store} = …`, and the child line with:

```tsx
					<Token key={keyOf(child)} token={child} path={[...path, i]} />
```

(Leave `OverlayRenderer.tsx` alone — it keys the overlay by OPTION object, the KeyGenerator's surviving job.)

- [ ] **Step 3: Run the gate and the full react project to verify green**

Run: `pnpm -F storybook test -- renderCount.react`
Expected: ALL tests pass, including Task 3's gate.
Run: `pnpm -F storybook test:react`
Expected: full pass (220 — the pre-phase-1 219 + Task 3's gate).

- [ ] **Step 4: Commit**

```bash
git add packages/react/markput/src/components/Container.tsx packages/react/markput/src/components/Token.tsx
git commit -m "feat(react): key tokens by stable identity id — suffix shifts no longer remount"
```

---

### Task 5: Vue remount gate — red

**Files:**
- Modify: `packages/storybook/src/pages/renderCount.vue.spec.ts` (append a top-level describe; extend imports)

- [ ] **Step 1: Write the failing gate**

Extend the vue import to `import {defineComponent, h, onMounted} from 'vue'` and add `import {getElement} from '../shared/lib/dom'` alongside the other shared-lib imports. Append at the end of the file:

```ts
/**
 * Vue mirror of the react remount gate (renderCount.react.spec.tsx — see its
 * comment for the identity-key mechanics). The mount spy is onMounted, keyed
 * by value: only real unmount/remount cycles count.
 */
describe('Remount gates: identity keys', () => {
	it('a structural edit before a mark does not remount the suffix marks', async () => {
		const mounts: string[] = []
		const Mark = defineComponent({
			props: {value: String},
			setup(props) {
				onMounted(() => {
					mounts.push(props.value ?? '')
				})
				return () => h('mark', {}, props.value)
			},
		})
		const Span = defineComponent({
			props: {value: String},
			setup(props) {
				return () => h('span', {}, props.value)
			},
		})
		const Fixture = defineComponent({
			setup() {
				return () => h(MarkedInput, {Mark, Span, defaultValue: 'Hello @[a](1) and @[b](2)!'})
			},
		})

		await render(Fixture)
		await expect.element(page.getByText('b')).toBeInTheDocument()
		expect(mounts.filter(v => v === 'a')).toHaveLength(1)
		expect(mounts.filter(v => v === 'b')).toHaveLength(1)

		// Structural edit BEFORE both marks — @[a] and @[b] suffix-shift into
		// NEW token objects carrying INHERITED ids.
		await focusAtEnd(getElement(page.getByText('Hello')))
		await userEvent.keyboard('@[[new](3)')
		await expect.element(page.getByText('new')).toBeInTheDocument()

		// Gate: only the inserted mark mounts — the shifted marks keep their keys.
		expect(mounts.filter(v => v === 'new')).toHaveLength(1)
		expect(mounts.filter(v => v === 'a')).toHaveLength(1)
		expect(mounts.filter(v => v === 'b')).toHaveLength(1)
	})
})
```

- [ ] **Step 2: Run it — verify it fails for the right reason**

Run: `pnpm -F storybook test -- renderCount.vue`
Expected: the NEW test FAILS on the post-edit `'a'`/`'b'` filters (length 2); pre-existing tests pass. Failures before the keyboard step mean a broken harness assumption — STOP and report.

- [ ] **Step 3: Commit the red gate**

```bash
git add packages/storybook/src/pages/renderCount.vue.spec.ts
git commit -m "test(storybook): failing gate — a structural edit before a mark must not remount it (vue)"
```

---

### Task 6: Vue adapter off KeyGenerator — green

**Files:**
- Modify: `packages/vue/markput/src/components/Container.vue:10-14, 34, 42`
- Modify: `packages/vue/markput/src/components/Token.vue:29, 40`

- [ ] **Step 1: Switch Container.vue to keyOf**

In the `useMarkput` selector, replace `key: s.key,` with:

```ts
	keyOf: s.tokens.keyOf,
```

and in the template replace BOTH `:key="result.key.get(token)"` (the Block loop and the Token loop) with:

```
				:key="result.keyOf(token)"
```

- [ ] **Step 2: Switch Token.vue to keyOf**

Replace `const key = store.key` with:

```ts
		const keyOf = store.tokens.keyOf
```

and the child render line with:

```ts
									h(markRaw(Token), {key: keyOf(child), token: child, path: [...props.path, i]})
```

(Leave `OverlayRenderer.vue` alone — option keying.)

- [ ] **Step 3: Run the gate and the full vue project to verify green**

Run: `pnpm -F storybook test -- renderCount.vue`
Expected: ALL tests pass, including Task 5's gate.
Run: `pnpm -F storybook test:vue`
Expected: full pass (202 — the pre-phase-1 201 + Task 5's gate).

- [ ] **Step 4: Commit**

```bash
git add packages/vue/markput/src/components/Container.vue packages/vue/markput/src/components/Token.vue
git commit -m "feat(vue): key tokens by stable identity id — suffix shifts no longer remount"
```

---

### Task 7: BlockController per-row stores re-keyed by id

**Files:**
- Modify: `packages/core/src/features/block/BlockController.ts`
- Modify: `packages/core/src/features/block/BlockController.spec.ts` (append a describe; add a `Token` type import)

- [ ] **Step 1: Write the failing tests**

In `BlockController.spec.ts`, add `import type {Token} from '../tokens'` after the Store import, then append at the end of the file, INSIDE the top-level `describe('BlockController')` (after the `skips writes when reorder is a no-op` test):

```ts
	describe('per-row stores (identity-keyed)', () => {
		it('keys stores by stable token id — a suffix-shifted row keeps its store', () => {
			// Fabricated same-id pair: exactly the suffix-shift shape (new object,
			// inherited id) whose drag/hover state the old object-keyed WeakMap
			// silently reset.
			const before: Token = {type: 'text', content: 'a', position: {start: 0, end: 1}, id: 101}
			const shifted: Token = {type: 'text', content: 'a', position: {start: 1, end: 2}, id: 101}
			const other: Token = {type: 'text', content: 'b', position: {start: 2, end: 3}, id: 102}

			expect(store.block.get(shifted)).toBe(store.block.get(before))
			expect(store.block.get(other)).not.toBe(store.block.get(before))
		})

		it('prunes the store of a structurally removed token after the removal commit', () => {
			// Mounted fixture (the MarkController.spec pattern): text 'he' [0,2],
			// mark '@[x]' [2,6], text 'llo' [6,9], bound on rendered().
			store.props.set({defaultValue: 'he@[x]llo', options: [{markup: '@[__value__]'}], Mark: () => null})
			const container = document.createElement('div')
			const text1 = document.createElement('span')
			const markEl = document.createElement('span')
			markEl.append(document.createTextNode('x'))
			const text2 = document.createElement('span')
			container.append(text1, markEl, text2)
			document.body.append(container)
			store.host.container(container)
			store.host.rendered()
			const token = store.tokens.tree().find(t => t.type === 'mark')
			if (!token) throw new Error('expected parsed mark token')
			const blockStore = store.block.get(token)

			// Remove the mark structurally and bind the new tree — the changed
			// event fires after the bind; its removed ids drive the prune.
			store.edit.replace({start: 2, end: 6}, '')
			container.replaceChildren(document.createElement('span'))
			store.host.rendered()

			// Same captured token object, same id — but the identity is gone, so
			// a FRESH store comes back: removed rows leak no per-row UI state.
			expect(store.block.get(token)).not.toBe(blockStore)
			document.body.replaceChildren()
		})
	})
```

- [ ] **Step 2: Run to verify they fail**

Run: `pnpm -F core test -- BlockController`
Expected: both new tests FAIL — the same-id pair gets two different stores, and the removed token's store survives (object-keyed WeakMap, no pruning). A typecheck complaint about `get(token: object)` vs the fabricated `Token` literals is the same red. Pre-existing tests pass.

- [ ] **Step 3: Re-key the stores**

In `BlockController.ts`, change the tokens import from `import type {TokenModel} from '../tokens'` to:

```ts
import type {Token, TokenModel} from '../tokens'
```

Replace the `#stores` declaration with:

```ts
	/**
	 * Per-row UI-state stores keyed by stable token id: a row suffix-shifted by
	 * an edit above it is a NEW object with an INHERITED id, so object keying
	 * (the old WeakMap) silently reset its drag/hover state. A number-keyed Map
	 * cannot self-collect — removed ids are pruned on the changed event below.
	 */
	readonly #stores = new Map<number, BlockStore>()
```

At the end of the constructor (after the existing `watch(this.action, …)` block), add:

```ts
		watch(this.tokens.changed, changeset => {
			if (changeset.kind !== 'delta') return
			for (const id of changeset.removed) this.#stores.delete(id)
		})
```

Replace `get` with:

```ts
	/** Returns the per-row UI-state store for a token (keyed by its stable identity id), creating it on first access. */
	get(token: Token): BlockStore {
		const id = this.tokens.keyOf(token)
		let store = this.#stores.get(id)
		if (!store) {
			store = new BlockStore()
			this.#stores.set(id, store)
		}
		return store
	}
```

- [ ] **Step 4: Run to verify green**

Run: `pnpm -F core test -- BlockController`
Expected: all pass, including both new tests.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/features/block/BlockController.ts packages/core/src/features/block/BlockController.spec.ts
git commit -m "feat(block): per-row stores keyed by identity id — suffix-shifted rows keep drag state"
```

---

### Task 8: Full verification

- [ ] **Step 1: All suites + guards**

Run, expecting full pass on each (do NOT use `pnpm -F react test` / `pnpm -F vue test` — silent no-ops, see Tech Stack):

```bash
pnpm -F core test            # 731 passed, 1 todo (pre-phase-1 726 + 5 new)
pnpm -F storybook test       # react 220 + vue 202, incl. both remount gates
pnpm run typecheck           # recursive tsc --noEmit
pnpm run check:encapsulation
```

- [ ] **Step 2: Confirm clean and report**

`git status` must be clean (everything committed task-by-task). Report the suite numbers.

---

### Task 9: Write the Phase 2 plan (phase chaining)

- [ ] **Step 1: Invoke the superpowers:writing-plans skill** to produce `docs/superpowers/plans/2026-06-13-one-fresh-truth-phase2.md` for **Phase 2 — reconcile-side routing** from the spec: reconcile emits `{structural, changes: [{id, token, path}], removedIds}` (paths threaded through `tryDescend`; the property spec extended with path-correctness properties), delete `collectChanged` and the runtime escalation type-walk, public `changed` becomes `Event<void>`, the commit-time fold guard stays, render gates untouched. Ground the plan by reading `tokenIdentity.ts`, `commit.ts`, `bind.ts`, and `tokenIdentity.property.spec.ts` first — no placeholder steps. Verification commands must follow this plan's Tech Stack note (`pnpm -F storybook test`, never `pnpm -F react test`).

- [ ] **Step 2: Commit the plan**

```bash
git add docs/superpowers/plans/2026-06-13-one-fresh-truth-phase2.md
git commit -m "docs(plan): one-fresh-truth phase 2 — reconcile-side routing"
```