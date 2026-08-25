import type {MarkupDescriptor} from '../parser/core/MarkupDescriptor'
import {depthCeiling} from '../parser/core/RowScanner'
import type {RowConfig} from '../parser/types'
import {offsetOfAnchor, rowBoundary} from './anchors'
import {preorderRows} from './rows'
import {rowContent, rowLine, rowMarkup} from './tree'
import type {NodeAnchor, Pairing, RowNode, RowPatch, RowPlacement, TreeNode, Window} from './types'

/**
 * Removing the boundary between two rows, as the window that holds them apart — see
 * {@link rowBoundary} for what is in it. Deleting it is the whole merge; reparse decides what the
 * joined text becomes (issue 08's markdown-like policy). No kind gate on the merged CONTENT: any
 * adjacent rows merge, and the survivor keeps the FIRST row's kind because the second row's
 * opener is part of the boundary.
 *
 * ADJACENT IN PRE-ORDER, not in the root list, and the difference is the whole of nesting: a
 * parent's boundary is with its FIRST CHILD, whose span starts inside the parent's own. Reading
 * the spans as `node.position.end === next.position.start` refused every parent/child pair, which
 * is every Backspace at the start of an indented row.
 *
 * `undefined` when the pair has no boundary to remove, fail-closed: either side is not a row
 * (only rows are separated), there is no configured separator, or the two are not actually
 * adjacent. The last is checked rather than assumed so a caller cannot splice across a gap it
 * never looked at, and the pre-order lookup is the liveness check with it.
 */
export function mergePlan(
	roots: readonly TreeNode[],
	node: TreeNode,
	next: TreeNode,
	separator: string | undefined
): {start: number; end: number} | undefined {
	if (node.kind !== 'row' || next.kind !== 'row') return undefined
	if (separator === undefined) return undefined
	const rows = preorderRows(roots)
	const at = rows.findIndex(entry => entry.row === node)
	if (at < 0 || rows[at + 1]?.row !== next) return undefined
	return rowBoundary(node, next, separator)
}

/**
 * The removal window of a row whose SUBTREE ENDS THE DOCUMENT, whose own span is not the whole
 * story: it owns no separator, so deleting only its span would convert it into the trailing empty
 * row and leave the boundary before it dangling — the row count could never shrink (issue 08
 * review finding). `undefined` everywhere else: any earlier row's span already includes its own
 * separator, and non-rows keep the plain structural splice.
 *
 * {@link endsDocument} and not "is the last row in pre-order": a removal takes the row's whole
 * SUBTREE, so an ANCESTOR of the last row carries no trailing separator either, and testing only
 * the leaf left the last root with children splicing its bare span — `'a⏎b⏎⇥c'` minus `b` emitted
 * `'a⏎'` and gained an empty row instead of losing one.
 */
export function removePlan(
	roots: readonly TreeNode[],
	node: TreeNode,
	separator: string | undefined
): {start: number; end: number} | undefined {
	if (node.kind !== 'row' || separator === undefined) return undefined
	// The walk is the finality test and the liveness check in one read, as `roots.indexOf` was.
	if (!endsDocument(roots, node)) return undefined
	// Nothing precedes the document's first row, so there is no boundary to take with it.
	if (preorderRows(roots)[0]?.row === node) return undefined
	// The boundary that leaves is the separator BEFORE the row rather than a previous SIBLING's
	// trailing one: the pre-order join puts one between every adjacent pair at every depth, so
	// the row a nested final row is preceded by may be its own parent.
	return {start: node.position.start - separator.length, end: node.position.end}
}

/**
 * Does this row's SUBTREE end the document — the rows whose projection carries no trailing
 * separator, since the pre-order join puts one between adjacent rows and none after the last.
 * True for the last row AND for every ancestor of it, which is why it is not "the last root":
 * under nesting a whole chain of rows ends the document at once.
 *
 * Asked of the pre-order WALK and not of the spans, because the trailing empty row is
 * zero-width: the row before it ends at the document's end too, and a span test calls it final.
 *
 * A non-row answers `false` without a guard of its own: the walk skips it and never descends, so
 * its own walk is empty and matches no last row.
 */
export function endsDocument(roots: readonly TreeNode[], node: TreeNode): boolean {
	const last = preorderRows(roots).at(-1)?.row
	return last !== undefined && preorderRows([node]).at(-1)?.row === last
}

