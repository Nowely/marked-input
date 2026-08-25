import {describe, it, expect, afterEach, beforeEach, vi} from 'vitest'

import {watch} from '../../../shared/signals'
import {Store} from '../../../store/Store'
import {treeShape} from '../__testing__/tokenFactories'
import type {Markup} from '../parser/types'
import type {TreeNode} from '../tree/types'

/** The `reportBadProp` channel, silenced and collected for the duration of one test. */
function captureErrors(): () => string[] {
	const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
	return () => spy.mock.calls.map(call => String(call[0]))
}

/**
 * Parse-pipeline behavior through the Store. The model publishes nothing
 * before mount, so each test attaches a bare container; with no aligned DOM
 * every commit settles structurally, keeping the live tree exactly the reconciled
 * parse — which is what these scenarios pin.
 */
describe('TokenModel', () => {
	let store: Store

	beforeEach(() => {
		store = new Store()
	})

	afterEach(() => {
		vi.restoreAllMocks()
	})

	function mountWith(value: string) {
		store.props.set({separator: null, Mark: () => null, defaultValue: value})
		store.host.container(document.createElement('div'))
	}

	describe('auto-parse on value change', () => {
		it('sets tokens from initial value on mount', () => {
			mountWith('hello')
			expect(treeShape(store.tokens.nodes())).toMatchObject([
				{kind: 'text', content: 'hello', position: {start: 0, end: 5}},
			])
		})

		it('updates tokens when value changes via replaceAll', () => {
			mountWith('hello')
			store.tokens.setValue('world')
			expect(treeShape(store.tokens.nodes())).toMatchObject([
				{kind: 'text', content: 'world', position: {start: 0, end: 5}},
			])
		})

		it('falls back to empty string when defaultValue is empty', () => {
			mountWith('')
			expect(treeShape(store.tokens.nodes())).toMatchObject([
				{kind: 'text', content: '', position: {start: 0, end: 0}},
			])
		})

		it('mount with defaultValue initializes value current', () => {
			mountWith('test')
			expect(store.tokens.value()).toBe('test')
		})

		it('does not parse markup when Mark is not set', () => {
			store.props.set({separator: null, options: [{markup: '@[__value__]'}]})
			store.host.container(document.createElement('div'))
			store.tokens.setValue('@[test]')
			expect(treeShape(store.tokens.nodes())).toMatchObject([
				{kind: 'text', content: '@[test]', position: {start: 0, end: 7}},
			])
		})

		it('parses markup when Mark is set', () => {
			store.props.set({separator: null, Mark: () => null, options: [{markup: '@[__value__]'}]})
			store.host.container(document.createElement('div'))
			store.tokens.setValue('@[test]')
			expect(store.tokens.nodes()).toEqual(expect.arrayContaining([expect.objectContaining({kind: 'mark'})]))
		})
	})

	describe('reactive parse', () => {
		it('re-parses when parser changes', () => {
			mountWith('hello @[world]')
			store.props.set({separator: null, Mark: () => null, options: [{markup: '@[__value__]'}]})
			expect(treeShape(store.tokens.nodes())).toEqual([
				expect.objectContaining({kind: 'text', content: 'hello '}),
				expect.objectContaining({kind: 'mark', content: '@[world]'}),
				expect.objectContaining({kind: 'text', content: ''}),
			])
			const mark = store.tokens.nodes()[1]
			expect(mark.kind === 'mark' && mark.value()).toBe('world')
		})

		it('re-parses when Mark is added or removed', () => {
			mountWith('first')
			store.props.set({separator: null, Mark: undefined})
			store.tokens.setValue('second')
			store.props.set({separator: null, Mark: () => null})
			expect(treeShape(store.tokens.nodes())).toMatchObject([
				{kind: 'text', content: 'second', position: {start: 0, end: 6}},
			])
		})
	})

	describe('signal ordering guarantee', () => {
		it('the live tree is updated when value.current fires', () => {
			// The model's reconcile watch is registered at mount, before any other
			// watcher added afterwards, so by the time downstream listeners observe
			// value.current, the tree reflects the new value (the structural commit
			// self-heals synchronously against the bare container).
			store.props.set({separator: null, Mark: () => null, defaultValue: ''})
			store.host.container(document.createElement('div'))
			let treeAtChangeTime: readonly TreeNode[] | undefined
			const stop = watch(store.tokens.value, () => {
				treeAtChangeTime = store.tokens.nodes()
			})

			store.tokens.setValue('hello')

			expect(treeShape(treeAtChangeTime ?? [])).toMatchObject([
				{kind: 'text', content: 'hello', position: {start: 0, end: 5}},
			])

			stop()
		})
	})

	describe('rows (issue 08)', () => {
		it('splits at a newline when nothing configures a separator', () => {
			// THE default (ADR-0011), so nothing here may spell it out: an editor that configures
			// nothing is a row editor whose rows are lines.
			store.props.set({Mark: () => null, options: [], defaultValue: 'a\nb'})
			store.host.container(document.createElement('div'))

			expect(store.tokens.rowConfig()).toEqual({separator: '\n', indent: '\t'})
			expect(store.tokens.nodes().map(node => node.kind)).toEqual(['row', 'row'])
		})

		it('answers no rows for a null separator, and never reports it', () => {
			// `null` DECLINES to separate, where `''` separates nothing — so this arm is silent
			// and the empty-string arm below is not.
			const errors = captureErrors()
			store.props.set({Mark: () => null, separator: null, options: [], defaultValue: 'a\nb'})
			store.host.container(document.createElement('div'))

			expect(store.tokens.rowConfig()).toBeUndefined()
			expect(store.tokens.nodes().map(node => node.kind)).toEqual(['text'])
			expect(errors()).toEqual([])
		})

		it('wraps the top level into rows', () => {
			store.props.set({
				Mark: () => null,
				separator: '\n\n',
				options: [{markup: '@[__value__]'}],
				defaultValue: '@[hello]',
			})
			store.host.container(document.createElement('div'))
			// One unterminated row holding [text, mark, text] — the separator is structural,
			// so a separator-less value is a single row.
			expect(store.tokens.nodes()).toHaveLength(1)
			const row = store.tokens.nodes()[0]
			expect(row.kind).toBe('row')
			if (row.kind !== 'row') throw new Error('expected a row')
			expect(row.children().map(child => child.kind)).toEqual(['text', 'mark', 'text'])
		})

		it('reports an explicit empty separator and renders a rowless document', () => {
			// PropsModel defaults replace only undefined, so '' flows through to `rowConfig`,
			// which answers `undefined` — this seam's one word for "no rows". It used to reach
			// `Parser.parseRows`' throw, which both adapters raise inside a per-render lifecycle
			// hook: React tore down the whole render root, Vue kept the stale tree.
			const errors = captureErrors()
			store.props.set({separator: '', options: [], defaultValue: 'a\n\nb'})
			store.host.container(document.createElement('div'))

			expect(treeShape(store.tokens.nodes())).toMatchObject([{kind: 'text', content: 'a\n\nb'}])
			expect(store.tokens.rowConfig()).toBeUndefined()
			expect(errors()).toEqual([expect.stringContaining('`separator` is empty')])
		})

		it('reports an empty separator once per distinct value, not once per prop sync', () => {
			// Both adapters call `props.set` on EVERY render, so a report placed upstream of an
			// equality gate would flood the console. `rowConfig` re-evaluates only when
			// `separator` actually moves.
			const errors = captureErrors()
			store.props.set({separator: '', options: []})
			store.host.container(document.createElement('div'))
			for (let i = 0; i < 10; i++) store.props.set({separator: '', options: []})

			expect(errors()).toHaveLength(1)
		})

		it('brackets a leading mark with empty text roots when the value never splits', () => {
			store.props.set({
				Mark: () => null,
				separator: null,
				options: [{markup: '@[__value__]'}],
				defaultValue: '@[hello]',
			})
			store.host.container(document.createElement('div'))
			expect(store.tokens.nodes()).toHaveLength(3)
			expect(store.tokens.nodes()[0].kind).toBe('text')
			expect(store.tokens.nodes()[1].kind).toBe('mark')
			expect(store.tokens.nodes()[2].kind).toBe('text')
		})
	})

	describe('framework identity (adapter SPI)', () => {
		it('a suffix-shifted mark keeps its node, and therefore its key', () => {
			store.props.set({
				separator: null,
				Mark: () => null,
				options: [{markup: '@[__value__]'}],
				defaultValue: 'he@[x]llo',
			})
			store.host.container(document.createElement('div'))
			const mark = store.tokens.nodes()[1]
			const markKey = mark.id

			// edit BEFORE the mark: 'he@[x]llo' → 'Xhe@[x]llo'. The mark's OWN address moves
			// and nothing else about it does — which is the whole reason the adapters key on
			// `node.id` and the node itself survives (object-keyed counters remounted it, the
			// defect; the deleted snapshot re-materialized a fresh Token here).
			store.tokens.setValue('Xhe@[x]llo')

			const shifted = store.tokens.nodes()[1]
			expect(shifted).toBe(mark)
			expect(shifted.id).toBe(markKey)
			expect(shifted.range()).toEqual({start: 3, end: 7})
		})

		it('a fresh but identical `options` array keeps every node and every id', () => {
			// THE gate this file was missing, and the defect is invisible without it: `options`
			// is a plain signal, so a new array with the same contents propagates, mints a new
			// `Parser`, and descriptors are interned PER PARSER — `adopt` pairs marks only on
			// `candidate.descriptor === token.descriptor`, so every mark falls to `buildNode` and
			// takes a new id. Both adapters key on `node.id`, so that is a full remount of every
			// Mark and of whatever component state the consumer keeps inside one.
			//
			// A consumer cannot avoid it: React's props sync has no dep array, and Vue's
			// `syncProps` allocates a fresh options array on every run of a watch whose deps
			// include `props.value` — so a controlled Vue editor tripped this on every keystroke.
			const Mark = () => null
			store.props.set({separator: null, Mark, options: [{markup: '@[__value__]'}], defaultValue: 'he@[x]llo'})
			store.host.container(document.createElement('div'))
			const before = store.tokens.nodes()
			const ids = before.map(node => node.id)

			// Same content, new array and new option objects — what an inline prop produces.
			store.props.set({separator: null, Mark, options: [{markup: '@[__value__]'}], defaultValue: 'he@[x]llo'})

			const after = store.tokens.nodes()
			expect(after.map(node => node.id)).toEqual(ids)
			// Node IDENTITY, not just the ids: an adapter keyed on the id would be fooled by a
			// fresh node that happened to be numbered the same.
			expect(after[1]).toBe(before[1])
		})

		it('a CHANGED markup still re-parses', () => {
			// The other half of the gate above: memoizing the parser must not make it deaf.
			store.props.set({
				separator: null,
				Mark: () => null,
				options: [{markup: '@[__value__]'}],
				defaultValue: 'he@[x]llo',
			})
			store.host.container(document.createElement('div'))
			expect(store.tokens.nodes()).toHaveLength(3)

			store.props.set({
				separator: null,
				Mark: () => null,
				options: [{markup: '#[__value__]'}],
				defaultValue: 'he@[x]llo',
			})

			// '@[x]' is no longer a markup, so the whole value is one text token.
			expect(store.tokens.nodes()).toHaveLength(1)
		})
	})

	describe('a markup the parser cannot use', () => {
		it('reports it and drops that option, keeping the others and their indices', () => {
			// A leading placeholder is a first-hour typo. It used to throw out of the props watch
			// `props.set` drains — i.e. out of the adapter's own render hook, which unmounts a
			// React root and leaves a Vue editor rendering its stale tree.
			const errors = captureErrors()
			store.props.set({
				separator: null,
				Mark: () => null,
				options: [{markup: '__value__ says'}, {markup: '@[__value__]'}],
				defaultValue: 'hi @[m]',
			})
			store.host.container(document.createElement('div'))

			expect(treeShape(store.tokens.nodes())).toMatchObject([
				{kind: 'text', content: 'hi '},
				{kind: 'mark'},
				{kind: 'text', content: ''},
			])
			// The dropped option leaves a HOLE, not a gap: the survivor keeps ITS index, which is
			// what resolves its per-option `Mark`.
			const mark = store.tokens.nodes()[1]
			if (mark.kind !== 'mark') throw new Error('expected a mark')
			expect(mark.value()).toBe('m')
			expect(mark.descriptor.index).toBe(1)
			expect(errors()).toEqual([
				expect.stringContaining('A markup must not begin with a placeholder'),
				// The half that names the consequence — the message is the parser's, the verdict is not.
			])
			expect(errors()[0]).toContain('This option contributes no markup')
		})

		it('renders a plain-text editor when every markup is unusable', () => {
			const errors = captureErrors()
			// No placeholder at all. `Markup` is a template-literal union, so TS already refuses
			// this LITERAL — the cast is what a computed string, or a JS consumer, arrives as. The
			// leading-placeholder rule above needs no cast: that shape typechecks.
			// oxlint-disable-next-line no-unsafe-type-assertion
			const markup = 'plain' as Markup
			store.props.set({separator: null, Mark: () => null, options: [{markup}], defaultValue: 'hi @[m]'})
			store.host.container(document.createElement('div'))

			expect(treeShape(store.tokens.nodes())).toMatchObject([{kind: 'text', content: 'hi @[m]'}])
			expect(errors()).toHaveLength(1)
		})

		/**
		 * The ROW half of the same boundary. `RowKind.spec` pins `rowMarkupError` as a function;
		 * these pin that `usableMarkups` CALLS it — without them the whole row arm can be deleted
		 * and the suite stays green, while a consumer's bad `row` option throws out of `props.set`
		 * and so out of the adapter's own render hook (ADR-0008, doctrine rule 7).
		 */
		it('reports a bad ROW markup and drops that option, keeping the others and their indices', () => {
			const errors = captureErrors()
			expect(() => {
				store.props.set({
					Mark: () => null,
					separator: '\n',
					// A leading placeholder, which makes line-start recognition undecidable.
					options: [
						{markup: '__slot__\n', row: {Component: 'div'}},
						{markup: '# __slot__', row: {Component: 'h1'}},
					],
					defaultValue: '# Title',
				})
				store.host.container(document.createElement('div'))
			}).not.toThrow()

			const row = store.tokens.nodes()[0]
			if (row.kind !== 'row') throw new Error('expected a row')
			// The dropped option leaves a HOLE: the survivor keeps ITS index, which is what
			// resolves its `row.Component`.
			expect(row.option()).toBe(1)
			expect(row.slot()).toBe('Title')
			expect(errors()).toEqual([expect.stringContaining('This option contributes no row kind')])
		})

		it('reports a duplicate row opener and lets the EARLIER option keep it', () => {
			const errors = captureErrors()
			store.props.set({
				Mark: () => null,
				separator: '\n',
				options: [
					{markup: '# __slot__', row: {Component: 'h1'}},
					{markup: '# __value__', row: {Component: 'h2'}},
				],
				defaultValue: '# Title',
			})
			store.host.container(document.createElement('div'))

			const row = store.tokens.nodes()[0]
			if (row.kind !== 'row') throw new Error('expected a row')
			expect(row.option()).toBe(0)
			expect(errors()).toEqual([expect.stringContaining('Duplicate row opener "# "')])
		})

		it('reports once per distinct markup set, not once per prop sync', () => {
			// The report sits DOWNSTREAM of `#markups`' shallow-equality gate over the markup
			// STRINGS. `props.options` compares elements by reference, so the inline array below —
			// what a JSX prop produces on every render — is never equal to the last one.
			const errors = captureErrors()
			store.props.set({
				separator: null,
				Mark: () => null,
				options: [{markup: '__value__ says'}],
				defaultValue: 'hi',
			})
			store.host.container(document.createElement('div'))
			for (let i = 0; i < 10; i++) {
				store.props.set({
					separator: null,
					Mark: () => null,
					options: [{markup: '__value__ says'}],
					defaultValue: 'hi',
				})
			}

			expect(errors()).toHaveLength(1)
		})
	})
})