import {faker} from '@faker-js/faker'
import {genHash} from 'rc-marked-input/utils'

describe(`Utility: ${genHash.name}`, () => {
	const str = faker.datatype.string()

	it('should be determinate', () =>
		expect(genHash(str)).toBe(genHash(str)))

	it('should accept a seed', () => {
		expect(genHash(str)).not.toBe(genHash(str, faker.datatype.number({min: 1})))
		expect(genHash(str)).not.toBe(genHash(str, faker.datatype.number({min: -100000})))
	})

	it('should return a number', () =>
		expect(typeof genHash(str)).toBe('number'))
})