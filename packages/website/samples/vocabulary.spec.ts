import {readdirSync, readFileSync} from 'node:fs'
import {dirname, join, relative} from 'node:path'
import {fileURLToPath} from 'node:url'

import {describe, expect, it} from 'vitest'

/**
 * THE OTHER HALF OF THE ROT GUARD. `samples.spec.ts` type-checks what is inside a FENCE and
 * follows every internal link; this one reads the two things neither of those can see — the
 * glossary's own deletions, and the identifiers that sit in PROSE backticks, which is where
 * `effectScope` and `store.bus` outlived the code.
 *
 * It lives beside the sample harness because that is the one vitest project with a filesystem
 * (`environment: 'node'`) and no browser to boot, which is what a check that reads the repository
 * needs. `packages/core/src/addressSpace.spec.ts` is the same shape one package down, and its two
 * rules are copied here: comments are stripped before scanning, because a record is not a rename
 * target, and every scan carries a NON-VACUITY guard, because `toEqual([])` is satisfied by
 * looking at nothing.
 */

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..')

const DOCS = join(ROOT, 'packages', 'website', 'src', 'content', 'docs')

/** TypeDoc rewrites `api/` from source on every build — see `samples.spec.ts` for the same skip. */
const GENERATED = 'api'

const PACKAGE_SOURCES = [
	join(ROOT, 'packages', 'core', 'src'),
	join(ROOT, 'packages', 'react', 'markput', 'src'),
	join(ROOT, 'packages', 'vue', 'markput', 'src'),
]

function walk(dir: string, keep: (name: string) => boolean): string[] {
	return readdirSync(dir, {withFileTypes: true}).flatMap(entry => {
		const path = join(dir, entry.name)
		if (entry.isDirectory()) return walk(path, keep)
		return keep(entry.name) ? [path] : []
	})
}

/**
 * Comments out, and the `//` arm declines a `://` so a URL in a template survives. Both scans
 * below read CODE: `CONTEXT.md` says in as many words that the historical comments naming the
 * deleted vocabulary stay, and a name that survives only in a record has not survived at all for
 * the purpose of the prose check.
 */
