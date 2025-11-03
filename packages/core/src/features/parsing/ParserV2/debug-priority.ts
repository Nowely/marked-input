import {Parser} from './Parser'
import {MarkupRegistry} from './utils/MarkupRegistry'
import {AhoCorasick} from './utils/AhoCorasick'

const markups = ['@[__value__]', '#[__value__]'] as any[]
const input = '@[hello #[world]]'

console.log('=== Debug mixed patterns ===')
console.log('Input:', input)
console.log()

const registry = new MarkupRegistry(markups)
const ac = new AhoCorasick(registry.segments)
const segments = ac.search(input)

console.log('Segments found:')
segments.forEach((s, idx) => {
	console.log(`  [${idx}] "${s.value}" at ${s.start}`)
})
console.log()

console.log('Patterns:')
registry.descriptors.forEach((d, idx) => {
	console.log(`  [${idx}] segments: [${d.segments.join(', ')}], hasNested: ${d.hasNested}`)
})
console.log()

console.log('Possible candidates:')
console.log('  Candidate A: @[hello #[world]] (segments 0, 3) - uses @[ at 0, ] at 16')
console.log('  Candidate B: @[hello #[world] (segments 0, 2) - uses @[ at 0, ] at 15')  
console.log('  Candidate C: #[world] (segments 1, 2) - uses #[ at 8, ] at 15')
console.log()

console.log('Priority should be: A > B > C (longer match first)')
console.log('But C uses segment 2 (] at 15), so A cannot use it')
console.log('So we get B, which is wrong')

