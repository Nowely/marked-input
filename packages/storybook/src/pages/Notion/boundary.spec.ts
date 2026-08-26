import {describe, expect, it} from 'vitest'

/**
 * THE ACCEPTANCE TEST OF THE WHOLE EFFORT, and it is a grep.
 *
 * The claim the thirteen phases were built to make good is that a Notion-shaped editor is
 * OPTIONS AND COMPONENTS — that nothing about typed, nested rows has to be reached for from
 * outside the published API. Two readings say so, and both are mechanical rather than
 * argumentative:
 *
 * 1. every import the showcase makes resolves to `react`, to `@markput/react`, or to a file
 *    inside this directory. Reaching into `@markput/core/src` is the failure this names, and so
 *    is a relative path that climbs out of `pages/Notion/`;
 * 2. the two store members a consumer would reach for if the option API were not enough —
 *    `.edit`, the raw text write, and `.tokens`, the seam — appear nowhere, and neither does
 *    `useMarkput`, the one published door through which either could be reached.
 *
 * Sources are read with `import.meta.glob`, not `node:fs`, so the check is a pure Vite read and
 * does not depend on the working directory the runner was started from.
 *
 * IT SCANS ITS OWN DIRECTORY, which until 2026-08-26 was the workspace package `@markput/notion`.
 * The scope moved with the code and `ALLOWED` did not, deliberately: the only import the move
 * would otherwise have added is `@markput/core`, and that is the very door this file exists to
 * keep shut. What it took instead was publishing `Suggestion` from the adapters, which is where
 * the type belonged.
 *
 * WHAT IS EXCLUDED AND WHY. `*.stories.*` and `*.spec.*` are the harness — Storybook's own
 * `Meta`/`StoryObj`, Vitest, the browser locators — none of which a consumer ships. Everything
 * else is in, and `Notion.fixtures.react.tsx` is IN ON PURPOSE: it is the file that builds the
 * `options` array the editor is handed, which makes it the exact place a workaround would live.
 * Excluding it would leave five green assertions looking like a fence.
 */
const sources: Record<string, string> = import.meta.glob('./**/*.{ts,tsx}', {
	query: '?raw',
	import: 'default',
	eager: true,
})

/** Comments are stripped first, so the prose above cannot fail the check it describes. */
function stripComments(source: string): string {
	return source.replaceAll(/\/\*[\s\S]*?\*\//g, '').replaceAll(/\/\/[^\n]*/g, '')
}

/** The harness: Storybook's own types, Vitest, the browser locators. A consumer ships none of it. */
const HARNESS = /\.(?:spec|stories)\.[^/]+$/

const isSource = (path: string) => !HARNESS.test(path)

const files = Object.entries(sources).filter(([path]) => isSource(path))

/**
 * Every `from '…'`, `import '…'` and `import('…')` specifier — every module the showcase pulls
 * in. EITHER QUOTE, because a fence that only sees one of them is not a fence: a deep core import
 * written with double quotes passed this file at 4/4 green until the alternation was widened.
 */
function specifiersOf(source: string): string[] {
	return [...stripComments(source).matchAll(/(?:from|import)\s*\(?\s*['"]([^'"]+)['"]/g)].map(match => match[1])
}

const ALLOWED = new Set(['react', '@markput/react'])

describe('the Notion showcase is options and components', () => {
	it('imports the published adapter, React, and its own files — nothing else', () => {
		const offenders = files.flatMap(([path, source]) =>
			specifiersOf(source)
				.filter(specifier => !ALLOWED.has(specifier))
				.filter(specifier => !specifier.startsWith('./') && !specifier.startsWith('../'))
				.map(specifier => `${path}: ${specifier}`)
		)

		expect(offenders).toEqual([])
	})

	it('climbs out of the showcase directory in no relative import', () => {
		const offenders = files.flatMap(([path, source]) =>
			specifiersOf(source)
				// `import.meta.glob` keys are relative to THIS file, which sits at the directory
				// root, so a path leaving the showcase shows up as a resolved depth below 0.
				.filter(specifier => specifier.startsWith('.'))
				.filter(specifier => escapes(path, specifier))
				.map(specifier => `${path}: ${specifier}`)
		)

		expect(offenders).toEqual([])
	})

	/**
	 * KEYED ON THE MEMBER REACHED, not on the receiver's NAME. `\bstore\.(edit|tokens)\b` was the
	 * first spelling and it fenced nothing: `useMarkput(s => s.tokens)` is the same reach through
	 * the same published door with the variable called something else, and it passed at 4/4 green.
	 * The showcase has no other `.edit` or `.tokens` member, so the wider pattern costs nothing.
	 *
	 * It is a SOURCE GREP, so computed access walks through it: `store['tok' + 'ens']` was measured
	 * and is not caught, while the same reach split across lines is. Left as is rather than grown
	 * into a parser, because there is no door behind it — the only published route to a store is
	 * `useMarkput`, which the next test forbids by name, and `MarkputHandle` exposes `focus()` and
	 * nothing else.
	 */
	it('reaches neither `.edit` nor `.tokens` on anything', () => {
		const offenders = files.flatMap(([path, source]) =>
			stripComments(source)
				.split('\n')
				.map((text, index) => ({line: index + 1, text}))
				.filter(entry => /\.\s*(?:edit|tokens)\b/.test(entry.text))
				.map(entry => `${path}:${entry.line} ${entry.text.trim()}`)
		)

		expect(offenders).toEqual([])
	})

	/**
	 * AND IT DOES NOT OPEN THE DOOR AT ALL. `useMarkput` is the adapter's published store hook and
	 * the only way a consumer reaches the store from outside; the member check above catches what
	 * you do with it, this catches holding it. A destructure — `const {tokens} = useMarkput(s => s)`
	 * — is invisible to a member grep and is not invisible here.
	 */
	it('imports no store hook from the adapter', () => {
		const offenders = files.filter(([, source]) => /\buseMarkput\b/.test(stripComments(source)))

		expect(offenders.map(([path]) => path)).toEqual([])
	})

	/**
	 * Every assertion above is `toEqual([])`, which an empty input satisfies — so this is the guard
	 * that the glob resolved something, and that the something is the right something.
	 *
	 * The two NAMED files are the load-bearing half. `options.tsx` is the block vocabulary and
	 * `Notion.fixtures.react.tsx` is the consumer wiring; a narrowed glob or a widened exclusion
	 * that drops either one turns this file into decoration, and a count alone would not notice.
	 */
	it('scans the whole showcase, so an empty answer came from looking', () => {
		expect(files.length).toBeGreaterThan(20)
		expect(files.some(([path]) => path.endsWith('/options.tsx'))).toBe(true)
		expect(files.some(([path]) => path.endsWith('/Notion.fixtures.react.tsx'))).toBe(true)
	})
})

/**
 * Does `specifier`, resolved against `from`, leave `pages/Notion/`? The glob's keys start at
 * `./`, this file's own directory, so depth 0 IS the showcase root.
 */
function escapes(from: string, specifier: string): boolean {
	let depth = 0
	for (const part of from.split('/').slice(0, -1)) {
		if (part === '..') depth -= 1
		else if (part !== '.' && part !== '') depth += 1
	}
	for (const part of specifier.split('/')) {
		if (part === '..') {
			depth -= 1
			if (depth < 0) return true
		} else if (part !== '.' && part !== '') depth += 1
	}
	return false
}