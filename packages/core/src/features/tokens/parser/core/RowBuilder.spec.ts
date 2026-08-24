import {faker} from '@faker-js/faker'
import {beforeEach, describe, expect, it} from 'vitest'

import {Parser} from '../Parser'
import type {Markup, PositionRange, RowToken} from '../types'
import {MarkupRegistry} from './MarkupRegistry'
import type {Match} from './Match'
import {PatternMatcher} from './PatternMatcher'
import {acceptMatches, groupRows} from './RowBuilder'
import {SegmentMatcher} from './SegmentMatcher'
import {TreeBuilder} from './TreeBuilder'

/**
 * The row pass answers two questions per round — which separator occurrences a
 * match hides, and which boundary an open trailing gap closes at — and each was
 * once a scan of the whole other list. This file is the oracle for the walk and
 * the binary search that replaced those scans: the naive shape is kept here, so
 * equivalence is asserted against runnable code rather than against a claim.
 */

const FAKER_SEED = 8_252_026
const ITERATIONS = 40_000
const SEPARATORS = ['\n', '\n\n'] as const

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

	parseRows(value: string, separator: string): RowToken[] {
		const segments = this.segmentMatcher.search(value)
		const {accepted, separators} = referenceRowPass(this.patternMatcher.process(segments), value, separator)
		return groupRows(this.treeBuilder.build(accepted, value), separators, value)
	}
}

// ── Fuzz corpus ─────────────────────────────────────────────────────────────

/**
 * Three shapes carry the pass's edge cases and all are deliberately frequent
 * here: an opener with an empty body (`'# '`) puts a boundary at exactly the
 * match's end, which is where a lower bound and an upper bound disagree; an
 * unclosed fence leaves a trailing gap that has to travel to a boundary across
 * separator occurrences its own literal hides; and a mark inside a closed slot
 * is the only shape whose extents nest, which is what makes the union of
 * extents differ from the extents themselves.
 */
function generateRow(): string {
	switch (faker.number.int({min: 0, max: 11})) {
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
		default:
			return faker.lorem.words({min: 1, max: 3})
	}
}

function generateDocument(separator: string): string {
	const rows = Array.from({length: faker.number.int({min: 1, max: 5})}, generateRow)
	return rows.join(separator) + (faker.datatype.boolean() ? separator : '')
}

/** Every field, with descriptors reduced to the markup index two registries agree on. */
function serialize(rows: RowToken[]): string {
	return JSON.stringify(rows, (key: string, value: unknown) =>
		key === 'descriptor' && typeof value === 'object' && value !== null && 'index' in value ? value.index : value
	)
}

// ── Cost corpus ─────────────────────────────────────────────────────────────

function generateLargeDocument(rows: number, separator: string): string {
	const lines: string[] = []
	for (let index = 0; index < rows; index++) {
		switch (index % 7) {
			case 0:
				lines.push(`# Heading ${index}`)
				break
			case 1:
				lines.push(`text ${index} **bold ${index}** tail`)
				break
			case 2:
				lines.push(`hi @[user${index}](id${index}) there`)
				break
			case 3:
				lines.push('- ')
				break
			default:
				lines.push(`plain paragraph number ${index} with some filler words`)
		}
	}
	return lines.join(separator)
}

/**
 * Median per-parse cost. Each sample times a batch: `performance.now()` is
 * coarsened to 0.1 ms in the browser, which alone would put ±20% on the
 * thousand-row reading the ratios divide by.
 */
function costOf(parser: Parser, value: string, separator: string): number {
	const BATCH = 4
	for (let round = 0; round < 3; round++) parser.parseRows(value, separator)

	const samples: number[] = []
	for (let round = 0; round < 7; round++) {
		const started = performance.now()
		for (let call = 0; call < BATCH; call++) parser.parseRows(value, separator)
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

			if (serialize(parser.parseRows(value, separator)) !== serialize(reference.parseRows(value, separator))) {
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
})