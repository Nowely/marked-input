import {faker} from '@faker-js/faker'
import {annotate} from 'rc-marked-input'
import {markupToRegex} from 'rc-marked-input/utils/markupToRegex'
import {describe, it, expect} from 'vitest'
import {createRandomMarkup} from '../_utils/createRandomMarkup'

describe(`Utility: ${markupToRegex.name}`, () => {
	it('should convert markup to regex', () => {
		const word1 = faker.lorem.word()
		const word2 = faker.lorem.word()

		const markup = createRandomMarkup(word1 + word2)
		const regex = markupToRegex(markup)
		const annotation = annotate(markup, word1, word2)
		const textWithAnnotation = `${faker.lorem.words()} ${annotation} ${faker.lorem.words()}`
		const textWithoutAnnotation = faker.lorem.sentences()

		expect(regex.test(textWithAnnotation)).toBeTruthy()
		expect(regex.test(textWithoutAnnotation)).toBeFalsy()
	})
})
