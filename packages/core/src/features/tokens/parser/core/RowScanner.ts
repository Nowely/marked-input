import type {GapType} from '../constants'
import {GAP_TYPE} from '../constants'
import type {RowConfig, RowToken} from '../types'
import type {MarkupDescriptor} from './MarkupDescriptor'

/**
 * The block skeleton, carved BEFORE any inline matching (ADR-0010). One linear pass over the
 * value: at each row's own start it reads the row's kind from the literals there, and everything
 * between that row's body edges is left for the inline pass to parse.
 *
 * The inversion is what removes the mutual dependence the row pass existed to resolve. Separators
 * and matches used to decide each other — a match hid the separators inside its extent, and a
 * separator bounded a match's open trailing gap — so the derivation had to run to a fixpoint. A
 * row's structure is now decided by its own first bytes alone, and an inline match can never
 * reach past the row it is inside.
 *
 * Emits `children: []`; `Parser.parseRows` fills them per row.
 */
export function scanRows(value: string, kinds: readonly MarkupDescriptor[], config: RowConfig): RowToken[] {
	const {separator} = config
	const rows: RowToken[] = []
	let at = 0

	for (;;) {
		// The row's own separator: the bound every NON-body gap must close before, and the body
		// bound of a kind that has no closing literal.
		const found = value.indexOf(separator, at)
		const rowEnd = found === -1 ? value.length : found

		const match = matchKind(value, at, rowEnd, kinds, separator)
		const slot = match?.slot ?? {start: at, end: rowEnd}
		const contentEnd = match?.end ?? rowEnd
		// A closed kind may have carried the body across separators, so the row's own end is read
		// at the match's end rather than at `rowEnd`.
		const terminated = value.startsWith(separator, contentEnd)
		const end = terminated ? contentEnd + separator.length : contentEnd

		rows.push({
			type: 'row',
			content: value.slice(at, end),
			position: {start: at, end},
			descriptor: match?.descriptor,
			meta: match?.meta,
			slot: {content: value.slice(slot.start, slot.end), start: slot.start, end: slot.end},
			children: [],
		})

		// The piece after the final separator is a row even when empty (ADR-0009's trailing
		// convention): Enter at the document end always yields a visible row.
		if (!terminated) return rows
		at = end
	}
}

type KindMatch = {descriptor: MarkupDescriptor; end: number; slot: {start: number; end: number}; meta?: string}

function matchKind(
	value: string,
	at: number,
	rowEnd: number,
	kinds: readonly MarkupDescriptor[],
	separator: string
): KindMatch | undefined {
	for (const descriptor of kinds) {
		const match = tryKind(value, at, rowEnd, descriptor, separator)
		if (match) return match
	}
	return undefined
}

/**
 * One kind against one row start. The walk is literal-only: the opener must sit exactly at the
 * row's start, and every following literal is found forward with `indexOf`.
 *
 * Two bounds, and both are load-bearing rather than decorative:
 *
 * - ONLY THE BODY GAP MAY CROSS A SEPARATOR. A metadata gap whose closing literal starts past the
 *   row's own separator is refused, so `'- [x hi⏎there] more'` stays two rows instead of becoming
 *   one todo whose meta swallowed the next row. The test is on where the closer STARTS: a fence's
 *   meta closes ON the separator, which must still be accepted.
 * - A CLOSED KIND MUST END AT A SEPARATOR OR AT END OF INPUT. Without it
 *   '```ts⏎q⏎``` tail⏎next' produces a row ending mid-line and a following row starting mid-line,
 *   which contradicts the one premise the whole scan rests on — that a row is decided at its own
 *   start.
 */
function tryKind(
	value: string,
	at: number,
	rowEnd: number,
	descriptor: MarkupDescriptor,
	separator: string
): KindMatch | undefined {
	const opener = descriptor.segments[0]
	if (typeof opener !== 'string' || !value.startsWith(opener, at)) return undefined

	let cursor = at + opener.length
	let body: {start: number; end: number} | undefined
	let meta: string | undefined

	for (const [gap, type] of descriptor.gapTypes.entries()) {
		const closer = descriptor.segments[gap + 1]
		const start = cursor
		let end: number

		if (typeof closer !== 'string') {
			// No closing literal: the kind is OPEN and its body runs to the row's own separator.
			end = rowEnd
			cursor = end
		} else {
			const closerStart = value.indexOf(closer, start)
			if (closerStart === -1) return undefined
			if (!isBody(type) && closerStart > rowEnd) return undefined
			end = closerStart
			cursor = closerStart + closer.length
		}

		if (isBody(type)) body = {start, end}
		else meta = value.slice(start, end)
	}

	if (!body) return undefined
	if (cursor !== value.length && !value.startsWith(separator, cursor)) return undefined
	return {descriptor, end: cursor, slot: body, meta}
}

function isBody(type: GapType): boolean {
	return type === GAP_TYPE.Slot || type === GAP_TYPE.Value
}