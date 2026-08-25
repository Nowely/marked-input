import type {MarkupDescriptor} from '../parser/core/MarkupDescriptor'
import {depthCeiling} from '../parser/core/RowScanner'
import type {RowConfig} from '../parser/types'
import {anchorEquals, entryAnchor, offsetOfAnchor, rowBoundary} from './anchors'
import {hasCells, preorderRows} from './rows'
import {rowContent, rowLine, rowMarkup} from './tree'
import type {AnchoredRow, NodeAnchor, Pairing, RowNode, RowPatch, RowPlacement, TreeNode, Window} from './types'

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
 * THE ROW AN ANCHOR SITS IN — the innermost one containing the node the anchor names — with the
 * facts about it a keybinding cannot ask for itself: its depth, the depth a row written directly
 * under it would land at, whether the anchor is that row's own entry, and the row it is nested in.
 * The last one is the walk's own by-product — the tree carries no parent pointers, so a caller
 * asking for it separately would be a second walk.
 *
 * Node identity rather than an offset, and that is the whole reason it is a walk: two rows share a
 * boundary offset at every nesting level, so a positional answer would have to pick a side, while
 * the node an anchor names belongs to exactly one row.
 *
 * `undefined` for a document that parses no rows, for a node no longer in the tree, and for the
 * `'start'`/`'end'` edges — which name a document rather than a row, and every caller here has a
 * live caret or nothing.
 */
export function rowOf(roots: readonly TreeNode[], anchor: NodeAnchor): AnchoredRow | undefined {
	if (typeof anchor === 'string') return undefined
	const target = 'node' in anchor ? anchor.node : 'before' in anchor ? anchor.before : anchor.after

	const search = (
		nodes: readonly TreeNode[],
		depth: number,
		inside: {row: RowNode; depth: number; parent: RowNode | undefined} | undefined
	): {row: RowNode; depth: number; parent: RowNode | undefined} | undefined => {
		for (const node of nodes) {
			const here = node.kind === 'row' ? {row: node, depth, parent: inside?.row} : inside
			if (node === target) return here
			if (node.kind === 'text') continue
			const found = search(node.children(), node.kind === 'row' ? depth + 1 : depth, here)
			if (found) return found
		}
		return undefined
	}

	const found = search(roots, 0, undefined)
	if (!found) return undefined
	return {
		...found,
		childDepth: depthCeiling(scannedAs(found.row, found.depth)),
		atEntry: anchorEquals(anchor, entryAnchor(found.row)),
	}
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
 * nesting off, and — the one answer that covers the rest — a splice the SCAN would read back as a
 * different tree, which is asked by replaying the scan over the span the splice rewrites.
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

	// This one walk is what THREE separate refusals reduce to: the destination's own ceiling (the
	// moved root asks for `depth` and must be granted it), a moved row re-led to `''` and thereby
	// emptied, which takes the children the move was carrying — `'a⏎⇥⏎⇥⇥b'` emitted `'a⏎⏎⇥b'` — and
	// an untouched row re-parenting under a ceiling the splice raised: `'x⏎⏎⇥⇥b'` emitted
	// `'⏎x⏎⇥⇥b'`, where the root `b` became `x`'s child.
	const written = (position: number): Written => {
		const entry = rows[order[position]]
		const landed = moved(order[position]) ? entry.depth + delta : entry.depth
		return {
			row: entry.row,
			depth: landed,
			lead: moved(order[position]) ? indent.repeat(landed) : entry.row.lead(),
		}
	}
	if (!scanAgrees(rows, low, high, written, indent)) return undefined

	const text = spliceLines(rows, low, high, written, separator)

	const window: Window = {
		start: rows[low].row.lineRange().start,
		end: rows[high].row.lineRange().end,
		insertedLength: text.length,
		pairing: order,
	}
	return {window, text}
}

