import {batch, untracked} from '../../../shared/signals/index.js'
import type {TreeNode} from '../tree/types'
import {TokenHandle} from './TokenHandle'
import type {ElementBindings} from './TokenHandle'

/**
 * The whole-tree projection of the one commit pipeline: pair the LIVE token tree with what the
 * adapters consigned and write the result onto the live node layer. It mutates the id-keyed
 * handle map in place rather than building throwaway records:
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
/**
 * THE element source: what the adapters consigned, asked one id at a time.
 *
 * Per-id lookups and not maps, because {@link rebindNode} answers for a SINGLE registration and
 * rebuilding a whole map to serve it is what made mount quadratic. The registries index by owner
 * id for the same reason.
 */
export type ElementSource = {
	/** The token's own element. */
	tokenElement(id: number): HTMLElement | undefined
	/** The block-layout row wrapper; `undefined` outside block layout, where no row registers. */
	rowElement(id: number): HTMLElement | undefined
	/**
	 * The SOLE registered `__slot__` host for one owner, resolved by the owner's stable id, and
	 * `undefined` when there is none or more than one. Two live registrations mean two generations
	 * are on the page and neither can be trusted to be this one's.
	 */
	childSequenceHost(ownerId: number): HTMLElement | undefined
}

/** The mutable node-layer state both binding paths share. */
export type BindTarget = {
	/** THE live node layer, keyed by node id — mutated in place. */
	nodes: Map<number, TokenHandle>
	/**
	 * The element→handle lookup, LONG-LIVED and mutated in place rather than replaced per walk.
	 * A per-walk map cannot survive {@link rebindNode}, which touches one id and must not forget
	 * the rest — so every path that stops binding an element deletes its entry explicitly.
	 */
	byElement: WeakMap<HTMLElement, TokenHandle>
	source: ElementSource
}

export type BindInput = BindTarget & {
	/** The live root nodes the renderer just painted. */
	roots: readonly TreeNode[]
}

/**
 * What one whole-tree walk publishes beyond the node layer it mutated.
 *
 * There is no id-keyed `bound` map any more: it was a second id→handle map rebuilt every
 * paint, and a strict function of the first — `input.nodes` holds every live handle, and
 * "this walk bound it" is `handle.alive()`, since the walk unbinds (never removes) a node
 * the DOM missed and deletes only ids absent from the tree.
 */
export type BindResult = {
	/**
	 * The flattened tree by id, so a later single-id rebind does not have to search for its node.
	 * Rebuilt here because the walk already flattens; a `find(id)` per ref would put the whole
	 * document back into the cost of one registration.
	 */
	nodeById: Map<number, TreeNode>
}

export function bind(input: BindInput): BindResult {
	const {roots, nodes, byElement} = input

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

		// The live id space, used below to decide which handles die. Built from the flattened
		// TREE rather than from what was consigned: a token whose element has not arrived is
		// still the tree's, and must not be killed for it.
		const nodeById = new Map<number, TreeNode>()
		for (const node of tree) nodeById.set(node.id, node)

		batch(() => {
			for (const node of tree) rebindNode(node, input)

			// Kill ONLY ids genuinely absent from the new TREE. A token whose element has
			// not arrived yet is transiently unconsigned while the tree still owns it —
			// it was unbound above instead.
			for (const [id, handle] of nodes) {
				if (nodeById.has(id)) continue
				forget(byElement, handle.node())
				handle.kill()
				nodes.delete(id)
			}
		})

		return {nodeById}
	})
}

/**
 * Bind ONE node against what is currently consigned for it — the body of the walk above, reached
 * directly when a single ref fires.
 *
 * This is what keeps mount linear. A registration used to invalidate a counter the bind effect
 * watched, so every ref cost a whole-tree walk and mounting an N-node document cost N of them
 * (measured: 2N+2 binds through both adapters, 678 ms at 2001 nodes). The element a ref carries
 * belongs to exactly one id, and this is that id's share of the walk.
 *
 * Safe to call between walks because it takes the same reading `bind` would: the registries are
 * the element source either way, and a wrong intermediate state is corrected by the next commit's
 * full walk rather than being relied upon never to happen.
 */
export function rebindNode(node: TreeNode, target: BindTarget): void {
	const {nodes, byElement, source} = target
	const bindings = bindingsFor(node, source)
	const existing = nodes.get(node.id)
	// An unconsigned NEW node materializes no handle; one appears once its component
	// paints and its ref fires.
	if (!existing && !bindings) return
	const handle = existing ?? new TokenHandle(node.id)
	if (!existing) nodes.set(node.id, handle)
	const previous = handle.node()
	if (!bindings) {
		forget(byElement, previous)
		handle.unbind()
		return
	}
	handle.bindElements(bindings, node)
	// A ROW's wrapper stays BARE: it is neither a text surface nor a mark root, and the
	// mark-root arm would freeze it atomic. Its chrome freezes itself via control() refs.
	if (node.kind !== 'row') applyMountState(bindings, previous)
	forget(byElement, previous, bindings)
	byElement.set(bindings.tokenElement, handle)
	if (bindings.rowElement) byElement.set(bindings.rowElement, handle)
	if (bindings.childSequenceHost) byElement.set(bindings.childSequenceHost, handle)
}

