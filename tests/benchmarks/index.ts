//1 Start bench and write raw measures
import path from 'path'
import {Benchmark} from './_utils/Benchmark'
import {getFileNames} from './_utils/getFileNames'
import {PEGParser} from './_utils/parsers/PEGParser'
import {SymbolParser} from './_utils/parsers/SymbolParser'
import {genPEGParser} from './_utils/PEGParserGenerator'
import {readFile} from './_utils/readFile'
import {genAnnotatedText} from './_utils/test-data/genAnnotatedText'
import {DataFolderPath, Markups_16} from './consts'
import * as peggy from "peggy";

const tester = new Benchmark()
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

//let a = new PEGParser(Markups_16)
//let b = a.split(data2)
//console.log(b)
//genPEGParser()
//const c = parser.parse('(in here there can be \'anything\' !"#¤);); any character is possible);')
//const parser = peggy.generate(a);
//const c = parser.parse('<div>Hello, <b>world!</b></div>')
//console.log(parser1)
/*const c1 = parser1.parse(data2, {
	markups: Markups_16
})*/



//await normalizeData()
//await computeScoreFoTestData
//await computeFinalScore()
