import {patienceDiffPlus} from '../PatienceDiff'

export function findMultiGap(value: string, newValue: string) {
	const dif = patienceDiffPlus(value.split(''), newValue.split(''))

	let previousIndex = -1
	dif.lines.find(v => {
		if (v.aIndex === -1) return true
		previousIndex = v.aIndex
	})
	return [previousIndex + 1, value.length-1] as const
}