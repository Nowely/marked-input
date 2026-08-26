import type {Match} from './Match'

/**
 * The two rules every inline pass shares, whichever scope it runs in: which overlapping matches
 * survive, and how far an open trailing gap reaches. They run per ROW now
 * (ADR-0010), so the scope is a row's body rather than the whole value, and neither rule needs to
 * know a separator exists.
 */

/**
 * The single conflict authority: drops every match that overlaps the last kept
 * one without nesting inside its slot. `TreeBuilder.build` assumes its input
 * already passed through here.
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
 * Closes every open trailing gap FORWARD: from the match's last segment to the end of its
 * enclosing scope — the enclosing slot when the match is nested, else the end of the parsed
 * span. The local, declared replacement for the backwards document-wide chain
 * (`resolveSlotLeadingMatches`), which cannot tell a leading marker from a trailing delimiter
 * and extends the wrong way.
 *
 * Mutates `gaps` and `end` in place; matches arrive sorted by start, so every
 * enclosing slot is already closed when its children are visited.
 */
export function closeTrailingGaps(matches: Match[], valueLength: number): void {
	const enclosing: Match[] = []
	for (const match of matches) {
		while (enclosing.length > 0) {
			const parentSlot = enclosing[enclosing.length - 1].gaps.slot
			if (parentSlot && match.start >= parentSlot.start && match.end <= parentSlot.end) break
			enclosing.pop()
		}

		const {trailingGap} = match.descriptor
		if (trailingGap) {
			// The stack holds slot-gapped matches only, so the parent's slot is always present
			const scopeEnd = enclosing[enclosing.length - 1]?.gaps.slot?.end ?? valueLength
			const end = Math.max(match.end, scopeEnd)
			match.gaps[trailingGap] = {start: match.end, end}
			match.end = end
		}

		if (match.gaps.slot) {
			enclosing.push(match)
		}
	}
}