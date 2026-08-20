import type {Window} from './types'

/**
 * Boundary-reset window: common prefix/suffix of the two projections.
 *
 * Identical values give the empty window `{start: n, end: n, insertedLength: 0}`
 * pinned at the END of the value, not at 0 — `start` of an empty window is not
 * an edit location.
 */
export function gapWindow(previousValue: string, nextValue: string): Window {
	// Reads past the shorter value yield undefined and count as mismatches,
	// which caps both scans at the shorter value's length.
	let prefix = 0
	while (prefix < previousValue.length && previousValue[prefix] === nextValue[prefix]) prefix++

	let suffix = 0
	while (
		suffix < previousValue.length &&
		previousValue[previousValue.length - 1 - suffix] === nextValue[nextValue.length - 1 - suffix]
	) {
		suffix++
	}

	// Prefix and suffix may overlap (e.g. 'aa' → 'aaa'); clamp the suffix so the
	// window stays a valid range in both values.
	const clampedSuffix = Math.min(suffix, Math.min(previousValue.length, nextValue.length) - prefix)
	const start = prefix
	const end = previousValue.length - clampedSuffix
	const insertedLength = nextValue.length - clampedSuffix - start
	return {start, end, insertedLength}
}