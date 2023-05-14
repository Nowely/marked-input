//111, 112, 121, 122, 211...
import {Markup} from 'rc-marked-input'
import {Piece} from 'rc-marked-input/types'
import {formalizeTear} from './formalizeTear'
import {joinSimple} from './joinSimple'

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

export type ParserConstructor = new(markups: Markup[]) => IParser

export interface IParser {
	split(value: string): Piece[]
}

export type Analyzer = typeof formalizeTear
export type Joiner = typeof joinSimple
export type JoinParameters = { pieces: Piece[], index: number, value: string, markups: Markup[] }