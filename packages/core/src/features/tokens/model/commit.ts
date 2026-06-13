import type {TokenPath} from '../../../shared/editorContracts'
import {batch, event, signal} from '../../../shared/signals/index.js'
import type {Computed, Event} from '../../../shared/signals/index.js'
import type {Token} from '../parser/types'
import type {ReconcileResult, TokenChangeEntry} from '../tokenIdentity'
import {bind} from './bind'
import type {TokenHandle} from './LiveNode'

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
	/** THE live node layer, keyed by token id — owned by the model shell, mutated through this pipeline. */
	nodes: Map<number, TokenHandle>
	/** Read-only id lookup (the identity tracker's idFor) — the pipeline never allocates ids. */
	idFor: (token: Token) => number | undefined
	/** Mount-time editable state for newly bound surfaces and mark roots. */
	editableState: () => {editable: boolean; readOnly: boolean}
	controlElements: () => ReadonlySet<HTMLElement>
	childSequenceHostsFor: (path: TokenPath) => readonly HTMLElement[]
	isBlock: () => boolean
	/** Dev-only: ms before warning that a structural publish never got rendered(). Test seam; defaults to 2000. */
	renderedTimeoutMs?: number
}

export type CommitPipeline = {
	/** THE entry — routes one reconcile result through the text or structural branch. */
	apply(result: ReconcileResult): void
	/** Adapter signal: the renderer painted — bind the DOM and complete a pending structural apply. */
	onRendered(): void
	/** Structural tree; reference changes ⇔ the renderer must run. */
	tree: Computed<Token[]>
	/** THE consumer read: the latest reconciled tree — always fresh, consistent with value.current() (it is `latest`, reassigned at the top of every apply). Never latch-gated. */
	tokens(): readonly Token[]
	/** THE model-level detector: fires once per commit, only after the DOM is consistent (both branches). Payloadless — consumers re-read. */
	changed: Event<void>
	/** Ids removed by the LAST committed reconcile (subtree included) — the prune feed for id-keyed stores. Empty on a re-bind. */
	removedIds(): readonly number[]
	/** pendingStructural latch: true between a structural apply and its bind — id-bridged resolution fails closed. */
	pending(): boolean
	byPath(): ReadonlyMap<string, TokenHandle>
	byElement(element: HTMLElement): TokenHandle | undefined
	isControlRoot(element: HTMLElement): boolean
}

// Guards the divergence detector: true under Vitest + dev builds, stripped to false in production bundles; ?? true keeps it live on unknown runtimes.
// oxlint-disable-next-line typescript/no-unnecessary-condition -- intentional runtime guard; value depends on bundler
const VERIFY_DOM: boolean = import.meta.env?.DEV ?? true

