import * as fs from 'fs'
import * as process from 'process'
import {Parser} from 'rc-marked-input/utils/Parser'
import {Markups_16} from './consts'
import {readFile} from './readFile'
import {MeasureResult} from './types'
import {writeFile} from './writeFile'

export class Tester {
	dataDir = './data'
	result: MeasureResult = {}

	constructor() {
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

	async start() {
		const names = await this.getTestDataNames()
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

		const parser = new Parser(Markups_16)

		const [time, memory, speed] = this.benchmark(() => parser.split(data))
		this.result['111'][clearName].measures.time.push(time)
		this.result['111'][clearName].measures.memory.push(memory)
		this.result['111'][clearName].measures.speed.push(speed)
	}

	benchmark(func: Function) {
		const startMemory = process.memoryUsage().heapUsed
		const start = performance.now()

		func()

		const end = performance.now()
		const endMemory = process.memoryUsage().heapUsed
		const averageTime = (end - start) /// 1000

		// Measure memory usage after sorting
		const usedMemory = endMemory - startMemory
		const opPerSec = (1 / (averageTime / 1000))
		//console.log(`Average execution time: ${averageTime} ms`)
		//console.log(`Memory used: ${usedMemory} bytes`)
		//console.log('Op/sec: ' + opPerSec)
		return [averageTime, usedMemory, opPerSec] as const
		// Convert in second
		//const diffSec = (end - start) / 1000;
		//console.log('op/sec: ' + (1 / diffSec));
	}

	async getTestDataNames() {
		try {
			let files = await fs.promises.readdir(this.dataDir)
			files = files.filter(value => value.includes('-k'))
			return files
			//files.forEach(file => console.log(file))
		} catch (error) {
			console.log('Unable to scan directory: ' + error)
			throw error
		}
	}
}