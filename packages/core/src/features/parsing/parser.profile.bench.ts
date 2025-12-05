import {afterAll, bench, describe} from 'vitest'
import {Parser} from './ParserV2/Parser'
import type {Markup, Token} from './ParserV2/types'
import * as fs from 'fs'
import * as path from 'path'

/**
 * Method profiling data with hierarchical structure
 */
interface MethodProfile {
	name: string
	calls: number
	percentage?: number // percentage of total execution time (optional for main method)
	complexity: string
	times: [number, number, number] // [minTime, avgTime, maxTime]
	firstParamLength?: number // length of first parameter (if applicable)
	subMethods?: Record<string, MethodProfile>
}

/**
 * Test profiling result
 */
interface TestProfile {
	duration: number
	inputLength: number
	markCount: number
	mainMethod: MethodProfile
}

/**
 * Single profiling run results
 */
interface ProfilingRun {
	timestamp: string
	tests: Record<string, TestProfile>
}

/**
 * Comparison data between two profiling runs
 */
interface ProfilingComparison {
	run1Timestamp: string
	run2Timestamp: string
	differences: Array<{
		testName: string
		durationChange: number
		durationChangePercent: number
		inputLength: number
		markCount: number
		methodChanges: Record<
			string,
			{
				timeChange: number
				timeChangePercent: number
				callsChange: number
				percentageChange: number
			}
		>
	}>
	summary: string[]
}

/**
 * Enhanced profiling result with summary and comparison
 */
interface ProfilingResult {
	timestamp: string
	summary: {
		totalTests: number
		totalDuration: string
		performanceDelta: string
		tests: Record<
			string,
			{
				duration: string
				durationChange: string
				durationChangePercent: string
			}
		>
	}
	tests: Record<string, TestProfile>
}

/**
 * Global profiling statistics
 */
const globalProfileStats = new Map<string, {times: number[]; paramLengths: number[]; count: number}>()
const methodCallStack: string[] = []

/**
 * History of profiling results for comparison
 */
const profilingResultsHistory: ProfilingResult[] = []

/**
 * Get length of first parameter if it's a string or array
 */
function getFirstParamLength(args: any[]): number | undefined {
	if (args.length === 0) return undefined
	const firstArg = args[0]
	if (typeof firstArg === 'string') {
		return firstArg.length
	}
	if (Array.isArray(firstArg)) {
		return firstArg.length
	}
	return undefined
}

/**
 * Update method statistics
 */
function updateMethodStats(
	methodName: string,
	duration: number,
	className?: string,
	complexity?: string,
	firstParamLength?: number
): void {
	const existing = globalProfileStats.get(methodName) || {times: [], paramLengths: [], count: 0}
	existing.times.push(duration)
	if (firstParamLength !== undefined) {
		existing.paramLengths.push(firstParamLength)
	}
	existing.count++
	globalProfileStats.set(methodName, existing)
}

/**
 * Create profiled version of a method
 */
function createProfiledMethod<T extends (...args: any[]) => any>(
	method: T,
	methodName: string,
	className?: string,
	complexity?: string
): T {
	return ((...args: any[]) => {
		methodCallStack.push(methodName)
		const start = performance.now()
		const result = method(...args)
		const end = performance.now()
		const firstParamLength = getFirstParamLength(args)
		updateMethodStats(methodName, end - start, className, complexity, firstParamLength)
		methodCallStack.pop()
		return result
	}) as T
}

/**
 * Create enhanced profiling result with summary and comparison
 */
