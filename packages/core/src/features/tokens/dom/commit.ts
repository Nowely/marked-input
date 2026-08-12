import {event, signal, untracked, watch} from '../../../shared/signals/index.js'
import type {Computed, Event} from '../../../shared/signals/index.js'
import type {TransactionResult, TreeNode} from '../tree/types'
import {bind} from './bind'
import type {TokenHandle} from './TokenHandle'

/**
 * The `changed` payload (spec §2.3) — the three id lists one commit did to the id space.
 *
 * Granularity is NORMATIVE and differs per field, because `foldDelta` below merges every
 * commit inside one pending window and cancels BY EXACT ID:
 *
 * - `added` / `removed` — SUBTREE-INCLUSIVE: a born or dead mark contributes every
 *   descendant id. `TransactionResult.removed` already is (types.ts), `added` carries
 *   subtree ROOTS (a node hands you the subtree; a bare id gives a consumer nothing to
 *   walk), so {@link deltaOf} walks it. Roots-only `added` folded against subtree-inclusive
 *   `removed` would announce descendant removals for ids the consumer was never told
 *   existed.
 * - `updated` — PER NODE, no subtree claim: an id is listed iff that node's own
 *   content/props changed. Adoption's `updated` feed lowers straight through, so a mark
 *   whose PROJECTION changed while its own fields did not stays out; a consumer needing
 *   the subtree re-reads the tree.
 */
export type TokenDelta = {
	readonly added: readonly number[]
	readonly removed: readonly number[]
	readonly updated: readonly number[]
}

/**
 * The one commit pipeline: every reconciled value change flows through a single
 * `apply`. Since S2.7 it has ONE branch and one question — does the renderer need
 * to run? Text no longer travels through here at all: `bind` arms a per-surface
 * effect on each bound text node, so a text-only commit reaches the DOM off the
 * node's own signal and `apply` is left with the announcement.
 *
 * `changed` still fires only once the DOM is consistent with the node layer, but
 * that is now an ORDERING property of the effect queue rather than of this
 * function's statement order: the writers are queued ahead of every `changed`
 * subscriber, including {@link assertAligned} (see its registration below).
 */
export type CommitDeps = {
	/** Adapter container; null until mounted. */
	container: () => HTMLElement | null
	/** THE live node layer, keyed by node id — owned by the model shell, mutated through this pipeline. */
	nodes: Map<number, TokenHandle>
	/**
	 * THE tree bind projects onto the node layer, read at bind time — the LIVE roots, so a
	 * re-render arriving from anywhere (any unrelated adapter update, not just a commit)
	 * binds the current tree rather than whatever generation was last painted.
	 */
	roots: () => readonly TreeNode[]
	controlElements: () => ReadonlySet<HTMLElement>
	childSequenceHostsFor: (ownerId: number) => readonly HTMLElement[]
	isBlock: () => boolean
}

export type CommitPipeline = {
	/**
	 * THE entry — one adoption result, routed by its own `render` bit. It takes the
	 * `TransactionResult` directly since S2.8: the `CommitInput` that used to sit between
	 * them carried a snapshot nothing renders any more, and the routing bit and the delta
	 * were always adoption's answers.
	 */
	apply(result: TransactionResult): void
	/** Adapter signal: the renderer painted — bind the DOM and complete a pending structural apply. */
	onRendered(): void
	/**
	 * THE renderer wake-up: bumped once per commit the renderer must run for (spec D9's
	 * `render` bit). A COUNTER and not the tree, because the tree is no longer this layer's
	 * to publish — the adapters read `tokens.nodes()` and each token component subscribes to
	 * its own node's signals (spec D8).
	 *
	 * It is NOT redundant with `roots`, and that is measured rather than assumed: adoption
	 * writes `roots` only when the ROOT LIST changes by reference (`adopt.ts`'s
	 * `sameNodes(out, prev)` gate), so a mark whose value changed and a structural change
	 * INSIDE a slot both leave it reference-equal. A container subscribed to `roots` alone
	 * would not re-render for either, and the post-render `rendered()` that drives `bind`
	 * would never fire — leaving a freshly born in-slot node with no handle and no text.
	 */
	renderEpoch: Computed<number>
	/**
	 * THE model-level detector: fires once per commit, only after the DOM is
	 * consistent, carrying what that commit did to the id space (spec §2.3). Every
	 * apply folded into one pending structural pass is MERGED into the single
	 * announcement.
	 */
	changed: Event<TokenDelta>
	/** pendingStructural latch: true between a structural apply and its bind — id-bridged resolution fails closed. */
	pending(): boolean
	byElement(element: HTMLElement): TokenHandle | undefined
	isControlRoot(element: HTMLElement): boolean
}

