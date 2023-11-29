import {readFile} from '../readFile'
import {DataScoredPath, GroupScoredPath} from '../../consts'
import {EachScored, FinalScored} from '../../types'
import {writeFile} from '../writeFile'

export async function computeFinalScore() {
	const str = await readFile(DataScoredPath)
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
	console.log(entries)
	console.log(finalResult)

	await writeFile(GroupScoredPath, JSON.stringify(entries, null, ' '))
}