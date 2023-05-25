import {findMultiGap} from './_utils/analyzers/findMultiGap'
import {findSingleGap} from './_utils/analyzers/findSingleGap'
import {Benchmark} from './_utils/Benchmark'
import {genBNFGrammar} from './_utils/genBNFGrammar'
import {getData} from './_utils/getData'
import {BNFParser} from './_utils/parsers/BNFParser'
import {patienceDiff, patienceDiffPlus} from './_utils/PatienceDiff'


await Benchmark.start(1)
//await Benchmark.continue(1)
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

//console.log(grammar)


//const data = await getData(18)
//debugger
//const parser = new BNFParser([])
//const a = parser.split(data); console.log(a)
