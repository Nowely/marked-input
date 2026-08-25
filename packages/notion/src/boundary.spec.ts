import {describe, expect, it} from 'vitest'

/**
 * THE ACCEPTANCE TEST OF THE WHOLE EFFORT, and it is a grep.
 *
 * The claim the thirteen phases were built to make good is that a Notion-shaped editor is
 * OPTIONS AND COMPONENTS — that nothing about typed, nested rows has to be reached for from
 * outside the published API. Two readings say so, and both are mechanical rather than
 * argumentative:
 *
 * 1. every import this package makes resolves to `react`, to `@markput/react`, or to a file
 *    inside the package. Reaching into `@markput/core/src` is the failure this names, and so is
 *    a relative path that climbs out of `packages/notion/`;
 * 2. the two store members a consumer would reach for if the option API were not enough —
 *    `.edit`, the raw text write, and `.tokens`, the seam — appear nowhere, and neither does
 *    `useMarkput`, the one published door through which either could be reached.
 *
 * Sources are read with `import.meta.glob`, not `node:fs`, so the check is a pure Vite read and
 * does not depend on the working directory the runner was started from.
 */
const sources: Record<string, string> = import.meta.glob('../**/*.{ts,tsx}', {
	query: '?raw',
	import: 'default',
	eager: true,
})

/** Comments are stripped first, so the prose above cannot fail the check it describes. */
function stripComments(source: string): string {
	return source.replaceAll(/\/\*[\s\S]*?\*\//g, '').replaceAll(/\/\/[^\n]*/g, '')
}

const isSource = (path: string) => !path.endsWith('.spec.ts') && !path.endsWith('.spec.tsx')

const files = Object.entries(sources).filter(([path]) => isSource(path))

/**
 * Every `from '…'`, `import '…'` and `import('…')` specifier — every module this package pulls
 * in. EITHER QUOTE, because a fence that only sees one of them is not a fence: a deep core import
 * written with double quotes passed this file at 4/4 green until the alternation was widened.
 */
function specifiersOf(source: string): string[] {
	return [...stripComments(source).matchAll(/(?:from|import)\s*\(?\s*['"]([^'"]+)['"]/g)].map(match => match[1])
}

const ALLOWED = new Set(['react', '@markput/react'])

describe('@markput/notion is options and components', () => {
	it('imports the published adapter, React, and its own files — nothing else', () => {
		const offenders = files.flatMap(([path, source]) =>
			specifiersOf(source)
				.filter(specifier => !ALLOWED.has(specifier))
				.filter(specifier => !specifier.startsWith('./') && !specifier.startsWith('../'))
				.map(specifier => `${path}: ${specifier}`)
		)

		expect(offenders).toEqual([])
	})

	it('climbs out of the package in no relative import', () => {
		const offenders = files.flatMap(([path, source]) =>
			specifiersOf(source)
				// `import.meta.glob` keys are relative to THIS file, one level inside `src/`, so a
				// path leaving the package shows up as a resolved depth below the package root.
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
	 * The package has no other `.edit` or `.tokens` member, so the wider pattern costs nothing.
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

	it('scans the package, so an empty answer came from looking', () => {
		// Every assertion above is `toEqual([])`, which an empty input satisfies. This is the
		// guard that the glob resolved something.
		expect(files.length).toBeGreaterThan(20)
		expect(files.some(([path]) => path.endsWith('options.tsx'))).toBe(true)
	})
})

/**
 * Does `specifier`, resolved against `from`, leave `packages/notion/`? The glob's keys start at
 * `../`, one level up from this file, so depth 0 IS the package root.
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