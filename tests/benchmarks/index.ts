//1 Start bench and write raw measures
import path from 'path'
import {Benchmark} from './_utils/Benchmark'
import {getFileNames} from './_utils/getFileNames'
import {SymbolParser} from './_utils/parsers/SymbolParser'
import {readFile} from './_utils/readFile'
import {genAnnotatedText} from './_utils/test-data/genAnnotatedText'
import {DataFolderPath, Markups_16} from './consts'

//const tester = new Benchmark()
//await tester.loadResult()
//await tester.start()
//await tester.saveResult()

const name = (await getFileNames(DataFolderPath))
	.filter(value => value.includes('-k'))
	//.filter(value => !value.includes('-a16')) //to 90
	.sort((a, b) => {
		const a1 = Number(a.split('-')[0])
		const b1 = Number(b.split('-')[0])
		return a1 -b1
	})[2]
const data2 = await readFile(path.resolve(DataFolderPath, name))
console.log(data2)

//await normalizeData()
//await computeScoreFoTestData
//await computeFinalScore()

//const parser = SymbolParser()