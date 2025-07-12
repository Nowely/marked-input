export function getClosestIndexes(array: number[], target: number) {
	let left = -1, right = array.length
	while (right - left > 1) {
		const middle = Math.round((left + right) / 2)
		if (array[middle] <= target) {
			left = middle
		} else {
			right = middle
		}
	}
	if (array[left] == target) right = left
	return [left, right].filter(v => array[v] !== undefined)
}