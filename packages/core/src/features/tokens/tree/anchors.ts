import {preorderRows} from './rows'
import type {Anchors, MarkNode, NodeAnchor, RowNode, TextNode, TreeNode} from './types'

/**
 * Right-affinity resolution: the last text node (document order) containing the offset.
 *
 * ONE reading, no `side` parameter, and for INLINE content that is a parser invariant rather
 * than a preference: `TreeBuilder` emits a text token immediately before every match, at every
 * nesting level (`buildSinglePass`: `roots.push` / `container.token.children.push` of
 * `createTextToken(textPos, match.start)`), so a mark's start is always the end of its preceding
 * sibling, and `adopt` pairs one node per token in token order.
 *
 * A ROW is the one owner whose own start is NOT covered by a text child, because its opener is
 * structural rather than content: `'# Title'` has no text over offsets 0–1. Those offsets answer
 * the row's own body start — the first position a caret may legally occupy in that row — which
 * is what keeps `selection.selectAll`'s seed (`deps.anchorAt(0)`) at the top of the document
 * instead of at the end of the first heading.
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
	if (owner) {
		// A row's LEAD and OPENER are structural bytes no caret may enter, so an offset inside
		// them belongs at the row's body start rather than past the whole row.
		if (owner.kind === 'row' && offset < owner.slotRange().start) return entryAnchor(owner)
		// A mark interior is not anchorable (spec §2.3), so a slotless mark answers with its
		// boundary — and a row's separator span and closing literal answer the same way, failing
		// closed exactly like a row's trailing `\n\n` always has.
		return {after: owner}
	}
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
 * The ROW BOUNDARY a collapsed delete at `anchor` removes, as the anchors spanning it —
 * {@link adjacentMark}'s swallow for the row world. `undefined` when the anchor sits at no row
 * boundary, which is EVERY anchor in a document with no rows: only a row parse builds RowNodes,
 * so the arm is inert there by construction rather than by a mode test.
 *
 * THE BOUNDARY IS THE SEPARATOR PLUS EVERY STRUCTURAL BYTE BEFORE THE NEXT ROW'S CONTENT — its
 * LEAD, and its OPENER when it has one. None of them is text the joined row may keep: a merge
 * that took only the separator left the indent behind as text, and one that took lead but not
 * opener could not be named at all, because no anchor sits between the two. It walks PRE-ORDER
 * rows at every depth, because that is the order the join puts the separators in — a parent's
 * boundary is with its first child, not with its next sibling.
 *
 * It exists because {@link stepAnchor} cannot express this edit: the boundary has no anchorable
 * interior, and a step into it fails closed. Removing the whole span IS the row merge — reparse
 * decides what the joined text becomes (issue 08's markdown-like policy), which is the same
 * answer `RowNode.mergeWith` gives.
 *
 * ASYMMETRIC, and that asymmetry is the row model's own long-standing answer rather than an
 * oversight. Backspace takes only the boundary ENDING at the anchor, so at a row's content end
 * it still deletes the character before it. Delete takes that one too, ahead of the boundary
 * STARTING at the anchor: Delete pressed at a row START merges that row into the previous one
 * (`Drag.spec`'s 'Delete at start of row'), and the earlier-row reading is what an empty row
 * between two boundaries needs to keep answering the row before it.
 *
 * "Ending at the anchor" is the next row's CONTENT start, not its line start: for a typed row the
 * two differ by the opener, and the caret can only ever sit at the first of them — so matching on
 * the line start left a Backspace at a typed row's first position matching no boundary at all.
 */
export function boundarySpan(
	roots: readonly TreeNode[],
	anchor: NodeAnchor,
	direction: -1 | 1,
	separator: string | undefined
): Anchors | undefined {
	if (separator === undefined) return undefined
	const offset = offsetOfAnchor(roots, anchor)
	const rows = preorderRows(roots).map(entry => entry.row)
	// The document-final row is followed by nothing, so it can never open a boundary here —
	// structural now that the join, not the row, decides who carries a separator.
	const boundaries = rows.slice(0, -1).map((row, index) => rowBoundary(row, rows[index + 1], separator))
	const boundary =
		boundaries.find(candidate => candidate.end === offset) ??
		(direction === 1 ? boundaries.find(candidate => candidate.start === offset) : undefined)
	if (!boundary) return undefined
	return {anchor: anchorAt(roots, boundary.start), head: anchorAt(roots, boundary.end)}
}

