import type {TokenPath} from '../../../shared/editorContracts'
import {batch} from '../../../shared/signals/index.js'
import type {Token} from '../parser/types'
import {pathKey} from '../tokenIndex'
import {TokenHandle} from './LiveNode'
import type {ElementBindings} from './LiveNode'

/**
 * The structural DOM walk of the one commit pipeline: zip the freshly rendered
 * DOM with the reconciled token tree and project the result onto the live node
 * layer. Adapted from buildIndex (same frame/stack walk, same all-or-nothing
 * alignment), but instead of building throwaway records it mutates the
 * id-keyed handle map in place:
 *
 * - indexed token, known id    → `update(token, path)` + `bindElements(...)`
 * - indexed token, new id      → `new TokenHandle` + bind
 * - tree token the walk missed → `update(token, path)` + `unbind()` — alive:
 *   the tree is authoritative, only the DOM is (transiently) misaligned
 * - id absent from the tree    → `kill()` + delete from the map
 *
 * The whole projection commits as ONE batch, so handle `changed` watchers
 * flush only after every node reflects the new tree and DOM.
 */
export type BindInput = {
	container: HTMLElement
	/** The identity-reconciled token tree the renderer just painted. */
	tokens: readonly Token[]
	/**
	 * Read-only id lookup (the identity tracker's `idFor`). Bind never
	 * allocates ids: reconcile already ensured one for every token of the tree
	 * it emitted — both its cold-start and delta paths end in a recursive
	 * ensureId sweep over the OUTPUT tree (tokenIdentity.ts), descendants
	 * included. A tree token without an id is a contract violation (an
	 * unreconciled tree was passed) and fails loud before any mutation.
	 */
	idFor: (token: Token) => number | undefined
	/** THE live node layer, keyed by token id — mutated in place. */
	nodes: Map<number, TokenHandle>
	controlElements: ReadonlySet<HTMLElement>
	childSequenceHostsFor: (path: TokenPath) => readonly HTMLElement[]
	isBlock: boolean
	/** Mount-time editable state for newly bound surfaces and mark roots. */
	editable: {editable: boolean; readOnly: boolean}
}

/** Derived lookups over the nodes the walk actually bound (buildIndex's IndexResult, handle-valued). */
export type BindResult = {
	byPath: ReadonlyMap<string, TokenHandle>
	byElement: WeakMap<HTMLElement, TokenHandle>
	controlRoots: WeakSet<HTMLElement>
}

type Frame = {
	tokens: readonly Token[]
	elements: HTMLElement[]
	basePath: TokenPath
	rows?: ReadonlyMap<number, HTMLElement>
}

type TreeEntry = {id: number; token: Token; path: TokenPath}

export function bind(input: BindInput): BindResult {
	const {container, tokens, idFor, nodes, controlElements, childSequenceHostsFor, isBlock, editable} = input

	// Pre-pass, before any mutation: flatten the tree to (id, token, path) in
	// depth-first order. Failing here (no id) leaves the node layer untouched.
	const tree: TreeEntry[] = []
	collectTree(tokens, [], idFor, tree)

	const controlRoots = computeControlRoots(container, controlElements)
	const bound = walkDom(container, tokens, controlRoots, childSequenceHostsFor, isBlock)

	const byPath = new Map<string, TokenHandle>()
	const byElement = new WeakMap<HTMLElement, TokenHandle>()

	batch(() => {
		const treeIds = new Set<number>()
		for (const {id, token, path} of tree) {
			treeIds.add(id)
			const bindings = bound.get(token)
			const existing = nodes.get(id)
			// An unrendered NEW token materializes no handle; one appears when a
			// later walk reaches it (or on demand through the model shell).
			if (!existing && !bindings) continue
			const handle = existing ?? new TokenHandle(id, token, path)
			if (existing) existing.update(token, path)
			else nodes.set(id, handle)
			if (!bindings) {
				handle.unbind()
				continue
			}
			const previous = handle.node()
			handle.bindElements(bindings)
			applyMountState(token, bindings, previous, editable)
			byPath.set(pathKey(path), handle)
			byElement.set(bindings.tokenElement, handle)
			if (bindings.rowElement) byElement.set(bindings.rowElement, handle)
			if (bindings.childSequenceHost) byElement.set(bindings.childSequenceHost, handle)
		}

		// Kill ONLY ids genuinely absent from the new TREE. A DOM-walk bail must
		// not kill: the DOM is transiently misaligned (adapter mid-render) while
		// the tree still owns those tokens — they were unbound above instead.
		// (Deliberate divergence from the old TokenModel#syncHandles, which
		// rebuilt #byId from byPath and so killed every handle on a bail.)
		for (const [id, handle] of nodes) {
			if (treeIds.has(id)) continue
			handle.kill()
			nodes.delete(id)
		}
	})

	return {byPath, byElement, controlRoots}
}

