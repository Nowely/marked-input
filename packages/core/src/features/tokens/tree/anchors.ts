import type {Anchors, MarkNode, NodeAnchor, RowNode, TextNode, TreeNode} from './types'

/**
 * Right-affinity resolution: the last text node (document order) containing the offset.
 *
 * ONE reading, no `side` parameter, and that is a parser invariant rather than a preference:
 * every non-text node's START offset is covered by a text node, so the fallback below can
 * only ever answer for an INTERIOR or an END, where no second reading exists. `TreeBuilder`
 * emits a text token immediately before every match, at every nesting level
 * (`buildSinglePass`: `roots.push` / `container.token.children.push` of
 * `createTextToken(textPos, match.start)`), so a mark's start is always the end of its
 * preceding sibling; `RowBuilder.groupRows` forces a row's first child to be a text token
 * starting at the row's own start; and `adopt` pairs one node per token in token order, so
 * the live tree keeps the parse's shape.
 */
export function anchorAt(roots: readonly TreeNode[], offset: number): NodeAnchor {
	let text: {node: TextNode; offset: number} | undefined
	let owner: MarkNode | RowNode | undefined
	const visit = (nodes: readonly TreeNode[]): void => {
		for (const node of nodes) {
			// Sibling positions ascend, so the first node starting past the offset ends the
			// scan; earlier siblings still run, which is what keeps later-wins intact.
			if (node.position.start > offset) break
			if (offset > node.position.end) continue
			if (node.kind === 'text') {
				text = {node, offset: offset - node.position.start}
			} else {
				owner = node
				visit(node.children())
			}
		}
	}
	visit(roots)
	if (text) return text
	// A mark interior is not anchorable (spec §2.3), so a slotless mark answers with its
	// boundary — and a row's separator span answers the same way: no text covers it, so the
	// row itself does, failing closed exactly like a block row's trailing `\n\n` always has.
	// `{after}` unconditionally: an owner's own START never reaches here (see above), and the
	// interior and the end have no second reading.
	if (owner) return {after: owner}
	return offset <= 0 ? 'start' : 'end'
}

/**
 * The inverse of {@link anchorAt}: an anchor's absolute offset in the TREE's projection.
 *
 * Tree space, deliberately — not `value.current()`, which is props-first in controlled
 * mode. The two disagree exactly while a parent's `props.value` is ahead of the last
 * arrival, and `selectionBefore` must be captured in the space `map` consumes (spec D7).
 *
 * `'end'` is the last root's end rather than a length, so an out-of-range intent
 * self-limits without arithmetic — that is what replaces the deleted selection clamp
 * (spec §4.6 item 5).
 */
export function offsetOfAnchor(roots: readonly TreeNode[], anchor: NodeAnchor): number {
	if (anchor === 'start') return 0
	if (anchor === 'end') return roots.length > 0 ? roots[roots.length - 1].position.end : 0
	if ('node' in anchor) return anchor.node.position.start + anchor.offset
	if ('before' in anchor) return anchor.before.position.start
	return anchor.after.position.end
}

/**
 * The mark whose own boundary sits exactly ON `anchor`: the one ENDING there for `-1`, the
 * one STARTING there for `+1`. NESTED-FIRST, so an inner mark wins over an enclosing one at
 * a shared boundary — the order `keyboard/input.ts`'s token walk had before it moved here.
 *
 * Offsets, deliberately: adjacency IS an equality between an anchor's resolved position and
 * a mark's stored boundary, and `tree/` is the one layer where that arithmetic is legal
 * (spec S2 D1). Its consumers — the Backspace/Delete mark swallow and `insertMark`'s "which
 * mark did that splice create" — name nodes on both sides.
 */
export function adjacentMark(roots: readonly TreeNode[], anchor: NodeAnchor, direction: -1 | 1): MarkNode | undefined {
	const offset = offsetOfAnchor(roots, anchor)
	const visit = (nodes: readonly TreeNode[]): MarkNode | undefined => {
		for (const node of nodes) {
			if (node.kind === 'text') continue
			const nested = visit(node.children())
			if (nested) return nested
			if (node.kind !== 'mark') continue
			if (direction === -1 ? node.position.end === offset : node.position.start === offset) return node
		}
		return undefined
	}
	return visit(roots)
}

