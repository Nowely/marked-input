import type {PositionRange, RowToken, Token} from '../types'
import {createTextToken} from '../utils/createTextToken'
import type {Match} from './Match'

/**
 * The row pass of `Parser.parseRows` (issue 08, phase 0 decision): the separator
 * is structural — it belongs to no markup, never enters the segment alternation,
 * and its precedence is local and declared: a matched gap hides its separators,
 * a separator beats plain text.
 */

/**
 * The single conflict authority: drops every match that overlaps the last kept
 * one without nesting inside its slot. `TreeBuilder.build` assumes its input
 * already passed through here, so the row pass and the tree agree on which
 * extents survive and hide separators.
 */
export function acceptMatches(matches: Match[]): Match[] {
	const accepted: Match[] = []
	let last: Match | null = null
	for (const match of matches) {
		if (last && match.conflictsWith(last)) continue
		last = match
		accepted.push(match)
	}
	return accepted
}

/**
 * The whole row derivation, run to a FIXPOINT. One round is not enough: closing a
 * trailing gap can extend a match into a conflict the tree will drop, and a dropped
 * match must not keep hiding the separator occurrences inside its extent — so the
 * pass re-derives boundaries and closures over the surviving set until a round drops
 * nothing. Terminates: every extra round strictly shrinks the accepted list.
 */
export function rowPass(
	matches: Match[],
	value: string,
	separator: string
): {accepted: Match[]; separators: PositionRange[]} {
	// Closure mutates `end`; re-derivation needs the segment end back
	const segmentEnds = new Map<Match, number>()
	for (const match of matches) segmentEnds.set(match, match.end)

	let accepted = acceptMatches(matches)
	for (;;) {
		for (const match of accepted) {
			const {trailingGap} = match.descriptor
			const segmentEnd = segmentEnds.get(match)
			if (trailingGap && segmentEnd !== undefined) {
				match.end = segmentEnd
				match.gaps[trailingGap] = undefined
			}
		}
		const separators = findSeparators(value, separator, accepted)
		closeTrailingGaps(accepted, separators, value.length)
		const survivors = acceptMatches(accepted)
		if (survivors.length === accepted.length) return {accepted, separators}
		accepted = survivors
	}
}

/**
 * Separator occurrences that delimit rows: every occurrence lying outside all
 * accepted match extents. An occurrence inside an extent is that markup's own
 * text — an opaque `__value__`/`__meta__` interior (a code block's internal
 * `'\n\n'`), a closed slot's interior, or a literal the occurrence straddles —
 * and is never a row boundary.
 */
function findSeparators(value: string, separator: string, matches: Match[]): PositionRange[] {
	const extents = mergeExtents(matches)
	const result: PositionRange[] = []
	let extentIndex = 0
	let at = value.indexOf(separator)
	while (at !== -1) {
		const end = at + separator.length
		// Occurrences only ever move forward, so the cursor into the disjoint
		// extents never rewinds: one walk covers the whole document.
		while (extentIndex < extents.length && extents[extentIndex].end <= at) extentIndex++
		const overlaps = extentIndex < extents.length && extents[extentIndex].start < end
		if (!overlaps) {
			result.push({start: at, end})
			at = value.indexOf(separator, end)
		} else {
			// A HIDDEN occurrence advances one char, not its own length: a valid
			// occurrence may start inside the hidden span ('- item\n' followed by
			// '\n\n' shares its first newline with the markup's literal), and
			// skipping the whole span would fuse two rows of plain text.
			at = value.indexOf(separator, at + 1)
		}
	}
	return result
}

/**
 * The accepted extents as a disjoint, ascending cover. Matches nest and touch,
 * so their extents are not disjoint on their own; the union is, and an
 * occurrence overlaps some match exactly when it overlaps the union.
 *
 * Requires `matches` sorted by `start` — `PatternMatcher` keeps its completed
 * list in that order and nothing downstream moves a `start`.
 */
function mergeExtents(matches: Match[]): PositionRange[] {
	const extents: PositionRange[] = []
	let current: PositionRange | undefined
	for (const match of matches) {
		if (current && match.start <= current.end) {
			if (match.end > current.end) current.end = match.end
		} else {
			current = {start: match.start, end: match.end}
			extents.push(current)
		}
	}
	return extents
}