/**
 * Drop the element→handle entries a handle is no longer answering for.
 *
 * Only needed since `byElement` outlived the walk: while it was rebuilt per bind, an element that
 * stopped being a token's simply never made it into the new map. Anything still bound in `next` is
 * kept, so a rebind that changes one of a token's three elements does not unpublish the other two.
 */
function forget(
	byElement: WeakMap<HTMLElement, TokenHandle>,
	previous: ElementBindings | undefined,
	next?: ElementBindings
): void {
	if (!previous) return
	for (const element of [previous.tokenElement, previous.rowElement, previous.childSequenceHost]) {
		if (!element) continue
		if (
			next &&
			(element === next.tokenElement || element === next.rowElement || element === next.childSequenceHost)
		) {
			continue
		}
		byElement.delete(element)
	}
}

function collectTree(nodes: readonly TreeNode[], out: TreeNode[]): void {
	for (const node of nodes) {
		out.push(node)
		if (node.kind !== 'text') collectTree(node.children(), out)
	}
}

/**
 * The element bindings of one generation, taken from what the adapters CONSIGNED rather than
 * derived by walking the painted DOM.
 *
 * This replaced a frame/stack walk over the painted DOM that zipped each sibling list against
 * its element children and bailed a whole frame on a count mismatch. Nothing in that walk was knowledge the framework did
 * not already hold, and pairing by COUNT was actively wrong in one measured case: when a
 * consumer's Mark renders its slot as a string instead of rendering `children`, the inner tokens
 * are never rendered at all and the walk still paired them with whatever element sat at the same
 * index. A token with no consigned element now simply has none, which is the truth.
 *
 * A Mark's element is the box-less wrapper the adapters render around it, so nothing here — and
 * nothing in {@link applyMountState} — ever touches a consumer's own element.
 */
function bindingsFor(node: TreeNode, source: ElementSource): ElementBindings | undefined {
	const element = source.tokenElement(node.id)
	if (!element) return undefined
	const host = source.childSequenceHost(node.id)
	// The `contains` test survives the walk's deletion: a host registered under this owner
	// but sitting outside its element belongs to a generation that has not been torn down.
	const childSequenceHost = host && element.contains(host) ? host : undefined
	return {
		tokenElement: element,
		// A Surface is a TEXT token's own element — the walk gave one to text nodes only, and
		// that equivalence is what lets the text effect write straight into it.
		textElement: node.kind === 'text' ? element : undefined,
		rowElement: source.rowElement(node.id),
		childSequenceHost,
	}
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

/**
 * One-host editable topology for a single bound token. The CONTAINER is the only
 * editing host; nothing below it opens a second one.
 *
 * - Text surface: BARE — no contenteditable attribute at all; it inherits
 *   editability from the container.
 * - Value-only mark root (no slot): `contenteditable=false` — atomic by
 *   contract, not by accident of "my parent is not an editing host". No
 *   tabindex either way: marks are not tab stops (Tab leaves the field
 *   natively).
 * - Slot mark: the root and the slot host go BARE, so slot content stays in the
 *   ONE host, and only the CHROME around it — every element hanging off the
 *   root→host path — becomes atomic. A nested `contenteditable=true` host is
 *   what this policy exists to avoid: the host both adapters render is
 *   `display: contents`, and a boxless element cannot take focus, so Chromium
 *   accepts a caret there and then fires no `beforeinput` at all.
 *
 * readOnly lives on the CONTAINER (the selection driver writes it), not here.
 *
 * Called only through {@link applyMountState}, on bindings from {@link bindingsFor},
 * which records a slot host only when the token element `contains` it. The chrome
 * walk below relies on that — it climbs host→root and has no other stop condition.
 */
function applyEditableState(bindings: ElementBindings): void {
	if (bindings.textElement) {
		bindings.textElement.removeAttribute('contenteditable')
		return
	}
	const {tokenElement, childSequenceHost} = bindings
	tokenElement.removeAttribute('tabindex')
	if (!childSequenceHost) {
		if (tokenElement.contentEditable !== 'false') tokenElement.contentEditable = 'false'
		return
	}
	tokenElement.removeAttribute('contenteditable')
	childSequenceHost.removeAttribute('contenteditable')
	// Walk the host back up to the root, freezing every sibling of the path: those are
	// the mark's own chrome, and chrome is not document content.
	let onPath: HTMLElement = childSequenceHost
	while (onPath !== tokenElement) {
		const parent = onPath.parentElement
		// The walk bound this host under this root, but nothing pins the DOM between that
		// walk and this write — a host detached in between must not spin.
		if (!parent) break
		for (const child of parent.children) {
			if (child !== onPath && child instanceof HTMLElement && child.contentEditable !== 'false') {
				child.contentEditable = 'false'
			}
		}
		onPath = parent
	}
}