/**
 * Moving a row AND ITS SUBTREE to a {@link RowPlacement}, as ONE splice over the pre-order LINES
 * whose bytes actually change, plus the {@link Pairing} that says which row went where.
 *
 * The whole plan lives in ONE coordinate space: the pre-order row list, whose lines tile the
 * value with a separator between every adjacent pair. A subtree is a contiguous RUN in it, so a
 * move is "cut this run, paste it before that index", the destination reduces to a single
 * pre-order position, and there is no common ancestor to find — the narrowest splice is the
 * narrowest changed range of lines, which is tighter than the ancestor's span whenever the
 * ancestor has untouched children before or after the move.
 *
 * TWO things change bytes, and the affected range is the union: a line where a DIFFERENT row now
 * sits, and a moved row whose LEAD is rewritten. The re-lead is `indent.repeat(depth)` rather
 * than the old lead shifted, for {@link depthPlan}'s reason plus one the mover adds: a surplus
 * indent run carried into a destination with a deeper ceiling would land the row at the surplus
 * depth instead of the requested one, so preserving those bytes cannot express the placement.
 *
 * `undefined` — fail closed — for a non-row, a dead row on either end (the pre-order lookup is
 * that check for both), a PLACEMENT INSIDE THE MOVED SUBTREE, an index outside the destination's
 * child list, a no-op, an editor with no separator to rejoin rows by, a nested placement with
 * nesting off, and a destination whose {@link depthCeiling} the moved row cannot reach. The last
 * one is "an empty row takes no children" read at both ends: nothing can be placed UNDER an empty
 * row, and a row carrying children cannot be re-led into an empty one.
 *
 * And one refusal that is about a row the caller never named: the row directly AFTER the span
 * re-parses against a new predecessor, so if its lead is SURPLUS — asking for more depth than the
 * clamp granted it — a splice that raises the ceiling above it would silently re-parent it. The
 * mover refuses instead of widening the span, because normalizing that row's lead rewrites bytes
 * outside the move and cascades into the row after it.
 *
 * The subtree test is the run, and it is the reason the run is computed before anything else: the
 * tree carries no parent pointers, so "is this parent inside what I am moving" has no answer
 * except "is its pre-order index in the moved run".
 *
 * The pairing spans EVERY pre-order row, not just the moved span — `resolvePairing` needs a total
 * bijection, and the untouched rows are the identity part of it.
 */
