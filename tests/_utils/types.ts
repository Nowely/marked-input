//111, 112, 121, 122, 211...
import {Markup} from 'rc-marked-input'
import {Piece} from 'rc-marked-input/types'
import {findSingleGap} from './analyzers/findSingleGap'
import {mapStraight} from './joiners/mapStraight'

export type AlgorithmGroup = string
//2-k02-a1
type TestDataName = string
type TestDataRawMeasure = {
	/** In bytes */
	memory: number[]
	/** In ms */
	time: number[]
	/** In operations per sec */
	speed: number[]
}

export type RawMeasures = Record<AlgorithmGroup, Record<TestDataName, TestDataRawMeasure>>

type TestDataMeasure = {
	/** In bytes */
	memory: number
	/** In ms */
	time: number
	/** In operations per sec */
	speed: number
	/** In kB */
	size: number
}
export type Measures = Record<AlgorithmGroup, Record<TestDataName, TestDataMeasure>>
//export type RawMeasures = Record<AlgorithmGroup, any>


export type ParserConstructor = new(markups: Markup[]) => IParser

export interface IParser {
	split(value: string): Piece[]
}

export type Analyzer = typeof findSingleGap
export type Joiner = typeof mapStraight
export type JoinParameters = { pieces: Piece[], index: number, value: string, markups: Markup[] }