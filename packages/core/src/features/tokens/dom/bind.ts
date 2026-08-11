import {batch, untracked} from '../../../shared/signals/index.js'
import type {TreeNode} from '../tree/types'
import {applyEditableState} from './editableState'
import {TokenHandle} from './TokenHandle'
import type {ElementBindings} from './TokenHandle'

/**
 * The structural DOM walk of the one commit pipeline: zip the freshly rendered
 * DOM with the LIVE token tree and project the result onto the live node layer.
 * Adapted from buildIndex (same frame/stack walk, same all-or-nothing
 * alignment), but instead of building throwaway records it mutates the
 * id-keyed handle map in place:
 *
 * - indexed node, known id    → `bindElements(...)` (re-arming the text effect)
 * - indexed node, new id      → `new TokenHandle` + bind
 * - tree node the walk missed → `unbind()` — alive: the tree is authoritative,
 *   only the DOM is (transiently) misaligned
 * - id absent from the tree   → `kill()` + delete from the map
 *
 * The whole projection commits as ONE batch, so handle `changed` watchers
 * flush only after every node reflects the new tree and DOM.
 *
 * The tree side is `TreeNode`, not a snapshot generation, since S2.7: a node
 * always has an id, so the id pre-pass throw and the `idFor` indirection both
 * went with the snapshot's optional one.
 */
export type BindInput = {
	container: HTMLElement
	/** The live root nodes the renderer just painted. */
	roots: readonly TreeNode[]
	/** THE live node layer, keyed by node id — mutated in place. */
	nodes: Map<number, TokenHandle>
	controlElements: ReadonlySet<HTMLElement>
	/** Registered `__slot__` hosts for one owner, resolved by the owner's stable id. */
	childSequenceHostsFor: (ownerId: number) => readonly HTMLElement[]
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
	nodes: readonly TreeNode[]
	elements: HTMLElement[]
	rows?: ReadonlyMap<number, HTMLElement>
}

export function bind(input: BindInput): BindResult {
	const {container, roots, nodes, controlElements, childSequenceHostsFor, isBlock, editable} = input

	// `untracked` for the reason adoption documents: the walk below reads `children()`
	// and the text effects read `text()`, and a caller inside an effect or computed must
	// not subscribe to every node the bind happened to touch. It does NOT starve the
	// per-surface effects: `effect()` installs itself as the active subscriber for its
	// own body, so what `untracked` suppresses is only the link to an OUTER scope — which
	// is exactly the link that would let a foreign re-run dispose them.
	return untracked(() => {
		// Depth-first flatten, before any mutation.
		const tree: TreeNode[] = []
		collectTree(roots, tree)

		const controlRoots = computeControlRoots(container, controlElements)
		const walked = walkDom(container, roots, controlRoots, childSequenceHostsFor, isBlock)

		const bound = new Map<number, TokenHandle>()
		const byElement = new WeakMap<HTMLElement, TokenHandle>()

		batch(() => {
			const treeIds = new Set<number>()
			for (const node of tree) {
				treeIds.add(node.id)
				const bindings = walked.get(node)
				const existing = nodes.get(node.id)
				// An unrendered NEW node materializes no handle; one appears when a
				// later walk reaches it (or on demand through the model shell).
				if (!existing && !bindings) continue
				const handle = existing ?? new TokenHandle(node.id)
				if (!existing) nodes.set(node.id, handle)
				if (!bindings) {
					handle.unbind()
					continue
				}
				const previous = handle.node()
				handle.bindElements(bindings, node)
				applyMountState(node, bindings, previous, editable)
				bound.set(node.id, handle)
				byElement.set(bindings.tokenElement, handle)
				if (bindings.rowElement) byElement.set(bindings.rowElement, handle)
				if (bindings.childSequenceHost) byElement.set(bindings.childSequenceHost, handle)
			}

			// Kill ONLY ids genuinely absent from the new TREE. A DOM-walk bail must
			// not kill: the DOM is transiently misaligned (adapter mid-render) while
			// the tree still owns those nodes — they were unbound above instead.
			// (Deliberate divergence from the old TokenModel#syncHandles, which
			// rebuilt #byId from byPath and so killed every handle on a bail.)
			for (const [id, handle] of nodes) {
				if (treeIds.has(id)) continue
				handle.kill()
				nodes.delete(id)
			}
		})

		return {bound, byElement, controlRoots}
	})
}

