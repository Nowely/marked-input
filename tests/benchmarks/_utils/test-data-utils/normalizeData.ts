import {readFile} from '../readFile'
import {TargetPath, NormalizedPath} from '../../consts'
import {Measures} from '../../types'
import {writeFile} from '../writeFile'

export async function normalizeData() {
	const str = await readFile(TargetPath)
	const data: Measures = JSON.parse(str)
	const groups = Object.keys(data)
	const testDataNames = Object.keys(data[groups[0]])

	//для каждого имени найти мин и макс по времени и памяти, и размеру
	for (const name of testDataNames) {
		//normalize time
		const minTime = Math.min(...groups.map(group => data[group][name].time))
		const maxTime = Math.max(...groups.map(group => data[group][name].time))
		groups.forEach(group => {
			data[group][name].time = (data[group][name].time - minTime) / (maxTime - minTime)
		})

		//normalize memory
		const minMemory = Math.min(...groups.map(group => data[group][name].memory))
		const maxMemory = Math.max(...groups.map(group => data[group][name].memory))
		groups.forEach(group => {
			data[group][name].memory = (data[group][name].memory - minMemory) / (maxMemory - minMemory)
		})

		//normalize size
		const minSize = Math.min(...groups.map(group => data[group][name].size))
		const maxSize = Math.max(...groups.map(group => data[group][name].size))
		groups.forEach(group => {
			data[group][name].size = (data[group][name].size - minSize) / (maxSize - minSize)
		})

		//remove speed
		groups.forEach(group => {
			// @ts-ignore
			delete data[group][name].speed
		})
	}

	await writeFile(NormalizedPath, JSON.stringify(data, null, ' '))
}