function createProfilingResult(currentRun: ProfilingRun, comparison?: ProfilingComparison): ProfilingResult {
	const testNames = Object.keys(currentRun.tests)
	const totalDuration = testNames.reduce((sum, name) => sum + currentRun.tests[name].duration, 0)

	// Calculate performance delta based on the comparison
	let performanceDelta = '0.0%'

	if (comparison) {
		const avgChange =
			comparison.differences.reduce((sum, diff) => sum + diff.durationChangePercent, 0) /
			comparison.differences.length
		// Invert the sign: a positive value means performance improved
		const performanceValue = -avgChange
		performanceDelta = `${performanceValue >= 0 ? '+' : ''}${performanceValue.toFixed(1)}%`
	}

	// Tests are updated in place, no additional processing needed

	return {
		timestamp: currentRun.timestamp,
		summary: {
			totalTests: testNames.length,
			totalDuration: formatTime(totalDuration),
			performanceDelta,
			tests: comparison
				? Object.fromEntries(
						comparison.differences.map(diff => [
							diff.testName,
							{
								duration: formatTime(currentRun.tests[diff.testName].duration),
								durationChange: `${diff.durationChange >= 0 ? '+' : '-'}${formatTime(Math.abs(diff.durationChange))}`,
								durationChangePercent: `${diff.durationChangePercent <= 0 ? '+' : '-'}${Math.abs(diff.durationChangePercent).toFixed(1)}%`,
							},
						])
					)
				: {},
		},
		tests: currentRun.tests,
	}
}

/**
 * AUTOMATIC METHOD PROFILING SYSTEM
 *
 * Automatically discovers and profiles all methods in ParserV2 classes and modules
 * without requiring manual benchmark code updates.
 *
 * Benefits:
 * - New methods are automatically included in profiling
 * - No need to rewrite benchmarks when adding methods
 * - Complexity is estimated automatically based on naming patterns
 *
 * How it works:
 * 1. discoverClassMethods() scans prototype and own properties of objects
 * 2. autoProfileObject() creates profiled versions of all discovered methods
 * 3. estimateComplexity() determines complexity based on method naming patterns
 *
 * Automatic class method discovery
 */
function discoverClassMethods(
	obj: any,
	className: string
): Array<{name: string; method: Function; original: Function}> {
	const methods: Array<{name: string; method: Function; original: Function}> = []
	const prototype = Object.getPrototypeOf(obj)

	// Get all methods from prototype
	const protoMethods = Object.getOwnPropertyNames(prototype).filter(name => {
		const descriptor = Object.getOwnPropertyDescriptor(prototype, name)
		return descriptor && typeof descriptor.value === 'function' && name !== 'constructor'
	})

	// Get all methods from object itself (if any)
	const ownMethods = Object.getOwnPropertyNames(obj).filter(name => {
		const descriptor = Object.getOwnPropertyDescriptor(obj, name)
		return descriptor && typeof descriptor.value === 'function'
	})

	// Combine and remove duplicates
	const allMethodNames = [...new Set([...protoMethods, ...ownMethods])]

	for (const methodName of allMethodNames) {
		const fullMethodName = `${className}.${methodName}`
		const method = obj[methodName]

		if (typeof method === 'function') {
			methods.push({
				name: fullMethodName,
				method: method,
				original: method.bind(obj),
			})
		}
	}

	return methods
}

/**
 * Automatic profiling of all object methods
 */
function autoProfileObject(obj: any, className: string, excludeMethods: string[] = []): () => void {
	const discoveredMethods = discoverClassMethods(obj, className)
	const patchedMethods: Array<{obj: any; name: string; original: Function}> = []
	const prototype = Object.getPrototypeOf(obj)

	for (const {name, method, original} of discoveredMethods) {
		// Skip excluded methods
		if (excludeMethods.includes(name)) continue

		const complexity = estimateComplexity(name)
		const profiledMethod = createProfiledMethod(original as (...args: any[]) => any, name, className, complexity)

		const methodName = name.split('.').pop()!

		// Try patching on prototype first (for proper method inheritance)
		if (prototype[methodName] === method) {
			// Method is on prototype, patch it there
			patchedMethods.push({obj: prototype, name: methodName, original: prototype[methodName]})
			prototype[methodName] = profiledMethod
		} else {
			// Method is on instance, patch it there
			patchedMethods.push({obj, name: methodName, original: obj[methodName]})
			obj[methodName] = profiledMethod
		}
	}

	// Restoration function
	return () => {
		for (const {obj, name, original} of patchedMethods) {
			obj[name] = original
		}
	}
}

