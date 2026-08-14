import {describe, expect, it} from 'vitest'

import type {CoreOption} from '../../shared/types'
import {createRowContent} from './createRowContent'

describe('createRowContent', () => {
	it('returns a bare newline when no options are configured', () => {
		expect(createRowContent([])).toBe('\n')
	})

	it('returns a bare newline when the first option carries no markup', () => {
		expect(createRowContent([{}])).toBe('\n')
	})

	it('annotates an empty row from the first option markup', () => {
		const options: CoreOption[] = [{markup: '__slot__\n\n'}]
		expect(createRowContent(options)).toBe('\n\n')
	})
})