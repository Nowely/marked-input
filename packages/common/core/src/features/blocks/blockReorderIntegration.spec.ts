import {describe, expect, it} from 'vitest'

import type {UseHookFactory} from '../../shared/classes/defineState'
import {Parser} from '../parsing/ParserV2/Parser'
import type {TextToken, Markup} from '../parsing/ParserV2/types'
import {getTokensByValue, parseWithParser} from '../parsing/utils/valueParser'
import {Store} from '../store/Store'
import {reorderBlocks} from './reorderBlocks'
import {splitTokensIntoBlocks} from './splitTokensIntoBlocks'

const mockUseHook: UseHookFactory = signal => () => signal.get()

function setupStore(value: string, markups: Markup[] = []) {
	const store = new Store({createUseHook: mockUseHook})
	const parser = markups.length > 0 ? new Parser(markups) : undefined

	store.state.parser.set(parser)
	store.state.value.set(value)
	store.state.previousValue.set(value)
	store.state.tokens.set(parseWithParser(store, value))

	return store
}

describe('block reorder → getTokensByValue integration', () => {
	it('fix path: full re-parse + set tokens gives correct result after reorder', () => {
		const original = 'aaa\nbbb\nccc'
		const store = setupStore(original)

		const tokens = store.state.tokens.get()
		const blocks = splitTokensIntoBlocks(tokens)
		const reordered = reorderBlocks(original, blocks, 0, 2)

		expect(reordered).toBe('bbb\naaa\nccc')

		// Apply the fix: full re-parse, set tokens, sync previousValue
		const newTokens = parseWithParser(store, reordered)
		store.state.tokens.set(newTokens)
		store.state.previousValue.set(reordered)
		store.state.value.set(reordered)

		expect(newTokens).not.toBe(tokens)

		const fullContent = newTokens.map(t => t.content).join('')
		expect(fullContent).toBe('bbb\naaa\nccc')

		// Subsequent getTokensByValue should be stable (no gap → returns current tokens)
		const stable = getTokensByValue(store)
		expect(stable.map(t => t.content).join('')).toBe('bbb\naaa\nccc')
	})

	it('fix path with parser: full re-parse gives correct tokens after reorder', () => {
		const original = '# Heading\nParagraph'
		const store = setupStore(original, ['# __nested__\n' as Markup])

		const tokens = store.state.tokens.get()
		const blocks = splitTokensIntoBlocks(tokens)

		expect(blocks).toHaveLength(2)

		const reordered = reorderBlocks(original, blocks, 1, 0)
		expect(reordered).toBe('Paragraph\n# Heading')

		// Apply the fix
		const newTokens = parseWithParser(store, reordered)
		store.state.tokens.set(newTokens)
		store.state.previousValue.set(reordered)
		store.state.value.set(reordered)

		const fullContent = newTokens.map(t => t.content).join('')
		expect(fullContent).toBe('Paragraph\n# Heading')
	})

	it('full re-parse produces correct blocks after reorder', () => {
		const original = 'first\nsecond\nthird'
		const store = setupStore(original)

		const tokens = store.state.tokens.get()
		const blocks = splitTokensIntoBlocks(tokens)
		const reordered = reorderBlocks(original, blocks, 2, 0)

		expect(reordered).toBe('third\nfirst\nsecond')

		const newTokens = parseWithParser(store, reordered)
		const newBlocks = splitTokensIntoBlocks(newTokens)

		expect(newBlocks).toHaveLength(3)
		expect((newBlocks[0].tokens[0] as TextToken).content).toBe('third')
		expect((newBlocks[1].tokens[0] as TextToken).content).toBe('first')
		expect((newBlocks[2].tokens[0] as TextToken).content).toBe('second')
	})

	it('direct token set + previousValue sync bypasses broken incremental parse', () => {
		const original = 'aaa\nbbb\nccc'
		const store = setupStore(original)

		const blocks = splitTokensIntoBlocks(store.state.tokens.get())
		const reordered = reorderBlocks(original, blocks, 0, 2)
		expect(reordered).toBe('bbb\naaa\nccc')

		// This is the fix: full re-parse + set tokens + sync previousValue
		const newTokens = parseWithParser(store, reordered)
		store.state.tokens.set(newTokens)
		store.state.previousValue.set(reordered)
		store.state.value.set(reordered)

		// Now getTokensByValue should see no gap and return current (correct) tokens
		const result = getTokensByValue(store)
		const resultContent = result.map(t => t.content).join('')
		expect(resultContent).toBe('bbb\naaa\nccc')
	})

	it('without fix: incremental parse crashes on block reorder', () => {
		const original = 'aaa\nbbb\nccc'
		const store = setupStore(original)

		const blocks = splitTokensIntoBlocks(store.state.tokens.get())
		const reordered = reorderBlocks(original, blocks, 0, 2)

		// Only set value without updating tokens/previousValue — this is the broken path
		store.state.value.set(reordered)

		expect(() => getTokensByValue(store)).toThrow()
	})
})