/**
 * Generate test text
 */
function generateTestText(markCount: number): string {
	let result = 'Start text '
	for (let i = 0; i < markCount; i++) {
		result += `@[user${i}](User ${i}) and #[tag${i}] `
	}
	result += 'end text.'
	return result
}

/**
 * Count marks in tokens
 */
function countMarks(tokens: Token[]): number {
	let count = 0
	for (const token of tokens) {
		if (token.type === 'mark') {
			count++
			count += countMarks(token.children)
		}
	}
	return count
}

/**
 * Format time
 */
function formatTime(ms: number): string {
	if (ms < 0.001) return `${(ms * 1000).toFixed(3)}μs`
	if (ms < 1) return `${ms.toFixed(3)}ms`
	return `${ms.toFixed(2)}ms`
}

/**
 * Patch SegmentMatcher with automatic profiling
 */
function patchSegmentMatcher(parser: Parser): () => void {
	const segmentMatcher = (parser as any).segmentMatcher
	return autoProfileObject(segmentMatcher, 'SegmentMatcher')
}

/**
 * Patch PatternMatcher with automatic profiling
 */
function patchPatternMatcher(parser: Parser): () => void {
	const patternMatcher = (parser as any).patternMatcher
	return autoProfileObject(patternMatcher, 'PatternMatcher')
}

/**
 * Patch TreeBuilder with automatic profiling
 */
function patchTreeBuilder(parser: Parser): () => void {
	const treeBuilder = (parser as any).treeBuilder
	return autoProfileObject(treeBuilder, 'TreeBuilder')
}

/**
 * Execute profiling with complete metrics set
 */
function runCompleteProfiling(parser: Parser, input: string, testName: string, iterations: number = 5): TestProfile {
	// Clear statistics for fresh run
	globalProfileStats.clear()
	methodCallStack.length = 0

	// Patch class-based components (auto-discovered methods)
	const restoreSegmentMatcher = patchSegmentMatcher(parser)
	const restorePatternMatcher = patchPatternMatcher(parser)
	const restoreTreeBuilder = patchTreeBuilder(parser)

	// Create profiled wrapper for Parser.split
	const originalSplit = parser.parse
	parser.parse = createProfiledMethod(originalSplit.bind(parser), 'Parser.split', 'Parser', 'O(T + S + M)')

	// Execute multiple iterations and collect statistics
	const splitTimes: number[] = []
	let finalTokens: any[] = []

	for (let i = 0; i < iterations; i++) {
		// Clear per-iteration stats
		methodCallStack.length = 0

		const splitStart = performance.now()
		finalTokens = parser.parse(input)
		const splitEnd = performance.now()
		const totalSplitTime = splitEnd - splitStart

		splitTimes.push(totalSplitTime)
	}

	// Restore original methods
	restoreSegmentMatcher()
	restorePatternMatcher()
	restoreTreeBuilder() // This will restore parser.parse to treeBuilderPatchedSplit

	// Calculate results with normalized statistics
	const avgSplitTime = splitTimes.reduce((a, b) => a + b, 0) / iterations

	const markCountActual = countMarks(finalTokens)

	// Convert flat method list to hierarchical structure
	const allMethods = Array.from(globalProfileStats.entries())
	const methodProfiles = allMethods
		.filter(([methodName]) => !methodName.startsWith('Parser.split'))
		.map(([methodName, data]) => {
			const times = data.times
			const totalTimeAcrossIterations = times.reduce((a, b) => a + b, 0)
			const totalTime = totalTimeAcrossIterations / iterations // Average time per iteration
			const avgTime = totalTime // Since we already averaged totalTime
			const minTime = Math.min(...times)
			const maxTime = Math.max(...times)

			// Calculate component times per iteration
			const totalComponentTime = allMethods.reduce(
				(sum, [, d]) => sum + d.times.reduce((a, b) => a + b, 0) / iterations,
				0
			)
			const percentage = totalComponentTime > 0 ? (totalTime / totalComponentTime) * 100 : 0

			// Calculate average parameter length if available
			const avgParamLength =
				data.paramLengths.length > 0
					? Math.round(data.paramLengths.reduce((a, b) => a + b, 0) / data.paramLengths.length)
					: undefined

			return {
				method: methodName,
				className: methodName.split('.')[0],
				complexity: getComplexityForMethod(methodName),
				totalTime,
				callCount: Math.round(data.count / iterations), // Average calls per iteration
				avgTime,
				minTime,
				maxTime,
				percentage,
				avgParamLength,
			}
		})
		.sort((a, b) => b.totalTime - a.totalTime)

	// Build hierarchical method tree
	const mainMethod = buildMethodTree(methodProfiles, avgSplitTime)

	return {
		duration: Math.round(avgSplitTime * 1000) / 1000, // round to 3 decimal places - using average across iterations
		inputLength: input.length,
		markCount: markCountActual,
		mainMethod,
	}
}

