import {batch, event, signal, untracked} from '../../../shared/signals/index.js'
import type {Computed, Event} from '../../../shared/signals/index.js'
import type {Token} from '../parser/types'
import type {CommitChange, CommitInput, TokenDelta} from '../seam/commitInput'
import type {TreeNode} from '../tree/types'
import {bind} from './bind'
import type {TokenHandle} from './TokenHandle'

/**
 * The one commit pipeline: every reconciled value change flows through a
 * single `apply` with two branches — in-place text updates that bypass the
 * renderer, and structural passes that publish a new tree and bind the DOM
 * the renderer paints. `changed` fires in both branches only after the DOM
 * is consistent with the node layer.
 */
export type CommitDeps = {
	/** Adapter container; null until mounted. */
	container: () => HTMLElement | null
	/** THE live node layer, keyed by node id — owned by the model shell, mutated through this pipeline. */
	nodes: Map<number, TokenHandle>
	/**
	 * THE tree bind projects onto the node layer, read at bind time. Deliberately the
	 * LIVE roots and not an input field: `renderTree` keeps its (stale) reference across
	 * text commits, and a re-render arriving after one (any unrelated adapter update)
	 * must re-bind the current tree, not regress the node layer to the painted
	 * generation.
	 */
	roots: () => readonly TreeNode[]
	/** Mount-time editable state for newly bound surfaces and mark roots. */
	editableState: () => {editable: boolean; readOnly: boolean}
	controlElements: () => ReadonlySet<HTMLElement>
	childSequenceHostsFor: (ownerId: number) => readonly HTMLElement[]
	isBlock: () => boolean
}

export type CommitPipeline = {
	/** THE entry — routes one commit input through the text or structural branch. */
	apply(input: CommitInput): void
	/** Adapter signal: the renderer painted — bind the DOM and complete a pending structural apply. */
	onRendered(): void
	/** Structural tree; reference changes ⇔ the renderer must run. */
	renderTree: Computed<Token[]>
	/** THE consumer read: the latest reconciled tree — always fresh, consistent with value.current() (it is `latest`, reassigned at the top of every apply). Never latch-gated. */
	current(): readonly Token[]
	/**
	 * THE model-level detector: fires once per commit, only after the DOM is
	 * consistent (both branches), carrying what that commit did to the id space
	 * (spec §2.3). Every apply folded into one pending structural pass is MERGED
	 * into the single announcement.
	 */
	changed: Event<TokenDelta>
	/** pendingStructural latch: true between a structural apply and its bind — id-bridged resolution fails closed. */
	pending(): boolean
	bound(): ReadonlyMap<number, TokenHandle>
	byElement(element: HTMLElement): TokenHandle | undefined
	isControlRoot(element: HTMLElement): boolean
}

