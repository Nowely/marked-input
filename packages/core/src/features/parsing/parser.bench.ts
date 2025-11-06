import {bench, describe, afterAll} from 'vitest'
import {Parser as ParserV1} from './ParserV1/Parser'
import {Parser as ParserV2} from './ParserV2/index'
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

// Simplified results storage for saving to JSON
interface TestResult {
	name: string
	category: 'scalability' | 'realWorld' // Internal only, not saved to JSON
	v1: [number, number, number] // [min, avg, max]
	v2: [number, number, number] // [min, avg, max]
	ratio: number
}

const testResults: TestResult[] = []
const resultsPath = path.join(__dirname, 'parser.bench.result.json')
let isCollecting = false // Prevent duplicate collection
let hasSaved = false // Prevent duplicate saves

// Utility functions
function calculateStats(values: number[]) {
	const sorted = [...values].sort((a, b) => a - b)
	const len = sorted.length
	return {
		avg: Math.round(values.reduce((a, b) => a + b, 0) / len),
		min: Math.round(sorted[0]),
		max: Math.round(sorted[len - 1]),
	}
}


function runBenchmark(parser: ParserV1 | ParserV2, input: string, iterations: number) {
	const ops: number[] = []

	for (let i = 0; i < iterations; i++) {
		const startTime = process.hrtime.bigint()

		parser.split(input)

		const endTime = process.hrtime.bigint()

		const timeMs = Number(endTime - startTime) / 1e6
		const hz = 1000 / timeMs

		ops.push(Math.round(hz))
	}

	return {ops}
}

function calculateTrends(currentRun: any, previousRun: any | null): any {
	if (!previousRun || !previousRun.summary || !previousRun.summary.performance) {
		return {
			v1: {changeFromLastV2: 'N/A', regressions: []},
			v2: {changeFromLastV2: 'N/A', regressions: []},
		}
	}

	const prevV1Ops = previousRun.summary.performance.v1
	const prevV2Ops = previousRun.summary.performance.v2

	if (!prevV1Ops || !prevV2Ops) {
		return {
			v1: {changeFromLastV2: 'N/A', regressions: []},
			v2: {changeFromLastV2: 'N/A', regressions: []},
		}
	}

	const v1Change = ((currentRun.summary.performance.v1 - prevV1Ops) / prevV1Ops) * 100
	const v2Change = ((currentRun.summary.performance.v2 - prevV2Ops) / prevV2Ops) * 100

	// Find regressions (>5% slowdown)
	const v1Regressions: string[] = []
	const v2Regressions: string[] = []

	Object.keys(currentRun.tests).forEach(testName => {
		const test = currentRun.tests[testName]
		const prevTest = previousRun.tests?.[testName]
		if (prevTest) {
			const v1Diff = ((test.v1[1] - prevTest.v1[1]) / prevTest.v1[1]) * 100
			const v2Diff = ((test.v2[1] - prevTest.v2[1]) / prevTest.v2[1]) * 100

			if (v1Diff < -5) v1Regressions.push(testName)
			if (v2Diff < -5) v2Regressions.push(testName)
		}
	})

	return {
		v1: {
			changeFromLast: v1Change >= 0 ? `+${v1Change.toFixed(1)}%` : `${v1Change.toFixed(1)}%`,
			regressions: v1Regressions,
		},
		v2: {
			changeFromLast: v2Change >= 0 ? `+${v2Change.toFixed(1)}%` : `${v2Change.toFixed(1)}%`,
			regressions: v2Regressions,
		},
	}
}