export function movePlan(
	roots: readonly TreeNode[],
	node: TreeNode,
	placement: RowPlacement,
	config: RowConfig | undefined
): {window: Window; text: string} | undefined {
	if (node.kind !== 'row' || config === undefined) return undefined
	const {separator, indent} = config
	const {parent, index} = placement
	// A nested placement has to be WRITTEN, and with no indent unit there is nothing to write it
	// with — every lead would be empty and every row a root.
	if (parent !== null && indent === '') return undefined

	const rows = preorderRows(roots)
	const from = rows.findIndex(entry => entry.row === node)
	if (from < 0) return undefined
	const span = preorderRows([node]).length

	let parentDepth = -1
	if (parent !== null) {
		const parentAt = rows.findIndex(entry => entry.row === parent)
		if (parentAt < 0) return undefined
		// THE refusal that keeps a move from eating the document: a row cannot become a
		// descendant of itself, and the run is where that question is answerable.
		if (parentAt >= from && parentAt < from + span) return undefined
		parentDepth = rows[parentAt].depth
	}
	const depth = parentDepth + 1
	// A moved row keeps its own subtree only while it stays NON-EMPTY, and the re-lead is what can
	// empty one: a blank row is non-empty only while it carries an indent. Written at depth 0 it
	// becomes the empty row {@link depthCeiling} gives no children, so every descendant the move
	// was carrying would be promoted out of it — `'a⏎⇥⏎⇥⇥b'` moving the blank row to a root
	// emitted `'a⏎⏎⇥b'`, where `b` is a root beside the row it travelled with. Refused, because a
	// depth-0 empty row with children is not a document that can be written.
	if (span > 1 && isEmptyRow(node, indent.repeat(depth))) return undefined

	// The destination's child rows WITHOUT the moved one, which is what makes `index` the position
	// the row takes after the move rather than a slot in a list it is still in.
	const siblings = (
		parent === null ? rows.filter(entry => entry.depth === 0).map(entry => entry.row) : parent.rows()
	).filter(row => row !== node)
	if (!Number.isInteger(index) || index < 0 || index > siblings.length) return undefined

	// Where the run lands, as a pre-order index in the CURRENT list: before the sibling that will
	// follow it, or past the whole subtree of the one it will follow.
	const preIndexOf = (row: RowNode): number => rows.findIndex(entry => entry.row === row)
	const before =
		index < siblings.length
			? preIndexOf(siblings[index])
			: siblings.length > 0
				? preIndexOf(siblings[index - 1]) + preorderRows([siblings[index - 1]]).length
				: parent === null
					? 0
					: preIndexOf(parent) + 1

	const kept = rows.map((_, at) => at).filter(at => at < from || at >= from + span)
	const at = kept.filter(old => old < before).length
	const run = Array.from({length: span}, (_, offset) => from + offset)
	// The claim itself: new pre-order row index → the previous row that becomes it.
	const order: Pairing = [...kept.slice(0, at), ...run, ...kept.slice(at)]

	const delta = depth - rows[from].depth

	// The scan's own ceiling, asked of the row the run will follow — see {@link fitsUnder}.
	if (!fitsUnder(at === 0 ? undefined : rows[kept[at - 1]], depth)) return undefined

	const moved = (old: number): boolean => old >= from && old < from + span
	const changed = (position: number): boolean =>
		order[position] !== position || (delta !== 0 && moved(order[position]))
	let low = 0
	while (low < order.length && !changed(low)) low++
	// A move that rewrites no line is the row already being where it was asked to go, and THIS is
	// the whole of that reading — an order comparison alone misses the re-indent, since outdenting
	// the last child to a root directly after its parent leaves the pre-order intact.
	if (low === order.length) return undefined
	let high = order.length - 1
	while (high > low && !changed(high)) high--

	// The row AFTER the span re-parses against a new predecessor while its own bytes stay put, and
	// a SURPLUS lead — one asking for more depth than the row was granted — is held down by the
	// ceiling above it alone. A splice that raises that ceiling re-parents a row nobody moved:
	// `'x⏎⏎⇥⇥b'` moving `x` below the blank row emitted `'⏎x⏎⇥⇥b'`, where the untouched root `b`
	// became `x`'s child. Refused rather than widened — normalizing that lead would rewrite a row
	// the caller never named, and the rewrite cascades into the row after THAT one.
	const follower = rows.at(high + 1)
	if (follower !== undefined && follower.row.lead() !== indent.repeat(follower.depth)) {
		const last = rows[order[high]]
		const landed = moved(order[high]) ? last.depth + delta : last.depth
		const lead = moved(order[high]) ? indent.repeat(landed) : last.row.lead()
		if (fitsUnder({row: last.row, depth: landed, lead}, follower.depth + 1)) return undefined
	}

	const lines = order
		.slice(low, high + 1)
		.map(old => rowLine(rows[old].row, moved(old) ? indent.repeat(rows[old].depth + delta) : undefined))
	// Every line but the document-final one carries a separator, and the span holds as many lines
	// as it did — so it ends with one exactly when the row it replaces did.
	const text = lines.join(separator) + (high < rows.length - 1 ? separator : '')

	const window: Window = {
		start: rows[low].row.lineRange().start,
		end: rows[high].row.lineRange().end,
		insertedLength: text.length,
		pairing: order,
	}
	return {window, text}
}

/**
 * Re-indenting one row, as the splice that REWRITES ITS WHOLE LEAD plus the {@link Pairing} that
 * keeps every row's identity across it.
 *
 * The pairing is the identity permutation and is still load-bearing: a Tab is an ordinary splice,
 * so without a hint adoption's prefix walk stops at the edit and the indented row's node — and
 * its text child — are rebuilt with fresh ids, taking the consumer's per-row state with them.
 * Pre-order is what makes the identity claim expressible at all, because the re-indent changes
 * which rows are nested where while leaving the document order alone.
 *
 * `undefined` — fail closed — for a non-row, a negative or non-integer depth, a no-op, an editor
 * with nesting off, and a depth the row before it does not {@link fitsUnder}. That last is the
 * SCAN's own clamp, asked of the scan rather than re-derived: asking for more would emit a lead
 * the parse reads as something shallower, and the row would gain an indent without gaining a
 * parent.
 *
 * It rewrites the whole lead rather than splicing it, which NORMALIZES a surplus indent run a
 * paste preserved — observable, and the alternative is two disagreeing readings of "depth".
 */
