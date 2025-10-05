import {bench, describe} from 'vitest'
import {ParserV2} from './index'

// Test data generators
function generateSimpleText(marks: number): string {
    let result = 'Hello world'
    for (let i = 0; i < marks; i++) {
        result += ` @[user${i}](User ${i}) some text `
    }
    return result
}

function generateComplexText(marks: number): string {
    let result = 'Complex text with multiple markups: '
    for (let i = 0; i < marks; i++) {
        if (i % 3 === 0) {
            result += `@[user${i}](User ${i}) `
        } else if (i % 3 === 1) {
            result += `#[tag${i}] `
        } else {
            result += `**[bold${i}]** `
        }
    }
    return result
}

describe('ParserV2 v2.5 Performance Comparison', () => {
    const parser = new ParserV2(['@[__label__](__value__)', '#[__label__]', '**__[__label__]__**'])

    describe('Simple Text Parsing', () => {
        // Small test (10 marks) - should be ~48K ops/sec (v2.4 baseline)
        const smallInput = generateSimpleText(10)
        bench('Small (10 marks)', () => {
            parser.split(smallInput)
        }, {
            time: 1000,
            iterations: 1000
        })

        // Medium test (100 marks) - should be ~5K ops/sec (v2.4 baseline)
        const mediumInput = generateSimpleText(100)
        bench('Medium (100 marks)', () => {
            parser.split(mediumInput)
        }, {
            time: 1000,
            iterations: 100
        })

        // Large test (1000 marks) - should be ~485 ops/sec (v2.4 baseline)
        const largeInput = generateSimpleText(1000)
        bench('Large (1000 marks)', () => {
            parser.split(largeInput)
        }, {
            time: 2000,
            iterations: 10
        })
    })

    describe('Complex Text Parsing', () => {
        // Complex small - should be ~70K ops/sec (v2.4 baseline)
        const complexSmallInput = generateComplexText(10)
        bench('Complex small (10 marks)', () => {
            parser.split(complexSmallInput)
        }, {
            time: 1000,
            iterations: 1000
        })

        // Complex medium - should be ~7.7K ops/sec (v2.4 baseline)
        const complexMediumInput = generateComplexText(100)
        bench('Complex medium (100 marks)', () => {
            parser.split(complexMediumInput)
        }, {
            time: 1000,
            iterations: 100
        })
    })

    describe('Baseline Comparison Notes', () => {
        console.log('\n📊 Expected v2.4 baseline results:')
        console.log('Small (10 marks): ~48K ops/sec')
        console.log('Medium (100 marks): ~5K ops/sec')
        console.log('Large (1000 marks): ~485 ops/sec')
        console.log('Complex small (10 marks): ~70K ops/sec')
        console.log('Complex medium (100 marks): ~7.7K ops/sec')
        console.log('\nIf current results are slower, investigate optimization regressions.')
    })
})
