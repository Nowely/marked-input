import {event, untracked} from '../../../shared/signals/index.js'
import type {Event} from '../../../shared/signals/index.js'
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
	 * Called by {@link apply} on every commit, and by nothing else — "when does bind run" is a
	 * call in one function rather than a dependency graph, a scheduler or a latch. A mount needs
	 * no separate call: it arrives through the model's props watch, which commits.
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
	 * THE DOM CLOCK: one pulse per bind, so every handle in the node layer matches an element that
	 * is actually in the document. Only the caret needs this — a caret landing in a node BORN by
	 * the commit has no handle until bind makes one, so nothing earlier can place it.
	 */
	bound: Event<void>
	byElement(element: HTMLElement): TokenHandle | undefined
}

export function createCommitPipeline(deps: CommitDeps): CommitPipeline {
	const committed = event<void>()
	const bound = event<void>()

	// Element-keyed lookups over the bound nodes. LONG-LIVED and mutated in place, not replaced
	// per walk: a single-id rebind touches one token and must leave every other element answering,
	// which a fresh map per bind cannot do. Both paths delete what they stop binding. The id-keyed
	// side is `deps.nodes`, which bind mutates in place, so there is nothing here to mirror it with.
	const byElement = new WeakMap<HTMLElement, TokenHandle>()
	// The last walk's tree, by id, so `rebind` finds its node without searching. Empty until the
	// first bind, which is why a registration arriving before one is a no-op rather than a guess.
	let nodeById = new Map<number, TreeNode>()
	let committing = false

	function apply(): void {
		if (committing) throw new Error('TokenModel commit re-entry')
		// BIND FIRST, ANNOUNCE SECOND, and the order is load-bearing: every `committed`
		// subscriber must see a DOM that already matches the tree, and every per-surface effect
		// must be re-armed before anything reads a surface. It used to be encoded in the POSITION
		// of a counter write — the bind effect flushed synchronously on that line — which made a
		// line move a behaviour change. A call says it instead.
		//
		// No routing: every commit announces, and every commit binds, including the ones that
		// move no element. `bindNow` is a whole-tree walk, measured at ~1.85 ms on a 2000-token
		// document, and it is what makes {@link bound} a clock every commit reaches.
		bindNow()
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
				roots: deps.roots(),
				nodes: deps.nodes,
				byElement,
				source: deps.source,
			})
			nodeById = result.nodeById
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
			// `untracked` for the reason `bind` documents at its own entry, and it is load-bearing
			// HERE for a second one: `rebindNode` ARMS the per-surface effect, and an effect links
			// itself to whatever scope is active when it is created. A ref firing inside a caller's
			// tracking scope would otherwise make the writer that scope's child, and the scope's
			// next run would dispose it — leaving a surface bound with nothing left to write it.
			untracked(() => rebindNode(node, {nodes: deps.nodes, byElement, source: deps.source}))
		} finally {
			committing = false
		}
		bound()
	}

	return {
		apply,
		bindNow,
		rebind,
		committed,
		bound,
		byElement: element => byElement.get(element),
	}
}