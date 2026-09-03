import type {Pairing, Window} from './types'

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

/**
 * The splice that takes the RESULT of `window` back to what it replaced: the same start, the two
 * lengths exchanged, and the pairing read the other way round.
 *
 * An undo is not a new edit, so it must not re-derive its window from the two strings — a
 * permutation is invisible to any such derivation ({@link Pairing}), and the rows would re-pair by
 * index. Inverting the recorded one is the only reading that keeps every row's identity, and it is
 * total: `pairing[j] = i` says previous row `i` became row `j`, so the reverse claim is `j` at `i`.
 */
export function invertWindow(window: Window): Window {
	return {
		start: window.start,
		end: window.start + window.insertedLength,
		insertedLength: window.end - window.start,
		pairing: window.pairing && invertPairing(window.pairing),
	}
}

/**
 * A permutation read backwards. A pairing that is NOT one leaves holes, which `resolvePairing`
 * refuses on its own — the claim degrades to adoption's ordinary walks rather than corrupting them.
 */
function invertPairing(pairing: Pairing): Pairing {
	const inverse: number[] = []
	pairing.forEach((previous, index) => {
		inverse[previous] = index
	})
	return inverse
}