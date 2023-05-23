import {readFile} from '../readFile'
import {TargetPath, RawPath, SizeMap} from '../../consts'
import {Measures, RawMeasures} from '../../types'
import {convertMsIntoFrequency} from '../convertMsIntoFrequency'
import {writeFile} from '../writeFile'

async function rawToMeasures() {
	const data = await readFile(RawPath)
	const result: RawMeasures = JSON.parse(data)
	const measures: Measures = {}

	for (const group in result) {
		measures[group] ??= {}
		for (const testCase in result[group]) {
			const lineCount = Number(testCase.split('-')[0])

			const memoryArr = result[group][testCase].memory.filter(value => value > 0)
			//const speedArr = result[group][testCase].speed.sort((a, b) => a - b)
			let timeArr = result[group][testCase].time.sort((a, b) => a - b)
			timeArr = removeFirstAndLast20Percent(timeArr)
			const time = findAverage(timeArr)
			const speed = convertMsIntoFrequency(time)

			const accuracy = lineCount <= 10 ? 10 : lineCount <= 100 ? 100 : lineCount <= 1000 ? 1000 : 10000
			const groupedMemory = groupBySimilar(memoryArr, accuracy)
			const [memory, count] = findOften(groupedMemory)

			// @ts-ignore
			const size = SizeMap.analyzer[group[0]] + SizeMap.parser[group[1]] + SizeMap.joiner[group[2]]
			/*if (accuracy === 10000)
				console.log(`Goal is ${goal} with ${count} count`)*/
			measures[group][testCase] = {memory, size, time, speed}
		}
	}

	await writeFile(TargetPath, JSON.stringify(measures, null, ' '))
}

function findOften(groups: Record<number, number>) {
	let count = Number.NEGATIVE_INFINITY
	let goalKey = ''
	for (const key in groups) {
		if (groups[key] > count) {
			count = groups[key]
			goalKey = key
		}
	}
	return [Number(goalKey), count] as const
}

function groupBySimilar(numbers: number[], accuracy: number = 10) {
	const groups: Record<number, number> = {}

	for (let number of numbers) {
		const key = Math.floor(number / accuracy) * accuracy
		groups[key] ??= 0
		groups[key] = groups[key] + 1
	}

	return groups
}

function findAverage(numbers: number[]): number {
	const sum: number = numbers.reduce((accumulator: number, currentValue: number) => accumulator + currentValue, 0)
	return sum / numbers.length
}

function removeFirstAndLast20Percent(array: number[]) {
	const startIndex = Math.floor(array.length * 0.2)
	const endIndex = Math.ceil(array.length * 0.8)

	return array.slice(startIndex, endIndex)
}