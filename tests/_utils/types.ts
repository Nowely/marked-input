//111, 112, 121, 122, 211...
type AlgorithmGroup = number
//2-k02-a1
type TestDataName = string
type TestDataMeasure = {
	measures: {
		/** In bytes */
		memory: number[]
		/** In ms */
		time: number[]
		/** In operations per sec */
		speed: number[]
	}
	memory?: number
	time?: number
	speed?: number
}
type AlgorithmGroupTestResult = Record<TestDataName, TestDataMeasure>
export type MeasureResult = Record<AlgorithmGroup, AlgorithmGroupTestResult>