// Guards the divergence detector: true under Vitest + dev builds, stripped to false in production bundles; ?? true keeps it live on unknown runtimes.
// oxlint-disable-next-line typescript/no-unnecessary-condition -- intentional runtime guard; value depends on bundler
const VERIFY_DOM: boolean = import.meta.env?.DEV ?? true

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
	// `renderTree` is a plain signal written ONLY by the structural branch —
	// reference stability on the text path is direct control flow. A computed
	// would have to derive the kept reference from the latest reconcile result,
	// reviving the old memo-mutation-inside-a-computed pattern this pipeline deletes.
	const renderTree = signal<Token[]>({initial: []})
	const changed = event<TokenDelta>()

	// Derived lookups over the bound nodes — replaced wholesale by bind on the
	// structural branch, untouched on the text branch (no node is added or removed
	// there by definition, so the same ids stay bound to the same elements).
	let bound: ReadonlyMap<number, TokenHandle> = new Map()
	let byElement = new WeakMap<HTMLElement, TokenHandle>()
	let controlRoots = new WeakSet<HTMLElement>()

	// The latest snapshot — what `current()` serves. NOT what bind projects: that is
	// `deps.roots()`, the live tree.
	let latest: readonly Token[] = []

	let pendingStructural = false
	// Accumulates across the pending window and is drained by whichever branch
	// announces. It is empty whenever pendingStructural is false — the drain is
	// what makes that true — so the old `pendingStructural ? … : []` guard on the
	// bind path is gone rather than duplicated.
	const pendingDelta: DeltaAccumulator = {added: new Set(), removed: new Set(), updated: new Set()}
	let committing = false

	function apply(input: CommitInput): void {
		if (committing) throw new Error('TokenModel commit re-entry')
		committing = true
		try {
			const {tokens, render, changes, delta} = input
			latest = tokens
			// Routing decided by the producer (spec D9's `render` bit). The one
			// commit-side override is the fold guard: while a structural apply
			// awaits its bind the node layer is one generation stale, so EVERY
			// apply folds into the pending structural pass (fail-closed — no
			// half-patch against a tree the DOM never showed).
			if (!pendingStructural && !render) {
				if (commitText(changes, delta)) return
				commitStructural(tokens, delta, true)
				return
			}
			commitStructural(tokens, delta, false)
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

	/**
	 * Text branch: the adapter never re-renders (tree keeps its reference), so
	 * bound elements stay live. The PRODUCER resolved every change to (id, token)
	 * and decided routing — `input.render` was false, so no node was added or
	 * removed anywhere (spec D9). Two passes: resolve every change to a live
	 * surface PURELY first; ANY miss abandons the branch before a single mutation
	 * and the caller escalates structurally.
	 */
	function commitText(changes: readonly CommitChange[], delta: TokenDelta): boolean {
		const updates: {surface: HTMLElement; content: string}[] = []
		for (const change of changes) {
			// Entries without `patch` carry no surface write: they existed to refresh a
			// handle's token, and a handle holds none since S2.7.
			if (!change.patch) continue
			const handle = deps.nodes.get(change.id)
			if (!handle) return false
			const surface = handle.node()?.textElement
			if (!surface) return false
			updates.push({surface, content: change.token.content})
		}

		batch(() => {
			for (const {surface, content} of updates) {
				if (surface.textContent !== content) surface.textContent = content
			}
		})
		if (VERIFY_DOM) assertAligned()
		foldDelta(pendingDelta, delta)
		changed(drainDelta(pendingDelta))
		return true
	}

	/**
	 * Structural branch: publish the new tree (reference change ⇔ the renderer
	 * must run) and latch until the freshly painted DOM is bound. `selfHeal`
	 * (the text branch escalating) also binds the CURRENT DOM right away — its structure is nominally
	 * unchanged on that path, so the node layer recovers without waiting for the
	 * adapter, whose later onRendered() just re-binds idempotently.
	 */
	function commitStructural(tokens: Token[], delta: TokenDelta, selfHeal: boolean): void {
		foldDelta(pendingDelta, delta)
		pendingStructural = true
		renderTree(tokens)
		if (!selfHeal) return
		const container = deps.container()
		if (container) bindAndAnnounce(container)
	}

	/** Shared endpoint of onRendered and escalation: one DOM+tree walk onto the node layer, then announce. */
	function bindAndAnnounce(container: HTMLElement): void {
		const result = bind({
			container,
			roots: deps.roots(),
			nodes: deps.nodes,
			controlElements: deps.controlElements(),
			childSequenceHostsFor: deps.childSequenceHostsFor,
			isBlock: deps.isBlock(),
			editable: deps.editableState(),
		})
		bound = result.bound
		byElement = result.byElement
		controlRoots = result.controlRoots
		// A re-bind with no pending structural change drains an empty accumulator.
		const delta = drainDelta(pendingDelta)
		pendingStructural = false
		if (VERIFY_DOM) assertAligned()
		changed(delta)
	}

	/**
	 * Divergence detector — last step of both branches. White-box rationale kept
	 * from the old patch spec, now stated against the ONE representation: each branch
	 * heals its own writes first (bind sweeps every bound surface, the text branch its
	 * targets), so a throw here means the healing itself missed a write — the bug class
	 * it guards. The expectation is read from the LIVE `TextNode.text()`, which is what
	 * lets the handle stop carrying a `Token` of its own.
	 */
	function assertAligned(): void {
		untracked(() => {
			walkTree(deps.roots(), node => {
				if (node.kind !== 'text') return
				const surface = bound.get(node.id)?.node()?.textElement
				if (!surface) return
				const expected = node.text()
				const actual = surface.textContent
				if (actual === expected) return
				throw new Error(`TokenModel divergence at #${node.id}: DOM "${actual}" ≠ model "${expected}"`)
			})
		})
	}

	return {
		apply,
		onRendered,
		renderTree,
		current: () => latest,
		changed,
		pending: () => pendingStructural,
		bound: () => bound,
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