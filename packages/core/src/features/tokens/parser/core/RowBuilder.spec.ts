import {faker} from '@faker-js/faker'
import {beforeEach, describe, expect, it} from 'vitest'

import {Parser} from '../Parser'
import type {Markup, PositionRange, RowConfig, RowToken} from '../types'
import {MarkupRegistry} from './MarkupRegistry'
import type {Match} from './Match'
import {PatternMatcher} from './PatternMatcher'
import {acceptMatches, closeTrailingGaps, groupRows} from './RowBuilder'
import {SegmentMatcher} from './SegmentMatcher'
import {TreeBuilder} from './TreeBuilder'

/**
 * The row pass answers two questions per round — which separator occurrences a
 * match hides, and which boundary an open trailing gap closes at — and each was
 * once a scan of the whole other list. This file is the oracle for the walk and
 * the binary search that replaced those scans: the naive shape is kept here, so
 * equivalence is asserted against runnable code rather than against a claim.
 *
 * RETIRE THIS FILE WITH THE ROW PASS. The oracle is a copy of `rowPass` whole, not
 * of the two answers alone, so it also pins rules P0 never touched: change the
 * closure scope or the fixpoint and it reddens under a name that blames the walk.
 * Once the parser carves the block skeleton first, `rowPass` is gone and this
 * asserts equality with a pass that no longer exists — delete it then, do not
 * re-copy the production code into it.
 */

const FAKER_SEED = 8_252_026
const ITERATIONS = 40_000
/**
 * `separator` is an arbitrary public string (`PropsModel.ts`), so the corpus does
 * not stop at the two defaults: the last four collide with the markup literals,
 * which is the one shape a newline-joined document cannot produce — an occurrence
 * that IS part of a match's own text.
 */
const SEPARATORS = ['\n', '\n\n', '**', '```', '@[', '|'] as const

const MARKUPS: Markup[] = [
	'# __slot__',
	'- __slot__',
	'**__slot__**',
	'@[__value__](__meta__)',
	'```__meta__\n__value__\n```',
]

// ── The pre-P0 row pass, kept runnable ──────────────────────────────────────

/** One `matches.some(...)` per separator occurrence: O(S·M). */
function referenceFindSeparators(value: string, separator: string, matches: Match[]): PositionRange[] {
	const result: PositionRange[] = []
	let at = value.indexOf(separator)
	while (at !== -1) {
		const end = at + separator.length
		const overlaps = matches.some(match => match.start < end && match.end > at)
		if (!overlaps) {
			result.push({start: at, end})
			at = value.indexOf(separator, end)
		} else {
			at = value.indexOf(separator, at + 1)
		}
	}
	return result
}

/** One `separators.find(...)` per match with a trailing gap: O(S·M). */
function referenceCloseTrailingGaps(matches: Match[], separators: PositionRange[], valueLength: number): void {
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

function referenceRowPass(
	matches: Match[],
	value: string,
	separator: string
): {accepted: Match[]; separators: PositionRange[]} {
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
		const separators = referenceFindSeparators(value, separator, accepted)
		referenceCloseTrailingGaps(accepted, separators, value.length)
		const survivors = acceptMatches(accepted)
		if (survivors.length === accepted.length) return {accepted, separators}
		accepted = survivors
	}
}

/** `Parser.parseRows` with the two scans in place of the walk and the search. */
class ReferenceParser {
	private readonly segmentMatcher: SegmentMatcher
	private readonly patternMatcher: PatternMatcher
	private readonly treeBuilder = new TreeBuilder()

	constructor(markups: Markup[]) {
		const registry = new MarkupRegistry(markups)
		this.segmentMatcher = new SegmentMatcher(registry.segments)
		this.patternMatcher = new PatternMatcher(registry)
	}

