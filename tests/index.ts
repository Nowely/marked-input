//await normalizeData()

import {EachScoredMeasuresPath, FinalScorePath, NormalizedMeasuresPath} from './_utils/consts'
import {readFile} from './_utils/readFile'
import {EachScored, FinalScored, NormalizedMeasures} from './_utils/types'
import {writeFile} from './_utils/writeFile'

async function computeScoreForTestData(timeAffect: number = 0.6, sizeAffect: number = 0.3, memoryAffect: number = 0.1) {
	const str = await readFile(NormalizedMeasuresPath)
	const data: NormalizedMeasures = JSON.parse(str)

	const groups = Object.keys(data)
	const testDataNames = Object.keys(data[groups[0]])

	for (const group in data) {
		for (const testDataName in data[group]) {
			const {memory, time, size} = data[group][testDataName]
			// @ts-ignore
			data[group][testDataName] = timeAffect * time + sizeAffect * size + memoryAffect * memory
		}
	}

	await writeFile(EachScoredMeasuresPath, JSON.stringify(data, null, ' '))
}

await computeScoreForTestData(0.8, 0.1, 0.1)

async function computeFinalScore() {
	const str = await readFile(EachScoredMeasuresPath)
	let data: EachScored = JSON.parse(str)

	for (const group in data) {
		let finalScore = 0
		for (const testDataName in data[group]) {
			const score = data[group][testDataName]
			finalScore = finalScore + score
		}
		// @ts-ignore
		data[group] = finalScore
	}

	const entries = Object.entries(data as unknown as FinalScored)
	entries.sort(([_1, a], [_2, b]) => a - b)

	const finalResult: FinalScored = {}
	for (const [key, value] of entries) {
		finalResult[key] = value
	}
	console.log(finalResult)

	await writeFile(FinalScorePath, JSON.stringify(entries, null, ' '))
}

await computeFinalScore()

function normalize(arr: number[]) {
	const max = Math.max(...arr)
	const min = Math.min(...arr)
	return arr.map(value => (value - min) / (max - min))
}

/*const tester = new Benchmark()
await tester.loadResult()
await tester.start()
await tester.saveResult()*/
