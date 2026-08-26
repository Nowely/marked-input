import {describe, expect, it} from 'vitest'

/**
 * ADR-0003's own check, made real.
 *
 * The ADR states the rule as "a grep with a fixed allowlist", but no such grep existed
 * anywhere — not in CI, not in `oxlint.config.ts`, not in a script, and there is no
 * `scripts/` directory. The rule was enforced by review alone, which is how the row keymap
 * stayed on the allowlist after its last real read had become a comment.
 *
 * The rule: only `features/tokens/` may read a node's `position`, `slotRange` or `lead`.
 * Everything above it names positions with a `NodeAnchor`. Inside that directory both `tree/`
 * (which owns the coordinate space) and `parser/` (whose `Token.position` is a different,
 * parse-local record) read them freely, so the directory boundary IS the allowlist — there is
 * nothing left to enumerate.
 *
 * `lead` joined the list when rows began to nest: it is a row's structural bytes, so reading it
 * outside is the same escape as reading a raw offset — a caller could measure a depth from it and
 * disagree with the tree's own.
 *
 * Sources are read through `import.meta.glob`, not `node:fs`: the core project runs in
 * Chromium, so there is no filesystem at test time.
 */
const sources: Record<string, string> = import.meta.glob('./**/*.ts', {
	query: '?raw',
	import: 'default',
	eager: true,
})

/**
 * Comments are stripped before scanning, and that is not cosmetic — MEASURED, not assumed:
 * without the strip this check fails on `features/rows/RowController.ts:9`, whose comment
 * explains why its `drop.position` field is NOT one of these reads. A check that failed on prose
 * would be a check nobody could keep green honestly.
 */
function stripComments(source: string): string {
	return source.replaceAll(/\/\*[\s\S]*?\*\//g, '').replaceAll(/\/\/[^\n]*/g, '')
}

const OWNS_POSITIONS = 'features/tokens/'

function isGoverned(path: string): boolean {
	// `import.meta.glob` keys are relative to THIS file: './features/tokens/...'.
	if (path.includes(OWNS_POSITIONS)) return false
	if (path.includes('/__testing__/')) return false
	return !path.endsWith('.spec.ts')
}

describe('one address space (ADR-0003)', () => {
	it('forms no node position and reads no lead outside features/tokens/', () => {
		const offenders = Object.entries(sources)
			.filter(([path]) => isGoverned(path))
			.flatMap(([path, source]) =>
				stripComments(source)
					.split('\n')
					.map((line, index) => ({path, line: index + 1, text: line}))
					.filter(entry => /\.(?:position|slotRange|lead)\b/.test(entry.text))
					.map(entry => `${entry.path}:${entry.line} ${entry.text.trim()}`)
			)

		expect(offenders).toEqual([])
	})

	it('scans a meaningful number of files, so a broken glob cannot pass vacuously', () => {
		// The assertion above is `toEqual([])`, which an empty input satisfies. This is the
		// guard that the empty answer came from looking rather than from not looking.
		const governed = Object.keys(sources).filter(isGoverned)
		expect(governed.length).toBeGreaterThan(20)
		expect(Object.keys(sources).some(path => path.includes(OWNS_POSITIONS))).toBe(true)
	})
})