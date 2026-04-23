import {afterEach, describe, it, expect, vi, beforeEach} from 'vitest'

import {Store} from '../../../store/Store'
import {cleanup, createEditableDiv} from '../../../test-utils/dom'
import type {Token} from '../../parsing'
import {deleteMark} from './deleteMark'

describe('deleteMark', () => {
	let store: Store

	beforeEach(() => {
		store = new Store()
		const feature = store.feature as Record<string, {enable(): void; disable(): void}>
		for (const key of Object.keys(feature)) {
			if (key === 'system' || key === 'value') continue
			vi.spyOn(feature[key], 'enable').mockImplementation(() => {})
			vi.spyOn(feature[key], 'disable').mockImplementation(() => {})
		}
		store.feature.system.enable()
		store.feature.value.enable()
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

		store.state.container(container)
		store.nodes.focus.target = mark
	}

	function makeTokens(): Token[] {
		const textToken1 = {type: 'text' as const, content: 'hi ', position: {start: 0, end: 3}}
		// oxlint-disable-next-line no-unsafe-type-assertion
		const markToken = {
			type: 'mark' as const,
			content: '@user',
			value: 'user',
			descriptor: {index: 0},
			children: [],
			position: {start: 3, end: 8},
		} as unknown as Token
		const textToken2 = {type: 'text' as const, content: ' there', position: {start: 8, end: 14}}
		return [textToken1, markToken, textToken2]
	}

	it('fire event.change after deleting a mark', () => {
		const onChange = vi.fn()
		store.setProps({onChange})
		setupDOM()
		store.state.tokens(makeTokens())

		deleteMark('self', store)

		expect(onChange).toHaveBeenCalled()
	})

	it('merge adjacent text spans after deletion', () => {
		const onChange = vi.fn()
		store.setProps({onChange})
		setupDOM()
		store.state.tokens(makeTokens())

		deleteMark('self', store)

		expect(store.state.tokens()).toHaveLength(1)
		expect(store.state.tokens()[0].content).toBe('hi  there')
	})
})