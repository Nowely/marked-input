import type {Parser} from './parser/Parser'
import type {Token} from './parser/types'
import type {EditHint} from './tokenIdentity'

/** Stabilization budget: window widenings before the full-parse fallback. */
const MAX_WIDENINGS = 3

/**
 * Windowed incremental reparse: reparse only a window around the edit and
 * splice the result between the untouched prefix and the position-shifted
 * suffix of the previous top-level token stream.
 *
 * Contract (gated by `incrementalParse.property.spec.ts`): the result
 * deep-equals `parser.parse(nextValue)` for ANY document and ANY single edit —
 * correctness never depends on incrementality (design-spec guarantee). Every
 * guard below therefore falls back to a full parse rather than risk a
 * divergent splice.
 *
 * Algorithm:
 * 1. Validate the hint against both values (a bogus hint → full parse).
 * 2. Window in PREV coordinates: expand [hint.start, hint.end] to enclosing
 *    top-level token boundaries, widen by one whole token per side, then snap
 *    both endpoints outward to TEXT tokens — `parse()` emits a strictly
 *    alternating top-level stream (text, mark, …, text, empty texts included),
 *    so a window with text endpoints splices back into a valid stream.
 * 3. Inert-outside guard: segment pairing is non-local (the matcher pairs a
 *    close with the NEAREST unmatched open, which may sit arbitrarily far
 *    outside any bounded window — the doubling check alone cannot see it).
 *    Conservative rule: every text content outside the window (top-level text
 *    tokens, plus nested text/value/meta inside outside marks) must contain no
 *    markup segment at all; otherwise → full parse.
 * 4. Reparse `nextValue.slice(windowStart, windowEndPrev + delta)` and shift
 *    the resulting positions by +windowStart (recursive, new objects,
 *    including `slot` ranges).
 * 5. Stabilization (doubling check): reparse a window widened by its own width
 *    on each side; the spliced content of the two windows must be identical
 *    over the doubled range. Equal → accept; different → adopt the doubled
 *    window and retry, at most {@link MAX_WIDENINGS} times, then full parse.
 *    A window that grows to cover the whole document IS the full parse.
 * 6. Output: [prefix prev tokens (same objects, positions valid), reparsed
 *    window tokens, suffix prev tokens rebuilt with positions shifted by
 *    delta] — the identity layer reuses/inherits ids on top of this.
 */
export function incrementalParse(
	parser: Parser,
	prev: readonly Token[],
	prevValue: string,
	nextValue: string,
	hint: EditHint
): Token[] {
	const delta = hint.insertedLength - (hint.end - hint.start)

	// 1. The splice trusts the hint, so verify it: range within bounds, lengths
	// consistent, and the values actually identical outside the edited range.
	if (
		hint.start < 0 ||
		hint.end < hint.start ||
		hint.end > prevValue.length ||
		hint.insertedLength < 0 ||
		prevValue.length + delta !== nextValue.length ||
		prevValue.slice(0, hint.start) !== nextValue.slice(0, hint.start) ||
		prevValue.slice(hint.end) !== nextValue.slice(hint.start + hint.insertedLength)
	) {
		return parser.parse(nextValue)
	}

	// The previous tree must tile the previous value (parse() invariant; a
	// filtered or foreign tree must not be spliced).
	const last = prev.length - 1
	if (prev.length === 0 || prev[0].position.start !== 0 || prev[last].position.end !== prevValue.length) {
		return parser.parse(nextValue)
	}

	// 2. Window token range [lo, hi] (inclusive) in the previous stream.
	let lo = 0
	while (lo < last && prev[lo].position.end < hint.start) lo++
	let hi = last
	while (hi > 0 && prev[hi].position.start > hint.end) hi--
	lo = Math.max(0, lo - 1)
	hi = Math.min(last, hi + 1)
	while (lo > 0 && prev[lo].type !== 'text') lo--
	while (hi < last && prev[hi].type !== 'text') hi++

	// 3. Inert-outside guard. Outside regions only shrink under widening, so one
	// scan against the initial window stays valid for all later attempts.
	for (let i = 0; i < prev.length; i++) {
		if (i >= lo && i <= hi) continue
		if (!isInert(parser, prev[i])) return parser.parse(nextValue)
	}

	// 4–5. Parse the window, stabilize by doubling.
	let windowTokens = parseWindow(parser, prev, nextValue, delta, lo, hi)
	for (let attempt = 0; attempt <= MAX_WIDENINGS; attempt++) {
		if (!windowTokens) return parser.parse(nextValue)
		// Window grew to the whole document — this already IS the full parse.
		if (lo === 0 && hi === last) return windowTokens

		const [lo2, hi2] = widenIndices(prev, lo, hi)
		const window2Tokens = parseWindow(parser, prev, nextValue, delta, lo2, hi2)
		if (!window2Tokens) return parser.parse(nextValue)
		// What the accepted splice would place over the doubled range:
		const spliced = [
			...prev.slice(lo2, lo),
			...windowTokens,
			...prev.slice(hi + 1, hi2 + 1).map(token => shiftToken(token, delta)),
		]
		if (equalTokenLists(spliced, window2Tokens)) {
			// 6. Stable — splice.
			return [...prev.slice(0, lo), ...windowTokens, ...prev.slice(hi + 1).map(token => shiftToken(token, delta))]
		}
		lo = lo2
		hi = hi2
		windowTokens = window2Tokens
	}
	return parser.parse(nextValue)
}

