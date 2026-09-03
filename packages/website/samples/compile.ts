import {dirname, join} from 'node:path'
import {fileURLToPath} from 'node:url'

import ts from 'typescript'

import type {Sample} from './extract'

const HERE = dirname(fileURLToPath(import.meta.url))
const PACKAGES = join(HERE, '..', '..')

/**
 * What a consumer's own `tsconfig.json` looks like, not what this repo builds with. The samples are
 * checked as a READER would compile them: strict, bundler resolution, the automatic JSX runtime.
 * The workspace packages resolve to SOURCE so a sample is checked against the code that shipped it
 * rather than against whatever `dist/` happens to hold.
 */
const OPTIONS: ts.CompilerOptions = {
	strict: true,
	target: ts.ScriptTarget.ESNext,
	module: ts.ModuleKind.Preserve,
	moduleResolution: ts.ModuleResolutionKind.Bundler,
	moduleDetection: ts.ModuleDetectionKind.Force,
	lib: ['lib.esnext.d.ts', 'lib.dom.d.ts', 'lib.dom.iterable.d.ts'],
	jsx: ts.JsxEmit.ReactJSX,
	skipLibCheck: true,
	noEmit: true,
	types: [],
	baseUrl: HERE,
	paths: {
		'@markput/core': [join(PACKAGES, 'core', 'index.ts')],
		'@markput/react': [join(PACKAGES, 'react', 'markput', 'index.ts')],
		'@markput/vue': [join(PACKAGES, 'vue', 'markput', 'index.ts')],
		// The samples live under the website, which has no Vue of its own; the adapter's does.
		vue: [join(PACKAGES, 'vue', 'markput', 'node_modules', 'vue')],
	},
}

const SCOPE = join(HERE, 'scope.d.ts')
/** The third-party packages the guides illustrate; see the file's own note. */
const READERS_OWN = join(HERE, 'readers-own.d.ts')

export interface SampleError {
	/** `<page>:<line>:<column>` in the DOCS page, never in the generated file. */
	where: string
	message: string
}

/** One sample's slice of a generated unit, so a diagnostic can be walked back to its fence. */
interface Chunk {
	sample: Sample
	/** 1-based line the sample's own first line sits at inside the generated unit. */
	from: number
	lines: number
}

interface Unit {
	path: string
	text: string
	chunks: Chunk[]
	/** Whether the unit may lean on `scope.d.ts` — the scope a page establishes and re-uses. */
	scoped: boolean
}

/** A file name that survives being a TS module specifier and still says which fence it came from. */
function unitName(file: string, index: number): string {
	return join(HERE, `${file.replace(/[/.]/g, '_')}__${index}.tsx`)
}

const WRAP = {
	markup: {before: 'const __markup = (<>', after: '</>)'},
	value: {before: 'const __value = (', after: ')'},
} as const

/**
 * One fence, one module. A fence stands or falls on its own — nothing it needs may come from
 * another fence by accident, only by saying so.
 */
function unitOf(sample: Sample, index: number): Unit {
	const {fragment, markup, value, uses} = sample.directives
	const wrap = markup ? WRAP.markup : value ? WRAP.value : null
	// `uses` is what the PAGE already showed and this fence does not repeat. A bare name is opaque
	// on purpose — the fence that defines it is checked where it is written; `name:Type` keeps the
	// check real for everything the fence goes on to do with it.
	const declared = uses.map(({name, type}) =>
		type === 'any' ? `declare const ${name}: any; type ${name} = any;` : `declare const ${name}: ${type};`
	)
	const before = [...declared, ...(wrap ? [wrap.before] : [])]
	const lines = sample.code.split('\n')
	return {
		path: unitName(sample.file, index),
		text: [...before, ...lines, ...(wrap ? [wrap.after] : [])].join('\n'),
		chunks: [{sample, from: before.length + 1, lines: lines.length}],
		scoped: fragment || markup || value,
	}
}

export function buildUnits(samples: Sample[]): Unit[] {
	const counts = new Map<string, number>()
	return samples.flatMap(sample => {
		const index = counts.get(sample.file) ?? 0
		counts.set(sample.file, index + 1)
		return sample.directives.sketch === null ? [unitOf(sample, index)] : []
	})
}

/**
 * A file in the READER's own project — `./types`, `./Mention.css`. There is nothing in this repo it
 * could resolve to, so the import is replaced with opaque declarations of the names it brought in;
 * the fence that shows that file is checked where it is written.
 *
 * Only RELATIVE specifiers are replaced, so a misspelt `@markput/…` still fails, and the
 * replacement collapses onto the statement's FIRST line so every line below keeps its number.
 */