/**
 * Re-indenting one row, as the splice that REWRITES ITS OWN LEAD AND ITS SUBTREE'S plus the
 * {@link Pairing} that keeps every row's identity across it.
 *
 * THE SUBTREE TRAVELS, and it has to be written for that to happen: nesting is indentation and
 * nothing else, so a child left at its old lead is measured against a parent that moved and lands
 * somewhere else — indenting `'a⏎b⏎⇥c'`'s middle row emitted `'a⏎⇥b⏎⇥c'`, where `c` stopped being
 * `b`'s child and became its sibling. Every descendant is therefore re-led by the same depth delta,
 * exactly as {@link movePlan} re-leads what it carries.
 *
 * The pairing is the identity permutation and is still load-bearing: a Tab is an ordinary splice,
 * so without a hint adoption's prefix walk stops at the edit and the indented row's node — and
 * its text child — are rebuilt with fresh ids, taking the consumer's per-row state with them.
 * Pre-order is what makes the identity claim expressible at all, because the re-indent changes
 * which rows are nested where while leaving the document order alone.
 *
 * `undefined` — fail closed — for a non-row, a negative or non-integer depth, a no-op, an editor
 * with nesting off, and — the one answer the rest reduce to — a splice the SCAN would read back as
 * a different tree, which is {@link scanAgrees} replaying it over the lines this rewrites plus the
 * row after them. That covers the row's own clamp (asking for more than the row above grants would
 * emit a lead the parse reads as something shallower), a row re-led to `''` on a blank body, which
 * EMPTIES it so it can no longer carry the children it had, and an untouched row after the subtree
 * re-parenting under a ceiling this splice raised — `'x⏎⏎⇥⇥b'` with the blank row indented emitted
 * `'x⏎⇥⏎⇥⇥b'`, where the root `b` landed two levels down as a grandchild.
 *
 * It rewrites whole leads rather than splicing them, which NORMALIZES a surplus indent run a paste
 * preserved — observable, and the alternative is two disagreeing readings of "depth".
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
	if (config.indent.repeat(depth) === node.lead()) return undefined

	const delta = depth - rows[at].depth
	const high = at + preorderRows([node]).length - 1
	const written = (position: number): Written => {
		const entry = rows[position]
		const carried = position >= at && position <= high
		const landed = carried ? entry.depth + delta : entry.depth
		return {row: entry.row, depth: landed, lead: carried ? config.indent.repeat(landed) : entry.row.lead()}
	}
	if (!scanAgrees(rows, at, high, written, config.indent)) return undefined

	const text = spliceLines(rows, at, high, written, config.separator)
	return {
		window: {
			start: rows[at].row.lineRange().start,
			end: rows[high].row.lineRange().end,
			insertedLength: text.length,
			pairing: rows.map((_, index) => index),
		},
		text,
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
	// A CARVED row has no subtree to place: its child rows are the body this split is cutting, and
	// both halves carry their own share of them.
	const children = hasCells(node) ? [] : node.rows()
	const descendants =
		children.length === 0 ? undefined : children.map(child => rowContent(child, separator)).join(separator)

	const head = rowMarkup(node.descriptor(), node.meta(), body.slice(0, cut))
	const tailLine =
		node.lead() +
		rowMarkup(continues ? node.descriptor() : undefined, continues ? node.meta() : undefined, body.slice(cut))
	const subtree = descendants === undefined ? '' : separator + descendants
	// The scan's own emptiness, asked of the head this split is about to write — see
	// {@link scannedAs} for the same test over a row a verb is about to emit.
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
 * ONE LINE A SPLICE IS ABOUT TO WRITE: which row sits at that pre-order position, the depth the
 * plan intends it to land at, and the lead bytes it is written with. A row the splice merely
 * re-emits carries its own lead and its own depth; a row it re-indents carries `indent.repeat` of
 * where it is going.
 */
type Written = {row: RowNode; depth: number; lead: string}

