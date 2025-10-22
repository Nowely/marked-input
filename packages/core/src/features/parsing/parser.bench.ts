import { bench, describe, afterAll } from 'vitest'
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

// Results storage for saving to JSON
interface TestResult {
	name: string
	category: 'scalability' | 'realWorld'
	input: { marks: number; complexity: string }
	results: {
		v1: {
			ops: { avg: number; min: number; max: number; p95: number; p99: number }
			latency: { avg: number; min: number; max: number; p95: number; p99: number; unit: string }
			memory: { heapUsed: number; external: number; unit: string }
			samples: number
		}
		v2: {
			ops: { avg: number; min: number; max: number; p95: number; p99: number }
			latency: { avg: number; min: number; max: number; p95: number; p99: number; unit: string }
			memory: { heapUsed: number; external: number; unit: string }
			samples: number
		}
		comparison: {
			ratio: number
			winner: string
			performanceGap: string
			latencyDiff: number
			memoryRatio: number
		}
	}
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
		p95: Math.round(sorted[Math.floor(len * 0.95)]),
		p99: Math.round(sorted[Math.floor(len * 0.99)])
	}
}

function getMemoryUsage() {
	const usage = process.memoryUsage()
	return {
		heapUsed: Math.round(usage.heapUsed / 1024), // KB
		external: Math.round(usage.external / 1024) // KB
	}
}

function runBenchmark(parser: ParserV1 | ParserV2, input: string, iterations: number) {
	const ops: number[] = []
	const latency: number[] = []
	const memory: ReturnType<typeof getMemoryUsage>[] = []

	for (let i = 0; i < iterations; i++) {
		const startMem = getMemoryUsage()
		const startTime = process.hrtime.bigint()

		parser.split(input)

		const endTime = process.hrtime.bigint()
		const endMem = getMemoryUsage()

		const timeMs = Number(endTime - startTime) / 1e6
		const hz = 1000 / timeMs

		ops.push(Math.round(hz))
		latency.push(timeMs)
		memory.push(endMem)
	}

	return { ops, latency, memory }
}

function calculateTrends(currentRun: any, previousRun: any | null): any {
	if (!previousRun || !previousRun.summary || !previousRun.summary.overallPerformance) {
		return {
			v1: { changeFromLast: 'N/A', regressions: [] },
			v2: { changeFromLast: 'N/A', regressions: [] }
		}
	}

	const prevV1Ops = previousRun.summary.overallPerformance.v1?.avgOps
	const prevV2Ops = previousRun.summary.overallPerformance.v2?.avgOps

	if (!prevV1Ops || !prevV2Ops) {
		return {
			v1: { changeFromLast: 'N/A', regressions: [] },
			v2: { changeFromLast: 'N/A', regressions: [] }
		}
	}

	const v1Change = ((currentRun.summary.overallPerformance.v1.avgOps - prevV1Ops) / prevV1Ops) * 100
	const v2Change = ((currentRun.summary.overallPerformance.v2.avgOps - prevV2Ops) / prevV2Ops) * 100

	// Find regressions (>5% slowdown)
	const v1Regressions: string[] = []
	const v2Regressions: string[] = []

	Object.keys(currentRun.categories).forEach(category => {
		currentRun.categories[category].tests.forEach((test: any) => {
			const prevTest = previousRun.categories[category]?.tests.find((t: any) => t.name === test.name)
			if (prevTest) {
				const v1Diff = ((test.results.v1.ops.avg - prevTest.results.v1.ops.avg) / prevTest.results.v1.ops.avg) * 100
				const v2Diff = ((test.results.v2.ops.avg - prevTest.results.v2.ops.avg) / prevTest.results.v2.ops.avg) * 100

				if (v1Diff < -5) v1Regressions.push(test.name)
				if (v2Diff < -5) v2Regressions.push(test.name)
			}
		})
	})

	return {
		v1: {
			changeFromLast: v1Change >= 0 ? `+${v1Change.toFixed(1)}%` : `${v1Change.toFixed(1)}%`,
			regressions: v1Regressions
		},
		v2: {
			changeFromLast: v2Change >= 0 ? `+${v2Change.toFixed(1)}%` : `${v2Change.toFixed(1)}%`,
			regressions: v2Regressions
		}
	}
}

