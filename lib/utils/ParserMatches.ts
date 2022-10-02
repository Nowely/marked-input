import {AnnotatedMark} from "../types";

export class ParserMatches implements IterableIterator<[string, AnnotatedMark | null]> {
    done: boolean = false

    constructor(
        public raw: string,
        public uniRegExp: RegExp
    ) {
    }

    [Symbol.iterator](): IterableIterator<[string, AnnotatedMark | null]> {
        return this;
    }

    next(): IteratorResult<[string, AnnotatedMark | null], [string, AnnotatedMark | null] | null> {
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

    extractPieces(execArray: RegExpExecArray): [string, AnnotatedMark, string] {
        const mark = this.extractMark(execArray)
        const span = mark.input.substring(0, mark.index)
        const raw = mark.input.substring(mark.index + mark.annotation.length)
        return [span, mark, raw]
    }

    extractMark(execArray: RegExpExecArray): AnnotatedMark {
        let annotation = execArray[0]

        let childIndex = 0
        let label = execArray[1]
        let value = execArray[2]
        while (true) {
            if (label || value) break

            childIndex++
            label = execArray[2 * childIndex + 1]
            value = execArray[2 * childIndex + 2]
        }

        let index = execArray.index
        let input = execArray.input
        return {annotation, label, value, input, index, childIndex}
    }
}