export function createCommitPipeline(deps: CommitDeps): CommitPipeline {
	// `tree` is a plain signal written ONLY by the structural branch — reference
	// stability on the text path is direct control flow. A computed would have
	// to derive the kept reference from the latest reconcile result, reviving
	// the old memo-mutation-inside-a-computed pattern this pipeline deletes.
	const tree = signal<Token[]>({initial: []})
	const changed = event<void>()

	// Derived lookups over the bound nodes — replaced wholesale by bind on the
	// structural branch, untouched on the text branch (paths are unchanged there
	// by definition).
	let byPath: ReadonlyMap<string, TokenHandle> = new Map()
	let byElement = new WeakMap<HTMLElement, TokenHandle>()
	let controlRoots = new WeakSet<HTMLElement>()

	// The latest RECONCILED tree — what bind projects onto the node layer.
	// Deliberately not tree(): the render tree keeps its (stale) reference
	// across text applies, and a re-render arriving after one (any unrelated
	// adapter update) must re-bind the fresh tokens, not regress the node
	// layer — and the DOM text with it — to the pre-edit generation.
	let latest: Token[] = []

	let pendingStructural = false
	let pendingRemovedIds: readonly number[] = []
	// Ids removed by the change currently being committed (read by removedIds()
	// after changed fires). A re-bind with no pending change removed nothing.
	let lastRemovedIds: readonly number[] = []
	let committing = false

	// Dev-only handshake tripwire: a structural publish whose rendered() never
	// arrives leaves the editor silently stale (e.g. a shadowed container ref).
	const renderedTimeoutMs = deps.renderedTimeoutMs ?? 2000
	let renderedTimer: ReturnType<typeof setTimeout> | undefined

	function apply(result: ReconcileResult): void {
		if (committing) throw new Error('TokenModel commit re-entry')
		committing = true
		try {
			const {tokens, structural, changes, removedIds} = result
			latest = tokens
			// Routing decided at RECONCILE time (result.structural). The one
			// commit-side override is the fold guard: while a structural apply
			// awaits its bind the node layer is one generation stale, so EVERY
			// apply folds into the pending structural pass (fail-closed — no
			// half-patch against a tree the DOM never showed).
			if (!pendingStructural && !structural) {
				if (commitText(changes, removedIds)) return
				commitStructural(tokens, removedIds, true)
				return
			}
			commitStructural(tokens, removedIds, false)
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
	 * bound elements and paths stay live. Reconcile already resolved every change
	 * to (id, token, path) and decided routing — `result.structural` was false, so
	 * no entry is an `add` and the tree has no removals. Two passes: resolve every
	 * change to a live handle/surface PURELY first; ANY miss abandons the branch
	 * before a single mutation and the caller escalates structurally.
	 */
	function commitText(changes: readonly TokenChangeEntry[], removedIds: readonly number[]): boolean {
		const updates: {handle: TokenHandle; token: Token; path: TokenPath}[] = []
		const patches: {surface: HTMLElement; content: string}[] = []
		for (const change of changes) {
			const handle = deps.nodes.get(change.id)
			if (change.kind === 'update') {
				// Never bound yet (a handle materializes on the next bind) — skip,
				// not a miss: an unrendered token has no surface to patch.
				if (!handle) continue
				updates.push({handle, token: change.token, path: change.path})
				continue
			}
			// kind 'text' on the text branch is always a TEXT token (a refused-descend
			// MARK set result.structural, so we are not here). Resolve its surface.
			if (!handle) return false
			const surface = handle.node()?.textElement
			if (!surface) return false
			updates.push({handle, token: change.token, path: change.path})
			patches.push({surface, content: change.token.content})
		}

		// Commit: update the listed nodes (each bumps only its own dirty) and patch
		// the changed surfaces, in one batch so handle watchers flush against a
		// consistent DOM. Conditional writes keep untouched Text nodes alive.
		batch(() => {
			for (const {handle, token, path} of updates) handle.update(token, path)
			for (const {surface, content} of patches) {
				if (surface.textContent !== content) surface.textContent = content
			}
		})
		if (VERIFY_DOM) assertAligned()
		lastRemovedIds = removedIds
		changed()
		return true
	}

	/**
	 * Structural branch: publish the new tree (reference change ⇔ the renderer
	 * must run) and latch until the freshly painted DOM is bound. `selfHeal`
	 * (the text branch escalating) also binds the CURRENT DOM right away — its structure is nominally
	 * unchanged on that path, so the node layer recovers without waiting for the
	 * adapter, whose later onRendered() just re-binds idempotently.
	 */
	function commitStructural(tokens: Token[], removedIds: readonly number[], selfHeal: boolean): void {
		pendingRemovedIds = removedIds
		pendingStructural = true
		tree(tokens)
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
		if (!selfHeal) return
		const container = deps.container()
		if (container) bindAndAnnounce(container)
	}

	/** Shared endpoint of onRendered and escalation: one DOM+tree walk onto the node layer, then announce. */
	function bindAndAnnounce(container: HTMLElement): void {
		clearTimeout(renderedTimer)
		const result = bind({
			container,
			tokens: latest,
			idFor: deps.idFor,
			nodes: deps.nodes,
			controlElements: deps.controlElements(),
			childSequenceHostsFor: deps.childSequenceHostsFor,
			isBlock: deps.isBlock(),
			editable: deps.editableState(),
		})
		byPath = result.byPath
		byElement = result.byElement
		controlRoots = result.controlRoots
		// A re-bind with no pending structural change removed nothing.
		lastRemovedIds = pendingStructural ? pendingRemovedIds : []
		pendingStructural = false
		if (VERIFY_DOM) assertAligned()
		changed()
	}

	/**
	 * Divergence detector — last step of both branches. White-box rationale kept
	 * from the old patch spec: each branch heals its own writes first (bind
	 * sweeps every bound surface, the text branch its targets), so a throw here
	 * means the healing itself missed a write — the bug class it guards.
	 */
	function assertAligned(): void {
		for (const handle of byPath.values()) {
			const surface = handle.node()?.textElement
			if (!surface) continue
			const expected = handle.token().content
			const actual = surface.textContent
			if (actual === expected) continue
			throw new Error(
				`TokenModel divergence at [${handle.address().path.join(', ')}]: DOM "${actual}" ≠ model "${expected}"`
			)
		}
	}

	return {
		apply,
		onRendered,
		tree,
		tokens: () => latest,
		changed,
		removedIds: () => lastRemovedIds,
		pending: () => pendingStructural,
		byPath: () => byPath,
		byElement: element => byElement.get(element),
		isControlRoot: element => controlRoots.has(element),
	}
}