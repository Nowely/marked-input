import {readFile} from '../readFile'
import {DataScoredPath, NormalizedPath} from '../../consts'
import {NormalizedMeasures} from '../../types'
import {writeFile} from '../writeFile'

//await computeScoreForTestData(0.8, 0.1, 0.1)

async function computeScoreForTestData(timeAffect: number = 0.6, sizeAffect: number = 0.3, memoryAffect: number = 0.1) {
	const str = await readFile(NormalizedPath)
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

	await writeFile(DataScoredPath, JSON.stringify(data, null, ' '))
}