/**
 * Recursively shift every position-bearing field of a token by `delta`,
 * producing new objects shaped exactly like TreeBuilder's output
 * (`position`, optional `slot.start/end`, children).
 */
export function shiftToken(token: Token, delta: number): Token {
	const position = {start: token.position.start + delta, end: token.position.end + delta}
	if (token.type === 'text') return {type: 'text', content: token.content, position}
	return {
		type: 'mark',
		content: token.content,
		children: token.children.map(child => shiftToken(child, delta)),
		descriptor: token.descriptor,
		value: token.value,
		meta: token.meta,
		position,
		slot: token.slot && {content: token.slot.content, start: token.slot.start + delta, end: token.slot.end + delta},
	}
}

/**
 * Reparse the window [lo, hi] (prev indices) against `nextValue`, shifted to
 * absolute positions. Returns `undefined` if the reparse does not exactly tile
 * the window range (defensive — `parse()` tiles its input by construction).
 */
function parseWindow(
	parser: Parser,
	prev: readonly Token[],
	nextValue: string,
	delta: number,
	lo: number,
	hi: number
): Token[] | undefined {
	const windowStart = prev[lo].position.start
	const windowEnd = prev[hi].position.end + delta
	const slice = nextValue.slice(windowStart, windowEnd)
	const parsed = parser.parse(slice)
	if (
		parsed.length === 0 ||
		parsed[0].position.start !== 0 ||
		parsed[parsed.length - 1].position.end !== slice.length
	) {
		return undefined
	}
	return parsed.map(token => shiftToken(token, windowStart))
}

/**
 * Widen [lo, hi] by the window's own character width on each side (at least
 * one token where an edge remains), snapping the endpoints back to text
 * tokens. Callers guarantee the window is not yet the whole document.
 *
 * Text-snapping shares the alternation-invariant rationale of step 2 in the
 * main JSDoc: the top-level stream strictly alternates text↔mark (empty text
 * tokens included), so a window with text endpoints always splices back into
 * a valid stream regardless of how the widenings grew it.
 */
function widenIndices(prev: readonly Token[], lo: number, hi: number): [number, number] {
	const last = prev.length - 1
	const width = prev[hi].position.end - prev[lo].position.start
	const targetStart = prev[lo].position.start - width
	const targetEnd = prev[hi].position.end + width
	let lo2 = lo
	let hi2 = hi
	while (lo2 > 0 && prev[lo2].position.start > targetStart) lo2--
	while (hi2 < last && prev[hi2].position.end < targetEnd) hi2++
	// zero-width tokens can stall the loops — force progress where possible
	if (lo2 === lo && lo > 0) lo2 = lo - 1
	if (hi2 === hi && hi < last) hi2 = hi + 1
	while (lo2 > 0 && prev[lo2].type !== 'text') lo2--
	while (hi2 < last && prev[hi2].type !== 'text') hi2++
	return [lo2, hi2]
}

/**
 * No free text of this token may contain a markup segment: text content for
 * text tokens; value, meta and nested children for marks (a mark's own
 * delimiters are balanced — only the free text between them can pair with
 * segments inside the window). The children check is recursive — it descends
 * arbitrarily deep via `children.every`, so a deeply nested text token with a
 * stray segment will correctly prevent the fast path.
 */
function isInert(parser: Parser, token: Token): boolean {
	if (token.type === 'text') return !parser.hasSegments(token.content)
	if (parser.hasSegments(token.value)) return false
	if (token.meta !== undefined && parser.hasSegments(token.meta)) return false
	return token.children.every(child => isInert(parser, child))
}

function equalTokenLists(a: readonly Token[], b: readonly Token[]): boolean {
	if (a.length !== b.length) return false
	return a.every((token, i) => equalToken(token, b[i]))
}

function equalToken(a: Token, b: Token): boolean {
	if (a === b) return true
	if (a.type !== b.type || a.content !== b.content) return false
	if (a.position.start !== b.position.start || a.position.end !== b.position.end) return false
	if (a.type === 'mark' && b.type === 'mark') {
		if (a.descriptor !== b.descriptor || a.value !== b.value || a.meta !== b.meta) return false
		if ((a.slot === undefined) !== (b.slot === undefined)) return false
		if (
			a.slot &&
			b.slot &&
			(a.slot.content !== b.slot.content || a.slot.start !== b.slot.start || a.slot.end !== b.slot.end)
		) {
			return false
		}
		return equalTokenLists(a.children, b.children)
	}
	// text tokens: content + positions already checked above
	return true
}