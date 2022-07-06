import {Configs, Slice} from "../types";
import {markupToRegex, normalizeMark} from "./index";
import {Matches} from "./Matches";

//TODO parser factory?
export class Parser {
    private readonly configs
    private readonly uniRegExp

    get regExps() {
        return this.markups.map(markupToRegex);
    }

    get markups() {
        return this.configs.map((c) => c.markup);
    }

    static split(value: string, configs: Configs<any>) {
        return () => new Parser(configs).split(value)
    }

    private constructor(configs: Configs<any>) {
        this.configs = configs
        this.uniRegExp = new RegExp(this.regExps.map(value => value.source).join("|"));
    }

    split(value: string) {
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