// Guards the divergence detector. The published bundle ships this expression VERBATIM (prepack's
// rolldown pass overwrites Vite's substituted output), so the consumer's bundler decides the value —
// which is why it must fail CLOSED. Vite and Vitest define `import.meta.env.DEV` true in dev/test;
// every other host (webpack, Next, node, plain rollup) has no `import.meta.env`, so the chain
// short-circuits to `undefined ?? false` → false and the sweep below is dead code. The former
// `?? true` did the opposite: it shipped a throwing O(tree) sweep into consumers' production apps.
// oxlint-disable-next-line typescript/no-unnecessary-condition -- `import.meta.env` is typed non-null by vite/client but absent at runtime off Vite
const VERIFY_DOM: boolean = import.meta.env?.DEV ?? false

type DeltaAccumulator = {added: Set<number>; removed: Set<number>; updated: Set<number>}

/**
 * Compose one commit's delta into the pending window's (spec D9's fold).
 * Exact, because ids are never reused within an input instance: a node added
 * and then removed before the paint never existed for a consumer, and an
 * update to a node that then died is moot.
 */
function foldDelta(into: DeltaAccumulator, delta: TokenDelta): void {
	for (const id of delta.added) into.added.add(id)
	for (const id of delta.updated) {
		if (!into.added.has(id)) into.updated.add(id)
	}
	for (const id of delta.removed) {
		into.updated.delete(id)
		if (!into.added.delete(id)) into.removed.add(id)
	}
}

function drainDelta(into: DeltaAccumulator): TokenDelta {
	const delta: TokenDelta = {added: [...into.added], removed: [...into.removed], updated: [...into.updated]}
	into.added.clear()
	into.removed.clear()
	into.updated.clear()
	return delta
}

