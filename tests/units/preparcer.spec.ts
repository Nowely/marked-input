import {expect} from 'vitest'

describe.only(`Utility: preparcer`, () => {

	it('should work on equal', () => {
		const gap = findGap('Hello', 'Hello')
		expect(gap).toMatchObject({})
	})


	it('should work on insert for empty', () => {
		const gap = findGap('', 'Hello')
		expect(gap).toMatchObject({start: undefined, end: undefined})
	})

	it('should work on remove from empty', () => {
		const gap = findGap('Hello', '')
		expect(gap).toMatchObject({start: 0, end: 5})
	})


	it('should work on single start type', () => {
		const gap = findGap('Hello', '!Hello')
		expect(gap).toMatchObject({start: 0, end: undefined})
	})

	it('should work on single middle type', () => {
		const gap = findGap('Hello World', 'Hello! World')
		expect(gap).toMatchObject({start: 5, end: 5})
	})

	it('should work on single end type', () => {
		const gap = findGap('Hello World', 'Hello World!')
		expect(gap).toMatchObject({start: undefined, end: 11})
	})


	it('should work on multi start type', () => {
		const gap = findGap('World', 'Hello World')
		expect(gap).toMatchObject({start: 0, end: undefined})
	})

	it('should work on multi middle type', () => {
		const gap = findGap('Hello World', 'Hello beautiful World')
		expect(gap).toMatchObject({start: 6, end: 5})
	})

	it('should work on multi end type', () => {
		const gap = findGap('Hello', 'Hello World')
		expect(gap).toMatchObject({start: undefined, end: 5})
	})


	it('should work on single start remove', () => {
		const gap = findGap('!Hello', 'Hello')
		expect(gap).toMatchObject({start: 0, end: 1})
	})

	it('should work on single middle remove', () => {
		const gap = findGap('Hello! World', 'Hello World')
		expect(gap).toMatchObject({start: 5, end: 6})
	})

	it('should work on single end remove', () => {
		const gap = findGap('Hello World!', 'Hello World')
		expect(gap).toMatchObject({start: 11, end: 12})
	})


	it('should work on multi start remove', () => {
		const gap = findGap('Hello World', 'World')
		expect(gap).toMatchObject({start: 0, end: 6})
	})

	it('should work on multi middle remove', () => {
		const gap = findGap('Hello beautiful World', 'Hello World')
		expect(gap).toMatchObject({start: 6, end: 15})
	})

	it('should work on multi end remove', () => {
		const gap = findGap('Hello World', 'Hello')
		expect(gap).toMatchObject({start: 5, end: 11})
	})
})

export type Gap = { start?: number, end?: number }

function findGap(previous: string, current: string): Gap {
	if (previous === current) return {}

	let start: number | undefined
	for (let i = 0; i < previous.length; i++) {
		if (previous[i] !== current[i]) {
			start = i
			break
		}
	}

	let end: number | undefined
	for (let i = 1; i <= previous.length; i++) {
		if (previous.at(-i) !== current.at(-i)) {
			end = previous.length - i + 1
			break
		}
	}

	return {start, end}
}