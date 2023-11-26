import {bench, describe} from 'vitest'

describe('sort', () => {
	bench('normal', () => {
		const x = [1, 5, 4, 2, 3]
		x.sort((a, b) => a - b)
	})

	bench('reverse', () => {
		const x = [1, 5, 4, 2, 3]
		x.reverse().sort((a, b) => a - b)

	})
})