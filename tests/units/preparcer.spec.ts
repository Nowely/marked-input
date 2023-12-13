import {expect} from 'vitest'

const Hello = 'Hello'
const Day = 'Day'
const Great = 'Great'
const I = 'I'

const HelloDay = `${Hello}${Day}`
const HelloGreatDay = `${Hello}${Great}${Day}`
const HelloIDay = `${Hello}${I}${Day}`
const HelloI = `${Hello}${I}`
const IHello = `${I}${Hello}`

//TODO process Similar start such as HEro and HEllo
describe.only(`Utility: preparcer`, () => {

	it('should work on equal', () =>
		expect(findGap(Hello, Hello)).toMatchObject({}))
	it('should work on insert for empty', () =>
		expect(findGap('', Hello)).toMatchObject({left: undefined, right: undefined}))
	it('should work on remove from empty', () =>
		expect(findGap(Hello, '')).toMatchObject({left: 0, right: Hello.length}))


	it('should work on single start type', () =>
		expect(findGap(Hello, IHello)).toMatchObject({left: 0, right: undefined}))
	it('should work on multi start type', () =>
		expect(findGap(Day, HelloDay)).toMatchObject({left: 0, right: undefined}))

	it('should work on single middle type', () =>
		expect(findGap(HelloDay, HelloIDay)).toMatchObject({left: Hello.length, right: HelloDay.length - Day.length}))
	it('should work on multi middle type', () =>
		expect(findGap(HelloDay, HelloGreatDay)).toMatchObject({left: Hello.length, right: HelloDay.length - Day.length}))

	it('should work on single end type', () =>
		expect(findGap(Hello, HelloI)).toMatchObject({left: undefined, right: Hello.length}))
	it('should work on multi end type', () =>
		expect(findGap(Hello, HelloDay)).toMatchObject({left: undefined, right: Hello.length}))


	it('should work on single start remove', () =>
		expect(findGap(IHello, Hello)).toMatchObject({left: 0, right: IHello.length - Hello.length}))
	it('should work on multi start remove', () =>
		expect(findGap(HelloDay, Day)).toMatchObject({left: 0, right: HelloDay.length - Day.length}))

	it('should work on single middle remove', () =>
		expect(findGap(HelloIDay, HelloDay)).toMatchObject({left: Hello.length, right: HelloI.length}))
	it('should work on multi middle remove', () =>
		expect(findGap(HelloGreatDay, HelloDay)).toMatchObject({
			left: HelloGreatDay.length - HelloDay.length,
			right: HelloGreatDay.length - Day.length
		}))

	it('should work on single end remove', () =>
		expect(findGap(HelloI, Hello)).toMatchObject({left: Hello.length, right: HelloI.length}))
	it('should work on multi end remove', () =>
		expect(findGap(HelloDay, Hello)).toMatchObject({left: Hello.length, right: HelloDay.length}))
})

export type Gap = { left?: number, right?: number }

function findGap(previous: string, current: string): Gap {
	if (previous === current) return {}

	let left: number | undefined
	for (let i = 0; i < previous.length; i++) {
		if (previous[i] !== current[i]) {
			left = i
			break
		}
	}

	let right: number | undefined
	for (let i = 1; i <= previous.length; i++) {
		if (previous.at(-i) !== current.at(-i)) {
			right = previous.length - i + 1
			break
		}
	}

	return {left, right}
}