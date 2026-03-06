import * as fs from 'fs'
import * as path from 'path'

import {bench, describe} from 'vitest'

import {Parser as ParserV2} from './index'

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
const parserV2 = new ParserV2(['@[__value__](__meta__)', '#[__value__]'])

// Simplified results storage for saving to JSON
interface TestResult {
	name: string
	category: 'scalability' | 'realWorld' // Internal only, not saved to JSON
	performance: [number, number, number] // [min, avg, max] for ParserV2
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

function runBenchmark(parser: ParserV2, input: string, iterations: number) {
	const ops: number[] = []

	for (let i = 0; i < iterations; i++) {
		const startTime = process.hrtime.bigint()

		parser.parse(input)

		const endTime = process.hrtime.bigint()

		const timeMs = Number(endTime - startTime) / 1e6
		const hz = 1000 / timeMs

		ops.push(Math.round(hz))
	}

	return {ops}
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
			const {name, ...testData} = result
			tests[name] = testData
		})

		// Calculate summary
		const allOps = testResults.map(t => t.performance[1]) // avg is at index 1

		const avgOps = Math.round(allOps.reduce((a, b) => a + b, 0) / allOps.length)

		const summary = {
			totalTests: testResults.length,
			performance: avgOps,
		}

		// Load previous results for trends
		let previousRun = null
		try {
			const existingData = fs.readFileSync(resultsPath, 'utf8')
			const existingResults = JSON.parse(existingData)
			if (Array.isArray(existingResults) && existingResults.length > 0) {
				// Find the most recent run with the new format (single parser)
				for (const run of existingResults) {
					if (run.summary && typeof run.summary.performance === 'number') {
						previousRun = run
						break
					}
				}
			}
		} catch {
			// No previous results
		}

		// Add changeFromLast for each test
		if (previousRun?.tests) {
			Object.keys(tests).forEach(testName => {
				const currentTest = tests[testName]
				const prevTest = previousRun.tests[testName]

				if (prevTest && prevTest.performance && Array.isArray(prevTest.performance)) {
					// Calculate change based on average value (index 1 in the array)
					const currentAvg = currentTest.performance[1] // current average
					const prevAvg = prevTest.performance[1] // previous average
					const change = ((currentAvg - prevAvg) / prevAvg) * 100

					currentTest.changeFromLast = change >= 0 ? `+${change.toFixed(1)}%` : `${change.toFixed(1)}%`
				} else {
					currentTest.changeFromLast = 'N/A'
				}
			})
		} else {
			// No previous run, set N/A for all tests
			Object.keys(tests).forEach(testName => {
				tests[testName].changeFromLast = 'N/A'
			})
		}

		// Calculate trends for single parser
		const currentRun: any = {
			timestamp: new Date().toISOString(),
			trends: {
				changeFromLast: 'N/A',
				regressions: [],
			},
			summary,
			tests,
		}

		// Calculate trends if we have previous run
		if (previousRun) {
			const prevOps = previousRun.summary.performance
			const currentOps = currentRun.summary.performance

			if (prevOps && currentOps) {
				const change = ((currentOps - prevOps) / prevOps) * 100
				currentRun.trends.changeFromLast = change >= 0 ? `+${change.toFixed(1)}%` : `${change.toFixed(1)}%`

				// Find regressions (>5% slowdown)
				const regressions: string[] = []
				Object.keys(currentRun.tests).forEach(testName => {
					const test = currentRun.tests[testName]
					const prevTest = previousRun.tests?.[testName]
					if (prevTest && prevTest.performance && Array.isArray(prevTest.performance)) {
						const diff = ((test.performance[1] - prevTest.performance[1]) / prevTest.performance[1]) * 100
						if (diff < -5) regressions.push(testName)
					}
				})
				currentRun.trends.regressions = regressions
			}
		}

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
		} catch {
			existingResults = []
		}

		// Add new run to the beginning
		existingResults.unshift(currentRun)

		// Keep only last 50 runs
		if (existingResults.length > 50) {
			existingResults = existingResults.slice(0, 50)
		}

		// Save
		const jsonData = JSON.stringify(existingResults, null, 2)
		fs.writeFileSync(resultsPath, jsonData)

		console.log(`✅ Results saved to ${resultsPath}`)
		console.log(`📊 Total runs in history: ${existingResults.length}`)
		console.log(`\n📈 Summary:`)
		console.log(
			`   Performance: ${currentRun.summary.performance.toLocaleString()} ops/sec (${currentRun.trends.changeFromLast})`
		)

		if (currentRun.trends.regressions && currentRun.trends.regressions.length > 0) {
			console.log(`⚠️  Regressions: ${currentRun.trends.regressions.join(', ')}`)
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

	const v2Results = runBenchmark(parserV2, input, iterations)
	const v2Ops = calculateStats(v2Results.ops)

	testResults.push({
		name,
		category,
		performance: [v2Ops.min, v2Ops.avg, v2Ops.max],
	})
}

describe('ParserV2 Performance Benchmark Suite', () => {
	// Scalability tests
	const sizes = [10, 50, 100, 500]

	sizes.forEach(size => {
		const input = generateComparisonText(size)
		const iterations = size <= 100 ? 10 : 5

		describe(`Scalability: ${size} marks`, () => {
			bench(
				`Parser v2 (${size} marks)`,
				() => {
					parserV2.parse(input)
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
				`Parser v2: ${name}`,
				() => {
					parserV2.parse(text)
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