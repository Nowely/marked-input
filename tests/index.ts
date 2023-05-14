import {SizeMap} from './_utils/consts'
import {convertMsIntoFrequency} from './_utils/convertMsIntoFrequency'
import {readFile} from './_utils/readFile'
import {Measures, RawMeasures} from './_utils/types'
import {writeFile} from './_utils/writeFile'

/*const data = await readFile('./raw.json')
const result: RawMeasures = JSON.parse(data)
const measures: Measures = {}

for (const group in result) {
	measures[group] ??= {}
	for (const testCase in result[group]) {
		const lineCount = Number(testCase.split('-')[0])

		const memoryArr = result[group][testCase].memory.filter(value => value > 0)
		//const speedArr = result[group][testCase].speed.sort((a, b) => a - b)
		let timeArr = result[group][testCase].time.sort((a, b) => a - b)
		timeArr = removeFirstAndLast20Percent(timeArr)
		const time = findAverage(timeArr)
		const speed = convertMsIntoFrequency(time)

		const accuracy = lineCount <= 10 ? 10 : lineCount <= 100 ? 100 : lineCount <= 1000 ? 1000 : 10000
		const groupedMemory = groupBySimilar(memoryArr, accuracy)
		const [memory, count] = findOften(groupedMemory)

		// @ts-ignore
		const size = SizeMap.analyzer[group[0]] + SizeMap.parser[group[1]] + SizeMap.joiner[group[2]]
		/!*if (accuracy === 10000)
			console.log(`Goal is ${goal} with ${count} count`)*!/
		measures[group][testCase] = {memory, size, time, speed}
	}
}*/

//await writeFile('./measures.json', JSON.stringify(measures, null, ' '))

/*const b = groupBySimilar(a, 100)
const c = findOften(b)
console.log(b)
console.log(c)*/

function findOften(groups: Record<number, number>) {
	let count = Number.NEGATIVE_INFINITY
	let goalKey = ''
	for (const key in groups) {
		if (groups[key] > count) {
			count = groups[key]
			goalKey = key
		}
	}
	return [Number(goalKey), count] as const
}

function groupBySimilar(numbers: number[], accuracy: number = 10) {
	const groups: Record<number, number> = {};

	for (let number of numbers) {
		const key = Math.floor(number / accuracy) * accuracy
		groups[key] ??= 0
		groups[key] = groups[key] + 1
	}

	return groups
}

function findAverage(numbers: number[]): number {
	const sum: number = numbers.reduce((accumulator: number, currentValue: number) => accumulator + currentValue, 0);
	return sum / numbers.length;
}

function removeFirstAndLast20Percent(array: number[]) {
	const startIndex = Math.floor(array.length * 0.2);
	const endIndex = Math.ceil(array.length * 0.8);

	return array.slice(startIndex, endIndex);
}
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