function declareReadersOwn(code: string): string {
	const source = ts.createSourceFile('own.tsx', code, ts.ScriptTarget.ESNext, true, ts.ScriptKind.TSX)
	const lines = code.split('\n')
	for (const statement of source.statements) {
		if (!ts.isImportDeclaration(statement)) continue
		if (!ts.isStringLiteral(statement.moduleSpecifier) || !statement.moduleSpecifier.text.startsWith('.')) continue
		const {importClause} = statement
		const clauseIsTypeOnly = importClause?.phaseModifier === ts.SyntaxKind.TypeKeyword
		const parts: string[] = []
		const declare = (name: string, typeOnly: boolean) => {
			parts.push(`type ${name} = any;`)
			if (!typeOnly) parts.push(`declare const ${name}: any;`)
		}
		if (importClause?.name) declare(importClause.name.text, clauseIsTypeOnly)
		const {namedBindings} = importClause ?? {}
		if (namedBindings && ts.isNamespaceImport(namedBindings)) declare(namedBindings.name.text, false)
		if (namedBindings && ts.isNamedImports(namedBindings)) {
			for (const element of namedBindings.elements) {
				declare(element.name.text, clauseIsTypeOnly || element.isTypeOnly)
			}
		}
		const from = source.getLineAndCharacterOfPosition(statement.getStart(source)).line
		const to = source.getLineAndCharacterOfPosition(statement.getEnd()).line
		lines[from] = parts.join(' ')
		for (let i = from + 1; i <= to; i++) lines[i] = ''
	}
	// A dynamic `import('./Heavy')` is an expression, not a statement to replace: its specifier is
	// moved under the prefix `readers-own.d.ts` declares as a shorthand ambient module instead.
	return lines.join('\n').replaceAll(/\bimport\((\s*)(['"])(\.[^'"]*)\2/g, 'import($1$2readers-own:$3$2')
}

function createHost(virtual: Map<string, string>): ts.CompilerHost {
	const host = ts.createCompilerHost(OPTIONS, true)
	const {getSourceFile, fileExists, readFile} = host
	host.fileExists = path => virtual.has(path) || fileExists.call(host, path)
	host.readFile = path => virtual.get(path) ?? readFile.call(host, path)
	host.getSourceFile = (path, languageVersion, onError, shouldCreate) => {
		const text = virtual.get(path)
		return text === undefined
			? getSourceFile.call(host, path, languageVersion, onError, shouldCreate)
			: ts.createSourceFile(path, text, languageVersion, true, ts.ScriptKind.TSX)
	}
	return host
}

function locate(unit: Unit, line: number, column: number): {sample: Sample; line: number; column: number} | null {
	for (const chunk of unit.chunks) {
		if (line < chunk.from) break
		if (line < chunk.from + chunk.lines) {
			return {
				sample: chunk.sample,
				line: chunk.sample.line + (line - chunk.from),
				column: column + chunk.sample.indent,
			}
		}
	}
	// A wrapper line the harness added; the fence as a whole owns it.
	const last = unit.chunks.at(-1)
	return last ? {sample: last.sample, line: last.sample.line, column: 1} : null
}

/**
 * Type-checks every sample and answers the failures, addressed in the DOCS page.
 *
 * Two programs, because the difference between them IS the contract: the scoped one sees
 * `scope.d.ts` and holds the fences that declared themselves a continuation of a page; the
 * standalone one does not, so a fence that claims no shape has to carry its own imports exactly
 * like the reader who pastes it will.
 */
export function checkSamples(samples: Sample[]): SampleError[] {
	const units = buildUnits(samples)
	return [
		...run(
			units.filter(u => u.scoped),
			true
		),
		...run(
			units.filter(u => !u.scoped),
			false
		),
	]
}

function run(units: Unit[], withScope: boolean): SampleError[] {
	if (units.length === 0) return []
	const virtual = new Map<string, string>()
	for (const unit of units) virtual.set(unit.path, declareReadersOwn(unit.text))
	const roots = units.map(u => u.path)
	const program = ts.createProgram(
		[READERS_OWN, ...(withScope ? [SCOPE] : []), ...roots],
		OPTIONS,
		createHost(virtual)
	)
	const errors: SampleError[] = []
	for (const unit of units) {
		const source = program.getSourceFile(unit.path)
		if (!source) continue
		// `tsc` itself drops every semantic diagnostic as soon as ONE file in the program fails to
		// parse, so the two sets are collected per file rather than through `getPreEmitDiagnostics`.
		// Without this a single unparsable sample would silently disarm the whole check.
		const diagnostics = [...program.getSyntacticDiagnostics(source), ...program.getSemanticDiagnostics(source)]
		for (const diagnostic of diagnostics) {
			const at = diagnostic.start === undefined ? null : source.getLineAndCharacterOfPosition(diagnostic.start)
			const found = at ? locate(unit, at.line + 1, at.character + 1) : null
			const sample = found?.sample ?? unit.chunks[0]!.sample
			errors.push({
				where: `packages/website/src/content/docs/${sample.file}:${found?.line ?? sample.line}:${found?.column ?? 1}`,
				message: `TS${diagnostic.code}: ${ts.flattenDiagnosticMessageText(diagnostic.messageText, ' ')}`,
			})
		}
	}
	return errors
}