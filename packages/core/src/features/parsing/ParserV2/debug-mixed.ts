import {Parser} from './Parser'

const markups = ['@[__value__]', '#[__value__]'] as any[]
const input = '@[hello #[world]]'

console.log('=== Testing mixed patterns (should NOT nest) ===')
console.log('Input:', input)
console.log('Patterns:', markups)
console.log()

const parser = new Parser(markups)
const tokens = parser.split(input)

function printTokens(tokens: any[], indent = '') {
	tokens.forEach((t, idx) => {
		if (t.type === 'text') {
			console.log(`${indent}[${idx}] TEXT "${t.content}" [${t.position.start}-${t.position.end}]`)
		} else {
			console.log(`${indent}[${idx}] MARK "${t.content}" [${t.position.start}-${t.position.end}]`)
			console.log(`${indent}    value="${t.value}"`)
			console.log(`${indent}    children: ${t.children.length}`)
			if (t.children && t.children.length > 0) {
				printTokens(t.children, indent + '    ')
			}
		}
	})
}

printTokens(tokens)

console.log('\nExpected:')
console.log('  [0] MARK "@[hello #[world]]" with NO children')
console.log('  (because @[__value__] should be greedy and take all until ])')