	parseRows(value: string, {separator}: RowConfig): RowToken[] {
		const segments = this.segmentMatcher.search(value)
		const {accepted, separators} = referenceRowPass(this.patternMatcher.process(segments), value, separator)
		return groupRows(this.treeBuilder.build(accepted, value), separators, value)
	}
}

// ── Fuzz corpus ─────────────────────────────────────────────────────────────

/**
 * Four shapes carry the pass's edge cases and all are deliberately frequent
 * here: an opener with an empty body (`'# '`) puts a boundary at exactly the
 * match's end, which is where a lower bound and an upper bound disagree; an
 * unclosed fence leaves a trailing gap that has to travel to a boundary across
 * separator occurrences its own literal hides; a mark inside a closed slot is
 * the only shape whose extents nest, which is what makes the union of extents
 * differ from the extents themselves; and case 11 is the only shape that drives
 * the fixpoint past ONE round — a mention whose closure extends the bold into a
 * conflict the tree drops, so the pass must re-derive boundaries over the
 * survivors. Without it the corpus terminated in a single round on all 40 000
 * documents and asserted nothing about the walk's per-round reset.
 */
function generateRow(separator: string): string {
	switch (faker.number.int({min: 0, max: 12})) {
		case 0:
			return `# ${faker.lorem.word()}`
		case 1:
			return '# '
		case 2:
			return `- ${faker.lorem.word()}`
		case 3:
			return '- '
		case 4:
			return `${faker.lorem.word()} **${faker.lorem.word()}** ${faker.lorem.word()}`
		case 5:
			return `@[${faker.string.alpha(3)}](${faker.string.alpha(2)}) ${faker.lorem.word()}`
		case 6:
			return '```js'
		case 7:
			return '```'
		case 8:
			return ''
		case 9:
			return `**${faker.lorem.word()} @[${faker.string.alpha(3)}](${faker.string.alpha(2)}) ${faker.lorem.word()}**`
		case 10:
			return `**# ${faker.lorem.word()}**`
		case 11:
			return `**# ${faker.lorem.word()} @[${faker.string.alpha(3)}](${faker.string.alpha(2)}**${separator}${faker.string.alpha(2)})`
		default:
			return faker.lorem.words({min: 1, max: 3})
	}
}

function generateDocument(separator: string): string {
	const rows = Array.from({length: faker.number.int({min: 1, max: 5})}, () => generateRow(separator))
	return rows.join(separator) + (faker.datatype.boolean() ? separator : '')
}

/** Every field, with descriptors reduced to the markup index two registries agree on. */
function serialize(rows: RowToken[]): string {
	return JSON.stringify(rows, (key: string, value: unknown) =>
		key === 'descriptor' && typeof value === 'object' && value !== null && 'index' in value ? value.index : value
	)
}

// ── Cost corpus ─────────────────────────────────────────────────────────────

function generateLargeDocument(count: number, separator: string): string {
	const rows: string[] = []
	for (let index = 0; index < count; index++) {
		switch (index % 7) {
			case 0:
				rows.push(`# Heading ${index}`)
				break
			case 1:
				rows.push(`text ${index} **bold ${index}** tail`)
				break
			case 2:
				rows.push(`hi @[user${index}](id${index}) there`)
				break
			case 3:
				rows.push('- ')
				break
			default:
				rows.push(`plain paragraph number ${index} with some filler words`)
		}
	}
	return rows.join(separator)
}

/**
 * Median per-parse cost. Each sample times a batch: `performance.now()` is
 * coarsened to 0.1 ms in the browser, which alone would put ±20% on the
 * thousand-row reading the ratios divide by.
 */
function costOf(parser: Parser, value: string, separator: string): number {
	const BATCH = 4
	for (let round = 0; round < 3; round++) parser.parseRows(value, {separator})

	const samples: number[] = []
	for (let round = 0; round < 7; round++) {
		const started = performance.now()
		for (let call = 0; call < BATCH; call++) parser.parseRows(value, {separator})
		samples.push((performance.now() - started) / BATCH)
	}
	return samples.toSorted((a, b) => a - b)[3]
}

