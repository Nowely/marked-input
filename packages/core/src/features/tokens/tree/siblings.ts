import {sliceNodes} from './tree'
import type {NodeAnchor, Pairing, TreeNode, Window} from './types'

/**
 * Removing the boundary between two adjacent ROWS, expressed as a REPLACEMENT OF THE FIRST:
 * the boundary is the first row's separator, and deleting it is the whole merge — reparse
 * decides what the joined text becomes (issue 08's markdown-like policy: a paragraph merging
 * into a heading is absorbed by its trailing slot). No kind gate on the merged CONTENT and no
 * descriptor to compare: any adjacent rows merge.
 *
 * `undefined` when the pair has no boundary to remove, fail-closed: either side is not a row
 * (only rows carry a separator), the first row is unterminated, or the two are not actually
 * adjacent. The last cannot arise from a parse — roots TILE the document — and is checked
 * rather than assumed so a caller cannot splice across a gap it never looked at.
 */
export function mergePlan(
	roots: readonly TreeNode[],
	node: TreeNode,
	next: TreeNode
): {kept: string; at: number} | undefined {
	if (node.kind !== 'row' || next.kind !== 'row') return undefined
	if (node.terminator === '') return undefined
	if (node.position.end !== next.position.start) return undefined
	// The caret goes where the two halves join, which is the first row's content end in the
	// PRE-splice coordinates — the caller resolves it against the post-splice tree.
	const contentEnd = node.position.end - node.terminator.length
	const kept = sliceNodes(roots, {before: node}, {after: node}).slice(0, contentEnd - node.position.start)
	return {kept, at: contentEnd}
}
/**
 * Moving a root to another root index, as ONE splice over the affected span plus the
 * {@link Pairing} that says which sibling went where. Roots outside
 * `[min(from,to), max(from,to)]` are not touched, so the splice is as narrow as a rotation can
 * be.
 *
 * `undefined` — fail closed — when the node is not a root (`indexOf` is the liveness check and
 * the index in one read, so there is no second `reachable`), when `to` is out of range or equal
 * to `from`, or when the affected roots do not TILE. The last cannot come from a parse and is
 * checked rather than assumed, because the splice re-emits the span from those roots alone:
 * any text between them would be silently dropped.
 *
 * The pairing spans the WHOLE root list, not just the moved span — `resolvePairing` needs a
 * total bijection over the roots, and the untouched ones are the identity part of it.
 */
export function movePlan(
	roots: readonly TreeNode[],
	node: TreeNode,
	to: number
): {window: Window; text: string} | undefined {
	const from = roots.indexOf(node)
	if (from < 0) return undefined
	if (!Number.isInteger(to) || to < 0 || to >= roots.length || to === from) return undefined

	const low = Math.min(from, to)
	const high = Math.max(from, to)
	for (let index = low; index < high; index++) {
		if (roots[index].position.end !== roots[index + 1].position.start) return undefined
	}

	const rotate = <T>(items: readonly T[]): T[] => {
		const next = [...items]
		next.splice(to - low, 0, ...next.splice(from - low, 1))
		return next
	}

	const span = rotate(roots.slice(low, high + 1))

	// ROW NORMALIZATION (issue 08's movePlan × terminated guard): a verbatim join would
	// carry the document-final row's MISSING separator into the middle — fusing it with
	// its new right neighbour — and leave a separator on whichever row lands final. Every
	// re-emitted row gets a terminator except the one landing document-final; the
	// separator text comes from any terminated sibling, since it is one editor-level
	// setting. Fail closed when a terminator is needed and none exists to copy — with two
	// or more rows the first is always terminated, so that door is a corrupted tree.
	const separator = roots.find(root => root.kind === 'row' && root.terminator !== '')
	const separatorText = separator?.kind === 'row' ? separator.terminator : undefined
	const spanEndsDocument = high === roots.length - 1

	const serialize = (node: TreeNode, indexInSpan: number): string | undefined => {
		const raw = sliceNodes(roots, {before: node}, {after: node})
		if (node.kind !== 'row') return raw
		const content = node.terminator === '' ? raw : raw.slice(0, raw.length - node.terminator.length)
		if (spanEndsDocument && indexInSpan === span.length - 1) return content
		if (node.terminator !== '') return raw
		if (separatorText === undefined) return undefined
		return content + separatorText
	}

	const parts: string[] = []
	for (const [indexInSpan, spanNode] of span.entries()) {
		const part = serialize(spanNode, indexInSpan)
		if (part === undefined) return undefined
		parts.push(part)
	}
	const text = parts.join('')
	const pairing: Pairing = [
		...roots.slice(0, low).map((_, index) => index),
		...rotate(roots.slice(low, high + 1).map((_, index) => low + index)),
		...roots.slice(high + 1).map((_, index) => high + 1 + index),
	]

	const window: Window = {
		start: roots[low].position.start,
		end: roots[high].position.end,
		insertedLength: text.length,
		pairing,
	}
	return {window, text}
}
/**
 * Where the caret ENTERS a node: inside its slot when it has one, else at the node's start.
 *
 * ONE rule, replacing three that disagreed about a freshly inserted node (backlog issue 04):
 * two of them answered the node's start and one answered past its end, and on a markup with a
 * literal prefix the start is several characters away from anywhere typing is legal.
 *
 * The slot's first text child, not the slot RANGE: a slot always parses with at least one text
 * child, and an anchor names a node rather than a coordinate.
 */
export function entryAnchor(node: TreeNode): NodeAnchor {
	if (node.kind === 'row') {
		const children = node.children()
		// `.at`, not `[]`: `noUncheckedIndexedAccess` is off, so an index read types as
		// non-nullable and the empty-children guard would be linted away as impossible.
		const first = children.at(0)
		// A row OPENING with a mark (its leading text is zero-width) enters through that
		// mark — for a fresh '# ' heading row the first legal typing position is inside
		// the heading's slot, not before its literal (backlog issue 04's rule, one level up).
		if (first?.kind === 'text' && first.position.start === first.position.end) {
			const second = children.at(1)
			if (second?.kind === 'mark') return entryAnchor(second)
		}
		if (first?.kind === 'text') return {node: first, offset: 0}
	}
	if (node.kind === 'mark' && node.descriptor.hasSlot) {
		const first = node.children().at(0)
		if (first?.kind === 'text') return {node: first, offset: 0}
	}
	return {before: node}
}