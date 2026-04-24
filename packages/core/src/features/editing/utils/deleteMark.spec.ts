import {afterEach, describe, it, expect, vi, beforeEach} from 'vitest'

import {Store} from '../../../store/Store'
import {cleanup, createEditableDiv} from '../../../test-utils/dom'
import type {Token} from '../../parsing'
import {deleteMark} from './deleteMark'

describe('deleteMark', () => {
	let store: Store

	beforeEach(() => {
		store = new Store()
		const features: Record<string, {enable(): void; disable(): void}> = {
			lifecycle: store.lifecycle,
			mark: store.mark,
			overlay: store.overlay,
			slots: store.slots,
			caret: store.caret,
			keyboard: store.keyboard,
			dom: store.dom,
			drag: store.drag,
			clipboard: store.clipboard,
			parsing: store.parsing,
		}
		for (const key of Object.keys(features)) {
			vi.spyOn(features[key], 'enable').mockImplementation(() => {})
			vi.spyOn(features[key], 'disable').mockImplementation(() => {})
		}
		store.value.enable()
	})

	afterEach(cleanup)

	function setupDOM(): void {
		const container = createEditableDiv()

		const span1 = document.createElement('span')
		span1.textContent = 'hi '
		span1.contentEditable = 'true'

		const mark = document.createElement('span')
		mark.textContent = '@user'
		mark.contentEditable = 'false'

		const span2 = document.createElement('span')
		span2.textContent = ' there'
		span2.contentEditable = 'true'

		container.append(span1, mark, span2)

		store.slots.container(container)
		store.nodes.focus.target = mark
	}

	function makeTokens(): Token[] {
		const textToken1 = {type: 'text' as const, content: 'hi ', position: {start: 0, end: 3}}
		// oxlint-disable-next-line no-unsafe-type-assertion
		const markToken = {
			type: 'mark' as const,
			content: '@user',
			value: 'user',
			descriptor: {index: 0, markup: '@[__value__](__meta__)'},
			meta: '1',
			children: [],
			position: {start: 3, end: 8},
		} as unknown as Token
		const textToken2 = {type: 'text' as const, content: ' there', position: {start: 8, end: 14}}
		return [textToken1, markToken, textToken2]
	}

	it('fire event.change after deleting a mark', () => {
		const onChange = vi.fn()
		store.props.set({onChange})
		setupDOM()
		store.parsing.tokens(makeTokens())

		deleteMark('self', store)

		expect(onChange).toHaveBeenCalled()
	})

	it('merge adjacent text spans after deletion', () => {
		const onChange = vi.fn()
		store.props.set({onChange})
		setupDOM()
		store.parsing.tokens(makeTokens())

		deleteMark('self', store)

		expect(store.parsing.tokens()).toHaveLength(1)
		expect(store.parsing.tokens()[0].content).toBe('hi  there')
	})

	it('controlled delete emits candidate without committing current or caret recovery', () => {
		const onChange = vi.fn()
		store.props.set({value: 'hi @[user](1) there', onChange})
		setupDOM()
		store.parsing.tokens(makeTokens())

		deleteMark('self', store)

		expect(onChange).toHaveBeenCalledWith('hi  there')
		expect(store.value.current()).toBe('hi @[user](1) there')
		expect(store.parsing.tokens()).toEqual(makeTokens())
		expect(store.caret.recovery()).toBeUndefined()
	})
})