/**
 * Estimate method complexity based on naming patterns and algorithmic analysis
 */
function estimateComplexity(methodName: string): string {
	// Complexity patterns based on method naming conventions
	const complexityPatterns: Array<{pattern: RegExp; complexity: string; description: string}> = [
		// Core algorithm methods
		{pattern: /\.search$/, complexity: 'O(T)', description: 'Search operations typically O(T)'},
		{pattern: /\.process$/, complexity: 'O(S)', description: 'Main processing typically O(S)'},

		// State management
		{pattern: /\.processWaitingStates$/, complexity: 'O(1)', description: 'Waiting states processing'},
		{pattern: /\.handleUpdatedState$/, complexity: 'O(1)', description: 'State updates typically O(1)'},
		{pattern: /\.tryStartNewStates$/, complexity: 'O(S × D)', description: 'State initialization O(S × D)'},
		{pattern: /\.dequeueWaitingMatch$/, complexity: 'O(1)', description: 'Queue dequeue operation O(1)'},

		// Data structure operations
		{pattern: /\.addToCompleted$/, complexity: 'O(log M)', description: 'Binary search insertion O(log M)'},
		{pattern: /\.addTo(PositionIndex|WaitingList)$/, complexity: 'O(log M + P)', description: 'Indexed insertions'},
		{pattern: /\.flattenMatches/, complexity: 'O(M)', description: 'Flattening operations O(M)'},
		{pattern: /\.filter/, complexity: 'O(M)', description: 'Filtering operations O(M)'},
		{pattern: /\.sort/, complexity: 'O(M log M)', description: 'Sorting operations'},
		{pattern: /\.find/, complexity: 'O(M)', description: 'Search in collections O(M)'},

		// Utility operations
		{pattern: /\.(create|build)/, complexity: 'O(M)', description: 'Construction operations'},
		{pattern: /\.(get|is|has|validate|extract)/, complexity: 'O(1)', description: 'Access/validation operations'},
		{pattern: /\.add/, complexity: 'O(1)', description: 'Simple additions O(1)'},
		{pattern: /\.remove/, complexity: 'O(M)', description: 'Removals may require shifting'},
		{pattern: /\.update/, complexity: 'O(1)', description: 'Updates typically O(1)'},
		{pattern: /\.(finalize|close)/, complexity: 'O(S)', description: 'Finalization operations O(S)'},
	]

	// Check patterns in order of specificity
	for (const {pattern, complexity} of complexityPatterns) {
		if (pattern.test(methodName)) {
			return complexity
		}
	}

	return 'O(?)'
}

/**
 * Get method complexity (deprecated function, kept for compatibility)
 */
function getComplexityForMethod(methodName: string): string {
	return estimateComplexity(methodName)
}

/**
 * Store profiling results for comparison (keeps last 2 runs)
 */
const currentRunResults: Record<string, TestProfile> = {}
const profilingHistory: ProfilingRun[] = []
const resultsPath = path.join(__dirname, 'parser.profile.json')
const MAX_HISTORY_RUNS = 2

