import type {TokenPath} from '../../../shared/editorContracts'
import {batch, event, signal} from '../../../shared/signals/index.js'
import type {Computed, Event} from '../../../shared/signals/index.js'
import type {Token} from '../parser/types'
import type {Changeset, ReconcileResult} from '../tokenIdentity'
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
}

export type CommitPipeline = {
	/** THE entry — routes one reconcile result through the text or structural branch. */
	apply(result: ReconcileResult): void
	/** Adapter signal: the renderer painted — bind the DOM and complete a pending structural apply. */
	onRendered(): void
	/** Structural tree; reference changes ⇔ the renderer must run. */
	tree: Computed<Token[]>
	/** THE model-level detector: fires once per commit, only after the DOM is consistent. */
	changed: Event<Changeset>
	/** pendingStructural latch: true between a structural apply and its bind — id-bridged resolution fails closed. */
	pending(): boolean
	byPath(): ReadonlyMap<string, TokenHandle>
	byElement(element: HTMLElement): TokenHandle | undefined
	isControlRoot(element: HTMLElement): boolean
}

type Delta = Extract<Changeset, {kind: 'delta'}>

// Guards the divergence detector: true under Vitest + dev builds, stripped to false in production bundles; ?? true keeps it live on unknown runtimes.
// oxlint-disable-next-line typescript/no-unnecessary-condition -- intentional runtime guard; value depends on bundler
const VERIFY_DOM: boolean = import.meta.env?.DEV ?? true

/** Payload for a re-bind with no pending apply (the adapter re-rendered on its own): nothing changed token-wise, the event still marks "DOM re-bound and consistent". */
const REBIND_CHANGESET: Changeset = (() => {
	// oxlint-disable-next-line no-unsafe-type-assertion -- freezing a typed mutable array; widening back to number[] is intentional and safe
	const e: number[] = Object.freeze<number[]>([]) as number[]
	return Object.freeze({kind: 'delta' as const, textChanged: e, added: e, removed: e, shifted: e})
})()

