import {rawToMeasures} from './rawToMeasures'
import {normalizeData} from './normalizeData'
import {computeScoreForTestData} from './computeScoreForTestData'
import {computeFinalScore} from './computeFinalScore'

export async function processMeasures(timeAffect: number = 0.6, sizeAffect: number = 0.3, memoryAffect: number = 0.1) {
	await rawToMeasures()
	await normalizeData()
	await computeScoreForTestData(timeAffect, sizeAffect, memoryAffect)
	await computeFinalScore()
}