/**
 * Build hierarchical method tree from flat method list
 */
function buildMethodTree(
	methods: Array<{
		method: string
		className: string
		complexity: string
		totalTime: number
		callCount: number
		avgTime: number
		minTime: number
		maxTime: number
		percentage: number
		avgParamLength?: number
	}>,
	totalTime: number
): MethodProfile {
	// Build hierarchy based on class relationships
	const rootMethod: MethodProfile = {
		name: 'Parser.split',
		calls: 1, // Parser.split is called once per test
		complexity: 'O(T + S + M)',
		times: [
			Math.round(totalTime * 1000) / 1000,
			Math.round(totalTime * 1000) / 1000,
			Math.round(totalTime * 1000) / 1000,
		], // [min, avg, max] - for main method they're the same, rounded to 3 decimals
		subMethods: {},
	}

	// Group methods by component
	const segmentMatcherMethods = methods.filter(m => m.method.startsWith('SegmentMatcher.'))
	const patternMatcherMethods = methods.filter(m => m.method.startsWith('PatternMatcher.'))
	const treeBuilderMethods = methods.filter(m => m.method.startsWith('TreeBuilder.'))

	// Add component roots
	if (segmentMatcherMethods.length > 0) {
		const segmentTime = segmentMatcherMethods.reduce((sum, m) => sum + m.totalTime, 0)
		const segmentMethod = segmentMatcherMethods[0]
		if (!rootMethod.subMethods) rootMethod.subMethods = {}
		rootMethod.subMethods['SegmentMatcher.search'] = {
			name: 'SegmentMatcher.search',
			calls: segmentMethod?.callCount || 0,
			percentage: Math.round((segmentTime / totalTime) * 100 * 10) / 10, // round to 1 decimal
			complexity: 'O(T)',
			times: segmentMethod
				? [
						Math.round(segmentMethod.minTime * 1000) / 1000,
						Math.round(segmentMethod.avgTime * 1000) / 1000,
						Math.round(segmentMethod.maxTime * 1000) / 1000,
					]
				: [0, 0, 0],
			firstParamLength: segmentMethod?.avgParamLength,
			// No subMethods for SegmentMatcher.search
		}
	}

	if (patternMatcherMethods.length > 0) {
		const mainPatternMethod = patternMatcherMethods.find(m => m.method === 'PatternMatcher.process')
		const subMethodsTime = patternMatcherMethods
			.filter(m => m.method !== 'PatternMatcher.process')
			.reduce((sum, m) => sum + m.totalTime, 0)

		// Use the main method's time if available, otherwise estimate from sub-methods
		const mainMethodTime = mainPatternMethod ? mainPatternMethod.totalTime : subMethodsTime

		const patternMatcherRoot: MethodProfile = {
			name: 'PatternMatcher.process',
			calls: mainPatternMethod?.callCount || 0,
			percentage: Math.round((mainMethodTime / totalTime) * 100 * 10) / 10, // round to 1 decimal
			complexity: 'O(S)',
			times: mainPatternMethod
				? [
						Math.round(mainPatternMethod.minTime * 1000) / 1000,
						Math.round(mainPatternMethod.avgTime * 1000) / 1000,
						Math.round(mainPatternMethod.maxTime * 1000) / 1000,
					]
				: [0, 0, 0],
			firstParamLength: mainPatternMethod?.avgParamLength,
			subMethods: {},
		}

		// Add sub-methods under PatternMatcher.process
		const subMethods = patternMatcherMethods
			.filter(m => m.method !== 'PatternMatcher.process')
			.map(method => ({
				name: method.method,
				calls: method.callCount,
				percentage: Math.round((method.totalTime / totalTime) * 100 * 10) / 10, // percentage of total time, round to 1 decimal
				complexity: method.complexity,
				times: [
					Math.round(method.minTime * 1000) / 1000,
					Math.round(method.avgTime * 1000) / 1000,
					Math.round(method.maxTime * 1000) / 1000,
				] as [number, number, number],
				firstParamLength: method.avgParamLength,
				// PatternMatcher sub-methods don't have their own sub-methods
			}))

		// Only add subMethods if there are any
		if (subMethods.length > 0) {
			if (!patternMatcherRoot.subMethods) patternMatcherRoot.subMethods = {}
			subMethods.forEach(subMethod => {
				patternMatcherRoot.subMethods![subMethod.name.split('.').pop()!] = subMethod
			})
		} else {
			delete patternMatcherRoot.subMethods
		}

		if (!rootMethod.subMethods) rootMethod.subMethods = {}
		rootMethod.subMethods['PatternMatcher.process'] = patternMatcherRoot
	}

	if (treeBuilderMethods.length > 0) {
		const mainTreeMethod = treeBuilderMethods.find(m => m.method === 'TreeBuilder.build')
		const subMethodsTime = treeBuilderMethods
			.filter(m => m.method !== 'TreeBuilder.build')
			.reduce((sum, m) => sum + m.totalTime, 0)

		// Use the main method's time if available, otherwise estimate from sub-methods
		const mainMethodTime = mainTreeMethod ? mainTreeMethod.totalTime : subMethodsTime

		const treeBuilderRoot: MethodProfile = {
			name: 'TreeBuilder.build',
			calls: mainTreeMethod?.callCount || 0,
			percentage: Math.round((mainMethodTime / totalTime) * 100 * 10) / 10, // round to 1 decimal
			complexity: getComplexityForMethod('TreeBuilder.build'),
			times: mainTreeMethod
				? [
						Math.round(mainTreeMethod.minTime * 1000) / 1000,
						Math.round(mainTreeMethod.avgTime * 1000) / 1000,
						Math.round(mainTreeMethod.maxTime * 1000) / 1000,
					]
				: [0, 0, 0],
			firstParamLength: mainTreeMethod?.avgParamLength,
			subMethods: {},
		}

		// Add sub-methods under TreeBuilder.build
		const subMethods = treeBuilderMethods
			.filter(m => m.method !== 'TreeBuilder.build')
			.map(method => ({
				name: method.method,
				calls: method.callCount,
				percentage: Math.round((method.totalTime / totalTime) * 100 * 10) / 10, // percentage of total time, round to 1 decimal
				complexity: method.complexity,
				times: [
					Math.round(method.minTime * 1000) / 1000,
					Math.round(method.avgTime * 1000) / 1000,
					Math.round(method.maxTime * 1000) / 1000,
				] as [number, number, number],
				firstParamLength: method.avgParamLength,
			}))

		// Only add subMethods if there are any
		if (subMethods.length > 0) {
			if (!treeBuilderRoot.subMethods) treeBuilderRoot.subMethods = {}
			subMethods.forEach(subMethod => {
				treeBuilderRoot.subMethods![subMethod.name.split('.').pop()!] = subMethod
			})
		} else {
			delete treeBuilderRoot.subMethods
		}

		if (!rootMethod.subMethods) rootMethod.subMethods = {}
		rootMethod.subMethods['TreeBuilder.build'] = treeBuilderRoot
	}

	return rootMethod
}

