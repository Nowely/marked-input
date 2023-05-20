//1 Start bench and write raw measures
import {Benchmark} from './_utils/Benchmark'

const tester = new Benchmark()
//await tester.loadResult()

await tester.start()

console.log(tester.result)

//await tester.saveResult()

//await normalizeData()
//await computeScoreFoTestData
//await computeFinalScore()
