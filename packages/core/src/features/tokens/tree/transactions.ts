import {untracked} from '../../../shared/signals'
import type {Parser} from '../parser/Parser'
import {createTextToken} from '../parser/utils/createTextToken'
import {adopt} from './adopt'
import type {TokenTree} from './tree'
import type {CommitSink, TextNode, TransactionResult, TreeNode, Window} from './types'

/**
 * Uncontrolled commit policy (spec D5): parse the spliced projection — the parser
 * is the single semantic authority — and adopt the result into the persistent
 * nodes. The parser-less fallback mirrors `TokenModel#reparse`: with no markups
 * configured there is no Parser instance and the whole value is one text token.
 */
export function createUncontrolledSink(deps: {
	tree: TokenTree
	parser: () => Parser | undefined
	/** The `TransactionResult` feed (spec D9); its pipeline consumer arrives with S1.5. */
	onResult?: (result: TransactionResult) => void
}): CommitSink {
	return {
		commit(next, window) {
			const parser = deps.parser()
			const parsed = parser ? parser.parse(next) : [createTextToken(next)]
			// Adoption is the commit; it must not sit inside the optional call's argument,
			// which JS skips evaluating when no listener is registered.
			const result = adopt(deps.tree, window, parsed)
			deps.onResult?.(result)
			return true
		},
	}
}

/**
 * One splice in the coordinates of the COMMITTED projection. No `insertedLength`:
 * it is `text.length` for a single op and recomputed for a hull, so storing it
 * would only be a second place to get it wrong.
 */
type Op = {start: number; end: number; text: string}

/** The open `tx` buffer. `refused` latches the first refusal — see `refuse`. */
type Batch = {ops: Op[]; refused: boolean}

/**
 * The write path (spec §4.3): verbs lower an edit to a projection splice and hand
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
	 * applied (spec §6: overlapping ops reject the whole tx, no partial state).
	 */
	const refuse = (): false => {
		if (pending) pending.refused = true
		return false
	}

	const dispatch = (ops: readonly Op[]): boolean => {
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
		const window: Window = {start, end, insertedLength: end - start + (next.length - value.length)}

		// A splice that changes nothing still commits: `next === value` reaches the sink and
		// costs a parse plus an adoption. The uncontrolled sink absorbs it (adoption diffs to
		// no change), so nothing short-circuits here; the phase that adds the CONTROLLED sink
		// owns the decision of whether an unchanged value may still fire `onChange`. Current
		// behavior is pinned in transactions.spec.ts.
		dispatching = true
		try {
			// The dispatcher owns the no-subscription invariant for the whole commit, sink
			// and result consumer included — whichever sink is plugged in (D5).
			return untracked(() => deps.sink.commit(next, window))
		} finally {
			dispatching = false
		}
	}

	const submit = (op: Op): boolean => {
		if (isReadOnly()) return refuse()
		if (op.start < 0 || op.end < op.start || op.end > currentValue().length) return refuse()
		if (!pending) return dispatch([op])
		if (pending.ops.some(other => overlaps(op, other))) return refuse()
		pending.ops.push(op)
		return true
	}

	return {
		/** The primitive (spec D5): a splice in the committed projection's coordinates. */
		applyRange(window: Window, text: string): boolean {
			assertIdle()
			// `window.insertedLength` is ignored: what we are about to splice in is the truth.
			return submit({start: window.start, end: window.end, text})
		},

		/** Node-local coordinates → global window. Single-node edits (spec D5). */
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

		/** Whole-node replacement (spec D5): mark update/remove, serialized by the caller. */
		applyStructural(target: TreeNode, replacement: string): boolean {
			assertIdle()
			if (!isLive(target)) return refuse()
			return submit({start: target.position.start, end: target.position.end, text: replacement})
		},

		/**
		 * Composition (spec D5): buffer the verbs, commit once, adopt once with the hull
		 * window (identity precision inside the hull degrades to middle pairing).
		 *
		 * Op coordinates stay in the COMMITTED projection's space rather than remapping
		 * through the accumulated offsets D5 describes: nothing commits until the end, so
		 * node positions — which is where `applyText`/`applyStructural` get their
		 * coordinates — never move mid-`tx`. Remapping would silently break exactly those
		 * verbs. Disjointness is what makes the two readings equivalent, and overlapping
		 * ops are rejected anyway.
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