/**
 * Load existing profiling history from file
 */
function loadExistingHistory(): void {
	try {
		if (fs.existsSync(resultsPath)) {
			const data = fs.readFileSync(resultsPath, 'utf8')
			const results: ProfilingResult[] = JSON.parse(data)

			// Restore results history from file (should already be newest first)
			profilingResultsHistory.length = 0
			profilingResultsHistory.push(...results)

			// Also restore profiling runs for comparison (newest first)
			profilingHistory.length = 0
			results.forEach(result => {
				profilingHistory.push({
					timestamp: result.timestamp,
					tests: result.tests,
				})
			})
		}
	} catch {
		// If loading fails, start with empty history
		profilingResultsHistory.length = 0
		profilingHistory.length = 0
	}
}

/**
 * Compare two profiling runs and calculate differences
 */
function compareProfilingResults(run1: ProfilingRun, run2: ProfilingRun): ProfilingComparison {
	const differences: ProfilingComparison['differences'] = []

	// Compare each test case
	for (const [testName, result2] of Object.entries(run2.tests)) {
		const result1 = run1.tests[testName]
		if (!result1) continue

		const durationChange = result2.duration - result1.duration
		const durationChangePercent = result1.duration > 0 ? (durationChange / result1.duration) * 100 : 0

		// Compare methods recursively
		const methodChanges: Record<
			string,
			{
				timeChange: number
				timeChangePercent: number
				callsChange: number
				percentageChange: number
			}
		> = {}

		function compareMethods(method1: MethodProfile, method2: MethodProfile, prefix = '') {
			const fullName = prefix ? `${prefix}.${method2.name}` : method2.name
			const avgTime1 = method1.times[1] // avg time from array
			const avgTime2 = method2.times[1] // avg time from array
			const timeChange = avgTime2 - avgTime1
			const timeChangePercent = avgTime1 > 0 ? (timeChange / avgTime1) * 100 : 0
			const callsChange = method2.calls - method1.calls
			const percentageChange = (method2.percentage || 0) - (method1.percentage || 0)

			methodChanges[fullName] = {
				timeChange,
				timeChangePercent,
				callsChange,
				percentageChange,
			}

			// Compare sub-methods if they exist
			const subMethods2 = method2.subMethods || {}
			const subMethods1 = method1.subMethods || {}
			for (const [subName, subMethod2] of Object.entries(subMethods2)) {
				const subMethod1 = subMethods1[subName]
				if (subMethod1) {
					compareMethods(subMethod1, subMethod2, fullName)
				}
			}
		}

		if (result1.mainMethod && result2.mainMethod) {
			compareMethods(result1.mainMethod, result2.mainMethod)
		}

		differences.push({
			testName,
			durationChange,
			durationChangePercent,
			inputLength: result2.inputLength,
			markCount: result2.markCount,
			methodChanges,
		})
	}

	// Determine overall trend (removed - using summary.trend instead)

	// Generate summary
	const summary: string[] = []
	const improving = differences.filter(d => d.durationChangePercent < -1).length
	const degrading = differences.filter(d => d.durationChangePercent > 1).length

	if (improving > degrading) {
		summary.push(`Performance improved in ${improving} tests, degraded in ${degrading} tests`)
	} else if (degrading > improving) {
		summary.push(`Performance degraded in ${degrading} tests, improved in ${improving} tests`)
	} else {
		summary.push(`Performance stable with ${improving} improvements and ${degrading} degradations`)
	}

	// Find biggest changes
	const biggestImprovement = differences
		.filter(d => d.durationChangePercent < -1)
		.sort((a, b) => a.durationChangePercent - b.durationChangePercent)[0]

	const biggestDegradation = differences
		.filter(d => d.durationChangePercent > 1)
		.sort((a, b) => b.durationChangePercent - a.durationChangePercent)[0]

	if (biggestImprovement) {
		summary.push(
			`Best improvement: ${biggestImprovement.testName} (+${Math.abs(biggestImprovement.durationChangePercent).toFixed(0)}%)`
		)
	}
	if (biggestDegradation) {
		summary.push(
			`Worst degradation: ${biggestDegradation.testName} (-${biggestDegradation.durationChangePercent.toFixed(0)}%)`
		)
	}

	return {
		run1Timestamp: run1.timestamp,
		run2Timestamp: run2.timestamp,
		differences,
		summary,
	}
}

