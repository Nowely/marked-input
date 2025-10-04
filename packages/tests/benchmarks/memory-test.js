// Simple memory usage test for parsers
const { Parser } = require('../../core/src/features/parsing/Parser/Parser.js');
const { ParserV2 } = require('../../core/src/features/parsing/ParserV2/index.js');

// Utility functions for memory measurement
function getMemoryUsage() {
	const usage = process.memoryUsage();
	return {
		rss: Math.round(usage.rss / 1024), // Resident Set Size in KB
		heapUsed: Math.round(usage.heapUsed / 1024), // Heap used in KB
		heapTotal: Math.round(usage.heapTotal / 1024), // Heap total in KB
		external: Math.round(usage.external / 1024) // External memory in KB
	};
}

function forceGC() {
	if (global.gc) {
		global.gc();
		// Small delay to let GC complete
		const start = Date.now();
		while (Date.now() - start < 10) {}
	}
}

function measureMemoryDuringOperation(operation, iterations = 100) {
	const memories = [];

	forceGC();
	const baseline = getMemoryUsage();

	for (let i = 0; i < iterations; i++) {
		operation();
		memories.push(getMemoryUsage());
	}

	forceGC();
	const after = getMemoryUsage();

	// Calculate averages
	const avgMemory = {
		rss: Math.round(memories.reduce((sum, m) => sum + m.rss, 0) / memories.length),
		heapUsed: Math.round(memories.reduce((sum, m) => sum + m.heapUsed, 0) / memories.length),
		heapTotal: Math.round(memories.reduce((sum, m) => sum + m.heapTotal, 0) / memories.length),
		external: Math.round(memories.reduce((sum, m) => sum + m.external, 0) / memories.length)
	};

	const peakMemory = {
		rss: Math.max(...memories.map(m => m.rss)),
		heapUsed: Math.max(...memories.map(m => m.heapUsed)),
		heapTotal: Math.max(...memories.map(m => m.heapTotal)),
		external: Math.max(...memories.map(m => m.external))
	};

	const memoryIncrease = {
		rss: after.rss - baseline.rss,
		heapUsed: after.heapUsed - baseline.heapUsed,
		heapTotal: after.heapTotal - baseline.heapTotal,
		external: after.external - baseline.external
	};

	return {
		baseline,
		average: avgMemory,
		peak: peakMemory,
		after,
		increase: memoryIncrease,
		iterations
	};
}

// Test data generators
function generateComparisonText(marks) {
	let result = 'Text with marks:';
	for (let i = 0; i < marks; i++) {
		result += ` @[user${i}](User ${i}) and #[tag${i}]`;
	}
	result += ' end of text.';
	return result;
}

// Parser configurations
const markups = ['@[__label__](__value__)', '#[__label__]'];
const parserV1 = new Parser(markups);
const parserV2 = new ParserV2(markups);

console.log('🧠 Memory Usage Test: Parser v1 vs Parser v2\n');

// Test different input sizes
const testCases = [
	{ name: 'small', marks: 10 },
	{ name: 'medium', marks: 50 },
	{ name: 'large', marks: 100 }
];

testCases.forEach(({ name, marks }) => {
	const text = generateComparisonText(marks);
	console.log(`📊 ${name} input (${marks} marks): "${text.substring(0, 50)}..."`);
	console.log('='.repeat(60));

	// Test Parser v1
	console.log('\n🔵 Parser v1:');
	const resultV1 = measureMemoryDuringOperation(() => {
		parserV1.split(text);
	}, 100);

	console.log(`   📈 Baseline: RSS=${resultV1.baseline.rss}KB, Heap=${resultV1.baseline.heapUsed}KB`);
	console.log(`   📊 Average: RSS=${resultV1.average.rss}KB, Heap=${resultV1.average.heapUsed}KB`);
	console.log(`   ⬆️  Peak: RSS=${resultV1.peak.rss}KB, Heap=${resultV1.peak.heapUsed}KB`);
	console.log(`   📉 After: RSS=${resultV1.after.rss}KB, Heap=${resultV1.after.heapUsed}KB`);
	console.log(`   🔺 Increase: RSS=${resultV1.increase.rss}KB, Heap=${resultV1.increase.heapUsed}KB`);

	// Test Parser v2
	console.log('\n🟡 Parser v2:');
	const resultV2 = measureMemoryDuringOperation(() => {
		parserV2.split(text);
	}, 100);

	console.log(`   📈 Baseline: RSS=${resultV2.baseline.rss}KB, Heap=${resultV2.baseline.heapUsed}KB`);
	console.log(`   📊 Average: RSS=${resultV2.average.rss}KB, Heap=${resultV2.average.heapUsed}KB`);
	console.log(`   ⬆️  Peak: RSS=${resultV2.peak.rss}KB, Heap=${resultV2.peak.heapUsed}KB`);
	console.log(`   📉 After: RSS=${resultV2.after.rss}KB, Heap=${resultV2.after.heapUsed}KB`);
	console.log(`   🔺 Increase: RSS=${resultV2.increase.rss}KB, Heap=${resultV2.increase.heapUsed}KB`);

	// Comparison
	const heapRatio = resultV2.increase.heapUsed / resultV1.increase.heapUsed;
	console.log(`\n⚖️  Comparison:`);
	console.log(`   Parser v2 использует ${heapRatio.toFixed(1)}x больше heap памяти`);

	console.log('\n' + '='.repeat(60) + '\n');
});

// Real-world scenario test
console.log('🎯 Real-world Scenarios Memory Test\n');

const scenarios = [
	{
		name: 'Social Media Post',
		text: 'Hey @[john](John Doe)! Check out #[react] and #[javascript] for #[webdev] projects. What do you think @[jane](Jane Smith)? #coding #programming'
	},
	{
		name: 'Complex Nested',
		text: '#[project #[react] @[alice](Alice) created **[amazing dashboard]** with #[typescript] #[tailwind] #[vercel]]'
	}
];

scenarios.forEach(({ name, text }) => {
	console.log(`📱 ${name}:`);
	console.log(`   Text: "${text}"`);

	// Parser v1
	const resultV1 = measureMemoryDuringOperation(() => {
		parserV1.split(text);
	}, 200);

	// Parser v2
	const resultV2 = measureMemoryDuringOperation(() => {
		parserV2.split(text);
	}, 200);

	console.log(`   🔵 Parser v1: ${resultV1.increase.heapUsed}KB heap increase`);
	console.log(`   🟡 Parser v2: ${resultV2.increase.heapUsed}KB heap increase`);
	console.log(`   ⚖️  Ratio: ${(resultV2.increase.heapUsed / resultV1.increase.heapUsed).toFixed(1)}x\n`);
});

console.log('✅ Memory test completed!');
