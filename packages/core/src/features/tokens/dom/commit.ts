import {event, signal, untracked, watch} from '../../../shared/signals/index.js'
import type {Computed, Event} from '../../../shared/signals/index.js'
import type {TransactionResult, TreeNode} from '../tree/types'
import {bind} from './bind'
import type {TokenHandle} from './TokenHandle'

/**
 * The one commit pipeline: every reconciled value change flows through a single
 * `apply`. Since S2.7 it has ONE branch and one question — does the renderer need
 * to run? Text no longer travels through here at all: `bind` arms a per-surface
 * effect on each bound text node, so a text-only commit reaches the DOM off the
 * node's own signal and `apply` is left with the announcement.
 *
 * There are TWO clocks now, because one event was serving two different questions.
 * `committed` is the model's — one pulse per commit, including the commits that
 * move no element at all, which is precisely what a DOM clock cannot see.
 * `bound` is the DOM's, and only the caret needs it. Neither carries a payload:
 * nothing in core read the old delta, and deriving one cost a module of its own.
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
	/**
	 * THE element source: what the adapters consigned for this generation, by token id. This
	 * replaced the DOM walk's `isBlock` and its frame alignment — an element is registered under
	 * an id or it is not, and a mismatch is no longer representable.
	 */
	consignedElements: (kind: 'token' | 'row') => ReadonlyMap<number, HTMLElement>
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
	 * THE MODEL CLOCK: one pulse per commit, once the tree, the projection and the repaired
	 * selection are all in place. Fires for EVERY commit, including the ones that move no element
	 * at all — a row reorder and a mark value change both leave the id space and the element set
	 * untouched, and they are exactly the commits a DOM clock cannot see.
	 */
	committed: Event<void>
	/**
	 * THE DOM CLOCK: one pulse per bind, so every handle in the node layer matches an element that
	 * is actually in the document. Only the caret needs this — a caret landing in a node BORN by
	 * the commit has no handle until bind makes one, so nothing earlier can place it.
	 */
	bound: Event<void>
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

export function createCommitPipeline(deps: CommitDeps): CommitPipeline {
	// A COUNTER written ONLY when the renderer must run: "the text path repaints nothing"
	// is direct control flow, not a reference-equality accident. Monotonic, so the write
	// can never dedupe — which a re-published tree reference would, exactly on the
	// value-only commits `roots` cannot carry.
	let epoch = 0
	const renderEpoch = signal({initial: epoch})
	const committed = event<void>()
	const bound = event<void>()

	// Element-keyed lookups over the bound nodes — replaced wholesale by bind, untouched by a
	// text-only commit (no node is added or removed there by definition, so the same ids
	// stay bound to the same elements). The id-keyed side is `deps.nodes`, which bind
	// mutates in place, so there is nothing here to mirror it with.
	let byElement = new WeakMap<HTMLElement, TokenHandle>()
	let controlRoots = new WeakSet<HTMLElement>()

	// COMMIT ROUTING, not a read: while a structural apply awaits its bind every later apply
	// folds into it and announces with it. It stopped being observable at ADR-0008, which
	// removed the `pending()` accessor and with it the id-bridge refusal it fed — a node BORN
	// by the commit has no handle until `bind` makes one, and that absence was always the
	// refusal that mattered.
	let pendingStructural = false
	let committing = false

	function apply(result: TransactionResult): void {
		if (committing) throw new Error('TokenModel commit re-entry')
		committing = true
		try {
			// The renderer still has to run for a commit the producer marked (spec D9's `render`
			// bit), and the latch still folds a later apply into an outstanding one. What is gone
			// is the ROUTING: both arms announce now, because the announcement is a commit fact
			// and not a DOM fact.
			if (result.render || pendingStructural) {
				pendingStructural = true
				renderEpoch(++epoch)
			}
			committed()
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
			consigned: deps.consignedElements('token'),
			rows: deps.consignedElements('row'),
		})
		byElement = result.byElement
		controlRoots = result.controlRoots
		pendingStructural = false
		bound()
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

	// A `committed` SUBSCRIBER, not an inline call at the end of `apply` — MEASURED, and
	// the one thing about this phase that a reading of the code alone gets wrong.
	// `EditController.replace` wraps the whole write in `batch`, so the per-surface
	// effects adoption queued do NOT flush until that outer batch closes, well after
	// `apply` returned (probe: every `store.edit.replace` fixture threw a false
	// divergence with the check inline). Event subscribers are queued BEHIND those
	// effects, so a watcher here runs once every writer has finished — in the batched
	// case and in the unbatched one alike, where adoption's own batch already flushed.
	// Registered before any consumer's watch, which keeps the old ordering:
	// the check runs first, and a divergence fails the commit rather than leaking into
	// a caret re-place.
	// BOTH clocks, and the guard between them is the whole subtlety. The sweep asks a DOM
	// question, so on a commit awaiting its bind it must wait too: `bind` disposes and re-arms
	// every per-surface effect, and that re-arm's first run is what heals a surface corrupted
	// between binds. Sweeping at commit time on that path reports the corruption instead of
	// letting the heal happen — measured, it turned the structural self-heal case into a throw.
	//
	// The text path has no bind at all, so it must be swept at commit time or never — which is
	// exactly the path the per-surface writer lives on and the one this sweep exists for.
	//
	// WHEN THE LATCH GOES, THIS NEEDS REVISITING: `pendingStructural` is what "a bind is still
	// coming" is spelled as today.
	untracked(() =>
		watch(committed, () => {
			if (!pendingStructural) assertAligned()
		})
	)
	untracked(() => watch(bound, assertAligned))

	return {
		apply,
		onRendered,
		renderEpoch,
		committed,
		bound,
		byElement: element => byElement.get(element),
		isControlRoot: element => controlRoots.has(element),
	}
}

function walkTree(nodes: readonly TreeNode[], visit: (node: TreeNode) => void): void {
	for (const node of nodes) {
		visit(node)
		if (node.kind === 'mark') walkTree(node.children(), visit)
	}
}