export function createCommitPipeline(deps: CommitDeps): CommitPipeline {
	// A COUNTER written ONLY when the renderer must run: "the text path repaints nothing"
	// is direct control flow, not a reference-equality accident. Monotonic, so the write
	// can never dedupe — which a re-published tree reference would, exactly on the
	// value-only commits `roots` cannot carry.
	let epoch = 0
	const renderEpoch = signal({initial: epoch})
	const changed = event<TokenDelta>()

	// Element-keyed lookups over the bound nodes — replaced wholesale by bind, untouched by a
	// text-only commit (no node is added or removed there by definition, so the same ids
	// stay bound to the same elements). The id-keyed side is `deps.nodes`, which bind
	// mutates in place, so there is nothing here to mirror it with.
	let byElement = new WeakMap<HTMLElement, TokenHandle>()
	let controlRoots = new WeakSet<HTMLElement>()

	let pendingStructural = false
	// Accumulates across the pending window and is drained by whichever path
	// announces. It is empty whenever pendingStructural is false — the drain is
	// what makes that true — so the old `pendingStructural ? … : []` guard on the
	// bind path is gone rather than duplicated.
	const pendingDelta: DeltaAccumulator = {added: new Set(), removed: new Set(), updated: new Set()}
	let committing = false

	function apply(result: TransactionResult): void {
		if (committing) throw new Error('TokenModel commit re-entry')
		committing = true
		try {
			foldDelta(pendingDelta, deltaOf(result))
			// Routing decided by the producer (spec D9's `render` bit). The one
			// commit-side override is the fold guard: while a structural apply awaits
			// its bind the node layer is one generation stale, so EVERY apply folds
			// into the pending structural pass and announces with it (fail-closed — no
			// consumer is told about a tree the DOM never showed).
			if (result.render || pendingStructural) {
				pendingStructural = true
				renderEpoch(++epoch)
				return
			}
			// Text-only: the per-surface effects own the DOM write, so all that is left
			// is the announcement.
			changed(drainDelta(pendingDelta))
		} finally {
			committing = false
		}
	}

	function onRendered(): void {
		if (committing) throw new Error('TokenModel commit re-entry')
		const container = deps.container()
		// No container: nothing to bind — a pending latch stays closed until a real bind.
		if (!container) return
		committing = true
		try {
			bindAndAnnounce(container)
		} finally {
			committing = false
		}
	}

	/** The renderer painted: one DOM+tree walk onto the node layer, then announce. */
	function bindAndAnnounce(container: HTMLElement): void {
		const result = bind({
			container,
			roots: deps.roots(),
			nodes: deps.nodes,
			controlElements: deps.controlElements(),
			childSequenceHostsFor: deps.childSequenceHostsFor,
			isBlock: deps.isBlock(),
		})
		byElement = result.byElement
		controlRoots = result.controlRoots
		// A re-bind with no pending structural change drains an empty accumulator.
		const delta = drainDelta(pendingDelta)
		pendingStructural = false
		changed(delta)
	}

	/**
	 * Divergence detector. White-box rationale kept from the old patch spec, now stated
	 * against the ONE representation: every bound text surface must show its node's
	 * CURRENT `text()`, because the per-surface effect wrote it and bind re-armed that
	 * effect over whatever the renderer painted. A throw here means the writer itself
	 * missed — never armed, disposed early, or outraced by a second writer — which is
	 * the bug class it guards.
	 *
	 * It sweeps the whole tree rather than only the node a commit touched, and that is
	 * the point: the S1 sweep it descends from caught 12 divergences, several of them on
	 * surfaces the commit in flight never named. A check folded into the per-surface
	 * effect could not see any of them — an effect that was never armed never runs.
	 */
	function assertAligned(): void {
		if (!VERIFY_DOM) return
		untracked(() => {
			walkTree(deps.roots(), node => {
				if (node.kind !== 'text') return
				const surface = deps.nodes.get(node.id)?.node()?.textElement
				if (!surface) return
				const expected = node.text()
				const actual = surface.textContent
				if (actual === expected) return
				throw new Error(`TokenModel divergence at #${node.id}: DOM "${actual}" ≠ model "${expected}"`)
			})
		})
	}

	// A `changed` SUBSCRIBER, not an inline call at the end of `apply` — MEASURED, and
	// the one thing about this phase that a reading of the code alone gets wrong.
	// `EditController.replace` wraps the whole write in `batch`, so the per-surface
	// effects adoption queued do NOT flush until that outer batch closes, well after
	// `apply` returned (probe: every `store.edit.replace` fixture threw a false
	// divergence with the check inline). Event subscribers are queued BEHIND those
	// effects, so a watcher here runs once every writer has finished — in the batched
	// case and in the unbatched one alike, where adoption's own batch already flushed.
	// Registered before any consumer's `changed` watch, which keeps the old ordering:
	// the check runs first, and a divergence fails the commit rather than leaking into
	// a caret re-place.
	untracked(() => watch(changed, assertAligned))

	return {
		apply,
		onRendered,
		renderEpoch,
		changed,
		pending: () => pendingStructural,
		byElement: element => byElement.get(element),
		isControlRoot: element => controlRoots.has(element),
	}
}

/**
 * One adoption result → the id-space delta it announces, at {@link TokenDelta}'s
 * granularity. `untracked` for the reason adoption documents: the walk reads node signals,
 * and a caller inside an effect must not subscribe to every node it happened to touch.
 */
function deltaOf(result: TransactionResult): TokenDelta {
	const added: number[] = []
	untracked(() => {
		for (const change of result.added) walkTree([change.node], node => added.push(node.id))
	})
	return {
		added,
		// Already flattened by adoption (types.ts).
		removed: result.removed,
		updated: result.updated.map(node => node.id),
	}
}

function walkTree(nodes: readonly TreeNode[], visit: (node: TreeNode) => void): void {
	for (const node of nodes) {
		visit(node)
		if (node.kind === 'mark') walkTree(node.children(), visit)
	}
}