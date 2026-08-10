import {batch} from '../../../shared/signals/index.js'
import type {Token} from '../parser/types'
import {applyEditableState} from './editableState'
import {TokenHandle} from './TokenHandle'
import type {ElementBindings} from './TokenHandle'

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
	/** The id-stamped token tree the renderer just painted. */
	tokens: readonly Token[]
	/**
	 * Read-only id lookup. Bind never allocates ids: every snapshot token carries
	 * its node's id (`tree/snapshot.ts`), descendants included. A tree token without
	 * an id is a contract violation (an unsnapshotted tree was passed) and fails loud
	 * before any mutation.
	 */
	idFor: (token: Token) => number | undefined
	/** THE live node layer, keyed by token id — mutated in place. */
	nodes: Map<number, TokenHandle>
	controlElements: ReadonlySet<HTMLElement>
	/** Registered `__slot__` hosts for one owner, resolved by the owner's stable id. */
	childSequenceHostsFor: (ownerId: number | undefined) => readonly HTMLElement[]
	isBlock: boolean
	/** Mount-time editable state for newly bound surfaces and mark roots. */
	editable: {editable: boolean; readOnly: boolean}
}

/** Derived lookups over the nodes the walk actually bound (buildIndex's IndexResult, handle-valued). */
export type BindResult = {
	/**
	 * The handles this walk bound, keyed by stable id. It was keyed by `pathKey(path)`
	 * until S1.8 step 4; no production consumer ever looked one up by key — all three
	 * (`assertAligned`, `setEditable`, `DomModel.boundHandles`) iterate the values — so the
	 * path string was the last thing keeping a path layer alive inside the pipeline.
	 */
	bound: ReadonlyMap<number, TokenHandle>
	byElement: WeakMap<HTMLElement, TokenHandle>
	controlRoots: WeakSet<HTMLElement>
}

type Frame = {
	tokens: readonly Token[]
	elements: HTMLElement[]
	rows?: ReadonlyMap<number, HTMLElement>
}

type TreeEntry = {id: number; token: Token}

export function bind(input: BindInput): BindResult {
	const {container, tokens, idFor, nodes, controlElements, childSequenceHostsFor, isBlock, editable} = input

	// Pre-pass, before any mutation: flatten the tree to (id, token) in depth-first
	// order. Failing here (no id) leaves the node layer untouched.
	const tree: TreeEntry[] = []
	collectTree(tokens, idFor, tree)

	const controlRoots = computeControlRoots(container, controlElements)
	const walked = walkDom(container, tokens, idFor, controlRoots, childSequenceHostsFor, isBlock)

	const bound = new Map<number, TokenHandle>()
	const byElement = new WeakMap<HTMLElement, TokenHandle>()

	batch(() => {
		const treeIds = new Set<number>()
		for (const {id, token} of tree) {
			treeIds.add(id)
			const bindings = walked.get(token)
			const existing = nodes.get(id)
			// An unrendered NEW token materializes no handle; one appears when a
			// later walk reaches it (or on demand through the model shell).
			if (!existing && !bindings) continue
			const handle = existing ?? new TokenHandle(id, token)
			if (existing) existing.refresh(token)
			else nodes.set(id, handle)
			if (!bindings) {
				handle.unbind()
				continue
			}
			const previous = handle.node()
			handle.bindElements(bindings)
			applyMountState(token, bindings, previous, editable)
			bound.set(id, handle)
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

	return {bound, byElement, controlRoots}
}

function collectTree(tokens: readonly Token[], idFor: (token: Token) => number | undefined, out: TreeEntry[]): void {
	for (const token of tokens) {
		const id = idFor(token)
		if (id === undefined) {
			throw new Error(`bind: token "${token.content}" has no id — bind requires an identity-reconciled tree`)
		}
		out.push({id, token})
		if (token.type === 'mark') collectTree(token.children, idFor, out)
	}
}

/**
 * buildIndex's frame/stack walk, emitting element bindings per tree token
 * instead of index records. Alignment is all-or-nothing per frame: a count
 * mismatch drops the frame and every descendant frame with it.
 */
function walkDom(
	container: HTMLElement,
	tokens: readonly Token[],
	idFor: (token: Token) => number | undefined,
	controlRoots: WeakSet<HTMLElement>,
	childSequenceHostsFor: (ownerId: number | undefined) => readonly HTMLElement[],
	isBlock: boolean
): Map<Token, ElementBindings> {
	const bound = new Map<Token, ElementBindings>()
	const stack: Frame[] = [resolveRoot()]

	while (stack.length > 0) {
		const frame = stack.pop()
		if (!frame) continue
		const {tokens: frameTokens, elements, rows} = frame
		if (elements.length !== frameTokens.length) continue

		frameTokens.forEach((token, i) => {
			const element = elements[i]
			const hosts = childSequenceHostsFor(idFor(token))
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
			})
		})
	}

	return bound

	function resolveRoot(): Frame {
		if (!isBlock) {
			return {tokens, elements: nonControlChildren(container, controlRoots)}
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
			if (inner.length !== 1) return {tokens, elements: []}
			tokenEls.push(inner[0])
			rows.set(i, row)
		}
		return {tokens, elements: tokenEls, rows}
	}
}

/**
 * Mount-time DOM state (absorbed here from the deleted per-commit sweep):
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
		// Apply editable state only to NEWLY bound text surfaces (mount); elements
		// that stay bound keep what the model shell's scoped setter last wrote.
		if (previous?.textElement !== surface) applyEditableState(bindings, editable)
		return
	}
	// Apply tabindex only to NEWLY bound mark roots.
	if (token.type !== 'mark' || previous?.tokenElement === bindings.tokenElement) return
	applyEditableState(bindings, editable)
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