export function depthPlan(
	roots: readonly TreeNode[],
	node: TreeNode,
	depth: number,
	config: RowConfig | undefined
): {window: Window; text: string} | undefined {
	if (node.kind !== 'row' || config === undefined || config.indent === '') return undefined
	if (!Number.isInteger(depth) || depth < 0) return undefined

	const rows = preorderRows(roots)
	const at = rows.findIndex(entry => entry.row === node)
	if (at < 0) return undefined
	if (!fitsUnder(at === 0 ? undefined : rows[at - 1], depth)) return undefined

	const lead = config.indent.repeat(depth)
	if (lead === node.lead()) return undefined

	return {
		window: {
			start: node.position.start,
			end: node.position.start + node.lead().length,
			insertedLength: lead.length,
			pairing: rows.map((_, index) => index),
		},
		text: lead,
	}
}

/**
 * Retyping one row, as the splice over ITS OWN LINE BODY that rewrites only the bytes that
 * actually CHANGE.
 *
 * The line body is the bound, and both of its edges are load-bearing under nesting. It starts past
 * the LEAD, so a re-typed row keeps the indent that says where it sits. It ends at the row's own
 * content end — `position` would take the whole SUBTREE, which is how a retype comes to delete a
 * row's children, and the row's own line is exactly the bytes the projection emits for it.
 *
 * Inside that bound the window is TRIMMED to the shared prefix and suffix, and that is a caret
 * rule rather than an economy: `resolveMappedAnchor` collapses every offset INSIDE a window onto
 * the window's end, so a window spanning the body sent a caret in the middle of a retyped row to
 * the row's end — caret 1 of `'abcdef'` answered 8 after a heading retype. Trimming emits the same
 * value with the untouched body OUTSIDE the window, where the map shifts the caret by the delta
 * and the character it named stays named.
 *
 * NO {@link Pairing}: a pairing is refused when a pair's kinds disagree (`pairEquals`), which is
 * precisely what a retype changes. The row survives on adoption's own index pairing instead — a
 * row candidate adopts any row token, kind-blind, which is the mechanism ADR-0007 keeps for this.
 *
 * `undefined` — fail closed — for a non-row, a dead node (the pre-order lookup is that check) and
 * a no-op, which is what a row control re-selecting the value it already has looks like.
 */
export function turnIntoPlan(
	roots: readonly TreeNode[],
	node: TreeNode,
	descriptor: MarkupDescriptor | undefined,
	patch: RowPatch | undefined
): {window: Window; text: string} | undefined {
	if (node.kind !== 'row') return undefined
	if (!preorderRows(roots).some(entry => entry.row === node)) return undefined

	const meta = patch?.meta === null ? undefined : (patch?.meta ?? node.meta())
	const text = rowMarkup(descriptor, meta, patch?.text ?? node.slot())
	const current = rowMarkup(node.descriptor(), node.meta(), node.slot())
	if (text === current) return undefined

	const start = node.position.start + node.lead().length
	const head = sharedPrefix(current, text)
	const tail = sharedSuffix(current, text, head)
	return {
		window: {
			start: start + head,
			end: start + current.length - tail,
			insertedLength: text.length - head - tail,
		},
		text: text.slice(head, text.length - tail),
	}
}

/** Leading characters the two strings agree on. */
function sharedPrefix(a: string, b: string): number {
	let at = 0
	while (at < a.length && at < b.length && a[at] === b[at]) at++
	return at
}

/** Trailing characters the two strings agree on, never reaching back into the shared `prefix`. */
function sharedSuffix(a: string, b: string, prefix: number): number {
	let at = 0
	while (at < a.length - prefix && at < b.length - prefix && a[a.length - 1 - at] === b[b.length - 1 - at]) at++
	return at
}

