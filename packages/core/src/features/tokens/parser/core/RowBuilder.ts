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
 * Keeps the matches `TreeBuilder.build` will accept, using its exact
 * single-lookback conflict rule, so the row pass and the tree agree on which
 * extents hide separators.
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
 * Separator occurrences that delimit rows: every occurrence lying outside all
 * accepted match extents. An occurrence inside an extent is that markup's own
 * text — an opaque `__value__`/`__meta__` interior (a code block's internal
 * `'\n\n'`), a closed slot's interior, or a literal the occurrence straddles —
 * and is never a row boundary.
 */
export function findSeparators(value: string, separator: string, matches: Match[]): PositionRange[] {
	const result: PositionRange[] = []
	let at = value.indexOf(separator)
	while (at !== -1) {
		const end = at + separator.length
		const overlaps = matches.some(match => match.start < end && match.end > at)
		if (!overlaps) {
			result.push({start: at, end})
		}
		at = value.indexOf(separator, end)
	}
	return result
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
			const boundary = separators.find(separator => separator.start >= match.end)
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