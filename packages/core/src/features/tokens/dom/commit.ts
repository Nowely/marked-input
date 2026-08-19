import {event, signal, untracked, watch} from '../../../shared/signals/index.js'
import type {Computed, Event} from '../../../shared/signals/index.js'
import type {TreeNode} from '../tree/types'
import {bind, rebindNode} from './bind'
import type {ElementSource} from './bind'
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
	/**
	 * THE element source: what the adapters consigned, asked one id at a time. This replaced the
	 * DOM walk's `isBlock` and its frame alignment — an element is registered under an id or it is
	 * not, and a mismatch is no longer representable.
	 */
	source: ElementSource
}

export type CommitPipeline = {
	/**
	 * THE entry: a commit happened. It takes NOTHING, and the emptiness is the point — the
	 * `CommitInput` that once carried a snapshot went at S2.8, the delta went with the ledger,
	 * and the `render` bit went when the routing did. What is left of "what changed" lives in the
	 * tree, which every reader here already has.
	 */
	apply(): void
	/**
	 * Project the registries onto the node layer and pulse {@link bound}.
	 *
	 * Called by the model's bind EFFECT, which is subscribed to the live roots and to the
	 * consignment registries — so "when does bind run" is answered by the dependency graph rather
	 * than by a scheduler, a latch or a round trip through the renderer.
	 */
	bindNow(): void
	/**
	 * Bind ONE id, because its element just arrived, changed or went away.
	 *
	 * The registration path, and the reason mount is linear: an adapter's ref carries an element
	 * that belongs to exactly one token, so it costs that token's share of a bind rather than a
	 * whole-tree walk. A ref for an id the last walk did not see is a no-op — the next commit's
	 * walk owns it.
	 */
	rebind(id: number): void
	/**
	 * THE MODEL CLOCK: one pulse per commit, once the tree, the projection and the repaired
	 * selection are all in place. Fires for EVERY commit, including the ones that move no element
	 * at all — a row reorder and a mark value change both leave the id space and the element set
	 * untouched, and they are exactly the commits a DOM clock cannot see.
	 */
	committed: Event<void>
	/**
	 * Bumped once per commit. The bind effect reads it, which is what makes EVERY commit bind —
	 * including the ones that move no element, where nothing else the effect subscribes to has
	 * changed. Measured at ~1.85 ms on a 2000-token document, comfortably inside a frame, and it
	 * buys two things: {@link bound} becomes the one DOM clock every commit reaches, and the
	 * divergence sweep needs no second subscription to cover the text path.
	 */
	commits: Computed<number>
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
	const committed = event<void>()
	let commitCount = 0
	const commits = signal({initial: commitCount})
	const bound = event<void>()

	// Element-keyed lookups over the bound nodes. LONG-LIVED and mutated in place, not replaced
	// per walk: a single-id rebind touches one token and must leave every other element answering,
	// which a fresh map per bind cannot do. Both paths delete what they stop binding. The id-keyed
	// side is `deps.nodes`, which bind mutates in place, so there is nothing here to mirror it with.
	const byElement = new WeakMap<HTMLElement, TokenHandle>()
	let controlRoots = new WeakSet<HTMLElement>()
	// The last walk's tree, by id, so `rebind` finds its node without searching. Empty until the
	// first bind, which is why a registration arriving before one is a no-op rather than a guess.
	let nodeById = new Map<number, TreeNode>()
	/**
	 * The commit the last whole-tree bind ran for, and THE precondition of the divergence sweep
	 * below: a commit that did not bind healed nothing, so it has no right to an opinion about
	 * what a surface shows. It replaces the `pendingStructural` guard the sweep used to read.
	 *
	 * Two commits reach `apply` without binding, and both were measured throwing before this
	 * existed: one made while the container is detached (`bindNow` returns at its own guard), and
	 * the FIRST commit of every attach (the props watch's immediate arm commits from inside
	 * `host.onMounted`, one statement before the bind effect is installed). On a RE-attach the
	 * previous generation's handles are still bound, so the second one swept last generation's
	 * surfaces — and its throw unwound out of `onMounted` before the effect scope was assigned,
	 * leaving the editor permanently unbound in dev.
	 */
	let boundForCommit = -1

	let committing = false

	function apply(): void {
		if (committing) throw new Error('TokenModel commit re-entry')
		// No routing left. The producer's `render` bit is not consulted here at all: every commit
		// announces, and every commit binds.
		//
		// The counter is written BEFORE the guard closes, and that is not a detail. An unbatched
		// commit flushes the bind effect on this very line, synchronously — so writing it inside
		// the guard made the commit's own bind read as re-entry and throw. It also fixes the
		// order the divergence sweep depends on: the bind, and with it every per-surface re-arm,
		// lands before `committed` reaches a single subscriber.
		commits(++commitCount)
		committing = true
		try {
			committed()
		} finally {
			committing = false
		}
	}

	function bindNow(): void {
		const container = deps.container()
		// No container: nothing to bind. The effect re-runs when one arrives.
		if (!container) return
		if (committing) throw new Error('TokenModel commit re-entry')
		committing = true
		try {
			const result = bind({
				container,
				roots: deps.roots(),
				nodes: deps.nodes,
				byElement,
				source: deps.source,
				controlElements: deps.controlElements(),
			})
			controlRoots = result.controlRoots
			nodeById = result.nodeById
			boundForCommit = commitCount
			bound()
		} finally {
			committing = false
		}
	}

	function rebind(id: number): void {
		// Before the first walk, or for an id it did not see: the registration stays in the
		// registry and the next walk reads it. Guessing a node here is what `find(id)` would do,
		// and that walk per ref is the cost this path exists to avoid.
		const node = nodeById.get(id)
		if (!node || !deps.container()) return
		if (committing) throw new Error('TokenModel commit re-entry')
		committing = true
		try {
			rebindNode(node, {nodes: deps.nodes, byElement, source: deps.source})
		} finally {
			committing = false
		}
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
		// See {@link boundForCommit}: no bind for this commit means no re-arm, and the re-arm IS
		// the heal this check assumes has already happened.
		if (boundForCommit !== commitCount) return
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
	// THE COMMIT CLOCK, and the ordering that makes it safe is a property of the dependency graph
	// rather than of a flag. A structural commit writes `tree.roots` inside adoption's own batch,
	// BEFORE `apply` fires `committed` — so at the flush the bind effect is queued ahead of this
	// watch, and by the time the sweep runs `bind` has already disposed and re-armed every
	// per-surface effect, whose first run IS the heal. The text path never binds off its own
	// writes, so it must be swept at commit time or never — and every commit reaches this watch.
	//
	// NOT the DOM clock, and that is a cost decision as much as a correctness one: `bound` pulses
	// once per REGISTRATION now, so a sweep hanging off it would walk the whole tree per ref and
	// put back, in dev and in every test, exactly the quadratic mount that `rebind` removes.
	untracked(() => watch(committed, assertAligned))

	return {
		apply,
		bindNow,
		rebind,
		committed,
		bound,
		commits,
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