/**
 * The ROW SEPARATOR a collapsed delete at `anchor` removes, as the anchors spanning it —
 * {@link adjacentMark}'s swallow for the row world. `undefined` when the anchor sits at no row
 * boundary, which is EVERY anchor in inline layout: only a block parse builds RowNodes, so the
 * arm is inert there by construction rather than by a layout test.
 *
 * It exists because {@link stepAnchor} cannot express this edit: a separator is the row's
 * `terminator`, it has no anchorable interior, and a step into it fails closed. Removing the
 * whole span IS the row merge — reparse decides what the joined text becomes (issue 08's
 * markdown-like policy), which is the same answer `RowNode.mergeWith` gives.
 *
 * ASYMMETRIC, and that asymmetry is block layout's own long-standing answer rather than an
 * oversight. Backspace takes only the separator ENDING at the anchor, so at a row's content end
 * it still deletes the character before it. Delete takes that one too, ahead of the separator
 * STARTING at the anchor: Delete pressed at a row START merges that row into the previous one
 * (`Drag.spec`'s 'Delete at start of row'), and the earlier-row reading is what an empty row
 * between two separators needs to keep answering the row before it.
 */
export function separatorSpan(roots: readonly TreeNode[], anchor: NodeAnchor, direction: -1 | 1): Anchors | undefined {
	const offset = offsetOfAnchor(roots, anchor)
	// The document-final row owns no separator, so it can never be the one removed here.
	const terminated = roots.filter((root): root is RowNode => root.kind === 'row' && root.terminator !== '')
	const row =
		terminated.find(candidate => candidate.position.end === offset) ??
		(direction === 1
			? terminated.find(candidate => candidate.position.end - candidate.terminator.length === offset)
			: undefined)
	if (!row) return undefined
	// A row's children end with a TEXT token by the parser's edge invariant
	// (`RowBuilder.groupRows`), so its content end is anchorable and {@link anchorAt} round-trips
	// on it; the head is the row's own trailing edge, which sits past the separator.
	return {anchor: anchorAt(roots, row.position.end - row.terminator.length), head: {after: row}}
}

/**
 * The single-character step in document order, or `undefined` when there is nothing to step
 * onto. The keyboard's "delete one character" fallback, which was `{start - 1, start}` on
 * raw offsets until S2.5.
 *
 * FAILS CLOSED on an unanchorable neighbour, and that is the one deliberate behavior change:
 * a position inside a mark's MARKUP (the `{` of `#[v]{inner}`, a block row's trailing
 * `\n\n`) is not anchorable, so {@link anchorAt} answers with the mark's own boundary
 * instead. The old numeric step spliced that position anyway and re-parsed the mark into
 * plain text; answering `undefined` leaves the browser default, which at the edge of a
 * `contenteditable` surface does nothing. The round-trip check is what detects it —
 * {@link anchorAt} is right-affine and does not invert.
 */
export function stepAnchor(roots: readonly TreeNode[], anchor: NodeAnchor, direction: -1 | 1): NodeAnchor | undefined {
	const offset = offsetOfAnchor(roots, anchor) + direction
	if (offset < 0 || offset > offsetOfAnchor(roots, 'end')) return undefined
	const stepped = anchorAt(roots, offset)
	return offsetOfAnchor(roots, stepped) === offset ? stepped : undefined
}

/**
 * Identity of an anchor: the node OBJECT plus the local offset. This is what the stored
 * selection dedupes on — the DOM sync rebuilds anchors on every `selectionchange`, and
 * without value equality every sweep tick would re-place the caret.
 */
export function anchorEquals(a: NodeAnchor | undefined, b: NodeAnchor | undefined): boolean {
	if (a === b) return true // covers undefined and the two string edges
	if (a === undefined || b === undefined || typeof a === 'string' || typeof b === 'string') return false
	if ('node' in a) return 'node' in b && a.node === b.node && a.offset === b.offset
	if ('before' in a) return 'before' in b && a.before === b.before
	return 'after' in b && a.after === b.after
}