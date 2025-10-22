import { bench, describe, afterAll, it } from 'vitest'
import { Parser as ParserV1 } from './ParserV1/Parser'
import { Parser as ParserV2 } from './ParserV2/index'
import * as fs from 'fs'
import * as path from 'path'


// Test data generators
function generateComparisonText(marks: number): string {
	let result = 'Text with marks:'
	for (let i = 0; i < marks; i++) {
		result += ` @[user${i}](User ${i}) and #[tag${i}]`
	}
	result += ' end of text.'
	return result
}

// Parser configurations
const parserV1 = new ParserV1(['@[__label__](__value__)', '#[__label__]'])
const parserV2 = new ParserV2(['@[__value__](__meta__)', '#[__value__]'])

// Results storage
const benchmarkResults: any[] = []
const resultsPath = path.join(__dirname, 'parser.bench.result.json')
let benchmarkCount = 0
let completedBenchmarks = 0
let saveScheduled = false


function generateSummary() {
	const v1Results = benchmarkResults.filter(r => r.parser === 'v1')
	const v2Results = benchmarkResults.filter(r => r.parser === 'v2')

	// Группировка результатов по имени теста
	const groupByTest = (results: any[], parser: string) => {
		const groups: any = {}
		results.forEach(result => {
			const testName = result.name.replace(`Parser ${parser}: `, '').replace(`Parser ${parser} `, '')
			if (!groups[testName]) {
				groups[testName] = []
			}
			groups[testName].push(result.hz)
		})

		const summary: any = {}
		Object.keys(groups).forEach(testName => {
			const hzValues = groups[testName]
			summary[testName] = {
				avgHz: Math.round(hzValues.reduce((a: number, b: number) => a + b, 0) / hzValues.length),
				minHz: Math.min(...hzValues),
				maxHz: Math.max(...hzValues),
				samples: hzValues.length
			}
		})
		return summary
	}

	const v1Tests = groupByTest(v1Results, 'v1')
	const v2Tests = groupByTest(v2Results, 'v2')

	// Создание сравнительной структуры
	const testComparison: any = {}
	const allTestNames = new Set([...Object.keys(v1Tests), ...Object.keys(v2Tests)])

	allTestNames.forEach(testName => {
		const v1Data = v1Tests[testName]
		const v2Data = v2Tests[testName]

		if (v1Data && v2Data) {
			const ratio = v1Data.avgHz / v2Data.avgHz
			const winner = ratio > 1 ? 'v1' : 'v2'
			const performanceGap = Math.abs((ratio - 1) * 100)

			testComparison[testName] = {
				parserV1: v1Data,
				parserV2: v2Data,
				ratio: Math.round(ratio * 100) / 100,
				winner,
				performanceGap: `${Math.round(performanceGap)}% faster`
			}
		}
	})

	const summary = {
		testComparison,
		overall: {
			parserV1: v1Results.length > 0 ? Math.round(v1Results.reduce((sum, r) => sum + r.hz, 0) / v1Results.length) : 0,
			parserV2: v2Results.length > 0 ? Math.round(v2Results.reduce((sum, r) => sum + r.hz, 0) / v2Results.length) : 0,
			avgRatio: Object.keys(testComparison).length > 0 ?
				Object.values(testComparison).reduce((sum: number, test: any) => sum + test.ratio, 0) / Object.keys(testComparison).length : 0,
			v1Wins: Object.values(testComparison).filter((test: any) => test.winner === 'v1').length,
			v2Wins: Object.values(testComparison).filter((test: any) => test.winner === 'v2').length
		}
	}

	return summary
}