function saveResults() {
	if (testResults.length === 0 || hasSaved) {
		return
	}
	hasSaved = true

	console.log('\n💾 Saving benchmark results...')

	try {
		// Group all tests by name
		const tests: any = {}

		testResults.forEach(result => {
			// Remove category field and use name as key
			const {category, name, ...testData} = result
			tests[name] = testData
		})


		// Calculate summary
		const allV1Ops = testResults.map(t => t.v1[1]) // avg is at index 1
		const allV2Ops = testResults.map(t => t.v2[1]) // avg is at index 1

		const v1AvgOps = Math.round(allV1Ops.reduce((a, b) => a + b, 0) / allV1Ops.length)
		const v2AvgOps = Math.round(allV2Ops.reduce((a, b) => a + b, 0) / allV2Ops.length)

		const summary = {
			totalTests: testResults.length,
			performance: {
				v1: v1AvgOps,
				v2: v2AvgOps,
				ratio: Math.round((v1AvgOps / v2AvgOps) * 100) / 100,
			},
		}

		// Load previous results for trends
		let previousRun = null
		try {
			const existingData = fs.readFileSync(resultsPath, 'utf8')
			const existingResults = JSON.parse(existingData)
			if (Array.isArray(existingResults) && existingResults.length > 0) {
				previousRun = existingResults[0]
			}
		} catch (error) {
			// No previous results
		}

		// Add changeFromLastV2 for each test
		if (previousRun?.tests) {
			Object.keys(tests).forEach(testName => {
				const currentTest = tests[testName]
				const prevTest = previousRun.tests[testName]

				if (prevTest) {
					// Calculate change based on average value (index 1 in the array)
					const currentAvg = currentTest.v2[1] // v2 average
					const prevAvg = prevTest.v2[1]       // previous v2 average
					const change = ((currentAvg - prevAvg) / prevAvg) * 100

					currentTest.changeFromLastV2 = change >= 0
						? `+${change.toFixed(1)}%`
						: `${change.toFixed(1)}%`
				} else {
					currentTest.changeFromLastV2 = 'N/A'
				}
			})
		} else {
			// No previous run, set N/A for all tests
			Object.keys(tests).forEach(testName => {
				tests[testName].changeFromLastV2 = 'N/A'
			})
		}

		const currentRun: any = {
			timestamp: new Date().toISOString(),
			trends: {},
			summary,
			tests,
		}

		currentRun.trends = calculateTrends(currentRun, previousRun)

		// Load existing results
		let existingResults = []
		try {
			const existingData = fs.readFileSync(resultsPath, 'utf8')
			if (existingData.trim()) {
				existingResults = JSON.parse(existingData)
				if (!Array.isArray(existingResults)) {
					existingResults = []
				}
			}
		} catch (error) {
			existingResults = []
		}

		// Add new run to the beginning
		existingResults.unshift(currentRun)

		// Keep only last 10 runs
		if (existingResults.length > 10) {
			existingResults = existingResults.slice(0, 10)
		}

		// Save
		const jsonData = JSON.stringify(existingResults, null, 2)
		fs.writeFileSync(resultsPath, jsonData)

		console.log(`✅ Results saved to ${resultsPath}`)
		console.log(`📊 Total runs in history: ${existingResults.length}`)
		console.log(`\n📈 Summary:`)
		console.log(
			`   Performance: v1=${currentRun.summary.performance.v1.toLocaleString()} ops/sec (${currentRun.trends.v1.changeFromLast}), v2=${currentRun.summary.performance.v2.toLocaleString()} ops/sec (${currentRun.trends.v2.changeFromLast})`
		)
		console.log(
			`   Ratio: ${currentRun.summary.performance.ratio}x performance`
		)

		if (currentRun.trends.v1.regressions.length > 0) {
			console.log(`\n⚠️  v1 regressions: ${currentRun.trends.v1.regressions.join(', ')}`)
		}
		if (currentRun.trends.v2.regressions.length > 0) {
			console.log(`⚠️  v2 regressions: ${currentRun.trends.v2.regressions.join(', ')}`)
		}
	} catch (error) {
		console.error('❌ Failed to save results:', error)
	}
}

// Collect results after benchmarks complete
function collectResult(name: string, category: 'scalability' | 'realWorld', input: string, iterations: number) {
	// Check if already collected to prevent duplicates
	if (testResults.find(r => r.name === name && r.category === category)) {
		return
	}

	const v1Results = runBenchmark(parserV1, input, iterations)
	const v2Results = runBenchmark(parserV2, input, iterations)

	const v1Ops = calculateStats(v1Results.ops)
	const v2Ops = calculateStats(v2Results.ops)

	const ratio = v1Ops.avg / v2Ops.avg

	testResults.push({
		name,
		ratio: Math.round(ratio * 100) / 100,
		category,
		v1: [v1Ops.min, v1Ops.avg, v1Ops.max],
		v2: [v2Ops.min, v2Ops.avg, v2Ops.max],
	})
}

describe('Parser Performance Benchmark Suite', () => {
	// Scalability tests
	const sizes = [10, 50, 100, 500]

	sizes.forEach(size => {
		const input = generateComparisonText(size)
		const iterations = size <= 100 ? 10 : 5

		describe(`Scalability: ${size} marks`, () => {
			bench(
				`Parser v1 (${size} marks)`,
				() => {
					parserV1.split(input)
				},
				{
					time: 1000,
					iterations,
				}
			)

			bench(
				`Parser v2 (${size} marks)`,
				() => {
					parserV2.split(input)
				},
				{
					time: 1000,
					iterations,
					teardown() {
						// Collect results after this benchmark completes
						if (!isCollecting) {
							isCollecting = true
							collectResult(`${size} marks`, 'scalability', input, iterations)
							isCollecting = false
						}
					},
				}
			)
		})
	})

	// Real-world scenarios
	const scenarios = [
		{
			name: 'social media',
			text: 'Hey @[john](John Doe)! Check out #[react] and #[javascript] for #[webdev] projects.',
		},
		{
			name: 'markdown-like',
			text: 'This is **[bold text]** with @[links](https://example.com) and #[hashtags]!',
		},
		{
			name: 'code comments',
			text: 'TODO: Fix @[bug123](null pointer) in #[authentication] module.',
		},
	]

	scenarios.forEach(({name, text}) => {
		describe(`Real-world: ${name}`, () => {
			bench(
				`Parser v1: ${name}`,
				() => {
					parserV1.split(text)
				},
				{
					time: 1000,
					iterations: 20,
				}
			)

			bench(
				`Parser v2: ${name}`,
				() => {
					parserV2.split(text)
				},
				{
					time: 1000,
					iterations: 20,
					teardown() {
						// Collect results after this benchmark completes
						if (!isCollecting) {
							isCollecting = true
							collectResult(name, 'realWorld', text, 20)
							isCollecting = false
						}
					},
				}
			)
		})
	})

	// Save results at the end - using a final bench to ensure it runs
	describe('📊 Results', () => {
		bench(
			'Save to JSON',
			() => {
				// Benchmark that saves results
			},
			{
				setup() {
					// Save happens once in setup
					if (testResults.length > 0) {
						saveResults()
					}
				},
				time: 1,
				iterations: 1,
			}
		)
	})
})

// Export for external usage
export {saveResults}
