import {findGap} from '../utils/findGap'
import type {Window} from './types'

/**
 * Boundary-reset window: common prefix/suffix of the two projections.
 *
 * Identical values give the empty window `{start: n, end: n, insertedLength: 0}`
 * pinned at the END of the value, not at 0 — `start` of an empty window is not
 * an edit location.
 *
 * findGap contract (see utils/findGap.spec.ts):
 * - `left` is the first diverging index, i.e. the common prefix length;
 *   undefined when the previous value is a prefix of the next one.
 * - `right` is the ABSOLUTE exclusive end of the gap in the PREVIOUS value
 *   (previous.length - commonSuffixLength); undefined when the previous value
 *   is a suffix of the next one. It is NOT measured from the end.
 */
export function gapWindow(previousValue: string, nextValue: string): Window {
	const gap = findGap(previousValue, nextValue)
	const prefix = gap.left ?? previousValue.length
	const suffix = gap.right === undefined ? previousValue.length : previousValue.length - gap.right
	// Prefix and suffix may overlap (e.g. 'aa' → 'aaa'); clamp the suffix so the
	// window stays a valid range in both values.
	const clampedSuffix = Math.min(suffix, Math.min(previousValue.length, nextValue.length) - prefix)
	const start = prefix
	const end = previousValue.length - clampedSuffix
	const insertedLength = nextValue.length - clampedSuffix - start
	return {start, end, insertedLength}
}