function saveResults() {
	console.log('🔍 saveResults called')
	try {
		// Читаем существующие результаты
		let existingResults = []
		try {
			const existingData = fs.readFileSync(resultsPath, 'utf8')
			console.log('📁 Read existing data:', existingData.substring(0, 50))
			if (existingData.trim()) {
				existingResults = JSON.parse(existingData)
				if (!Array.isArray(existingResults)) {
					existingResults = []
				}
			}
		} catch (error) {
			console.log('📁 File not found or empty, creating new array')
			// Файл не существует или пустой - создаем новый массив
			existingResults = []
		}

		console.log('📊 Existing results count:', existingResults.length)
		console.log('📊 Benchmark results count:', benchmarkResults.length)

		// Формируем данные для этого запуска
		const summary = generateSummary()

		const runData = {
			timestamp: new Date().toISOString(),
			overall: {
				parserV1: summary.overall.parserV1,
				parserV2: summary.overall.parserV2,
				avgRatio: summary.overall.avgRatio,
				v1Wins: summary.overall.v1Wins,
				v2Wins: summary.overall.v2Wins
			},
		summary: {
			testComparison: summary.testComparison
		}
		}

		// Добавляем новый запуск в начало массива
		existingResults.unshift(runData)
		console.log('📊 Added run to array, new count:', existingResults.length)

		// Сохраняем обратно
		const jsonData = JSON.stringify(existingResults, null, 2)
		console.log('💾 JSON data length:', jsonData.length)
		fs.writeFileSync(resultsPath, jsonData)

		console.log(`✅ Results saved to ${resultsPath}`)
		console.log(`📊 Run saved. Total runs in history: ${existingResults.length}`)

	} catch (error) {
		console.error('❌ Failed to save results:', error)
		console.error('Stack:', error.stack)
	}
}

// Function to create benchmark callback
function createBenchmarkCallback(name: string, parser: string, fn: () => void) {
	console.log(`🛠️ Created callback for ${name} (${parser})`)
	let callCount = 0
	return () => {
		callCount++
		if (callCount === 1) {
			console.log(`🚀 First call for ${name} (${parser})`)
		}
		const startTime = process.hrtime.bigint()
		fn()
		const endTime = process.hrtime.bigint()
		const timeMs = Number(endTime - startTime) / 1e6 // Convert to milliseconds
		const hz = 1000 / timeMs // Operations per second

		// Store result
		const result = {
			name,
			parser,
			hz: Math.round(hz),
			timeMs,
			timestamp: new Date().toISOString()
		}
		benchmarkResults.push(result)

		// For Vitest bench, the callback is called multiple times per benchmark
		// We consider the benchmark completed when we've collected enough samples
		// Let's use a simple approach: save when we have at least benchmarkCount results
		if (benchmarkResults.length >= benchmarkCount && !saveScheduled) {
			saveScheduled = true
			console.log(`✅ Collected ${benchmarkResults.length} results, saving...`)
			const v1Count = benchmarkResults.filter(r => r.parser === 'v1').length
			const v2Count = benchmarkResults.filter(r => r.parser === 'v2').length
			console.log(`📊 Results breakdown: v1=${v1Count}, v2=${v2Count}`)
			// Save immediately when we have enough results
			try {
				saveResults()
			} catch (error) {
				console.error('❌ Error saving results:', error)
			}
		}
	}
}

