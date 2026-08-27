import type {MarkupDescriptor} from '../parser/core/MarkupDescriptor'
import {depthCeiling} from '../parser/core/RowScanner'
import type {RowConfig} from '../parser/types'
import {anchorEquals, entryAnchor, offsetOfAnchor, rowBoundary} from './anchors'
import {hasCells, preorderRows} from './rows'
import {rowContent, rowLine, rowMarkup} from './tree'
import type {
	AnchoredRow,
	Anchors,
	NodeAnchor,
	Pairing,
	RowNode,
	RowPatch,
	RowPlacement,
	TreeNode,
	Window,
} from './types'

/**
 * WHAT A LINE OPENED BESIDE A ROW IS WRITTEN AS: a compiled kind and the `meta` to write in its gap,
 * or `undefined` for a plain row. It is `RowSpec.continues` resolved — `tree/` knows a descriptor
 * and not the option that declared one, so the seam answers this and this layer only writes it.
 */
export type Continuation = {descriptor: MarkupDescriptor | undefined; meta: string | undefined} | undefined

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
 * THE ROW WHOSE LINE AN ANCHOR SITS ON — with the facts about it a keybinding cannot ask for
 * itself: its depth, the depth a row written directly under it would land at, whether the anchor
 * is that row's own entry, the row it is nested in, and the carved piece it is in when the row's
 * body is carved. The last two are the walk's own by-products — the tree carries no parent
 * pointers, so a caller asking for either separately would be a second walk.
 *
 * A CARVED PIECE IS NOT A ROW OF THE DOCUMENT, and that is why this is not "the innermost row
 * containing the node": every verb here splices lines, and a cell has no line of its own. So an
 * anchor inside one answers the row that OWNS the line, and Enter, Backspace and the slash menu all
 * address the table row rather than refusing on a node no pre-order walk can name.
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

	type Found = {row: RowNode; depth: number; parent: RowNode | undefined; cell: RowNode | undefined}

	const search = (nodes: readonly TreeNode[], depth: number, inside: Found | undefined): Found | undefined => {
		for (const node of nodes) {
			let here = inside
			let carved = false
			if (node.kind === 'row') {
				carved = inside !== undefined && hasCells(inside.row)
				here =
					inside && carved
						? {...inside, cell: node}
						: {row: node, depth, parent: inside?.row, cell: undefined}
			}
			if (node === target) return here
			if (node.kind === 'text') continue
			const found = search(node.children(), node.kind === 'row' && !carved ? depth + 1 : depth, here)
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
 * THE ROW SELECTION: the rows a span of the value covers WHOLE, maximal — a covered row's covered
 * children are inside it and are not named again, which is the same normalization the mover takes
 * a set through, asked here of a span instead of a pick.
 *
 * "Whole" is the row's SUBTREE CONTENT — its own line, its descendants' lines and the separators
 * between them, but not the separator that follows it, which belongs to the boundary rather than
 * to the row. A row is a unit or it is nothing: half a row selected is a text selection, and a
 * verb acting on a set may not act on a row the user only partly named.
 *
 * A COLLAPSED span covers NOTHING, whatever offsets it coincides with, for `isAllSelected`'s
 * reason read at the row: an EMPTY row's content is zero-width, so a caret resting in one sits at
 * both of its edges and would select the row it is merely being typed into. The cost is declared
 * and is the same shape: an empty row cannot be row-selected on its own, only as part of a range
 * that already spans its neighbours.
 *
 * A CARVED PIECE is never covered — the walk does not descend into one — because a cell is not a
 * row of the document and nothing that acts on a set can address it.
 */
export function rowsWithin(
	roots: readonly TreeNode[],
	span: {start: number; end: number},
	separator: string | undefined
): RowNode[] {
	if (separator === undefined || span.start >= span.end) return []
	const take = (list: readonly RowNode[]): RowNode[] =>
		list.flatMap(row => {
			const own = rowSpan(roots, row, separator)
			if (span.start <= own.start && span.end >= own.end) return [row]
			return hasCells(row) ? [] : take(row.rows())
		})
	return take(roots.filter((node): node is RowNode => node.kind === 'row'))
}

/**
 * THE ROW SELECTION: the rows a selection holds, and the bytes a verb acting on them must write
 * over — or `undefined` when the selection is not a whole number of rows.
 *
 * ONE READING for every gesture that acts on a row selection — paste, cut, Backspace, Enter, Tab —
 * because they disagreed. {@link rowSpan} starts a row's span at its ENTRY, past the lead and the
 * opener, since those are structural bytes no caret may occupy and a selection written across them
 * reads back one offset later. But `sliceNodes` PROJECTS the same span with the opener put back:
 * copying a selected `'- alpha'` yields `'- alpha'`. So what the clipboard carried and what a
 * replacement wrote were different bytes, and replacing a selected row left its old opener standing
 * in front of whatever landed — `'- - one⏎- two'` from a paste, and the husk `'- '` from a delete.
 * What a selection copies is now what it cuts and what a paste replaces.
 *
 * EXACTLY those rows, and that test is what makes this safe to reach for on any ranged edit: a
 * selection running from the middle of one row into the end of another COVERS the rows between
 * them whole while also naming bytes outside them, and writing only the covered rows' span would
 * silently keep the partial text the user had selected. Every row gesture produces an exact span by
 * construction ({@link rowScope} builds every one of them out of {@link rowSpan}), and a text sweep
 * that happens to land on both edges is the same selection by every reading this editor has.
 *
 * "Exact" is measured in CONTENT, not in offsets — see {@link contentSpan}. Every edge a gesture
 * writes lands somewhere in the structural run between two lines, and all of those offsets name the
 * same pair of content boundaries.
 *
 * `'replace'` takes the covered rows' own LINES and their subtrees, and stops before the separator
 * that follows them — that byte belongs to the boundary, and the rows arriving in their place need
 * it to stay separated from the row below.
 *
 * `'remove'` takes that boundary with them, for {@link removePlan}'s reason read over a run: the
 * rows leave and the separator that held them apart from the document would otherwise remain as an
 * empty row, so the row count could never shrink. At the END of the document there is no trailing
 * separator to take, so the one BEFORE the run leaves instead — and when the run also starts the
 * document there is neither, which is the whole value and clears it.
 *
 * The ROWS come back beside the span because a caller that writes into it needs the first one — its
 * lead, and its kind where the kind continues, are what an arriving line is opened with — and
 * because a caller that only wants the SET (Tab) must not re-derive the exactness test to get it.
 * That is the whole of {@link TokenModel.rowSelection}.
 */
export function rowSelectionSpan(
	roots: readonly TreeNode[],
	anchors: Anchors,
	separator: string | undefined,
	take: 'replace' | 'remove'
): {start: number; end: number; rows: readonly RowNode[]} | undefined {
	if (separator === undefined) return undefined
	const ends = [offsetOfAnchor(roots, anchors.anchor), offsetOfAnchor(roots, anchors.head)]
	const held = {start: Math.min(...ends), end: Math.max(...ends)}
	const covered = rowsWithin(roots, held, separator)
	if (covered.length === 0) return undefined

	const first = covered[0]
	const last = covered[covered.length - 1]
	// EXACT means the CONTENT the selection covers is exactly the covered rows' own content —
	// their first line's entry to their last line's end. Every other offset the two edges could
	// carry is structure, and structure belongs to no row.
	const content = contentSpan(roots, anchors)
	const own = contentLines([first]).at(0)
	const upto = contentLines([last]).at(-1)
	if (!content || !own || !upto) return undefined
	if (content.start !== own.start || content.end !== upto.end) return undefined

	// The row's own LINE START — its lead and its opener included, which is the difference this
	// whole function exists for. It is not expressible as an anchor, which is why the callers ask
	// for a span rather than widening the selection they hold.
	const start = first.position.start
	const final = endsDocument(roots, last)
	if (take === 'replace') return {start, end: last.position.end - (final ? 0 : separator.length), rows: covered}
	return {start: final ? Math.max(0, start - separator.length) : start, end: last.position.end, rows: covered}
}

/**
 * THE CONTENT A SELECTION COVERS — the one rule for every edge that lands on structural bytes, and
 * the span a ranged edit may write over. `undefined` when an edge sits INSIDE a line's content,
 * which is an ordinary text selection and stays exactly the bytes the event named.
 *
 * A DOCUMENT IS CONTENT SEPARATED BY STRUCTURE, and the structure is never the user's to write
 * over. Between two lines' content lie the separator, the next line's lead, its opener and the
 * `meta` in it — and between two CARVED pieces lies the delimiter the kind split at. Every one of
 * them is structural, no caret may occupy one (ADR-0010), and a selection reaching any offset in
 * such a run has taken nothing another has not. So each edge resolves to the content boundary it
 * names: the low edge FORWARD onto the next line's entry, the high edge BACK onto the previous
 * line's end.
 *
 * IT IS NOT THE MODEL THAT WRITES THE FAR EDGE, which is why the run's own edges were never
 * enough. Every row gesture writes the near one ({@link rowScope} builds its spans out of
 * {@link rowSpan}); everything else writes the far one — Shift+ArrowDown and a mouse sweep land the
 * focus at the NEXT line's first typable position, a triple-click ends on the line below, and a
 * click on a frozen row selects it across its own ELEMENT, whose edges are `position.start` and
 * `position.end`. Read as an ordinary text span, each of those deleted a boundary the highlight
 * never painted: a sibling row merged into the one above, a PARENT swallowed its first child
 * (`'- A⏎⇥- B⏎⇥- C'` typed over emitted `'- ZB⏎⇥- C'`), and a table cell ate the delimiter after it
 * so the row lost a column.
 *
 * A LINE, not a row, and that is what makes it one rule instead of four: a row's own content is
 * its `slotRange`, which stops where its first CHILD begins, and a carved row has no line of its
 * own — its pieces are the lines. So a parent, a child, a cell and a plain sibling are all the
 * same shape here.
 *
 * IT ONLY EVER SHRINKS. Both edges move inward, so the answer can never name a byte the selection
 * did not, and no content inside the selection is left behind: a line that overlaps the span at
 * all lies wholly inside it, since neither edge is in a line's interior. Shrinking to NOTHING is a
 * legal answer and is a collapsed span, not `undefined` — see the no-content arm below.
 */
export function contentSpan(roots: readonly TreeNode[], anchors: Anchors): {start: number; end: number} | undefined {
	const ends = [offsetOfAnchor(roots, anchors.anchor), offsetOfAnchor(roots, anchors.head)]
	const held = {start: Math.min(...ends), end: Math.max(...ends)}
	// A CARET names no content, and the collapsed case is every ordinary keystroke: resolving one
	// would move the insertion point off the position the user is typing at.
	if (held.start >= held.end) return undefined
	const lines = contentLines(roots)
	const interior = (at: number) => lines.some(line => line.start < at && at < line.end)
	// AN EDGE IN A STRUCTURAL RUN RESOLVES WHATEVER THE OTHER EDGE IS, and that is the amendment. The
	// pair test below asks whether this is a text selection, and it answered YES for a pair with one
	// edge INSIDE content and the other on bytes no caret may occupy — so the write kept the raw span
	// and took the structure between them. MEASURED on the showcase: triple-click the intro
	// paragraph's LAST line — Chromium ends that range on the `@toc` row's own ELEMENT, which is an
	// offset in the run before its first line — and type once: 76 lines to 74, the table of contents
	// destroyed and the paragraph truncated, `store.rows.selected()` empty the whole time so round
	// nine's refusal never saw it.
	// A POSITION A CARET MAY HOLD is a line's interior OR either of its edges; an offset touching no
	// line at all lies in a structural RUN, which is the case an ordinary text span may never keep.
	const named = (at: number) => lines.some(line => line.start <= at && at <= line.end)
	// AN ORDINARY TEXT SELECTION stays exactly the bytes the event named, and that is the pair both
	// of whose edges a caret may hold with at least one INSIDE content: a mid-row sweep still merges
	// its two rows, which is the behaviour this function was written not to change.
	if (named(held.start) && named(held.end) && (interior(held.start) || interior(held.end))) return undefined
	const opens = interior(held.start) ? held.start : lines.find(line => line.start >= held.start)?.start
	const closes = interior(held.end) ? held.end : lines.findLast(line => line.end <= held.end)?.end
	if (opens === undefined || closes === undefined) return undefined
	// NO CONTENT LIES BETWEEN THE TWO EDGES — the whole span is structure, and the answer is a
	// POSITION rather than nothing. `undefined` here handed the RAW pair back to the write path,
	// which then took the structure the selection had covered: a double-click in a row's blank right
	// MARGIN is the plainest way to it, since Chromium's word expansion past end-of-line returns a
	// cross-row range whose own text is empty — `'lead sentence here'` + `'- bullet row'`, one `'Z'`,
	// and the value read `'lead sentence hereZbullet row'` with the bullet's marker gone. A sweep
	// that ends on an atomic row is the same pair once {@link TokenModel.#offBlockInterior} has moved
	// its far edge, and it cost `'@metrics'` and `'@views'` their opener lines.
	//
	// THE LOW EDGE NAMES IT: `closes` wherever the low edge is at or past a line's end — the row the
	// gesture began in — and `opens` where it is not, so the point is always inside the span the user
	// held and this still ONLY SHRINKS.
	if (opens > closes) {
		const at = closes >= held.start ? closes : opens
		return {start: at, end: at}
	}
	return {start: opens, end: closes}
}

/**
 * EVERY LINE OF THE DOCUMENT, as the CONTENT range it owns, in document order.
 *
 * A row's own content is its `slotRange` — its inline body, which ends where its first child row
 * begins, so a parent contributes its own line and its children contribute theirs. A CARVED row
 * contributes no line at all: its pieces ARE the lines of it, each one a Row whose structural bytes
 * are the delimiter it was carved at, and the descent is recursive because a piece may be carved in
 * turn.
 *
 * The ranges ascend and never overlap, which is what lets {@link contentSpan} read an edge by
 * scanning them.
 */
function contentLines(nodes: readonly TreeNode[]): {start: number; end: number}[] {
	return contentLineRows(nodes).map(line => line.range)
}

/**
 * {@link contentLines} WITH THE ROW THAT OWNS EACH LINE, which is the same walk read by a caller
 * that has to ask something ABOUT the row rather than about the range — whether the kind paints
 * its own text, which is a DOM question and lives at the seam.
 */
export function contentLineRows(nodes: readonly TreeNode[]): {row: RowNode; range: {start: number; end: number}}[] {
	const out: {row: RowNode; range: {start: number; end: number}}[] = []
	for (const node of nodes) {
		if (node.kind !== 'row') continue
		if (hasCells(node)) {
			out.push(...contentLineRows(node.rows()))
			continue
		}
		out.push({row: node, range: node.slotRange()})
		out.push(...contentLineRows(node.rows()))
	}
	return out
}

/**
 * THE FOUR SPANS A ROW-SELECTION GESTURE MOVES TO, each answered from the span the editor holds
 * now — and they are spans rather than verbs because the row selection IS the text selection
 * (`store.rows.selected` derives from it), so widening it is one `select` and no second store.
 *
 * - `'row'` — the row the anchor's line belongs to, whole. Esc's first rung: it turns a caret or a
 *   partial text selection into a row selection. In a CARVED piece it answers the LINE, which is
 *   {@link rowOf}'s rule and the whole of what selecting inside a table means.
 * - `'out'` — the PARENT of the first covered row, whole, UNIONED with what is already held so the
 *   widening rung can never answer less than it was given. The rung is shared by Esc and Mod+A;
 *   `undefined` when no row is covered or the covered scope is already at depth 0, which is what
 *   leaves Mod+A meaning select-all everywhere it always did.
 * - `'up'` / `'down'` — the covered span with the neighbouring row ABSORBED WHOLE. It only grows,
 *   and absorbing whole is what keeps it from getting stuck: extending up from a first child
 *   reaches its parent, whose subtree already covers the child, so the selection becomes the
 *   parent rather than an impossible span that covers neither. At the document's edge there is no
 *   neighbour and the answer is the span already held — the key is still the gesture's.
 *
 * Every arm but `'row'` answers `undefined` when the span covers no whole row, which is what keeps
 * an arrow key native until a row selection actually stands (ADR-0002's rule that nothing may
 * cancel an ordinary arrow).
 *
 * The gestures re-normalize to the COVERED rows rather than to the raw selection, so a text
 * selection that overshoots into a neighbouring row's body does not carry that overshoot along.
 */
export function rowScope(
	roots: readonly TreeNode[],
	anchors: Anchors,
	scope: 'row' | 'out' | 'up' | 'down',
	separator: string | undefined
): {start: number; end: number} | undefined {
	if (separator === undefined) return undefined
	if (scope === 'row') {
		const found = rowOf(roots, anchors.anchor)
		return found && rowSpan(roots, found.row, separator)
	}

	const ends = [offsetOfAnchor(roots, anchors.anchor), offsetOfAnchor(roots, anchors.head)]
	const covered = rowsWithin(roots, {start: Math.min(...ends), end: Math.max(...ends)}, separator)
	if (covered.length === 0) return undefined

	const rows = preorderRows(roots)
	const first = rows.findIndex(entry => entry.row === covered[0])
	const last = rows.findIndex(entry => entry.row === covered[covered.length - 1])
	const held = {
		start: rowSpan(roots, rows[first].row, separator).start,
		end: rowSpan(roots, rows[last].row, separator).end,
	}

	if (scope === 'out') {
		const parent = rows.slice(0, first).findLast(entry => entry.depth < rows[first].depth)
		if (!parent) return undefined
		const outer = rowSpan(roots, parent.row, separator)
		// UNIONED WITH WHAT IS HELD, because the parent is the first covered row's and a selection
		// may span several: answering the parent verbatim drops every covered row outside it, and a
		// widening rung that loses rows is worse than one that declines.
		return {start: Math.min(held.start, outer.start), end: Math.max(held.end, outer.end)}
	}
	// `.at`, and the negative guard with it: `noUncheckedIndexedAccess` is off, so an index read
	// types as non-nullable and the no-neighbour guard reads as impossible — while `.at(-1)` alone
	// would wrap a grow upward from the document's first row onto its last.
	const step = scope === 'up' ? first - 1 : last + preorderRows([rows[last].row]).length
	const neighbour = step < 0 ? undefined : rows.at(step)
	// AT THE DOCUMENT'S EDGE THE ANSWER IS WHAT IS HELD, not `undefined`: a row selection stands
	// and there is simply no row left to absorb. Declining here left the key native, and the
	// browser's own Shift+Arrow then moves the focus end off the row boundary — so a gesture that
	// should do nothing DESTROYED the selection instead.
	if (!neighbour) return held
	const absorbed = rowSpan(roots, neighbour.row, separator)
	return {start: Math.min(held.start, absorbed.start), end: Math.max(held.end, absorbed.end)}
}

/**
 * THE SPAN A SELECTION MUST COVER TO HOLD THIS ROW WHOLE: from the row's own ENTRY to the end of
 * its subtree's content.
 *
 * The entry and not `position.start`, and the difference is the whole reason this is a function:
 * a row's lead and its opener are STRUCTURAL BYTES NO CARET ENTERS (ADR-0010), so `anchorAt` on
 * them answers the row's slot start instead — a selection written at `position.start` reads back
 * one offset later and would never cover the row it was written for.
 *
 * The end drops the separator that FOLLOWS the row, which belongs to the boundary rather than to
 * either side of it; `position` carries it on every row but the ones whose subtree ends the
 * document, and {@link endsDocument} is what tells the two apart.
 */
export function rowSpan(roots: readonly TreeNode[], row: RowNode, separator: string): {start: number; end: number} {
	return {
		start: offsetOfAnchor(roots, entryAnchor(row)),
		end: row.position.end - (endsDocument(roots, row) ? 0 : separator.length),
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
 * Moving ROWS AND THEIR SUBTREES to a {@link RowPlacement}, as ONE splice over the pre-order
 * LINES whose bytes actually change, plus the {@link Pairing} that says which row went where.
 *
 * The whole plan lives in ONE coordinate space: the pre-order row list, whose lines tile the
 * value with a separator between every adjacent pair. A subtree is a contiguous RUN in it, so a
 * move is "cut these runs, paste them before that index", the destination reduces to a single
 * pre-order position, and there is no common ancestor to find — the narrowest splice is the
 * narrowest changed range of lines, which is tighter than the ancestor's span whenever the
 * ancestor has untouched children before or after the move.
 *
 * A SET, and one splice for the whole of it. Two verbs cannot compose here — in controlled mode
 * the tree has not moved when the first returns — and moving a selection one row at a time would
 * also expose intermediate documents the scan re-reads differently. The set is normalized to
 * MAXIMAL subtrees first ({@link maximalRuns}): a row named together with its own ancestor
 * travels inside that ancestor's run, and naming it twice would splice its lines twice.
 * Every named root lands at the SAME depth, side by side, in document order — a multi-row drag
 * is a set of siblings-to-be, whatever depths they were picked up from.
 *
 * TWO things change bytes, and the affected range is the union: a line where a DIFFERENT row now
 * sits, and a moved row whose LEAD is rewritten. The re-lead is `indent.repeat(depth)` rather
 * than the old lead shifted, for {@link depthPlan}'s reason plus one the mover adds: a surplus
 * indent run carried into a destination with a deeper ceiling would land the row at the surplus
 * depth instead of the requested one, so preserving those bytes cannot express the placement.
 *
 * `'unchanged'` for the placement the named rows ALREADY hold. It is separated from the refusals
 * because at a row's own gap it is the only outcome that means "leave it where it was", and a
 * caller offering the gap's depths has to be able to offer that one too — see
 * {@link dropPlacements}. Nothing is written either way: the verb answers `false` for it, as it
 * always did.
 *
 * `undefined` — fail closed — for an empty set, a non-row or a dead row anywhere in it (the
 * pre-order lookup is that check for every end), a PLACEMENT INSIDE ONE OF THE MOVED SUBTREES, a
 * destination whose child rows are its own carved BODY, an index outside the destination's child
 * list, an editor with no separator to rejoin rows by, a nested placement with nesting off, and —
 * the one answer that covers the rest — a splice the SCAN would read back as a different tree,
 * which is asked by replaying the scan over the span the splice rewrites.
 *
 * The subtree test is the run, and it is the reason the runs are computed before anything else:
 * the tree carries no parent pointers, so "is this parent inside what I am moving" has no answer
 * except "is its pre-order index in one of the moved runs".
 *
 * The pairing spans EVERY pre-order row, not just the moved spans — `resolvePairing` needs a
 * total bijection, and the untouched rows are the identity part of it.
 */
export function movePlan(
	roots: readonly TreeNode[],
	nodes: readonly TreeNode[],
	placement: RowPlacement,
	config: RowConfig | undefined
): {window: Window; text: string} | 'unchanged' | undefined {
	if (config === undefined) return undefined
	const {separator, indent} = config
	const {parent, index} = placement
	// A nested placement has to be WRITTEN, and with no indent unit there is nothing to write it
	// with — every lead would be empty and every row a root.
	if (parent !== null && indent === '') return undefined

	const rows = preorderRows(roots)
	const runs = maximalRuns(rows, nodes)
	if (runs === undefined) return undefined
	const inside = (position: number): boolean =>
		runs.some(run => position >= run.from && position < run.from + run.span)

	let parentDepth = -1
	if (parent !== null) {
		const parentAt = rows.findIndex(entry => entry.row === parent)
		if (parentAt < 0) return undefined
		// THE refusal that keeps a move from eating the document: a row cannot become a
		// descendant of itself, and the runs are where that question is answerable.
		if (inside(parentAt)) return undefined
		parentDepth = rows[parentAt].depth
	}
	const depth = parentDepth + 1

	// The destination's child rows WITHOUT the moved ones, which is what makes `index` the position
	// they take after the move rather than a slot in a list they are still in.
	const movedRoots = new Set(runs.map(run => rows[run.from].row))
	const siblings = (
		parent === null ? rows.filter(entry => entry.depth === 0).map(entry => entry.row) : parent.rows()
	).filter(row => !movedRoots.has(row))
	if (!Number.isInteger(index) || index < 0 || index > siblings.length) return undefined

	// Where the runs land, as a pre-order index in the CURRENT list: before the sibling that will
	// follow them, or past the whole subtree of the one they will follow.
	const preIndexOf = (row: RowNode): number => rows.findIndex(entry => entry.row === row)
	const before =
		index < siblings.length
			? preIndexOf(siblings[index])
			: siblings.length > 0
				? preIndexOf(siblings[index - 1]) + preorderRows([siblings[index - 1]]).length
				: parent === null
					? 0
					: preIndexOf(parent) + 1

	const kept = rows.map((_, at) => at).filter(at => !inside(at))
	const at = kept.filter(old => old < before).length
	const run = runs.flatMap(({from, span}) => Array.from({length: span}, (_, offset) => from + offset))
	// The claim itself: new pre-order row index → the previous row that becomes it.
	const order: Pairing = [...kept.slice(0, at), ...run, ...kept.slice(at)]

	// One delta PER RUN, because the runs are picked up from different depths and put down at one:
	// a single delta is only right when there is a single run.
	const delta = new Map<number, number>()
	for (const {from, span} of runs) {
		const shift = depth - rows[from].depth
		for (let offset = 0; offset < span; offset++) delta.set(from + offset, shift)
	}

	// TWO readings of "this line is not what it was", and a set is what separates them. `moves` is
	// the NO-OP test: a plan under which no line changes its row and no row changes its depth is
	// the rows already being where they were asked to go — an order comparison alone misses the
	// re-indent, since outdenting the last child to a root directly after its parent leaves the
	// pre-order intact. `rewritten` is the WINDOW: a named row is re-led whatever else happens to
	// it, which is how a move NORMALIZES a surplus indent run, so a row that keeps its position and
	// its depth while a second run travels is still a line this splice must write.
	const moves = (position: number): boolean => order[position] !== position || (delta.get(order[position]) ?? 0) !== 0
	const rewritten = (position: number): boolean => order[position] !== position || delta.has(order[position])
	if (!order.some((_, position) => moves(position))) return 'unchanged'

	// Terminates: a plan that moves no line was refused above, and every line that MOVES is a line
	// this REWRITES.
	let low = 0
	while (!rewritten(low)) low++
	let high = order.length - 1
	while (high > low && !rewritten(high)) high--

	// This one walk is what THREE separate refusals reduce to: the destination's own ceiling (the
	// moved root asks for `depth` and must be granted it), a moved row re-led to `''` and thereby
	// emptied, which takes the children the move was carrying — `'a⏎⇥⏎⇥⇥b'` emitted `'a⏎⏎⇥b'` — and
	// an untouched row re-parenting under a ceiling the splice raised: `'x⏎⏎⇥⇥b'` emitted
	// `'⏎x⏎⇥⇥b'`, where the root `b` became `x`'s child.
	const written = (position: number): Written => {
		const entry = rows[order[position]]
		const shift = delta.get(order[position])
		const landed = entry.depth + (shift ?? 0)
		return {
			row: entry.row,
			depth: landed,
			lead: shift === undefined ? entry.row.lead() : indent.repeat(landed),
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
 * EVERY PLACEMENT A DROP INTO ONE GAP MAY TAKE, shallowest first — the gap being the boundary on
 * one `edge` of `row`, and each answer carrying the DEPTH it lands the moved rows at.
 *
 * A drop names a gap between two lines and a depth inside it, and the depth is the pointer's
 * horizontal position. Which depths a gap actually offers is not a rule this can restate: it is
 * bounded above by the scan's own ceiling for the line before the gap and below by the depth of
 * the line after it — go shallower and the row after the gap becomes a CHILD of what was dropped,
 * which is a re-parenting nobody asked for and which no depth comparison inside the mover sees.
 * Everything else is ASKED OF THE MOVER: each candidate is planned, and the ones it refuses are
 * not offered. That is the difference between a drop indicator that predicts and one that
 * promises — what is painted and what will happen are the same call.
 *
 * THE PLACEMENT THE ROWS ALREADY HOLD IS ONE OF THE ANSWERS, and it is the whole reason
 * {@link movePlan} tells `'unchanged'` apart from a refusal. At a row's OWN gap that placement is
 * the one the pointer means most of the time — the drag that only changes depth passes through it
 * on the way — and dropping it from the list left every horizontal position resolving to some
 * OTHER depth, so a gesture that should do nothing moved the row instead. It is offered like any
 * other candidate; the drop writes nothing, exactly as it already did wherever no candidate
 * survived at all.
 *
 * THE LINES EITHER SIDE OF THE GAP ARE THE ONES THE MOVE LEAVES THERE, so the rows in flight are
 * stepped over at BOTH ends: a row that is leaving cannot become a child of what lands where it
 * was, and neither can it be the line a landing row nests under. Read off the current list instead,
 * the commonest drag there is — pick a row up and drop it at its own gap to change only its depth —
 * offered no outdent at all below the gap and no INDENT above it, so the same physical gap answered
 * differently from a row's upper half and its lower.
 *
 * `index` is counted with the moved rows TAKEN OUT, which is what {@link RowPlacement} means, so a
 * gap whose preceding siblings are themselves in flight still addresses the slot it looks like.
 *
 * WHAT IT COSTS, stated because a `dragover` tick calls it and the hit test beside it defends a
 * 0.2%-of-a-frame budget this does not meet. Planning is LINEAR in the document — every candidate
 * replays `movePlan`, which walks the whole pre-order list twice — and there are 1–3 candidates a
 * gap. Measured (darwin arm64, Chromium, median of 20 after 5 warmups, one-in-three nested):
 * 0.1 ms a tick at 200 rows, 0.4 ms at 1000, ~1.5 ms at 4000 — 9% of a 16.7 ms frame at 4000 rows.
 * Bought deliberately: the alternative is a depth rule restated outside the mover, which is the
 * one thing a promising indicator may not have. The invariant part is hoistable if it ever bites —
 * `preorderRows(roots)` and the `kept` projection are identical across one tick's candidates.
 */
export function dropPlacements(
	roots: readonly TreeNode[],
	nodes: readonly TreeNode[],
	row: RowNode,
	edge: 'before' | 'after',
	config: RowConfig | undefined
): {depth: number; placement: RowPlacement}[] {
	if (config === undefined) return []
	const rows = preorderRows(roots)
	const found = rows.findIndex(entry => entry.row === row)
	if (found < 0) return []

	// The gap FOLLOWS this pre-order index; `-1` is the gap before the document's first line.
	const gap = edge === 'after' ? found : found - 1
	const runs = maximalRuns(rows, nodes) ?? []
	const inFlight = (position: number): boolean =>
		runs.some(run => position >= run.from && position < run.from + run.span)

	// BOTH ENDS STEP OVER THE ROWS IN FLIGHT, and the ceiling's step is the one that was missing.
	// At a moved row's OWN lower gap `previous` IS that row, so the only nested candidate was "child
	// of the row being dragged", which `movePlan` refuses — leaving the commonest drag there is,
	// pick a row up and change only its depth, working from the upper half of its own line and not
	// the lower. The line the move leaves above the gap is the one to ask, and it is what
	// `placementAt` must anchor on too: anchored on the moved row it named that row as the parent.
	let at = gap
	while (at >= 0 && inFlight(at)) at--
	const previous = at < 0 ? undefined : rows[at]
	const ceiling = depthCeiling(previous && scannedAs(previous.row, previous.depth))
	let after = gap + 1
	while (inFlight(after)) after++
	const floor = rows[after]?.depth ?? 0

	const moved = new Set(nodes)
	const out: {depth: number; placement: RowPlacement}[] = []
	for (let depth = floor; depth <= ceiling; depth++) {
		const placement = placementAt(rows, at, depth, moved)
		if (placement && movePlan(roots, nodes, placement, config) !== undefined) out.push({depth, placement})
	}
	return out
}

/**
 * The placement that puts a row at `depth` in the gap after pre-order index `at`. One deeper than
 * the line above the gap is that line's FIRST CHILD; anything shallower follows the ancestor of it
 * that sits at the wanted depth, which is the last entry at that depth on the way back.
 */
function placementAt(
	rows: readonly {row: RowNode; depth: number}[],
	at: number,
	depth: number,
	moved: ReadonlySet<TreeNode>
): RowPlacement | undefined {
	if (at < 0) return depth === 0 ? {parent: null, index: 0} : undefined
	if (depth === rows[at].depth + 1) return {parent: rows[at].row, index: 0}

	const ancestorAt = (limit: number, wanted: number): number => {
		for (let position = limit; position >= 0; position--) {
			if (rows[position].depth === wanted) return position
		}
		return -1
	}
	const anchor = ancestorAt(at, depth)
	if (anchor < 0) return undefined
	const parentAt = depth === 0 ? -1 : ancestorAt(anchor - 1, depth - 1)
	if (depth > 0 && parentAt < 0) return undefined
	const parent = depth === 0 ? null : rows[parentAt].row

	const siblings = parent === null ? rows.filter(entry => entry.depth === 0).map(entry => entry.row) : parent.rows()
	const index = siblings
		.slice(0, siblings.indexOf(rows[anchor].row) + 1)
		.filter(sibling => !moved.has(sibling)).length
	return {parent, index}
}

/**
 * The moved set as PRE-ORDER RUNS, in document order and normalized to MAXIMAL subtrees: a row
 * named together with an ancestor already travels inside that ancestor's run, so its own run is
 * dropped rather than spliced a second time.
 *
 * The normalization lives HERE and not at the caller because the pre-order list is the only place
 * "is this row inside that one" is answerable at all — the tree carries no parent pointers — and
 * the same list is what the plan splices in.
 *
 * `undefined` for an empty set and for anything that is not a live row OF THE DOCUMENT. A CARVED
 * PIECE is the case that matters: a cell is a Row, but the pre-order walk names no cell, so a
 * lookup for one fails here and a cell can never be dragged out of the line that carved it.
 */
function maximalRuns(
	rows: readonly {row: RowNode; depth: number}[],
	nodes: readonly TreeNode[]
): {from: number; span: number}[] | undefined {
	const starts = new Set<number>()
	for (const node of nodes) {
		if (node.kind !== 'row') return undefined
		const from = rows.findIndex(entry => entry.row === node)
		if (from < 0) return undefined
		starts.add(from)
	}
	if (starts.size === 0) return undefined

	const runs: {from: number; span: number}[] = []
	for (const from of [...starts].toSorted((a, b) => a - b)) {
		const last = runs.at(-1)
		if (last && from < last.from + last.span) continue
		runs.push({from, span: preorderRows([rows[from].row]).length})
	}
	return runs
}

/**
 * Re-indenting a SET of rows by `steps` levels, as ONE splice that rewrites their own leads AND
 * their subtrees' plus the {@link Pairing} that keeps every row's identity across it.
 *
 * A SET, and one splice for the whole of it, for {@link movePlan}'s reasons: two verbs cannot
 * compose in controlled mode, and a Tab over a row selection re-indents every row the user named
 * or none of them. The set is normalized to MAXIMAL subtrees first, so a row named together with
 * its own ancestor travels inside that ancestor's run rather than being re-led twice.
 *
 * STEPS rather than a depth, and that is what a set forces: rows picked up from different depths
 * keep the nesting they had, where one absolute depth would flatten them onto a single level. A
 * single row's absolute {@link RowNode.setDepth} is that same arithmetic done at the caller, which
 * is the layer that knows where the row is now.
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
 * `undefined` — fail closed — for an empty set, a non-row or a dead row anywhere in it, a
 * non-integer step, a depth below the root for any named row, a no-op, an editor with nesting off,
 * and — the one answer the rest reduce to — a splice the SCAN would read back as a different tree,
 * which is {@link scanAgrees} replaying it over the lines this rewrites plus the row after them.
 * That covers the row's own clamp (asking for more than the row above grants would emit a lead the
 * parse reads as something shallower), a row re-led to `''` on a blank body, which EMPTIES it so it
 * can no longer carry the children it had, and an untouched row after the subtree re-parenting
 * under a ceiling this splice raised — `'x⏎⏎⇥⇥b'` with the blank row indented emitted
 * `'x⏎⇥⏎⇥⇥b'`, where the root `b` landed two levels down as a grandchild. One refusal is the
 * whole set's: a Tab that could only move some of the named rows moves none.
 *
 * The NO-OP is asked of the named roots' own leads and not of `steps`, which is what keeps a
 * re-indent to the depth a row already renders at NORMALIZING a surplus indent run some paste
 * preserved — observable, and the alternative is two disagreeing readings of "depth".
 */
export function depthPlan(
	roots: readonly TreeNode[],
	nodes: readonly TreeNode[],
	steps: number,
	config: RowConfig | undefined
): {window: Window; text: string} | undefined {
	if (config === undefined || config.indent === '') return undefined
	if (!Number.isInteger(steps)) return undefined

	const rows = preorderRows(roots)
	const runs = maximalRuns(rows, nodes)
	if (runs === undefined) return undefined

	const carried = new Set<number>()
	for (const {from, span} of runs) {
		for (let offset = 0; offset < span; offset++) carried.add(from + offset)
	}
	// Refused before `repeat`, which throws on a negative count. Asked of every run's ROOT, which
	// is where the shallowest carried row is: a descendant is deeper than the row it travels under.
	if (runs.some(run => rows[run.from].depth + steps < 0)) return undefined

	const written = (position: number): Written => {
		const entry = rows[position]
		const moved = carried.has(position)
		const landed = entry.depth + (moved ? steps : 0)
		return {row: entry.row, depth: landed, lead: moved ? config.indent.repeat(landed) : entry.row.lead()}
	}
	if (runs.every(run => written(run.from).lead === rows[run.from].row.lead())) return undefined

	const low = runs[0].from
	const last = runs[runs.length - 1]
	const high = last.from + last.span - 1
	if (!scanAgrees(rows, low, high, written, config.indent)) return undefined

	const text = spliceLines(rows, low, high, written, config.separator)
	return {
		window: {
			start: rows[low].row.lineRange().start,
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
): {window: Window; text: string; caret: number | undefined} | undefined {
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
		// THE ROW'S LINE BODY START, which is its OPENER — and `anchorAt` answers a row's own ENTRY
		// for any offset inside those structural bytes (ADR-0010), so this one number is "the start
		// of what was seeded" for a plain kind and "its first cell" for a carved one. The offset
		// survives the splice unmoved: everything before the row's line is untouched, and the lead
		// a retype leaves alone. See {@link RowPatch.seeded} for when it is named at all.
		caret: patch?.seeded === true ? start : undefined,
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
 * A LINE OPENED BESIDE `node`: written at its LEAD, opened as {@link Continuation} says. The one
 * rule for every arriving line, and it has two writers — the lines {@link splitPlan} opens at a
 * cut, and the lines {@link rowSelectionRows} writes in a covered row's place. Answering it twice
 * is how a paste at a caret and the same paste over a row selection came to disagree about the
 * same clip.
 */
function openedLine(node: RowNode, continues: Continuation, text: string): string {
	return node.lead() + rowMarkup(continues?.descriptor, continues?.meta, text)
}

/**
 * A CLIP'S LINES, RE-CUT SO NO PIECE CARRIES THE DOCUMENT'S OWN SEPARATOR. A piece holding one
 * opens a row nobody wrote a lead or an opener for, and — for {@link splitPlan} — a row the plan
 * did not count, so its pre-order `tail` named the wrong one and the caret came to rest inside the
 * clip instead of at its end.
 *
 * HERE and not at the caller, which cuts on LINE BREAKS: what a line break is belongs to the clip's
 * platform, what the separator is belongs to the document, and only this layer holds the second.
 * Reachable only for a separator with no newline in it (`';;'`, `'¶'`) — for the `'\n'` family the
 * caller's own cut has already taken every one of them.
 */
function documentLines(lines: readonly string[], separator: string): string[] {
	return lines.flatMap(line => line.split(separator))
}

/**
 * A FOREIGN CLIP'S LINES AS THE ROWS THAT REPLACE A ROW SELECTION — `first`'s lead on every one of
 * them, and its kind where the kind continues, joined by the document's own separator.
 *
 * The rows a selection holds are being replaced whole, so the row that decides how the arriving
 * lines are written is the FIRST of them: the depth the user was at, and the kind they were in.
 * That is the same answer {@link splitPlan} gives for a clip pasted at a caret in that row, which
 * is the point — the two gestures disagreed, and a foreign clip over a row selection was spliced
 * verbatim, so its `\r` survived into the value and its `⏎` became a row boundary in a document
 * whose separator is not one.
 */
export function rowSelectionRows(
	first: RowNode,
	continues: Continuation,
	lines: readonly string[],
	separator: string
): string {
	return documentLines(lines, separator)
		.map(line => openedLine(first, continues, line))
		.join(separator)
}

/**
 * Opening ROWS inside one row's own body, as ONE splice plus the PRE-ORDER index of the row the
 * caret belongs in and how far into it. Enter's split is the degenerate case — two empty pieces,
 * which is a cut and nothing written at it.
 *
 * `rows` are the pieces written AT THE CUT, one per line the edit opens: `rows[0]` joins the head,
 * `rows.at(-1)` opens the tail and the rest of the body follows it, and every piece between them
 * becomes a row of its own. Two pieces are the minimum, because fewer opens no row and is an
 * ordinary insert; a multi-line PASTE is the caller that supplies more. Its lines take the row
 * rules rather than a second implementation of them — a raw `⏎` spliced into the body carried
 * neither the lead nor the opener, so a clip pasted into a nested list item landed at depth 0 and
 * one pasted into a table cell ended the table line.
 *
 * A SPAN rather than one anchor, so a paste over a text selection is one splice: the head keeps
 * what precedes the span and the tail what follows it. Enter passes its caret on both ends.
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
 * The opened rows' kind is the row's own when the kind `continues`, else a plain row; the caller
 * reads that field, because `tree/` knows a descriptor and not the option that declared it.
 *
 * A STRING IS THIS EDITOR'S OWN MARKUP — {@link TokenModel.replaceRows}'s convention, read here at
 * the caret — and its lines are already whole ROWS, lead and opener and all. They are written
 * VERBATIM: opened as pieces they would take a second lead and a second opener each, and spliced as
 * text (which is what a markup clip did until now) their structural bytes landed in the caret's row
 * as PROSE — a literal `'- '` mid-paragraph, and a literal tab in front of it.
 *
 * IT NAMES NO CARET, and that is not an omission: a verbatim splice is contiguous, so the trimmed
 * window IS the insertion and right affinity leaves the caret at its end — the end of the clip,
 * which is where the ordinary replacement used to leave it. Naming one would need the last line's
 * BODY length, which is a parse this layer does not have.
 *
 * `undefined` — fail closed — for a non-row, a dead node, an editor with no separator to split at,
 * fewer than two pieces, and a span that is not inside the row's own body — which is what sends a
 * paste across several rows back to the ordinary splice.
 */
export function splitPlan(
	roots: readonly TreeNode[],
	node: TreeNode,
	span: Anchors,
	separator: string | undefined,
	continues: Continuation,
	rows: readonly string[] | string
): {window: Window; text: string; tail: number; into: number | undefined} | undefined {
	if (node.kind !== 'row' || separator === undefined) return undefined
	const markup = typeof rows === 'string'
	// The pieces, re-cut so none of them carries the document's own separator — see
	// {@link documentLines}. Counted AFTER that cut, because it is the cut that decides how many
	// rows this opens, and `tail` is an index into them. A markup clip arrives as ONE string and is
	// cut here for the same reason: what a row boundary is belongs to the document.
	const pieces = documentLines(markup ? [rows] : rows, separator)
	if (pieces.length < 2) return undefined
	const lines = preorderRows(roots)
	const index = lines.findIndex(entry => entry.row === node)
	if (index < 0) return undefined

	const slot = node.slotRange()
	const ends = [offsetOfAnchor(roots, span.anchor), offsetOfAnchor(roots, span.head)]
	const from = Math.min(...ends)
	const to = Math.max(...ends)
	if (from < slot.start || to > slot.end) return undefined

	const body = node.slot()
	// A CARVED row has no subtree to place: its child rows are the body this split is cutting, and
	// both halves carry their own share of them.
	const children = hasCells(node) ? [] : node.rows()
	const descendants =
		children.length === 0 ? undefined : children.map(child => rowContent(child, separator)).join(separator)

	const headBody = body.slice(0, from - slot.start)
	// AN EMPTY FIRST LINE IS A ROW'S TAIL, not a row: a markup clip beginning with the document's
	// own separator was copied from the END of a row, so there is nothing there to open and it joins
	// the head exactly as a foreign clip's first piece does. Every other first line is written as the
	// row it may be — which is the whole of the leak this closes, since the payload does not say
	// whether the copy started at a row's line start. DECLARED COST: a markup clip copied from the
	// MIDDLE of a row and across a boundary opens its first fragment as a row of its own.
	const joinsHead = !markup || pieces[0] === ''
	// AT A ROW'S OWN START THE TWO HALVES SWAP ROLES, and that is the same rule the subtree
	// placement below already follows. A split OPENS one row and KEEPS the other, and
	// {@link Continuation} describes the one it opens — but when nothing is written at the cut and
	// the head takes none of the body, the opened row is the EMPTY HEAD and the tail is the row
	// that was already there. Written the other way round, `continues` was applied to the user's
	// own text: Enter at the head of a table HEADER left an empty header above and demoted its
	// column names to a data LINE (`'|= A | B'` emitted `'|= ⏎| A | B'`, the table's head gone),
	// Enter at the head of a heading took the heading off its own text (`'# a'` emitted `'# ⏎a'`),
	// and Enter at the head of a ticked to-do left the tick above and re-seeded the text below.
	// The row that keeps the CONTENT keeps the kind and the `meta` that qualifies it.
	const opensAbove = !markup && headBody === '' && pieces.every(piece => piece === '')
	const kept: Continuation = {descriptor: node.descriptor(), meta: node.meta()}
	const headKind = opensAbove ? continues : kept
	const headLine = rowMarkup(headKind?.descriptor, headKind?.meta, headBody + (joinsHead ? pieces[0] : ''))
	// An empty, kindless head is not kept: pasting rows onto a blank row is the clip and nothing else.
	const keepsHead = joinsHead || node.lead() + headLine !== ''
	const head = keepsHead ? headLine : pieces[0]
	const opened = pieces.slice(joinsHead || !keepsHead ? 1 : 0)
	const openedLines = opened.map((piece, at) => {
		const text = at === opened.length - 1 ? piece + body.slice(to - slot.start) : piece
		return markup ? text : openedLine(node, opensAbove ? kept : continues, text)
	})
	const subtree = descendants === undefined ? '' : separator + descendants
	// The scan's own emptiness, asked of the head this split is about to write — see
	// {@link scannedAs} for the same test over a row a verb is about to emit.
	const headKeepsChildren = node.lead() + head !== ''

	const written = openedLines.join(separator)
	const text = headKeepsChildren ? head + subtree + separator + written : head + separator + written + subtree

	const start = node.position.start + node.lead().length
	// The bytes the bound holds right now: the row's own line, plus the subtree and the separator
	// before it. The subtree's last line carries no trailing separator when it ends the document,
	// and the bound stops before it when it does — the join puts one back afterwards.
	const current = rowMarkup(node.descriptor(), node.meta(), body) + subtree
	// The LAST opened row is where the caret goes, past the subtree when the head kept it and
	// directly after the head when it did not.
	const tail = index + (headKeepsChildren ? preorderRows([node]).length : 1) + opened.length - 1

	// TRIMMED to the shared prefix and suffix inside that bound, and it is {@link turnIntoPlan}'s
	// caret rule rather than an economy — the same defect P4 fixed there and left standing here.
	// `resolveMappedAnchor` collapses every offset INSIDE a window onto the window's end, so a
	// window spanning the line body sent the caret of every mid-row Enter to the END OF THE TAIL:
	// `'hello'` split at 2 emitted `'he⏎llo'` and then typed the next character into `'he⏎lloZ'`.
	// Trimmed, such a split is exactly the INSERTION of the separator plus the tail's lead and
	// opener at the cut, and right affinity puts the caret at the end of that insertion — the
	// tail's first typable position. Uncontrolled the verb names the caret itself
	// (`TokenModel.#enterRow`); controlled it does not, and this is the whole of what answers there.
	//
	// ONLY WHILE THE SPLICE IS CONTIGUOUS. A head that KEEPS a subtree writes two disjoint pieces —
	// bytes leave at the cut and arrive past the subtree — and the smallest window covering both is
	// the whole bound again, where the caret still lands at the tail's end. That is right at a row's
	// END, which is where the tail is empty and both readings agree, and it is the one shape of the
	// defect a single window cannot express. See `docs/scratch/notion-like/map.md`.
	const contiguous = subtree === '' || !headKeepsChildren
	const prefix = contiguous ? sharedPrefix(current, text) : 0
	const suffix = contiguous ? sharedSuffix(current, text, prefix) : 0
	return {
		window: {
			start: start + prefix,
			end: start + current.length - suffix,
			insertedLength: text.length - prefix - suffix,
		},
		text: text.slice(prefix, text.length - suffix),
		tail,
		// How far INTO the tail's own body the caret goes: past what this wrote there, which for
		// Enter's empty piece is the tail's entry and for a foreign clip is the end of the clip.
		// `undefined` for a markup clip, whose last line is a whole row — see the header.
		into: markup ? undefined : pieces[pieces.length - 1].length,
	}
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