function saveCompleteProfileResults(): void {
	if (Object.keys(currentRunResults).length === 0) return

	// Create current run
	const currentRun: ProfilingRun = {
		timestamp: new Date().toISOString(),
		tests: {...currentRunResults},
	}

	// Add current results to history
	profilingHistory.unshift(currentRun)

	// Keep only last MAX_HISTORY_RUNS runs
	if (profilingHistory.length > MAX_HISTORY_RUNS) {
		profilingHistory.splice(MAX_HISTORY_RUNS)
	}

	console.log(
		`\n💾 Saving profiling results (${Object.keys(currentRunResults).length} tests, ${profilingResultsHistory.length} runs in history)...`
	)

	try {
		let comparison: ProfilingComparison | undefined
		if (profilingHistory.length >= 2) {
			comparison = compareProfilingResults(profilingHistory[1], profilingHistory[0])
		}

		// Save summary result with history
		const result = createProfilingResult(currentRun, comparison)
		profilingResultsHistory.unshift(result)

		// Keep only last 2 results for comparison (newest first, no sorting needed since we unshift)
		if (profilingResultsHistory.length > 2) {
			profilingResultsHistory.splice(2)
		}

		// Sync profilingHistory with the sorted results
		profilingHistory.length = 0
		profilingResultsHistory.forEach(result => {
			profilingHistory.push({
				timestamp: result.timestamp,
				tests: result.tests,
			})
		})

		const summaryData = JSON.stringify(profilingResultsHistory, null, 2)
		fs.writeFileSync(resultsPath, summaryData)
		console.log(`✅ Results saved: ${resultsPath} (${profilingResultsHistory.length} runs in history)`)

		// Current run summary
		console.log('\n📊 CURRENT RUN SUMMARY:')
		for (const [testName, result] of Object.entries(currentRunResults)) {
			const performance = result.duration < 0.5 ? 'good' : result.duration < 2.0 ? 'warning' : 'bad'
			const performanceEmoji = performance === 'good' ? '🟢' : performance === 'warning' ? '🟡' : '🔴'

			console.log(`\n🔍 ${testName}:`)
			console.log(`   Duration: ${formatTime(result.duration)} ${performanceEmoji}`)
			console.log(`   Input: ${result.inputLength} chars, ${result.markCount} marks`)
			console.log(`   Main method: ${result.mainMethod.name}`)

			function printMethodTree(method: MethodProfile, indent = '   ') {
				const percentageStr =
					method.percentage !== undefined ? ` (${method.percentage.toFixed(1)}% of parent)` : ''
				console.log(
					`${indent}├─ ${method.name}: ${formatTime(method.times[1])} ${percentageStr}, ${method.calls} calls [${method.complexity}]`
				)
				const subMethods = method.subMethods ? Object.values(method.subMethods) : []
				subMethods.forEach((subMethod, index) => {
					const isLast = index === subMethods.length - 1
					const newIndent = indent + (isLast ? '   ' : '│  ')
					printMethodTree(subMethod, newIndent)
				})
			}

			printMethodTree(result.mainMethod)
		}

		// Enhanced summary
		const enhancedResult = createProfilingResult(currentRun, comparison)
		console.log('\n📈 ENHANCED RUN SUMMARY:')
		console.log(`   Total tests: ${enhancedResult.summary.totalTests}`)
		console.log(`   Total duration: ${enhancedResult.summary.totalDuration}`)
		console.log(`   Performance delta: ${enhancedResult.summary.performanceDelta}`)
	} catch (error) {
		console.error('❌ Save error:', error)
	}
}

// Profiling scenarios
describe('ParserV2 Complete Profiling', () => {
	const markups: Markup[] = ['@[__value__](__meta__)', '#[__value__]']

	bench('should profile all methods automatically', () => {
		// Load existing history if available
		loadExistingHistory()

		// Clear current results for fresh profiling
		Object.keys(currentRunResults).forEach(key => delete currentRunResults[key])

		const testCases = [
			{name: '10 marks', markCount: 10},
			{name: '100 marks', markCount: 100},
			{name: '500 marks', markCount: 500},
		]

		testCases.forEach(({name, markCount}) => {
			const testName = `split: ${name}`
			const parser = new Parser(markups)
			const input = generateTestText(markCount)

			const result = runCompleteProfiling(parser, input, testName)
			currentRunResults[testName] = result
		})

		// Results will be saved in afterAll hook
	})
})

afterAll(() => {
	if (Object.keys(currentRunResults).length > 0) {
		saveCompleteProfileResults()
	}
})