describe('row pass', () => {
	beforeEach(() => {
		faker.seed(FAKER_SEED)
	})

	it('answers exactly what the scans answered, over the whole fuzz corpus', () => {
		const parser = new Parser(MARKUPS)
		const reference = new ReferenceParser(MARKUPS)
		const mismatches: string[] = []

		for (let iteration = 0; iteration < ITERATIONS; iteration++) {
			const separator = SEPARATORS[iteration % SEPARATORS.length]
			const value = generateDocument(separator)

			if (
				serialize(parser.parseRows(value, {separator})) !== serialize(reference.parseRows(value, {separator}))
			) {
				mismatches.push(`separator ${JSON.stringify(separator)}, value ${JSON.stringify(value)}`)
			}
		}

		expect({count: mismatches.length, sample: mismatches.slice(0, 3)}).toEqual({count: 0, sample: []})
	})

	/**
	 * A growth factor, not a millisecond budget. Absolutes move ±35% between runs
	 * of the same code and further between machines, so a budget would either be
	 * flaky or so loose it pins nothing; what the two scans cost is growth with
	 * rows × matches, which shows as cost outrunning its input. Measured on this
	 * corpus: eight times the rows costs ~8× with the walk and the search, and
	 * ~60× with the scans.
	 */
	it('costs no more than its input grows', () => {
		const parser = new Parser(MARKUPS)
		const separator = '\n\n'

		const base = costOf(parser, generateLargeDocument(1000, separator), separator)
		const quadruple = costOf(parser, generateLargeDocument(4000, separator), separator)
		const octuple = costOf(parser, generateLargeDocument(8000, separator), separator)

		const scale = `1000 rows ${base.toFixed(2)}ms, 4000 rows ${quadruple.toFixed(2)}ms, 8000 rows ${octuple.toFixed(2)}ms`
		expect(quadruple / base, scale).toBeLessThan(10)
		expect(octuple / base, scale).toBeLessThan(20)
	})

	/**
	 * The growth pin above cannot see the binary search, and no tightening of it
	 * will: the scan it replaced is O(boundaries) per gap at EVERY rung, so it
	 * inflates the thousand-row baseline the ratios divide by along with the top
	 * rung. Measured on this corpus, 8000/1000 reads 8.1x with the search and
	 * 16.6x with the scan — a real 2.3x of runtime that both readings hide inside
	 * a tolerance the ±35% on absolutes forces the pin to keep.
	 *
	 * Probe count sees it exactly and owes nothing to the machine: a lower bound
	 * reads ~log2(boundaries) per gap, a scan from the front ~boundaries/2. The
	 * limit is per gap, so a corpus that stopped producing trailing gaps would
	 * divide by zero and redden rather than pass vacuously.
	 */
	it('reaches a gap boundary without reading the boundaries before it', () => {
		const separator = '\n\n'
		const value = generateLargeDocument(1000, separator)
		const registry = new MarkupRegistry(MARKUPS)
		const segments = new SegmentMatcher(registry.segments).search(value)
		const matches = acceptMatches(new PatternMatcher(registry).process(segments))

		const boundaries: PositionRange[] = []
		for (let at = value.indexOf(separator); at !== -1; at = value.indexOf(separator, at + separator.length)) {
			boundaries.push({start: at, end: at + separator.length})
		}

		let reads = 0
		const counted = new Proxy(boundaries, {
			get(target, key, receiver) {
				if (typeof key === 'string' && Number.isInteger(Number(key))) reads++
				return Reflect.get(target, key, receiver)
			},
		})

		const gaps = matches.filter(match => match.descriptor.trailingGap).length
		closeTrailingGaps(matches, counted, value.length)

		const probe = `${reads} reads for ${gaps} gaps over ${boundaries.length} boundaries`
		expect(reads / gaps, probe).toBeLessThan(20)
	})
})