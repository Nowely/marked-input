import {untracked} from '../../../shared/signals'
import type {TokenTree} from './tree'
import type {CommitSink, Pairing, TextNode, TreeNode, Window} from './types'

/**
 * One splice in the coordinates of the COMMITTED projection. No `insertedLength`:
 * it is `text.length` for a single op and recomputed for a hull, so storing it
 * would only be a second place to get it wrong.
 */
type Op = {start: number; end: number; text: string}

/** The open `tx` buffer. `refused` latches the first refusal — see `refuse`. */
type Batch = {ops: Op[]; refused: boolean}

/**
 * The write path: verbs lower an edit to a projection splice and hand
 * `{next, window}` to the sink. Nothing here mutates the tree — adoption, inside
 * the sink, is the only writer.
 */
export function createTransactions(deps: {tree: TokenTree; readOnly: () => boolean; sink: CommitSink}) {
	let dispatching = false
	let pending: Batch | undefined

	/**
	 * Every tree read below is `untracked` for the reason adoption documents: a verb
	 * called from inside an effect or computed must not subscribe that caller to the
	 * projection, the roots, or whatever nodes the liveness walk happened to touch.
	 */
	const currentValue = (): string => untracked(() => deps.tree.value())
	const isReadOnly = (): boolean => untracked(deps.readOnly)
	const isLive = (node: TreeNode): boolean => untracked(() => reachable(deps.tree.roots(), node))

	/** Mirrors the commit pipeline's re-entry guard: editing from a result consumer is a bug. */
	const assertIdle = (): void => {
		if (dispatching) throw new Error('TokenTree: re-entrant transaction dispatch')
	}

	/**
	 * One refusal rule for the whole layer: the refusing call answers `false` at once,
	 * and inside a `tx` it also poisons the batch, so a caller's intent is never half
	 * applied: overlapping ops reject the whole tx, and no partial state survives.
	 */
	const refuse = (): false => {
		if (pending) pending.refused = true
		return false
	}

	const dispatch = (ops: readonly Op[], pairing?: Pairing): boolean => {
		const value = currentValue()
		// The `end` tie-break is load-bearing, not cosmetic: half-open disjointness admits a
		// zero-length op at the start of a range op, and on `start` alone the range op can sort
		// first, drive `cursor` BACKWARDS and re-emit the span it just deleted.
		const sorted = ops.toSorted((a, b) => a.start - b.start || a.end - b.end)

		let next = ''
		let cursor = 0
		for (const op of sorted) {
			next += value.slice(cursor, op.start) + op.text
			cursor = op.end
		}
		next += value.slice(cursor)

		// `sorted[last].end` is the maximal end: an earlier op either starts before the last
		// one — and half-open disjointness then holds its end at or before that op's start —
		// or shares its start, where the tie-break already ordered the ends. So the loop
		// copied `value[0, start)` and `value[end, …)` verbatim and everything between them is
		// the hull's inserted text: its old span plus the total delta. For a single op that
		// reduces to `text.length`.
		const start = sorted[0].start
		const end = sorted[sorted.length - 1].end
		// The pairing is re-attached HERE and not carried on the caller's window, because this
		// is where the window is (re)derived from the ops — a hint on an input window would be
		// silently dropped.
		const window: Window = {start, end, insertedLength: end - start + (next.length - value.length), pairing}

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
		if (isReadOnly()) return refuse()
		if (op.start < 0 || op.end < op.start || op.end > currentValue().length) return refuse()
		if (!pending) return dispatch([op], pairing)
		// A pairing claims the WHOLE root list, and a hull composed with other ops cannot keep
		// that claim true — the other ops may add or remove roots the pairing never counted.
		// Refused rather than dropped: silently ignoring it would commit a move that quietly
		// lost every row's identity.
		if (pairing) return refuse()
		if (pending.ops.some(other => overlaps(op, other))) return refuse()
		pending.ops.push(op)
		return true
	}

	return {
		/** The primitive: a splice in the committed projection's coordinates, plus any identity claim it carries. */
		applyRange(window: Window, text: string): boolean {
			assertIdle()
			// `window.insertedLength` is ignored: what we are about to splice in is the truth.
			return submit({start: window.start, end: window.end, text}, window.pairing)
		},

		/** Node-local coordinates → global window. Single-node edits. */
		applyText(node: TextNode, localRange: {start: number; end: number}, text: string): boolean {
			assertIdle()
			if (!isLive(node)) return refuse()
			// The bound has to come from `position`, because that is the coordinate space the
			// splice offsets below are built in: `text().length` would bound one space by
			// another. They agree by construction — adoption writes a node's position and its
			// content from one parse token, and the suffix walk moves both ends by the same
			// delta — and reading `text()` would add a signal dependency on top.
			const length = node.position.end - node.position.start
			if (localRange.start < 0 || localRange.end < localRange.start || localRange.end > length) return refuse()
			return submit({
				start: node.position.start + localRange.start,
				end: node.position.start + localRange.end,
				text,
			})
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
			if (!isLive(node)) return refuse()
			return submit({start: node.position.end, end: node.position.end, text})
		},

		/** Whole-node replacement: mark update/remove, serialized by the caller. */
		applyStructural(target: TreeNode, replacement: string): boolean {
			assertIdle()
			if (!isLive(target)) return refuse()
			return submit({start: target.position.start, end: target.position.end, text: replacement})
		},

		/**
		 * Composition: buffer the verbs, commit once, adopt once with the hull window
		 * (identity precision inside the hull degrades to middle pairing).
		 *
		 * Op coordinates stay in the COMMITTED projection's space rather than being remapped
		 * through accumulated offsets: nothing commits until the end, so node positions —
		 * which is where `applyText`/`applyStructural` get their coordinates — never move
		 * mid-`tx`. Remapping would silently break exactly those verbs. Disjointness is what
		 * makes the two readings equivalent, and overlapping ops are rejected anyway.
		 *
		 * A throw out of `fn` propagates with nothing committed: the buffer only ever
		 * held intent. An empty `tx` is a no-op success.
		 */
		tx(fn: () => void): boolean {
			assertIdle()
			if (pending) return refuse() // nested tx is unsupported, and it rejects its parent
			if (isReadOnly()) return false
			const buffer: Batch = {ops: [], refused: false}
			pending = buffer
			try {
				fn()
			} finally {
				pending = undefined
			}
			if (buffer.refused) return false
			if (buffer.ops.length === 0) return true
			return dispatch(buffer.ops)
		},
	}
}

/** Half-open overlap: two zero-length inserts at the same offset do NOT overlap. */
function overlaps(a: Op, b: Op): boolean {
	return a.start < b.end && b.start < a.end
}

/**
 * Liveness is reachability from the roots. Nodes carry no dead flag and no parent
 * link, so short of widening the node shape this walk is the check; it is O(tree)
 * against a commit that parses and adopts the whole document anyway.
 */
function reachable(nodes: readonly TreeNode[], node: TreeNode): boolean {
	return nodes.some(child => child === node || (child.kind === 'mark' && reachable(child.children(), node)))
}