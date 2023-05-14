import {Benchmark} from './_utils/Benchmark'
import {Markups_2} from './_utils/consts'
import {RegexParser} from './_utils/parsers/RegexParser'
import {SymbolParser} from './_utils/parsers/SymbolParser'
import {readFile} from './_utils/readFile'
import {VirtualComponent} from './_utils/VirtualComponent'


//const tester = new Benchmark()
//await tester.loadResult()
//await tester.start()
//await tester.saveResult()

/*const a = new SymbolParser(Markups_2)
const b = new RegexParser(Markups_2)
const data = await readFile('./data/2-k02-a2.txt')
const tokens = a.split(data)
const tokens1 = b.split(data)
console.log(data)
console.log(tokens)
console.log(tokens1)*/

/*const component = new VirtualComponent(Markups_2, [0, 0, 1])
//First render
component.render('Hello @[friend]')
component.update(str => str + '1')
component.update(str => str + ' @[friend2]')*/

/*let symPar = new SymbolParser(Markups_2)
let regPar = new Parser(Markups_2)
//let b = a.split('Hello  @[friend]  @[friend2]')

const startTime1 = performance.now()
for (let i = 0; i < 10000; i++) {
	regPar.split('Hello  @[friend]  @[friend2]')
}
const endTime1 = performance.now()

const startTime2 = performance.now()
for (let i = 0; i < 10000; i++) {
	symPar.split('Hello  @[friend]  @[friend2]')
}
const endTime2 = performance.now()

const a = convertMsIntoFrequency(endTime1 - startTime1)
const b = convertMsIntoFrequency(endTime2 - startTime2)
console.log(`Reg: ${a}`)
console.log(`Sym: ${b}`)*/

//const a = findSingleGap('Hellfriend!', 'Hello friend!')
//console.log(a)