function stripComments(source: string): string {
	return source
		.replaceAll(/\/\*[\s\S]*?\*\//g, '')
		.replaceAll(/<!--[\s\S]*?-->/g, '')
		.replaceAll(/(^|[^:])\/\/[^\n]*/g, '$1')
}

const sources = PACKAGE_SOURCES.flatMap(dir => walk(dir, name => /\.(?:ts|tsx|vue)$/.test(name))).map(path => ({
	path: relative(ROOT, path),
	code: stripComments(readFileSync(path, 'utf8')),
}))

/**
 * THE GLOSSARY'S DELETIONS, AS IDENTIFIERS. `CONTEXT.md`'s "Flagged ambiguities" resolves two
 * words by DELETION and enumerates what each one used to be called; this is that enumeration, and
 * the test below refuses to run unless the glossary still says so — so un-banning a word means
 * editing the glossary and watching this go red, rather than editing the glossary alone.
 *
 * THE `_Avoid_` LISTS ARE NOT HERE, and that is measured rather than lazy. Extracting every
 * single-word `_Avoid_` entry answers 74 words including `dom`, `state`, `focus`, `selection`,
 * `props`, `ref`, `index`, `position` and `text` — every one of them a legitimate name on the
 * published surface, several of them in the same sentence of the glossary that bans them for a
 * DIFFERENT concept. An avoided word is only wrong when it names the thing the glossary renamed,
 * which is a judgement about a sentence and not a grep. What IS checkable is the case where a word
 * names nothing at all any more, and that is the two below.
 *
 * A BARE `block` IS NOT BANNED either, for the reason the glossary gives: the word is CSS's,
 * markdown's and the Notion showcase's before it is ours. Only the identifiers markput itself
 * retired are named here, which is why this check needs no allowlist for any of those three.
 */
const RETIRED: {name: string; pattern: RegExp; glossary: string}[] = [
	{name: 'Lexeme', pattern: /\blexeme/i, glossary: '**Lexeme** was the second word this entry used'},
	{name: 'BlockStore', pattern: /\bBlockStore\b/, glossary: '`BlockStore` and `blockIndex` stay deleted'},
	{name: 'blockIndex', pattern: /\bblockIndex\b/, glossary: '`BlockStore` and `blockIndex` stay deleted'},
	{name: 'BlockController', pattern: /\bBlockController\b/, glossary: '`BlockController` → `RowController`'},
	{name: 'BlockMenu', pattern: /\bBlockMenu\b/, glossary: '`BlockMenu` → `RowMenu`'},
	{name: 'BLOCK_MENU_ITEMS', pattern: /\bBLOCK_MENU_ITEMS\b/, glossary: '`BLOCK_MENU_ITEMS` → `ROW_MENU_ITEMS`'},
	{name: 'isBlock', pattern: /\bisBlock\b/, glossary: '`isBlock` never existed as a declaration at all'},
	{name: 'slots.block', pattern: /\bslots\.block\b/, glossary: '`slots.block` → `slots.paragraph`'},
	{name: 'slotProps.block', pattern: /\bslotProps\.block\b/, glossary: '`slotProps.block` → `slotProps.row`'},
	{name: 'store.block', pattern: /\bstore\.block\b/, glossary: '`store.block` → `store.rows`'},
]

const context = readFileSync(join(ROOT, 'CONTEXT.md'), 'utf8')

describe("CONTEXT.md's deletions stay deleted", () => {
	it.each(RETIRED.map(entry => entry.name))('%s', name => {
		const entry = RETIRED.find(candidate => candidate.name === name)!
		// The glossary is the source; this list is a reading of it, and the reading is pinned so
		// the two cannot drift apart in silence.
		expect(context).toContain(entry.glossary)

		const offenders = sources.flatMap(({path, code}) =>
			code
				.split('\n')
				.map((text, index) => ({path, line: index + 1, text}))
				.filter(line => entry.pattern.test(line.text))
				.map(line => `${line.path}:${line.line} ${line.text.trim()}`)
		)
		expect(offenders).toEqual([])
	})

	it('reads a meaningful number of sources, so an empty answer came from looking', () => {
		expect(sources.length).toBeGreaterThan(100)
		expect(sources.some(source => source.path.includes('features/rows/'))).toBe(true)
	})
})

/**
 * EVERY IDENTIFIER THE PACKAGES DECLARE OR USE, from code alone. A prose backtick is checked
 * against membership rather than against a resolved symbol, and that is a deliberate floor: it
 * catches the rot mode that actually happens — a name is DELETED and the prose keeps citing it —
 * without pretending to type-check a sentence. `store.bus` fails on `bus`; `store.rows` passes on
 * both halves.
 */
const identifiers = new Set(sources.flatMap(({code}) => code.match(/[A-Za-z_$][A-Za-z0-9_$]*/g) ?? []))

/**
 * WHICH BACKTICKS ARE CODE. A span qualifies when it is DOTTED (`store.rows`, `RowSpec.continues`)
 * or camelCase with an internal capital (`effectScope`, `rowSelectionText`), optionally ending in
 * `()`. That is the filter the ticket asked for and it is drawn where English does not go: prose
 * puts single lowercase words and phrases in backticks — `row`, `separator`, `'\n'` — and neither
 * shape matches. Measured over the guides as they stand: 259 spans qualify out of the many
 * hundreds present.
 */
const CODE_SPAN =
	/^[A-Za-z_$][A-Za-z0-9_$]*(?:\.[A-Za-z0-9_$]+)+(?:\(\))?$|^[a-z$_][a-z0-9$_]*[A-Z][A-Za-z0-9_$]*(?:\(\))?$/

/**
 * Names that are correctly in the guides and are not ours to declare. Kept explicit and short for
 * `SKETCH_BUDGET`'s reason: each one is a decision someone made, not a hole the check grew.
 */
const FOREIGN = new Map([
	['React', "React's own namespace, in `React.memo`"],
	['forwardRef', "React's own API, named while explaining what a row component must spread"],
	['insertMark', 'a WITHDRAWN ref member, named in the sentence that says it is withdrawn'],
	['replaceText', 'the same sentence'],
])

const docPages = walk(DOCS, name => /\.mdx?$/.test(name))
	.map(path => ({slug: relative(DOCS, path).replaceAll('\\', '/'), text: readFileSync(path, 'utf8')}))
	.filter(page => !page.slug.startsWith(`${GENERATED}/`))
	.sort((a, b) => a.slug.localeCompare(b.slug))

/** Fenced code is `samples.spec.ts`'s subject; what is left is the prose this check reads. */
function prose(text: string): string {
	return text.replaceAll(/^```[\s\S]*?^```/gm, '')
}

describe('prose backticks name something that exists', () => {
	it.each(docPages.map(page => page.slug))('%s', slug => {
		const page = docPages.find(candidate => candidate.slug === slug)!
		const spans = [...prose(page.text).matchAll(/`([^`\n]+)`/g)].map(match => match[1].trim())
		const rot = spans
			.filter(span => CODE_SPAN.test(span))
			.flatMap(span =>
				span
					.split(/[.()]/)
					.filter(Boolean)
					.filter(part => !identifiers.has(part) && !FOREIGN.has(part))
					.map(part => `${span} — no \`${part}\` in any package source`)
			)
		expect(rot).toEqual([])
	})

	it('checks a meaningful number of spans, so an empty answer came from looking', () => {
		const checked = docPages
			.flatMap(page => [...prose(page.text).matchAll(/`([^`\n]+)`/g)].map(match => match[1].trim()))
			.filter(span => CODE_SPAN.test(span))
		expect(checked.length).toBeGreaterThan(150)
		expect(identifiers.size).toBeGreaterThan(1000)
	})

	it('spends no more of the foreign list than agreed', () => {
		expect([...FOREIGN.keys()]).toHaveLength(4)
	})
})