describe('Parser Performance Benchmark Suite', () => {
	// Performance Comparison
	const sizes = [10, 50, 100, 500]

	sizes.forEach(size => {
		const input = generateComparisonText(size)

		it(`Parser v1 (${size} marks)`, () => {
			const iterations = size <= 100 ? 10 : 5
			const results = []

			for (let i = 0; i < iterations; i++) {
				const startTime = process.hrtime.bigint()
				parserV1.split(input)
				const endTime = process.hrtime.bigint()
				const timeMs = Number(endTime - startTime) / 1e6
				const hz = 1000 / timeMs
				results.push(Math.round(hz))
			}

			const avgHz = Math.round(results.reduce((a, b) => a + b, 0) / results.length)
			benchmarkResults.push({
				name: `Parser v1 (${size} marks)`,
				parser: 'v1',
				hz: avgHz,
				timeMs: 0,
				timestamp: new Date().toISOString()
			})
		})

		it(`Parser v2 (${size} marks)`, () => {
			const iterations = size <= 100 ? 10 : 5
			const results = []

			for (let i = 0; i < iterations; i++) {
				const startTime = process.hrtime.bigint()
				parserV2.split(input)
				const endTime = process.hrtime.bigint()
				const timeMs = Number(endTime - startTime) / 1e6
				const hz = 1000 / timeMs
				results.push(Math.round(hz))
			}

			const avgHz = Math.round(results.reduce((a, b) => a + b, 0) / results.length)
			benchmarkResults.push({
				name: `Parser v2 (${size} marks)`,
				parser: 'v2',
				hz: avgHz,
				timeMs: 0,
				timestamp: new Date().toISOString()
			})
		})
	})

	// Real-world Scenarios
	const scenarios = [
		{
			name: 'social media',
			text: 'Hey @[john](John Doe)! Check out #[react] and #[javascript] for #[webdev] projects.'
		},
		{
			name: 'markdown-like',
			text: 'This is **[bold text]** with @[links](https://example.com) and #[hashtags]!'
		},
		{
			name: 'code comments',
			text: 'TODO: Fix @[bug123](null pointer) in #[authentication] module.'
		}
	]

	scenarios.forEach(({ name, text }) => {
		it(`Parser v1: ${name}`, () => {
			const results = []

			for (let i = 0; i < 20; i++) {
				const startTime = process.hrtime.bigint()
				parserV1.split(text)
				const endTime = process.hrtime.bigint()
				const timeMs = Number(endTime - startTime) / 1e6
				const hz = 1000 / timeMs
				results.push(Math.round(hz))
			}

			const avgHz = Math.round(results.reduce((a, b) => a + b, 0) / results.length)
			benchmarkResults.push({
				name: `Parser v1: ${name}`,
				parser: 'v1',
				hz: avgHz,
				timeMs: 0,
				timestamp: new Date().toISOString()
			})
		})

		it(`Parser v2: ${name}`, () => {
			const results = []

			for (let i = 0; i < 20; i++) {
				const startTime = process.hrtime.bigint()
				parserV2.split(text)
				const endTime = process.hrtime.bigint()
				const timeMs = Number(endTime - startTime) / 1e6
				const hz = 1000 / timeMs
				results.push(Math.round(hz))
			}

			const avgHz = Math.round(results.reduce((a, b) => a + b, 0) / results.length)
			benchmarkResults.push({
				name: `Parser v2: ${name}`,
				parser: 'v2',
				hz: avgHz,
				timeMs: 0,
				timestamp: new Date().toISOString()
			})
		})
	})

	// Save results after all tests complete
	afterAll(() => {
		if (benchmarkResults.length > 0) {
			saveResults()
		}
	})
})

// Function to show benchmark history
function showHistory() {
	try {
		const data = fs.readFileSync(resultsPath, 'utf8')
		const runs = JSON.parse(data)

		console.log('\n📚 Benchmark History')
		console.log('════════════════════')

		runs.forEach((run: any, index: number) => {
			const date = new Date(run.timestamp).toLocaleString('ru-RU', {
				year: 'numeric',
				month: '2-digit',
				day: '2-digit',
				hour: '2-digit',
				minute: '2-digit'
			})
			console.log(`${index + 1}. ${date} | v1=${run.overall.parserV1} | v2=${run.overall.parserV2} | ratio=${run.overall.avgRatio.toFixed(2)}x`)
		})

		if (runs.length > 0) {
			const latest = runs[0]
			console.log(`\n🎯 Latest run: ${new Date(latest.timestamp).toLocaleString('ru-RU')}`)
			console.log(`Parser v1: ${latest.overall.parserV1.toLocaleString()} ops/sec`)
			console.log(`Parser v2: ${latest.overall.parserV2.toLocaleString()} ops/sec`)
			console.log(`Ratio: ${latest.overall.avgRatio.toFixed(2)}x (${latest.overall.v1Wins}:${latest.overall.v2Wins} wins)`)
		}

	} catch (error) {
		console.log('📭 No benchmark history found')
	}
}

// Export for external usage
export { showHistory }
