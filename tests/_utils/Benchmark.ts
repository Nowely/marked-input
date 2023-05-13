import * as fs from 'fs'
import * as process from 'process'
import {Parser} from 'rc-marked-input/utils/Parser'
import {Markups_16} from './consts'
import {convertMsIntoFrequency} from './convertMsIntoFrequency'
import {readFile} from './readFile'
import {MeasureResult} from './types'
import {writeFile} from './writeFile'

export class Benchmark {
	dataDir = './data'
	result: MeasureResult = {}

	async start() {
		const names = await getTestDataNames(this.dataDir)
		for (let i = 0; i < names.length; i++) {
			const name = names[i]
			console.log(`Process ${i} of ${names.length} the ${name}`)

			for (let j = 0; j < 10; j++)
				await this.runFor(name)
		}
	}

	async runFor(name: string) {
		const data = await readFile(this.dataDir + '/' + name)
		const clearName = name.replace('.txt', '')
		this.result['111'] ??= {}
		this.result['111'][clearName] ??= {measures: {memory: [], speed: [], time: []}}

		//Not only 16 markups
		const parser = new Parser(Markups_16)

		const [time, memory, speed] = this.measure(() => parser.split(data))
		this.result['111'][clearName].measures.time.push(time)
		this.result['111'][clearName].measures.memory.push(memory)
		this.result['111'][clearName].measures.speed.push(speed)
	}

	measure(func: Function) {
		const startMemory = process.memoryUsage().heapUsed
		const startTime = performance.now()

		func()

		const endTime = performance.now()
		const endMemory = process.memoryUsage().heapUsed

		const time = endTime - startTime
		const memory = endMemory - startMemory
		const opPerSec = convertMsIntoFrequency(time)

		return [time, memory, opPerSec] as const
	}

	async loadResult() {
		const content = await readFile('./result.json')
		this.result = JSON.parse(content)
	}

	clearResult() {
		this.result = {}
	}

	async saveResult() {
		const content = JSON.stringify(this.result, null, ' ')
		await writeFile('./result.json', content)
	}
}

async function getTestDataNames(path: string) {
	try {
		let files = await fs.promises.readdir(path)
		files = files.filter(value => value.includes('-k'))
		return files
		//files.forEach(file => console.log(file))
	} catch (error) {
		console.log('Unable to scan directory: ' + error)
		throw error
	}
}