/**
 * THE SCAN, replayed over the lines `low..high` rewrite plus the row after them: does every row in
 * that stretch land where the plan intends it to?
 *
 * Every line in the span is re-emitted and the row after it meets a new predecessor, so `high + 1`
 * is where the replay stops; past that every row's predecessor is unchanged and so is its parse.
 * A rewritten row is written at its own new depth, but an untouched one keeps its bytes — and a
 * SURPLUS lead, one asking for more depth than the clamp granted, is held at its depth by the row
 * above it and by nothing else.
 *
 * ONE owner for both verbs that write a lead: a move and a re-indent differ in which rows they put
 * where, not in what the scan will make of the result, and answering that question twice is how a
 * fix for one of them leaves the other with the hole ({@link depthPlan}'s own history).
 *
 * A false answer is a REFUSAL rather than a widening, and that is the declared choice: normalizing
 * some other row's lead rewrites bytes outside the edit, and it cascades — a lead normalized to
 * `''` on a blank body empties THAT row and moves the ceiling again for the row after it.
 */
function scanAgrees(
	rows: readonly {row: RowNode; depth: number}[],
	low: number,
	high: number,
	written: (position: number) => Written,
	indent: string
): boolean {
	let previous = low === 0 ? undefined : scannedAs(rows[low - 1].row, rows[low - 1].depth)
	for (let position = low; position <= Math.min(high + 1, rows.length - 1); position++) {
		const line = written(position)
		if (landsAt(previous, leadDepth(line.lead, indent)) !== line.depth) return false
		previous = scannedAs(line.row, line.depth, line.lead)
	}
	return true
}

/**
 * The LINES `low..high` re-emits, joined. Every line but the document-final one carries a
 * separator, and a splice holds as many lines as it replaces — so it ends with one exactly when
 * the last line it replaces did.
 */
function spliceLines(
	rows: readonly {row: RowNode; depth: number}[],
	low: number,
	high: number,
	written: (position: number) => Written,
	separator: string
): string {
	const lines: string[] = []
	for (let position = low; position <= high; position++) {
		const line = written(position)
		lines.push(rowLine(line.row, line.lead))
	}
	return lines.join(separator) + (high < rows.length - 1 ? separator : '')
}

/**
 * A row AS THE SCAN WILL READ IT once it is written at `depth` carrying `lead`: the depth it landed
 * at, and whether its whole LINE is empty. Both are parameters rather than reads off the node,
 * because a verb that re-leads a row changes both, and the row the scan reads back is the one the
 * verb is about to write — a blank row is non-empty only while it carries an indent.
 *
 * Emptiness is asked of the LINE BYTES, through the projection's own {@link rowLine}, and that is
 * the point: `scanRows` reads it as `contentEnd === at` over the same bytes, and the field-wise
 * restatement it used to carry (`lead === '' && descriptor === undefined && slot === ''`) was a
 * second implementation of a rule {@link rowLine} already owns — exactly what `splitPlan` compares
 * for the head it is about to write. It costs one line build per replayed row, which is the
 * same build {@link spliceLines} makes for every line in the window anyway.
 */
function scannedAs(row: RowNode, depth: number, lead: string = row.lead()): {depth: number; childless: boolean} {
	return {depth, childless: rowLine(row, lead) === '' || hasCells(row)}
}

/** The depth a LEAD asks for — `RowScanner`'s own division, over bytes not yet in the value. */
function leadDepth(lead: string, indent: string): number {
	return indent === '' ? 0 : lead.length / indent.length
}

/**
 * The depth a row LANDS at when its lead asks for `asked` and it is written directly after a row
 * the scan read as `previous` — {@link depthCeiling}'s clamp, and the ONE owner of that question
 * for every verb that writes a lead. `undefined` is the document's first row, always a root.
 */
function landsAt(previous: {depth: number; childless: boolean} | undefined, asked: number): number {
	return Math.min(asked, depthCeiling(previous))
}