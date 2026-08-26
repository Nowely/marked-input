import {readdirSync, readFileSync} from 'node:fs'
import {dirname, join, relative} from 'node:path'
import {fileURLToPath} from 'node:url'

import {describe, expect, it} from 'vitest'

import {checkSamples} from './compile'
import {extractSamples, type Sample} from './extract'

const DOCS = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'content', 'docs')

/**
 * TypeDoc rewrites `api/` from the adapter's own source on every build, and its fences are
 * extracted member signatures (`optional children: ReactNode;`) rather than samples. There is
 * nothing there that can drift from the code, and nothing a reader pastes.
 */
const GENERATED = 'api'

/**
 * How many fences may say `sketch` — a fence that leaves the check because it is not code, only an
 * illustration. The number is pinned so reaching for one is a decision someone has to make, rather
 * than the easy way past a sample that stopped compiling.
 */
const SKETCH_BUDGET = 8

function pages(dir: string): string[] {
	return readdirSync(dir, {withFileTypes: true}).flatMap(entry => {
		const path = join(dir, entry.name)
		if (entry.isDirectory()) return pages(path)
		return /\.mdx?$/.test(entry.name) ? [path] : []
	})
}

const files = pages(DOCS)
	.sort()
	.map(path => ({
		slug: relative(DOCS, path).replaceAll('\\', '/'),
		text: readFileSync(path, 'utf8'),
	}))

const byPage = new Map<string, Sample[]>()
for (const {slug, text} of files) {
	if (slug.startsWith(`${GENERATED}/`)) continue
	const samples = extractSamples(text, slug)
	if (samples.length > 0) byPage.set(slug, samples)
}

const all = [...byPage.values()].flat()
const errors = checkSamples(all)

describe('doc samples type-check', () => {
	it.each([...byPage.keys()])('%s', file => {
		const mine = errors.filter(error => error.where.startsWith(`packages/website/src/content/docs/${file}:`))
		expect(mine.map(error => `${error.where}  ${error.message}`).join('\n')).toBe('')
	})

	it('every error it can find is addressed to a page it read', () => {
		const stray = errors.filter(error => ![...byPage.keys()].some(file => error.where.includes(`/docs/${file}:`)))
		expect(stray).toEqual([])
	})

	it('spends no more of the sketch budget than agreed', () => {
		const sketches = all.filter(sample => sample.directives.sketch !== null)
		expect(sketches.map(s => `${s.file}:${s.line} — ${s.directives.sketch}`)).toHaveLength(SKETCH_BUDGET)
	})
})

/** `](/guides/rows)` and friends: a site-absolute link, with an optional `#anchor`. */
const INTERNAL_LINK = /]\((\/[^)#\s]*)(?:#[^)\s]*)?\)/g

/** Starlight's own slug for a content file: lower-cased, extension dropped, `index` collapsed. */
function slugOf(file: string): string {
	const path = `/${file.replace(/\.mdx?$/, '').toLowerCase()}`
	return path.endsWith('/index') ? path.slice(0, -'/index'.length) : path
}

describe('doc links resolve', () => {
	// Prose is where `effectScope` and `store.bus` outlived the code, and a link is the part of
	// prose a machine CAN read. The generated `api/` tree is a link target here even though it is
	// not a sample source: a renamed interface takes its page's slug with it.
	const known = new Set(files.map(file => slugOf(file.slug)))

	it.each(files.filter(file => !file.slug.startsWith(`${GENERATED}/`)).map(file => file.slug))('%s', slug => {
		const text = files.find(file => file.slug === slug)!.text
		const broken = [...text.matchAll(INTERNAL_LINK)]
			.map(match => match[1]!)
			.filter(target => {
				const path = target.replace(/\/$/, '').toLowerCase()
				return path !== '' && !known.has(path)
			})
		expect(broken).toEqual([])
	})
})