export function createCommitPipeline(deps: CommitDeps): CommitPipeline {
	// `tree` is a plain signal written ONLY by the structural branch — reference
	// stability on the text path is direct control flow. A computed would have
	// to derive the kept reference from the latest reconcile result, reviving
	// the old memo-mutation-inside-a-computed pattern this pipeline deletes.
	const tree = signal<Token[]>({initial: []})
	const changed = event<Changeset>()

	// Derived lookups over the bound nodes — replaced wholesale by bind on the
	// structural branch, untouched on the text branch (paths are unchanged there
	// by definition).
	let byPath: ReadonlyMap<string, TokenHandle> = new Map()
	let byElement = new WeakMap<HTMLElement, TokenHandle>()
	let controlRoots = new WeakSet<HTMLElement>()

	let pendingStructural = false
	let pendingChangeset: Changeset = REBIND_CHANGESET
	let committing = false

	function apply(result: ReconcileResult): void {
		if (committing) throw new Error('TokenModel commit re-entry')
		committing = true
		try {
			const {tokens, changeset} = result
			// Routing: text path ⇔ delta with no added/removed — IF the node layer
			// is current. While the structural latch is up the layer is one
			// generation stale, so every apply folds into the pending window
			// (fail-closed: no half-patch against a tree the DOM never showed).
			if (
				!pendingStructural &&
				changeset.kind === 'delta' &&
				changeset.added.length === 0 &&
				changeset.removed.length === 0
			) {
				if (commitText(tokens, changeset)) return
				commitStructural(tokens, changeset, true)
				return
			}
			commitStructural(tokens, changeset, false)
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
	 * the bound elements and paths are all still live. Two passes, like the old
	 * preparePatch: resolve everything pure first — ANY miss abandons the branch
	 * before a single mutation and the caller escalates structurally. Resolution
	 * honesty: changeset buckets carry ids only, so id → (token, path) comes from
	 * ONE read-only depth-first walk of the new tree — O(tree) time, O(change)
	 * allocations — and tree/byPath/byElement stay untouched here.
	 */
	function commitText(tokens: readonly Token[], changeset: Delta): boolean {
		const needed = new Set<number>(changeset.textChanged)
		for (const id of changeset.shifted) needed.add(id)
		const resolved = new Map<number, {token: Token; path: TokenPath}>()
		if (needed.size > 0) collectChanged(tokens, needed, resolved)

		const updates: {handle: TokenHandle; token: Token; path: TokenPath}[] = []
		const patches: {surface: HTMLElement; content: string}[] = []
		for (const id of changeset.textChanged) {
			const entry = resolved.get(id)
			// Unknown id: conservative stale-tree guard (old isTextPath parity).
			if (!entry) return false
			// A textChanged MARK renders value/meta as framework props — the
			// renderer must run. B3's deep reconcile makes this branch unreachable
			// (textChanged will hold text tokens by construction); demote it to a
			// dev assertion then.
			if (entry.token.type !== 'text') return false
			const handle = deps.nodes.get(id)
			const surface = handle?.node()?.textElement
			if (!handle || !surface) return false
			updates.push({handle, token: entry.token, path: entry.path})
			patches.push({surface, content: entry.token.content})
		}
		for (const id of changeset.shifted) {
			const handle = deps.nodes.get(id)
			if (!handle) continue // never bound — a handle materializes on the next bind
			const entry = resolved.get(id)
			if (!entry) return false
			updates.push({handle, token: entry.token, path: entry.path})
		}

		// Commit: update the listed nodes (each bumps only its own dirty) and
		// patch the changed surfaces, in one batch so handle watchers flush
		// against a consistent DOM. Conditional writes keep untouched Text nodes
		// alive under the caret.
		batch(() => {
			for (const {handle, token, path} of updates) handle.update(token, path)
			for (const {surface, content} of patches) {
				if (surface.textContent !== content) surface.textContent = content
			}
		})
		if (VERIFY_DOM) assertAligned()
		changed(changeset)
		return true
	}

	/**
	 * Structural branch: publish the new tree (reference change ⇔ the renderer
	 * must run) and latch until the freshly painted DOM is bound. `selfHeal`
	 * (the text branch escalating, matching the old #patchCommit → #rebuildIndex)
	 * also binds the CURRENT DOM right away — its structure is nominally
	 * unchanged on that path, so the node layer recovers without waiting for the
	 * adapter, whose later onRendered() just re-binds idempotently.
	 */
	function commitStructural(tokens: Token[], changeset: Changeset, selfHeal: boolean): void {
		pendingChangeset = changeset
		pendingStructural = true
		tree(tokens)
		if (!selfHeal) return
		const container = deps.container()
		if (container) bindAndAnnounce(container)
	}

	/** Shared endpoint of onRendered and escalation: one DOM+tree walk onto the node layer, then announce. */
	function bindAndAnnounce(container: HTMLElement): void {
		const result = bind({
			container,
			tokens: tree(),
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
		const changeset = pendingStructural ? pendingChangeset : REBIND_CHANGESET
		pendingStructural = false
		if (VERIFY_DOM) assertAligned()
		changed(changeset)
	}

	/** id → (token, path) for the changed ids: one shared-prefix DFS over the new tree, allocating only on hits. */
	function collectChanged(
		tokens: readonly Token[],
		needed: ReadonlySet<number>,
		out: Map<number, {token: Token; path: TokenPath}>
	): void {
		const prefix: number[] = []
		const walk = (level: readonly Token[]): void => {
			for (let i = 0; i < level.length; i++) {
				const token = level[i]
				prefix.push(i)
				const id = deps.idFor(token)
				if (id !== undefined && needed.has(id)) out.set(id, {token, path: [...prefix]})
				if (token.type === 'mark') walk(token.children)
				prefix.pop()
			}
		}
		walk(tokens)
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
		changed,
		pending: () => pendingStructural,
		byPath: () => byPath,
		byElement: element => byElement.get(element),
		isControlRoot: element => controlRoots.has(element),
	}
}