function collectTree(
	tokens: readonly Token[],
	basePath: TokenPath,
	idFor: (token: Token) => number | undefined,
	out: TreeEntry[]
): void {
	tokens.forEach((token, i) => {
		const path = [...basePath, i]
		const id = idFor(token)
		if (id === undefined) {
			throw new Error(`bind: token at [${path.join(', ')}] has no id — bind requires an identity-reconciled tree`)
		}
		out.push({id, token, path})
		if (token.type === 'mark') collectTree(token.children, path, idFor, out)
	})
}

/**
 * buildIndex's frame/stack walk, emitting element bindings per tree token
 * instead of index records. Alignment is all-or-nothing per frame: a count
 * mismatch drops the frame and every descendant frame with it.
 */
function walkDom(
	container: HTMLElement,
	tokens: readonly Token[],
	controlRoots: WeakSet<HTMLElement>,
	childSequenceHostsFor: (path: TokenPath) => readonly HTMLElement[],
	isBlock: boolean
): Map<Token, ElementBindings> {
	const bound = new Map<Token, ElementBindings>()
	const stack: Frame[] = [resolveRoot()]

	while (stack.length > 0) {
		const frame = stack.pop()
		if (!frame) continue
		const {tokens: frameTokens, elements, basePath, rows} = frame
		if (elements.length !== frameTokens.length) continue

		frameTokens.forEach((token, i) => {
			const path = [...basePath, i]
			const element = elements[i]
			const hosts = childSequenceHostsFor(path)
			const childSequenceHost = hosts.length === 1 && element.contains(hosts[0]) ? hosts[0] : undefined
			bound.set(token, {
				tokenElement: element,
				textElement: token.type === 'text' ? element : undefined,
				rowElement: rows?.get(i),
				childSequenceHost,
			})
			if (token.type !== 'mark' || token.children.length === 0) return
			stack.push({
				tokens: token.children,
				elements: nonControlChildren(childSequenceHost ?? element, controlRoots),
				basePath: path,
			})
		})
	}

	return bound

	function resolveRoot(): Frame {
		if (!isBlock) {
			return {tokens, elements: nonControlChildren(container, controlRoots), basePath: []}
		}
		// Block layout: take all container children as candidate rows (do NOT filter rows
		// by controlRoots — a row that contains controls is still a row). Controls are
		// filtered only inside each row when looking for the single token element.
		const rowEls = elementChildren(container)
		const tokenEls: HTMLElement[] = []
		const rows = new Map<number, HTMLElement>()
		const len = Math.min(tokens.length, rowEls.length)
		for (let i = 0; i < len; i++) {
			const row = rowEls[i]
			const inner = nonControlChildren(row, controlRoots)
			// Block alignment is all-or-nothing: one bad row bails the whole frame.
			if (inner.length !== 1) return {tokens, elements: [], basePath: []}
			tokenEls.push(inner[0])
			rows.set(i, row)
		}
		return {tokens, elements: tokenEls, basePath: [], rows}
	}
}

/**
 * Mount-time DOM state, absorbed from the per-commit reconcileTextSurfaces sweep:
 *
 * - textContent: EVERY bound text surface is reconciled to its token content
 *   (conditional write — an untouched Text node keeps the caret stable). bind
 *   is the structural branch's endpoint, and a structural commit can also
 *   carry text changes (e.g. paste replacing a mark AND editing text); the
 *   renderer only re-renders structure, so a kept element's surface would
 *   stay stale without this.
 * - contentEditable / tabindex: applied only to NEWLY bound elements (mount).
 *   Elements that stay bound keep whatever the model shell's scoped editable
 *   setter last wrote — prop-change application is its job, not bind's.
 */
function applyMountState(
	token: Token,
	bindings: ElementBindings,
	previous: ElementBindings | undefined,
	editable: {editable: boolean; readOnly: boolean}
): void {
	const surface = bindings.textElement
	if (surface) {
		if (surface.textContent !== token.content) surface.textContent = token.content
		if (previous?.textElement !== surface) {
			const editableAttr = editable.editable ? 'true' : 'false'
			if (surface.contentEditable !== editableAttr) surface.contentEditable = editableAttr
		}
		return
	}
	if (token.type !== 'mark' || previous?.tokenElement === bindings.tokenElement) return
	if (editable.readOnly) bindings.tokenElement.removeAttribute('tabindex')
	else if (bindings.tokenElement.tabIndex !== 0) bindings.tokenElement.tabIndex = 0
}

function nonControlChildren(parent: HTMLElement, controlRoots: WeakSet<HTMLElement>): HTMLElement[] {
	const out: HTMLElement[] = []
	for (const child of parent.children) {
		if (child instanceof HTMLElement && !controlRoots.has(child)) out.push(child)
	}
	return out
}

function elementChildren(parent: HTMLElement): HTMLElement[] {
	const out: HTMLElement[] = []
	for (const child of parent.children) {
		if (child instanceof HTMLElement) out.push(child)
	}
	return out
}

function computeControlRoots(container: HTMLElement, controlElements: ReadonlySet<HTMLElement>): WeakSet<HTMLElement> {
	const roots = new WeakSet<HTMLElement>()
	for (const ctrl of controlElements) {
		let el: HTMLElement | null = ctrl
		while (el && el !== container) {
			roots.add(el)
			el = el.parentElement
		}
	}
	return roots
}