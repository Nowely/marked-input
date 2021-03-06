import {Configs, Markup, Slice} from "../types";
import {markupToRegex, normalizeMark} from "./index";
import {Matches} from "./Matches";

//TODO parser factory?
export class Parser {
    private readonly markups: Markup[]
    private readonly uniRegExp: RegExp

    get regExps() {
        return this.markups.map(markupToRegex);
    }

    static split(value: string, configs: Configs<any>) {
        const markups = configs.map((c) => c.markup)
        return () => new Parser(markups).split(value)
    }

    constructor(markups: Markup[]) {
        this.markups = markups
        this.uniRegExp = new RegExp(this.regExps.map(value => value.source).join("|"));
    }

    split(value: string): Slice<any>[] {
        return this.iterateMatches(value);
    }

    iterateMatches(value: string) {
        const result: Slice<any>[] = []

        for (let [span, mark] of new Matches(value, this.uniRegExp)) {
            result.push(span)
            if (mark !== null) {
                result.push(normalizeMark(mark, this.markups[mark.childIndex]))
            }
        }

        return result;
    }
}

