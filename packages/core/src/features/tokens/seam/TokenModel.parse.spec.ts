import {describe, it, expect, beforeEach} from 'vitest'

import {watch} from '../../../shared/signals'
import {Store} from '../../../store/Store'
import {treeShape} from '../__testing__/tokenFactories'
import type {TreeNode} from '../tree/types'

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

	function mountWith(value: string) {
		store.props.set({Mark: () => null, defaultValue: value})
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
			store.props.set({options: [{markup: '@[__value__]'}]})
			store.host.container(document.createElement('div'))
			store.tokens.setValue('@[test]')
			expect(treeShape(store.tokens.nodes())).toMatchObject([
				{kind: 'text', content: '@[test]', position: {start: 0, end: 7}},
			])
		})

		it('parses markup when Mark is set', () => {
			store.props.set({Mark: () => null, options: [{markup: '@[__value__]'}]})
			store.host.container(document.createElement('div'))
			store.tokens.setValue('@[test]')
			expect(store.tokens.nodes()).toEqual(expect.arrayContaining([expect.objectContaining({kind: 'mark'})]))
		})
	})

	describe('reactive parse', () => {
		it('re-parses when parser changes', () => {
			mountWith('hello @[world]')
			store.props.set({Mark: () => null, options: [{markup: '@[__value__]'}]})
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
			store.props.set({Mark: undefined})
			store.tokens.setValue('second')
			store.props.set({Mark: () => null})
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
			store.props.set({Mark: () => null, defaultValue: ''})
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

	describe('block layout empty text filtering', () => {
		it('filters out empty text tokens when layout is block', () => {
			store.props.set({
				Mark: () => null,
				layout: 'block',
				options: [{markup: '@[__value__]'}],
				defaultValue: '@[hello]',
			})
			store.host.container(document.createElement('div'))
			expect(store.tokens.nodes()).toHaveLength(1)
			expect(store.tokens.nodes()[0].kind).toBe('mark')
		})

		it('does not filter out empty text tokens when layout is inline', () => {
			store.props.set({
				Mark: () => null,
				layout: 'inline',
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
			store.props.set({Mark: () => null, options: [{markup: '@[__value__]'}], defaultValue: 'he@[x]llo'})
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
	})
})