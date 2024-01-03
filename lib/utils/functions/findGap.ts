export type Gap = { left?: number, right?: number }

export function findGap(previous: string = '', current: string = ''): Gap {
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