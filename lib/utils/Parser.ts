import {Markup, Options, Piece} from '../types'
import {markupToRegex, normalizeMark} from './index'
import {ParserMatches} from './ParserMatches'

//TODO parser factory?
export class Parser {
    private readonly markups: Markup[]
    private readonly uniRegExp: RegExp

    get regExps() {
        return this.markups.map(markupToRegex)
    }

    static split(value: string, options: Options) {
        const markups = options.map((c) => c.markup)
        return () => new Parser(markups).split(value)
    }

    constructor(markups: Markup[]) {
        this.markups = markups
        this.uniRegExp = new RegExp(this.regExps.map(value => value.source).join('|'))
    }

    split(value: string): Piece[] {
        return this.iterateMatches(value)
    }

    iterateMatches(value: string) {
        const result: Piece[] = []

        for (let [span, mark] of new ParserMatches(value, this.uniRegExp)) {
            result.push(span)
            if (mark !== null)
                result.push(normalizeMark(mark, this.markups[mark.childIndex]))
        }

        return result
    }
}

