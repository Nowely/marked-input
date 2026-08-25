import {describe, expect, it} from 'vitest'

import {Parser} from '../Parser'
import type {Markup} from '../types'
import {rowMarkupError, rowOpener} from './RowKind'

/**
 * The props boundary for a ROW markup. `createMarkupDescriptor` throws, and both adapters push
 * `options` into core from a per-render lifecycle hook, so the boundary asks this first and drops
 * the option instead — exactly as `markupError` already serves the mark path.
 */
describe('rowMarkupError', () => {
	it('accepts the shapes the showcase writes', () => {
		const kinds: Markup[] = [
			'# __slot__',
			'- [__meta__] __slot__',
			'```__meta__\n__value__\n```',
			'---\n__value__\n---',
			'@bookmark(__meta__) __slot__',
		]

		expect(kinds.map(markup => rowMarkupError(markup))).toEqual(kinds.map(() => undefined))
	})

	it('reports the mark rules first — a leading placeholder makes line-start recognition undecidable', () => {
		expect(rowMarkupError('__slot__\n')).toMatch('must not begin with a placeholder')
	})

	it('refuses two body placeholders, which leave the scan no rule for where the row content is', () => {
		expect(rowMarkupError('# __value__ __slot__')).toMatch('exactly one')
	})

	it('refuses the two-value form, whose literals compile to patterns rather than to a scan', () => {
		expect(rowMarkupError('<__value__>__slot__</__value__>')).toMatch('literal scan')
	})

	it('refuses two placeholders that touch, which no literal walk can tell apart', () => {
		expect(rowMarkupError('# __meta____slot__')).toMatch('Two placeholders touch')
	})
})

describe('row kind order', () => {
	it('scans the longest opener first, then the option order', () => {
		// `'- ['` (3) beats `'- '` (2) regardless of which option came first, so a todo is never
		// read as a bullet whose text begins with a bracket.
		const kinds = new Parser(['- __slot__', '- [__meta__] __slot__'], [true, true]).parseRows('- [x] a', {
			separator: '\n',
			indent: '\t',
		})

		expect(kinds.map(row => row.descriptor?.index)).toEqual([1])
	})

	it('answers a markup opener as the literal a row is recognised by', () => {
		expect(rowOpener('- [__meta__] __slot__')).toBe('- [')
		expect(rowOpener('```__meta__\n__value__\n```')).toBe('```')
	})
})