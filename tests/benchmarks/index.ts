import {findMultiGap} from './_utils/analyzers/findMultiGap'
import {findSingleGap} from './_utils/analyzers/findSingleGap'
import {Benchmark} from './_utils/Benchmark'
import {genBNFGrammar} from './_utils/genBNFGrammar'
import {getData} from './_utils/getData'
import {BNFParser} from './_utils/parsers/BNFParser'
import {PEGParser} from './_utils/parsers/PEGParser'
import {RegexParser} from './_utils/parsers/RegexParser'
import {patienceDiff, patienceDiffPlus} from './_utils/PatienceDiff'
import {computeFinalScore} from './_utils/test-data-utils/computeFinalScore'
import {processMeasures} from './_utils/test-data-utils/processMeasures'
import {Markups_16} from './consts'

//await processMeasures()
//await Benchmark.start(1)
//await Benchmark.continue(10)
//await genBNFGrammar()



/*const ab = 'Hello world'
const ac = 'Hello worldasd'
const a = patienceDiffPlus(ab.split(''), ac.split(''))
const b = findMultiGap(ab, ac)
const c = findSingleGap(ab, ac)
//const a1 = patienceDiff(ab, ac, false)
//const a2 = patienceDiff(ab, ac, true)
console.log(a)
console.log(b)
console.log(c)
//console.log(a1)
//console.log(a2)
debugger*/
console.log(1)
//console.log(grammar)
//await processMeasures(0.5, 0.2, 0.3)
//await processMeasures(0, 1, 0)
//await processMeasures(0, 0, 1)

//const data = await getData(3)
//const parser = new RegexParser(['[__label__]'])
//const tokens = parser.split('Hello [world]!')
//console.log(data)
//console.log(tokens)
//debugger
//const parser = new BNFParser([])
//const a = parser.split(data); console.log(a)
