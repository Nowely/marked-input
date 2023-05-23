import * as path from 'path'
import * as process from 'process'
import {Analyzers, AnnCountToMarkupMap, DataFolderPath, Joiners, LineCountToDiff, Parsers, RawPath} from '../consts'
import {AlgorithmGroup, RawMeasures} from '../types'
import {convertMsIntoFrequency} from './convertMsIntoFrequency'
import {getFileNames} from './getFileNames'
import {readFile} from './readFile'
import {VirtualComponent} from './VirtualComponent'
import {writeFile} from './writeFile'

export class Benchmark {
	result: RawMeasures = {}

	//Load last results, start measuring, save result in any way
	static async continue(iterations: number = 10) {
		const tester = new Benchmark()
		await tester.loadResult()
		try {
			await tester.start(iterations)
		} catch (e) {
			console.error(e)
		} finally {
			await tester.saveResult()
		}
	}

	//Only start measuring
	static async start(iterations: number = 10) {
		const tester = new Benchmark()
		await tester.start()
	}

	async start(iterations: number = 10) {
		const names = (await getFileNames(DataFolderPath))
			.filter(value => value.includes('-k'))
			.sort((a, b) => {
				const a1 = Number(a.split('-')[0])
				const b1 = Number(b.split('-')[0])
				return a1 - b1
			})

		//To 10_000 is 105
		console.log(`Start benchmark`)
		const startTime = performance.now()
		for (let i = 0; i < names.length; i++) {
			const name = names[i]
			console.log(`Process ${i} of ${names.length} the ${name}`)

			const startTime = performance.now()

			for (let j = 0; j < iterations; j++) await this.runFor(name)

			const endTime = performance.now()
			const executionTime = Math.round(endTime - startTime)
			console.log(`Process ${i} finished in ${executionTime} ms`)
			console.log()
		}
		const endTime = performance.now()
		const executionTime = Math.round(endTime - startTime) / 60000
		console.log(`Benchmark finished in ${executionTime} min`)
	}

	async runFor(name: string) {
		const data = await readFile(path.resolve(DataFolderPath, name))
		const clearName = name.replace('.txt', '')
		const [lineCount, annRatio, annCount] = clearName.split('-')
		const updateRule = LineCountToDiff[lineCount]
		const markups = AnnCountToMarkupMap[annCount]

		for (let i = 0; i < Analyzers.length; i++) {
			for (let j = 0; j < Parsers.length; j++) {
				for (let k = 0; k < Joiners.length; k++) {
					const group = getAlgorithmGroup(i, j, k)

					this.result[group] ??= {}
					this.result[group][clearName] ??= {memory: [], speed: [], time: []}

					const component = new VirtualComponent(markups, [i, j, k])

					const inputData = data.substring(0, data.length - updateRule.count * updateRule.speed)
					const updaterData = data.substring(data.length - updateRule.count * updateRule.speed)

					/*const [time, memory, speed] = this.measure(() => component.render(inputData))
					this.result[group][clearName].measures.time.push(time)
					this.result[group][clearName].measures.memory.push(memory)
					this.result[group][clearName].measures.speed.push(speed)*/
					component.render(inputData)

					let currentPosition = 0
					for (let l = 0; l < updateRule.count; l++) {
						let c = updaterData.substring(currentPosition, currentPosition + updateRule.speed)
						currentPosition = currentPosition + updateRule.speed
						const [time1, memory1, speed1] = this.measure(() =>
							component.update(str => str + c))

						this.result[group][clearName].time.push(time1)
						this.result[group][clearName].memory.push(memory1)
						this.result[group][clearName].speed.push(speed1)
					}


				}
			}
		}


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
		const content = await readFile(RawPath)
		this.result = JSON.parse(content)
	}

	clearResult() {
		this.result = {}
	}

	async saveResult() {
		const content = JSON.stringify(this.result, null, ' ')
		await writeFile(RawPath, content)
	}
}


function getAlgorithmGroup(i: number, j: number, k: number): AlgorithmGroup {
	return `${i}${j}${k}`
}