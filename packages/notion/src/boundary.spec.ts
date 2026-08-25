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
 *    `store.edit`, the raw text write, and `store.tokens`, the seam — appear nowhere.
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

/** Every `from '…'` and `import '…'` specifier, which is every module this package pulls in. */
function specifiersOf(source: string): string[] {
	return [...stripComments(source).matchAll(/(?:from|import)\s+'([^']+)'/g)].map(match => match[1])
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

	it('calls neither store.edit nor store.tokens', () => {
		const offenders = files.flatMap(([path, source]) =>
			stripComments(source)
				.split('\n')
				.map((text, index) => ({line: index + 1, text}))
				.filter(entry => /\bstore\s*\.\s*(?:edit|tokens)\b/.test(entry.text))
				.map(entry => `${path}:${entry.line} ${entry.text.trim()}`)
		)

		expect(offenders).toEqual([])
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