/**
 * Splitting one row at an anchor in its own body, as ONE splice plus the PRE-ORDER index of the
 * row it produces.
 *
 * The window covers the row's LINE BODY AND ITS WHOLE SUBTREE, and re-emits the descendants
 * unchanged in the middle, because the tail row normally lands AFTER them. That placement is
 * forced by the encoding rather than preferred: a row written directly under this one at this
 * one's lead adopts every child it has, since nesting is indentation and nothing else. Re-emitting
 * the subtree also costs nothing in identity — the descendants sit at the same indices in the
 * row's child list, so adoption's index pairing carries every one of them.
 *
 * ONE EXCEPTION, and it is the same rule read at the other row: a head that empties keeps no
 * children, because `depthCeiling` gives an EMPTY row none. Written under it the descendants clamp
 * to depth 0 and the tail lands BELOW its own former children — `'ab⏎⇥c'` split at offset 0 emitted
 * `'⏎⇥c⏎ab'`, which un-nests `c` and reorders the document. So when the head's whole line would be
 * empty the subtree follows the TAIL, which is Enter at a row's start: an empty row above, and the
 * row with its children below it, intact.
 *
 * The tail's kind is the row's own when the kind `continues`, else a plain row; the caller reads
 * that field, because `tree/` knows a descriptor and not the option that declared it.
 *
 * `undefined` — fail closed — for a non-row, a dead node, an editor with no separator to split at,
 * and an anchor outside the row's own body.
 */
export function splitPlan(
	roots: readonly TreeNode[],
	node: TreeNode,
	at: NodeAnchor,
	separator: string | undefined,
	continues: boolean
): {window: Window; text: string; tail: number} | undefined {
	if (node.kind !== 'row' || separator === undefined) return undefined
	const rows = preorderRows(roots)
	const index = rows.findIndex(entry => entry.row === node)
	if (index < 0) return undefined

	const slot = node.slotRange()
	const offset = offsetOfAnchor(roots, at)
	if (offset < slot.start || offset > slot.end) return undefined

	const body = node.slot()
	const cut = offset - slot.start
	const children = node.rows()
	const descendants =
		children.length === 0 ? undefined : children.map(child => rowContent(child, separator)).join(separator)

	const head = rowMarkup(node.descriptor(), node.meta(), body.slice(0, cut))
	const tailLine =
		node.lead() +
		rowMarkup(continues ? node.descriptor() : undefined, continues ? node.meta() : undefined, body.slice(cut))
	const subtree = descendants === undefined ? '' : separator + descendants
	// The scan's own emptiness, asked of the head this split is about to write — see
	// {@link isEmptyRow} for the same test over a live row.
	const headKeepsChildren = node.lead() + head !== ''

	const text = headKeepsChildren ? head + subtree + separator + tailLine : head + separator + tailLine + subtree

	const start = node.position.start + node.lead().length
	// The subtree's last line carries a separator unless it ends the document, and the window
	// stops before it — the join puts one back between the tail and whatever follows.
	const end = node.position.end - (endsDocument(roots, node) ? 0 : separator.length)
	// The tail sits past the whole subtree, or directly after the head when the subtree followed it.
	const tail = index + (headKeepsChildren ? preorderRows([node]).length : 1)
	return {window: {start, end, insertedLength: text.length}, text, tail}
}

/**
 * The scan's own emptiness, read off the node: a row whose whole LINE is empty. The `lead` is a
 * parameter because a verb that REWRITES one changes the answer, and the row it is about to write
 * is the row the scan will read.
 */
function isEmptyRow(row: RowNode, lead: string = row.lead()): boolean {
	return lead === '' && row.descriptor() === undefined && row.slot() === ''
}

/**
 * Can a row sit at `depth` when it is written directly after `previous` — {@link depthCeiling}
 * asked of a pre-order entry, and the ONE owner of that question for every verb that writes a
 * lead. `undefined` is the document's first row, which is always a root.
 *
 * `previous` is read AS THE SPLICE LEAVES IT, which is why its `lead` is a parameter and its
 * `depth` is passed rather than trusted: a re-lead moves a row and can empty it, and the row the
 * scan will read back is the row the verb is about to write, not the one on the tree now.
 */
function fitsUnder(previous: {row: RowNode; depth: number; lead?: string} | undefined, depth: number): boolean {
	return depth <= depthCeiling(previous && {depth: previous.depth, empty: isEmptyRow(previous.row, previous.lead)})
}