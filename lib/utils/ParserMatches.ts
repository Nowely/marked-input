import {MarkMatch} from '../types'

export class ParserMatches implements IterableIterator<[string, MarkMatch | null]> {
	done: boolean = false

	constructor(
		public raw: string,
		public uniRegExp: RegExp,
		public regExps: RegExp[]
	) {
	}

	[Symbol.iterator](): IterableIterator<[string, MarkMatch | null]> {
		return this
	}

	next(): IteratorResult<[string, MarkMatch | null], [string, MarkMatch | null] | null> {
		if (this.done)
			return {done: this.done, value: null}

		let match = this.uniRegExp.exec(this.raw)
		if (match === null) {
			this.done = true
			return {done: false, value: [this.raw, null]}
		}

		let [span, mark, raw] = this.extractPieces(match)
		this.raw = raw
		return {done: false, value: [span, mark]}
	}

	extractPieces(execArray: RegExpExecArray): [string, MarkMatch, string] {
		const mark = this.extractMark(execArray)
		const span = mark.input.substring(0, mark.index)
		const raw = mark.input.substring(mark.index + mark.annotation.length)
		return [span, mark, raw]
	}

	extractMark(execArray: RegExpExecArray): MarkMatch {
		let annotation = execArray[0]
		let optionIndex = 0
		let label
		let value
		while (true) {
			if (this.regExps[optionIndex].test(annotation)) {
				const match = this.regExps[optionIndex].exec(annotation)
				label = match![1]
				value = match![2]
				break
			}
			optionIndex++
		}
		/*let label = execArray[1]
		let value = execArray[2]

		while (true) {
			if (label !== undefined) break

			optionIndex++
			label = execArray[2 * optionIndex + 1]
			value = execArray[2 * optionIndex + 2]
		}*/

		let index = execArray.index
		let input = execArray.input

		return {annotation, label, value, input, index, optionIndex}
	}
}