/**
 * The first row boundary at or after `position`. `findSeparators` emits its
 * occurrences in ascending order, so the lookup is a lower bound — the match a
 * linear scan would have stopped at, without walking every earlier boundary.
 */
function firstBoundaryFrom(separators: PositionRange[], position: number): PositionRange | undefined {
	let left = 0
	let right = separators.length

	while (left < right) {
		const mid = Math.floor((left + right) / 2)
		if (separators[mid].start < position) {
			left = mid + 1
		} else {
			right = mid
		}
	}

	return separators[left]
}

/**
 * Closes every open trailing gap FORWARD: from the match's last segment to the
 * next row boundary, bounded by the enclosing slot when the match is nested,
 * else by end of input. The local, declared replacement for the backwards
 * document-wide chain (`resolveSlotLeadingMatches`), which cannot tell a
 * leading marker from a trailing delimiter and extends the wrong way.
 *
 * Mutates `gaps` and `end` in place; matches arrive sorted by start, so every
 * enclosing slot is already closed when its children are visited.
 */
export function closeTrailingGaps(matches: Match[], separators: PositionRange[], valueLength: number): void {
	const enclosing: Match[] = []
	for (const match of matches) {
		while (enclosing.length > 0) {
			const parentSlot = enclosing[enclosing.length - 1].gaps.slot
			if (parentSlot && match.start >= parentSlot.start && match.end <= parentSlot.end) break
			enclosing.pop()
		}

		const {trailingGap} = match.descriptor
		if (trailingGap) {
			const boundary = firstBoundaryFrom(separators, match.end)
			// The stack holds slot-gapped matches only, so the parent's slot is always present
			const scopeEnd = enclosing[enclosing.length - 1]?.gaps.slot?.end ?? valueLength
			const end = Math.max(match.end, Math.min(boundary?.start ?? valueLength, scopeEnd))
			match.gaps[trailingGap] = {start: match.end, end}
			match.end = end
		}

		if (match.gaps.slot) {
			enclosing.push(match)
		}
	}
}

/**
 * Groups the built top level into rows. Every span between boundaries is a row;
 * a text token spanning a boundary is sliced, the separator's own text is
 * consumed by the row (its `content`/`position`), and `children` keep the
 * parser's edge invariant — they always start and end with a text token, so an
 * empty row carries ONE empty text child (its caret target), never zero.
 *
 * The piece after the final separator is a row even when empty (issue 08's
 * trailing convention): Enter at the document end always yields a visible row.
 */
export function groupRows(tokens: Token[], separators: PositionRange[], value: string): RowToken[] {
	const rows: RowToken[] = []
	let rowStart = 0
	let index = 0

	const spans: {contentEnd: number; rowEnd: number; terminated: boolean}[] = [
		...separators.map(separator => ({contentEnd: separator.start, rowEnd: separator.end, terminated: true})),
		{contentEnd: value.length, rowEnd: value.length, terminated: false},
	]

	for (const {contentEnd, rowEnd, terminated} of spans) {
		const children: Token[] = []

		while (index < tokens.length) {
			const token = tokens[index]
			if (token.position.start < contentEnd) {
				if (token.type === 'mark') {
					children.push(token)
				} else {
					children.push(
						createTextToken(
							value,
							Math.max(token.position.start, rowStart),
							Math.min(token.position.end, contentEnd)
						)
					)
				}
			}
			// A token reaching past this row's end continues into the next row
			if (token.position.end > rowEnd) break
			index++
		}

		if (children.length === 0 || children[0].type !== 'text') {
			children.unshift(createTextToken(value, rowStart, rowStart))
		}
		if (children[children.length - 1].type !== 'text') {
			children.push(createTextToken(value, contentEnd, contentEnd))
		}

		rows.push({
			type: 'row',
			content: value.slice(rowStart, rowEnd),
			position: {start: rowStart, end: rowEnd},
			children,
			terminated,
		})
		rowStart = rowEnd
	}

	return rows
}