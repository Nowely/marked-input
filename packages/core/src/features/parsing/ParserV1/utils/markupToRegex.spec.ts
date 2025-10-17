import {faker} from '@faker-js/faker'
import {markupToRegex} from './markupToRegex'
import {describe, expect, it} from 'vitest'
import {Markup} from './types'
import {annotate} from './utils/annotate'

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

function createRandomMarkup(excludeSymbols: string) {
	const str1 = faker.string.sample(5)
	const str2 = faker.string.sample(5)
	const str3 = faker.string.sample(5)
	const markup = str1 + '__label__' + str2 + '__value__' + str3
	const regExp = new RegExp(`[${excludeSymbols}]`, 'g')
	return markup.replace(regExp, '') as Markup
}