/**
 * THE bytes between two rows adjacent in PRE-ORDER: the separator, the next row's LEAD and its
 * OPENER — everything before the next row's own content, and none of it text the joined row may
 * keep. Removing this span IS the row merge, which is why it is one function rather than a rule
 * written twice: {@link boundarySpan} and `RowNode.mergeWith` address the same boundary from
 * different ends, and answering differently is what let a Delete and a `mergeWith` at one
 * boundary produce two documents.
 *
 * The start is the first row's own content end: a row's line ends where its first child row
 * starts, or at its own span's end, and either way the separator is the last thing in it. The end
 * is the next row's SLOT start, which is exactly where its first inline child — the one
 * {@link entryAnchor} names — begins, so the caret has an anchor on both edges.
 */
export function rowBoundary(row: RowNode, next: RowNode, separator: string): {start: number; end: number} {
	return {start: row.lineRange().end - separator.length, end: next.slotRange().start}
}

/**
 * The single-character step in document order, or `undefined` when there is nothing to step
 * onto. The keyboard's "delete one character" fallback, which was `{start - 1, start}` on
 * raw offsets until S2.5.
 *
 * FAILS CLOSED on an unanchorable neighbour, and that is the one deliberate behavior change:
 * a position inside a mark's MARKUP (the `{` of `#[v]{inner}`, a row's trailing
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

/**
 * Where the caret ENTERS a node: inside its body when it has one, else at the node's start.
 *
 * ONE rule, replacing three that disagreed about a freshly inserted node (backlog issue 04):
 * two of them answered the node's start and one answered past its end, and on a markup with a
 * literal prefix the start is several characters away from anywhere typing is legal.
 *
 * The body's first text child, not its RANGE: a body always parses with at least one text child,
 * and an anchor names a node rather than a coordinate.
 *
 * Lives here rather than in `siblings.ts` because {@link anchorAt} asks it: a row's opener is
 * structural, so the offsets inside it resolve to the row's entry.
 */
export function entryAnchor(node: TreeNode): NodeAnchor {
	// A ROW has a body too, and one arm answers it: `children()` is INLINE-THEN-ROWS, so a row's
	// first child IS its first inline child — a caret entering a row belongs on that row's line,
	// and its child rows are separate rows with entries of their own.
	const hasBody = node.kind === 'row' || (node.kind === 'mark' && node.descriptor.hasSlot)
	// `.at`, not `[]`: `noUncheckedIndexedAccess` is off, so an index read types as
	// non-nullable and the empty-children guard would be linted away as impossible.
	const first = hasBody ? node.children().at(0) : undefined
	if (first?.kind === 'text') return {node: first, offset: 0}
	// A CARVED row has no inline child of its own: its first position is inside its first cell, and
	// the descent is recursive because that cell may be carved in turn.
	if (first?.kind === 'row') return entryAnchor(first)
	return {before: node}
}

/**
 * A row's own body with `span` CUT OUT of it — the body text a retype writes when the caller has
 * a span to remove in the same splice. The slash menu is that caller: it strips its own trigger
 * and applies a kind at once, because two verbs cannot compose in controlled mode.
 *
 * Anchors in, TEXT out, so the arithmetic stays here (ADR-0003): the caller holds a span it got
 * from a match and a row it got from {@link rowOf}, and neither of those is an offset.
 *
 * `undefined` — fail closed — for a span that is not inside this row's own body, which is
 * {@link splitPlan}'s rule read at the other end: a caret in another row cannot address this
 * one's content.
 */
export function slotWithout(roots: readonly TreeNode[], row: RowNode, span: Anchors): string | undefined {
	const slot = row.slotRange()
	const from = offsetOfAnchor(roots, span.anchor)
	const to = offsetOfAnchor(roots, span.head)
	if (from < slot.start || to > slot.end) return undefined
	const body = row.slot()
	return body.slice(0, from - slot.start) + body.slice(to - slot.start)
}