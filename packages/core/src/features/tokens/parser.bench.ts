import * as fs from 'fs'
import * as path from 'path'

import {bench, describe} from 'vitest'

import {Parser as ParserV2} from './parser/Parser'

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
	category: 'scalability' | 'realWorld' | 'incremental' // Internal only, not saved to JSON
	performance: [number, number, number] // [min, avg, max] for ParserV2
}

const testResults: TestResult[] = []
// path.join is a Node API. When the bench runs in Chromium (vitest browser provider),
// path.join is not a function and resultsPath computation fails. Guard with a try/catch
// so the bench still runs and prints numbers; JSON persistence is skipped in that case.
let resultsPath: string
try {
	resultsPath = path.join(import.meta.dirname, 'parser.bench.result.json')
} catch {
	resultsPath = ''
}
let isCollecting = false // Prevent duplicate collection
let hasSaved = false // Prevent duplicate saves

// Utility functions
function calculateStats(values: number[]) {
	const sorted = [...values].toSorted((a, b) => a - b)
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
		const startTime = performance.now()

		parser.parse(input)

		const endTime = performance.now()

		const timeMs = endTime - startTime
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

	if (!resultsPath) {
		// Browser context: path.join unavailable — print summary to console only.
		// Browser-mode (Chromium) runs cannot write parser.bench.result.json (the write path is skipped);
		// the 2026-06-12 entry was recorded manually from a browser run — regenerate from a Node-context run when the bench infra supports it.
		console.log('\n📊 Benchmark results (browser context — JSON save skipped):')
		testResults.forEach(r => {
			console.log(
				`  ${r.name}: avg ${r.performance[1].toLocaleString()} ops/sec [min ${r.performance[0].toLocaleString()}, max ${r.performance[2].toLocaleString()}]`
			)
		})
		return
	}

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

				if (prevTest?.performance && Array.isArray(prevTest.performance)) {
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
					if (prevTest?.performance && Array.isArray(prevTest.performance)) {
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
function collectResult(
	name: string,
	category: 'scalability' | 'realWorld' | 'incremental',
	input: string,
	iterations: number
) {
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

// Collect results for an arbitrary bench function (used by incremental benches)
function collectResultFn(
	name: string,
	category: 'scalability' | 'realWorld' | 'incremental',
	fn: () => void,
	iterations: number
) {
	if (testResults.find(r => r.name === name && r.category === category)) {
		return
	}

	const ops: number[] = []
	for (let i = 0; i < iterations; i++) {
		const startTime = performance.now()
		fn()
		const endTime = performance.now()
		const timeMs = endTime - startTime
		ops.push(Math.round(1000 / timeMs))
	}

	const stats = calculateStats(ops)
	testResults.push({
		name,
		category,
		performance: [stats.min, stats.avg, stats.max],
	})
}

// ── Typing-cost bench fixtures ─────────────────────────────────────────────
// Pre-built OUTSIDE the timed callback so only the parse itself is measured.
// Inline parsing is always a full parse (the windowed incrementalParse is
// deleted — Phase 7's pre-split row parser is the incrementality story), so the
// 500-mark full-parse-per-keystroke bench below IS the inline typing cost and
// the regression tripwire the design keeps. Uses @[__value__] markup with
// inert inter-mark text for a representative realistic-document shape.

const incrementalParser = new ParserV2(['@[__value__]'])

/** A 500-mark document with truly inert inter-mark text (no @[ or ] in plain text). */
function generateInertText(marks: number): string {
	let result = 'Start text'
	for (let i = 0; i < marks; i++) {
		// Inter-mark text uses only alphanumeric and spaces — guaranteed no @[, ] chars.
		result += ` word${i} and more text @[user${i}]`
	}
	result += ' end of text'
	return result
}

const incrementalBase500 = generateInertText(500)

// One-char tail insert: append 'x' at the very end (the post-edit value the
// full-parse-per-keystroke bench parses).
const incrementalTailValue = incrementalBase500 + 'x'

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

	// Typing-cost bench (500-mark document): full parse per keystroke — the inline
	// typing cost (inline parsing is always a full parse) and the regression
	// tripwire. Parses the POST-EDIT value (incrementalTailValue).
	describe('Typing cost: 500 marks full parse per keystroke', () => {
		bench(
			'full parse — 500 marks per keystroke',
			() => {
				incrementalParser.parse(incrementalTailValue)
			},
			{
				time: 1000,
				iterations: 5,
				teardown() {
					if (!isCollecting) {
						isCollecting = true
						collectResultFn(
							'typing: full parse per keystroke (500 marks)',
							'incremental',
							() => incrementalParser.parse(incrementalTailValue),
							5
						)
						isCollecting = false
					}
				},
			}
		)
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