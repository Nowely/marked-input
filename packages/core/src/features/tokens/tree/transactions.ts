import {untracked} from '../../../shared/signals'
import type {TokenTree} from './tree'
import type {CommitSink, Pairing, TreeNode, Window} from './types'

/**
 * One splice in the coordinates of the COMMITTED projection. No `insertedLength`:
 * it is `text.length`, so storing it would only be a second place to get it wrong.
 */
type Op = {start: number; end: number; text: string}

/**
 * The write path: verbs lower an edit to a projection splice and hand
 * `{next, window}` to the sink. Nothing here mutates the tree — adoption, inside
 * the sink, is the only writer.
 */
export function createTransactions(deps: {tree: TokenTree; readOnly: () => boolean; sink: CommitSink}) {
	let dispatching = false

	/**
	 * Every tree read below is `untracked` for the reason adoption documents: a verb
	 * called from inside an effect or computed must not subscribe that caller to the
	 * projection, the roots, or whatever nodes the liveness walk happened to touch.
	 */
	const currentValue = (): string => untracked(() => deps.tree.value())
	const isReadOnly = (): boolean => untracked(deps.readOnly)
	const isLive = (node: TreeNode): boolean => untracked(() => reachable(deps.tree.roots(), node))

	/**
	 * Editing from a result consumer is a bug: the dispatcher is still on the stack, so the
	 * splice would be computed from a projection the outer op has already replaced.
	 *
	 * THE only re-entry guard left. The commit pipeline mirrored it until the commit became
	 * atomic — its clocks now fire after the walk and inside the boundary's batch, so nothing
	 * can re-enter mid-write and there was no reachable case to police. This one stays because
	 * it IS reachable: `arrive` bypasses the dispatcher, but a verb called from a commit
	 * watcher still runs inside it (gated below).
	 */
	const assertIdle = (): void => {
		if (dispatching) throw new Error('TokenTree: re-entrant transaction dispatch')
	}

	const dispatch = (op: Op, pairing?: Pairing): boolean => {
		const value = currentValue()
		const next = value.slice(0, op.start) + op.text + value.slice(op.end)
		// The pairing is re-attached HERE and not carried on the caller's window, because this
		// is where the window is (re)derived from the op — a hint on an input window would be
		// silently dropped.
		const window: Window = {start: op.start, end: op.end, insertedLength: op.text.length, pairing}

		// A splice that changes nothing still commits: `next === value` reaches the sink and
		// costs a parse plus an adoption, which adoption then diffs to no change. It also still
		// fires `onChange`, in both modes. Suppression, if it is ever wanted, belongs HERE and not
		// in a sink: the dispatcher is the only layer that can drop the wasted parse and adoption
		// along with the emission, so a sink-level guard would buy the user-visible behavior change
		// and none of the saving. Pinned here in transactions.spec.ts and, for the emission itself
		// in both modes, in valueBoundary.spec.ts.
		dispatching = true
		try {
			// The dispatcher owns the no-subscription invariant for the whole commit, sink
			// and result consumer included — whichever sink is plugged in.
			return untracked(() => deps.sink.commit(next, window))
		} finally {
			dispatching = false
		}
	}

	const submit = (op: Op, pairing?: Pairing): boolean => {
		if (isReadOnly()) return false
		if (op.start < 0 || op.end < op.start || op.end > currentValue().length) return false
		return dispatch(op, pairing)
	}

	return {
		/** The primitive: a splice in the committed projection's coordinates, plus any identity claim it carries. */
		applyRange(window: Window, text: string): boolean {
			assertIdle()
			// `window.insertedLength` is ignored: what we are about to splice in is the truth.
			return submit({start: window.start, end: window.end, text}, window.pairing)
		},

		/**
		 * Zero-length splice at a node's TRAILING EDGE — the insert verbs' primitive.
		 *
		 * Node-addressed rather than a raw `applyRange`, and that is the whole reason it exists:
		 * `applyRange` takes a window and so cannot check liveness, while `reachable` is
		 * file-local. A verb built on the raw window would have to re-implement the gate, and a
		 * second implementation of "is this node still in the tree" is exactly what the one-owner
		 * rule forbids.
		 *
		 * The window is EMPTY at the edge, not the node's own span, and that is what keeps the
		 * anchor node's identity: adoption's prefix walk retains a root whose `position.end <=
		 * window.start`, which the node itself satisfies here and would not if the splice
		 * replaced it.
		 */
		applyAfter(node: TreeNode, text: string): boolean {
			assertIdle()
			if (!isLive(node)) return false
			return submit({start: node.position.end, end: node.position.end, text})
		},

		/** Whole-node replacement: mark update/remove, serialized by the caller. */
		applyStructural(target: TreeNode, replacement: string): boolean {
			assertIdle()
			if (!isLive(target)) return false
			return submit({start: target.position.start, end: target.position.end, text: replacement})
		},
	}
}

/**
 * Liveness is reachability from the roots. Nodes carry no dead flag and no parent
 * link, so short of widening the node shape this walk is the check; it is O(tree)
 * against a commit that parses and adopts the whole document anyway.
 */
function reachable(nodes: readonly TreeNode[], node: TreeNode): boolean {
	return nodes.some(child => child === node || (child.kind !== 'text' && reachable(child.children(), node)))
}