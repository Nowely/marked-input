/**
 * Pulls the typed fenced samples out of a docs page and reads what each fence declares itself to
 * be. Kept free of `node:` and of the compiler so the parsing rules can be unit-tested on strings.
 */

/** Fence languages a reader would paste into a `.ts`/`.tsx` file. Everything else is prose. */
const TYPED_LANGUAGES = new Set(['ts', 'tsx', 'typescript', 'jsx'])

/** What a fence says it is. A fence that says nothing is a whole module. */
export interface Directives {
	/** Statements continuing the page's scope rather than a standalone module. */
	fragment: boolean
	/** JSX markup rather than a program — wrapped in a fragment before checking. */
	markup: boolean
	/** A bare value — an object or array literal — rather than a program. */
	value: boolean
	/** Carries deliberate `...` elisions; those lines are dropped before checking. */
	elide: boolean
	/**
	 * Names the PAGE introduced elsewhere, declared for this fence rather than re-shown. `name`
	 * alone is opaque; `name:Type` keeps the check real for everything done with it.
	 */
	uses: {name: string; type: string}[]
	/**
	 * Not code at all — an illustrative shape, a partial class body, a diagram that happens to be
	 * fenced as TypeScript. Excluded from the check, and the string says why. Their number is
	 * pinned by a test, so reaching for one is a decision rather than a habit.
	 */
	sketch: string | null
}

export interface Sample {
	/** Page-relative-to-`content/docs` path, for the message a failure prints. */
	file: string
	/** 1-based line of the sample's FIRST code line inside that page. */
	line: number
	/** Columns the fence was indented by, stripped from `code` and added back to a reported column. */
	indent: number
	lang: string
	code: string
	directives: Directives
}

const NO_DIRECTIVES: Directives = {
	fragment: false,
	markup: false,
	value: false,
	elide: false,
	uses: [],
	sketch: null,
}

/** The three ways a fence says "this continues the page rather than standing alone". */
const SHAPES = ['fragment', 'markup', 'value'] as const

export class DirectiveError extends Error {}

/**
 * Splits a fence's meta string into words, keeping a `key="value"` pair whole.
 */
function metaWords(meta: string): string[] {
	return meta.match(/[^\s"]+="[^"]*"|[^\s"]+/g) ?? []
}

export function parseDirectives(meta: string, where: string): Directives {
	const result: Directives = {...NO_DIRECTIVES, uses: []}
	for (const word of metaWords(meta)) {
		if (word === 'fragment') result.fragment = true
		else if (word === 'markup') result.markup = true
		else if (word === 'value') result.value = true
		else if (word === 'elide') result.elide = true
		else if (word.startsWith('uses=')) {
			const names = word.slice('uses='.length).replace(/^"|"$/g, '').split(',').filter(Boolean)
			if (names.length === 0)
				throw new DirectiveError(`${where}: \`uses\` needs names: uses=Mention,node:RowNode`)
			for (const entry of names) {
				const at = entry.indexOf(':')
				result.uses.push(
					at === -1 ? {name: entry, type: 'any'} : {name: entry.slice(0, at), type: entry.slice(at + 1)}
				)
			}
		} else if (word.startsWith('sketch=')) {
			const reason = word.slice('sketch='.length).replace(/^"|"$/g, '')
			if (!reason)
				throw new DirectiveError(`${where}: \`sketch\` needs a reason: sketch="why this is not real code"`)
			result.sketch = reason
		} else {
			throw new DirectiveError(
				`${where}: unknown fence directive \`${word}\`. Known: fragment, markup, value, elide, uses=A,B, sketch="reason".`
			)
		}
	}
	if (SHAPES.filter(shape => result[shape]).length > 1) {
		throw new DirectiveError(`${where}: \`${SHAPES.join('`, `')}\` are alternatives — a fence is one of them.`)
	}
	if (result.sketch && (SHAPES.some(shape => result[shape]) || result.elide || result.uses.length > 0)) {
		throw new DirectiveError(`${where}: \`sketch\` leaves the check, so it takes no other directive.`)
	}
	return result
}

/**
 * An elision standing where a value would: a lone `...` line, or `...`/`…` filling a `{}` or `[]`.
 * A spread — `{...props}` — is real code and is left alone, which is why the marker has to be
 * bounded by an opener, a comma or the end of the line on both sides.
 */
const ELISION = /(^|[[{(,\s])(\.\.\.|…)(?=[\]}),\s]|$)/g

/** Blanks the elisions out, keeping every column where the reader sees it. */
export function stripElisions(code: string): string {
	return code.replaceAll(ELISION, (_, before: string, marker: string) => before + ' '.repeat(marker.length))
}

/**
 * Every typed fence in one markdown/MDX page, in document order.
 *
 * Fences are matched CommonMark-style: an opening run of three or more backticks closes on the
 * first line with at least as many, so a ```` ```md ```` sample quoting ``` inside stays one fence.
 */
export function extractSamples(text: string, file: string): Sample[] {
	const lines = text.split('\n')
	const samples: Sample[] = []
	let i = 0
	while (i < lines.length) {
		const opening = /^([ \t]*)(`{3,})[ \t]*([A-Za-z0-9+#-]*)[ \t]*(.*)$/.exec(lines[i]!)
		if (!opening) {
			i++
			continue
		}
		const [, indent = '', ticks = '', lang = '', meta = ''] = opening
		const closing = new RegExp(`^[ \\t]*\`{${ticks.length},}[ \\t]*$`)
		let end = i + 1
		while (end < lines.length && !closing.test(lines[end]!)) end++
		if (TYPED_LANGUAGES.has(lang.toLowerCase())) {
			const line = i + 2
			const body = lines
				.slice(i + 1, end)
				.map(l => (l.startsWith(indent) ? l.slice(indent.length) : l))
				.join('\n')
			const directives = parseDirectives(meta, `${file}:${i + 1}`)
			samples.push({
				file,
				line,
				indent: indent.length,
				lang,
				code: directives.elide ? stripElisions(body) : body,
				directives,
			})
		}
		i = end + 1
	}
	return samples
}