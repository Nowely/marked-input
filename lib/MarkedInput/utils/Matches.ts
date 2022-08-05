import {Mark} from "../types";

export class Matches implements IterableIterator<[string, Mark | null]> {
    done: boolean = false

    constructor(
        public raw: string,
        public uniRegExp: RegExp
    ) {
    }

    [Symbol.iterator](): IterableIterator<[string, Mark | null]> {
        return this;
    }

    next(): IteratorResult<[string, Mark | null], [string, Mark | null] | null> {
        if (this.done)
            return {done: this.done, value: null}

        let match = this.uniRegExp.exec(this.raw)
        if (match === null) {
            this.done = true
            return {done: false, value: [this.raw, null]}
        }

        let [span, mark, raw] = this.extractSlices(match)
        this.raw = raw
        return {done: false, value: [span, mark]}
    }

    extractSlices(execArray: RegExpExecArray): [string, Mark, string] {
        const mark = this.extractMark(execArray)
        const span = mark.input.substring(0, mark.index)
        const raw = mark.input.substring(mark.index + mark.annotation.length)
        return [span, mark, raw]
    }

    extractMark(execArray: RegExpExecArray): Mark {
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