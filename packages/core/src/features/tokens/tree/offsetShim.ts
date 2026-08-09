import {gapWindow} from './gapWindow'
import type {Window} from './types'

/**
 * The internal offset shim (spec D8): a global `{start, end}` range → the
 * `applyRange` primitive. Block mode, the keyboard, the clipboard and the overlay
 * still address the document by offsets; they lower here until the block-rows
 * follow-up (§9) gives them node-anchored verbs. Its lifetime is that follow-up's,
 * NOT S1.7's.
 *
 * `end < 0` means "to the end of the value" — the sentinel `EditController`
 * documents and the seven whole-value call sites use (`BlockController.ts:35`,
 * `blockEdit.ts:84,132,278`, `input.ts:37,60,129`).
 *
 * WHOLE-VALUE ops are re-derived through `gapWindow` instead of being passed
 * through as `{0, length}`. Those callers synthesize a complete new string and have
 * no real edit span; a full window makes both adoption walks inert, so every row is
 * re-paired BY INDEX and deleting row 2 of three keeps row 2's node (now holding
 * row 3's content) while row 3's node dies — moving `BlockController`'s per-row
 * store onto the wrong row. Measured, and gated in offsetShim.spec.ts, together
 * with the case where the narrowing does NOT help (rows repeating the separator).
 *
 * Sub-range ops pass through untouched: their window already IS the exact op
 * window (spec D2), and narrowing it further would move `map`'s fixed point for no
 * identity gain.
 */
export function lowerReplace(
	value: string,
	range: {readonly start: number; readonly end: number},
	replacement: string
): {window: Window; text: string} | undefined {
	const end = range.end < 0 ? value.length : range.end
	if (range.start < 0 || end < range.start || end > value.length) return undefined
	if (range.start !== 0 || end !== value.length) {
		return {window: {start: range.start, end, insertedLength: replacement.length}, text: replacement}
	}
	const window = gapWindow(value, replacement)
	return {window, text: replacement.slice(window.start, window.start + window.insertedLength)}
}