function saveResults() {
	if (testResults.length === 0 || hasSaved) {
		return
	}
	hasSaved = true

	console.log('\n💾 Saving benchmark results...')

	try {
		// Group by category
		const categories: any = {
			scalability: { tests: [] },
			realWorld: { tests: [] }
		}

		testResults.forEach(result => {
			categories[result.category].tests.push(result)
		})

		// Calculate summary
		const allV1Ops = testResults.flatMap(t => t.results.v1.ops.avg)
		const allV2Ops = testResults.flatMap(t => t.results.v2.ops.avg)

		const v1AvgOps = Math.round(allV1Ops.reduce((a, b) => a + b, 0) / allV1Ops.length)
		const v2AvgOps = Math.round(allV2Ops.reduce((a, b) => a + b, 0) / allV2Ops.length)

		const summary = {
			totalTests: testResults.length,
			v1Wins: testResults.filter(t => t.results.comparison.winner === 'v1').length,
			v2Wins: testResults.filter(t => t.results.comparison.winner === 'v2').length,
			overallPerformance: {
				v1: { avgOps: v1AvgOps, medianOps: v1AvgOps },
				v2: { avgOps: v2AvgOps, medianOps: v2AvgOps }
			},
			performanceRatio: Math.round((v1AvgOps / v2AvgOps) * 100) / 100
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

		const currentRun: any = {
			timestamp: new Date().toISOString(),
			trends: {},
			summary,
			categories
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
		console.log(`   v1: ${currentRun.summary.overallPerformance.v1.avgOps.toLocaleString()} ops/sec (${currentRun.trends.v1.changeFromLast})`)
		console.log(`   v2: ${currentRun.summary.overallPerformance.v2.avgOps.toLocaleString()} ops/sec (${currentRun.trends.v2.changeFromLast})`)
		console.log(`   Ratio: ${currentRun.summary.performanceRatio}x`)
		console.log(`   Winner: v${currentRun.summary.v1Wins > currentRun.summary.v2Wins ? '1' : '2'} (${currentRun.summary.v1Wins}:${currentRun.summary.v2Wins})`)

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
	const v1Latency = calculateStats(v1Results.latency)
	const v2Latency = calculateStats(v2Results.latency)

	const v1MemAvg = {
		heapUsed: Math.round(v1Results.memory.reduce((sum, m) => sum + m.heapUsed, 0) / v1Results.memory.length),
		external: Math.round(v1Results.memory.reduce((sum, m) => sum + m.external, 0) / v1Results.memory.length)
	}
	const v2MemAvg = {
		heapUsed: Math.round(v2Results.memory.reduce((sum, m) => sum + m.heapUsed, 0) / v2Results.memory.length),
		external: Math.round(v2Results.memory.reduce((sum, m) => sum + m.external, 0) / v2Results.memory.length)
	}

	const ratio = v1Ops.avg / v2Ops.avg
	const winner = ratio > 1 ? 'v1' : 'v2'
	const performanceGap = Math.abs((ratio - 1) * 100)
	const latencyDiff = v2Latency.avg / v1Latency.avg
	const memoryRatio = v2MemAvg.heapUsed / v1MemAvg.heapUsed

	// Extract marks count
	const marks = (input.match(/@\[/g) || []).length + (input.match(/#\[/g) || []).length

	testResults.push({
		name,
		category,
		input: { marks, complexity: category === 'realWorld' ? 'real-world' : 'simple' },
		results: {
			v1: {
				ops: v1Ops,
				latency: { ...v1Latency, unit: 'ms' },
				memory: { ...v1MemAvg, unit: 'KB' },
				samples: iterations
			},
			v2: {
				ops: v2Ops,
				latency: { ...v2Latency, unit: 'ms' },
				memory: { ...v2MemAvg, unit: 'KB' },
				samples: iterations
			},
			comparison: {
				ratio: Math.round(ratio * 100) / 100,
				winner,
				performanceGap: `${Math.round(performanceGap)}%`,
				latencyDiff: Math.round(latencyDiff * 100) / 100,
				memoryRatio: Math.round(memoryRatio * 100) / 100
			}
		}
	})
}

describe('Parser Performance Benchmark Suite', () => {
	// Scalability tests
	const sizes = [10, 50, 100, 500]

	sizes.forEach(size => {
		const input = generateComparisonText(size)
		const iterations = size <= 100 ? 10 : 5

		describe(`Scalability: ${size} marks`, () => {
			bench(`Parser v1 (${size} marks)`, () => {
				parserV1.split(input)
			}, {
				time: 1000,
				iterations
			})

			bench(`Parser v2 (${size} marks)`, () => {
				parserV2.split(input)
			}, {
				time: 1000,
				iterations,
				teardown() {
					// Collect results after this benchmark completes
					if (!isCollecting) {
						isCollecting = true
						collectResult(`${size} marks`, 'scalability', input, iterations)
						isCollecting = false
					}
				}
			})
		})
	})

	// Real-world scenarios
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
		describe(`Real-world: ${name}`, () => {
			bench(`Parser v1: ${name}`, () => {
				parserV1.split(text)
			}, {
				time: 1000,
				iterations: 20
			})

			bench(`Parser v2: ${name}`, () => {
				parserV2.split(text)
			}, {
				time: 1000,
				iterations: 20,
				teardown() {
					// Collect results after this benchmark completes
					if (!isCollecting) {
						isCollecting = true
						collectResult(name, 'realWorld', text, 20)
						isCollecting = false
					}
				}
			})
		})
	})

	// Save results at the end - using a final bench to ensure it runs
	describe('📊 Results', () => {
		bench('Save to JSON', () => {
			// Benchmark that saves results
		}, {
			setup() {
				// Save happens once in setup
				if (testResults.length > 0) {
					saveResults()
				}
			},
			time: 1,
			iterations: 1
		})
	})
})

// Export for external usage
export { saveResults }