function collectTree(nodes: readonly TreeNode[], out: TreeNode[]): void {
	for (const node of nodes) {
		out.push(node)
		if (node.kind === 'mark') collectTree(node.children(), out)
	}
}

/**
 * buildIndex's frame/stack walk, emitting element bindings per tree node
 * instead of index records. Alignment is all-or-nothing per frame: a count
 * mismatch drops the frame and every descendant frame with it.
 */
function walkDom(
	container: HTMLElement,
	roots: readonly TreeNode[],
	controlRoots: WeakSet<HTMLElement>,
	childSequenceHostsFor: (ownerId: number) => readonly HTMLElement[],
	isBlock: boolean
): Map<TreeNode, ElementBindings> {
	const bound = new Map<TreeNode, ElementBindings>()
	const stack: Frame[] = [resolveRoot()]

	while (stack.length > 0) {
		const frame = stack.pop()
		if (!frame) continue
		const {nodes: frameNodes, elements, rows} = frame
		if (elements.length !== frameNodes.length) continue

		frameNodes.forEach((node, i) => {
			const element = elements[i]
			const hosts = childSequenceHostsFor(node.id)
			const childSequenceHost = hosts.length === 1 && element.contains(hosts[0]) ? hosts[0] : undefined
			bound.set(node, {
				tokenElement: element,
				textElement: node.kind === 'text' ? element : undefined,
				rowElement: rows?.get(i),
				childSequenceHost,
			})
			if (node.kind !== 'mark') return
			const children = node.children()
			if (children.length === 0) return
			stack.push({
				nodes: children,
				elements: nonControlChildren(childSequenceHost ?? element, controlRoots),
			})
		})
	}

	return bound

	function resolveRoot(): Frame {
		if (!isBlock) {
			return {nodes: roots, elements: nonControlChildren(container, controlRoots)}
		}
		// Block layout: take all container children as candidate rows (do NOT filter rows
		// by controlRoots — a row that contains controls is still a row). Controls are
		// filtered only inside each row when looking for the single token element.
		const rowEls = elementChildren(container)
		const tokenEls: HTMLElement[] = []
		const rows = new Map<number, HTMLElement>()
		const len = Math.min(roots.length, rowEls.length)
		for (let i = 0; i < len; i++) {
			const row = rowEls[i]
			const inner = nonControlChildren(row, controlRoots)
			// Block alignment is all-or-nothing: one bad row bails the whole frame.
			if (inner.length !== 1) return {nodes: roots, elements: []}
			tokenEls.push(inner[0])
			rows.set(i, row)
		}
		return {nodes: roots, elements: tokenEls, rows}
	}
}

/**
 * Mount-time DOM state: contentEditable / tabindex, applied only to NEWLY bound
 * elements. Elements that stay bound keep whatever the model shell's scoped
 * editable setter last wrote — prop-change application is its job, not bind's.
 *
 * The textContent half is GONE (S2.7). `TokenHandle.bindElements` arms a per-surface
 * effect instead, and an effect's immediate first run performs exactly the
 * reconciliation this used to: a newly bound surface the renderer left stale, and a
 * kept surface whose node's text moved on a structural commit, are both the effect's
 * first comparison. Leaving both writers alive is the failure mode the phase exists to
 * avoid.
 */
function applyMountState(
	node: TreeNode,
	bindings: ElementBindings,
	previous: ElementBindings | undefined,
	editable: {editable: boolean; readOnly: boolean}
): void {
	const surface = bindings.textElement
	if (surface) {
		// Apply editable state only to NEWLY bound text surfaces (mount); elements
		// that stay bound keep what the model shell's scoped setter last wrote.
		if (previous?.textElement !== surface) applyEditableState(bindings, editable)
		return
	}
	// Apply tabindex only to NEWLY bound mark roots.
	if (node.kind !== 'mark' || previous?.tokenElement === bindings.tokenElement) return
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