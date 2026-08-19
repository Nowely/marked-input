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
	/** THE element source: what each adapter consigned for this generation, by token id. */
	consigned: ReadonlyMap<number, HTMLElement>
	/** The same for block row wrappers; empty outside block layout, because only rows register. */
	rows: ReadonlyMap<number, HTMLElement>
}

/**
 * The ELEMENT-keyed lookups of one walk (buildIndex's IndexResult, handle-valued).
 *
 * There is no id-keyed `bound` map any more: it was a second id→handle map rebuilt every
 * paint, and a strict function of the first — `input.nodes` holds every live handle, and
 * "this walk bound it" is `handle.alive()`, since the walk unbinds (never removes) a node
 * the DOM missed and deletes only ids absent from the tree.
 */
export type BindResult = {
	byElement: WeakMap<HTMLElement, TokenHandle>
	controlRoots: WeakSet<HTMLElement>
}

export function bind(input: BindInput): BindResult {
	const {container, roots, nodes, controlElements, childSequenceHostsFor, consigned, rows} = input

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
		const walked = bindingsFor(tree, consigned, rows, childSequenceHostsFor)

		const byElement = new WeakMap<HTMLElement, TokenHandle>()
		// The live id space, used below to decide which handles die. Built from the flattened
		// TREE rather than from what was consigned: a token whose element has not arrived is
		// still the tree's, and must not be killed for it.
		const treeIds = new Set<number>()
		for (const node of tree) treeIds.add(node.id)

		batch(() => {
			for (const node of tree) {
				const bindings = walked.get(node)
				const existing = nodes.get(node.id)
				// An unconsigned NEW node materializes no handle; one appears once its
				// component paints and its ref fires.
				if (!existing && !bindings) continue
				const handle = existing ?? new TokenHandle(node.id)
				if (!existing) nodes.set(node.id, handle)
				if (!bindings) {
					handle.unbind()
					continue
				}
				const previous = handle.node()
				handle.bindElements(bindings, node)
				applyMountState(bindings, previous)
				byElement.set(bindings.tokenElement, handle)
				if (bindings.rowElement) byElement.set(bindings.rowElement, handle)
				if (bindings.childSequenceHost) byElement.set(bindings.childSequenceHost, handle)
			}

			// Kill ONLY ids genuinely absent from the new TREE. A token whose element has
			// not arrived yet is transiently unconsigned while the tree still owns it —
			// it was unbound above instead.
			for (const [id, handle] of nodes) {
				if (treeIds.has(id)) continue
				handle.kill()
				nodes.delete(id)
			}
		})

		return {byElement, controlRoots}
	})
}

function collectTree(nodes: readonly TreeNode[], out: TreeNode[]): void {
	for (const node of nodes) {
		out.push(node)
		if (node.kind === 'mark') collectTree(node.children(), out)
	}
}

/**
 * The element bindings of one generation, taken from what the adapters CONSIGNED rather than
 * derived by walking the painted DOM.
 *
 * This replaced a frame/stack walk that zipped each sibling list against its DOM children and
 * bailed a whole frame on a count mismatch. Nothing in that walk was knowledge the framework did
 * not already hold, and pairing by COUNT was actively wrong in one measured case: when a
 * consumer's Mark renders its slot as a string instead of rendering `children`, the inner tokens
 * are never rendered at all and the walk still paired them with whatever element sat at the same
 * index. A token with no consigned element now simply has none, which is the truth.
 *
 * A Mark's element is the box-less wrapper the adapters render around it, so nothing here — and
 * nothing in {@link applyMountState} — ever touches a consumer's own element.
 */
function bindingsFor(
	tree: readonly TreeNode[],
	consigned: ReadonlyMap<number, HTMLElement>,
	rows: ReadonlyMap<number, HTMLElement>,
	childSequenceHostsFor: (ownerId: number) => readonly HTMLElement[]
): Map<TreeNode, ElementBindings> {
	const bound = new Map<TreeNode, ElementBindings>()
	for (const node of tree) {
		const element = consigned.get(node.id)
		if (!element) continue
		const hosts = childSequenceHostsFor(node.id)
		// The `contains` test survives the walk's deletion: a host registered under this owner
		// but sitting outside its element belongs to a generation that has not been torn down.
		const childSequenceHost = hosts.length === 1 && element.contains(hosts[0]) ? hosts[0] : undefined
		bound.set(node, {
			tokenElement: element,
			// A Surface is a TEXT token's own element — the walk gave one to text nodes only, and
			// that equivalence is what lets the text effect write straight into it.
			textElement: node.kind === 'text' ? element : undefined,
			rowElement: rows.get(node.id),
			childSequenceHost,
		})
	}
	return bound
}

/**
 * Mount-time DOM state: the one-host editable topology ({@link applyEditableState}).
 * A bound TEXT SURFACE is written once, at mount, and never rewritten while it stays
 * bound — no attribute write lands on a surface the user is typing in. A MARK ROOT
 * re-applies whenever its slot host changes under it, because the policy the root
 * itself gets depends on whether it has one.
 *
 * The textContent half is GONE (S2.7). `TokenHandle.bindElements` arms a per-surface
 * effect instead, and an effect's immediate first run performs exactly the
 * reconciliation this used to: a newly bound surface the renderer left stale, and a
 * kept surface whose node's text moved on a structural commit, are both the effect's
 * first comparison. Leaving both writers alive is the failure mode the phase exists to
 * avoid.
 */
function applyMountState(bindings: ElementBindings, previous: ElementBindings | undefined): void {
	const surface = bindings.textElement
	if (surface) {
		if (previous?.textElement !== surface) applyEditableState(bindings)
		return
	}
	// A MARK ROOT — bind gives a text surface to text nodes ONLY, so the arm above is the
	// whole text case. Newly bound, or its slot host appeared or was replaced under a root
	// element that survived: a root that GAINS a host must lose the `ce=false` that made it
	// atomic, or the slot it just grew is uneditable.
	const sameRoot = previous?.tokenElement === bindings.tokenElement
	const sameHost = previous?.childSequenceHost === bindings.childSequenceHost
	if (sameRoot && sameHost) return
	applyEditableState(bindings)
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