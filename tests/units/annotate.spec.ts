import {annotate} from "rc-marked-input";
import {Markup} from "rc-marked-input/MarkedInput/types";

describe(`Utility: ${annotate.name}`, () => {
    const markup: Markup = "@[__label__](__value__)"

    it('should make an annotation', () => {
        const result = "@[Label](Value)"
        const annotation = annotate(markup, "Label", "Value")
        expect(annotation).toBe(result)
    })

    it('should have a optional value', () => {
        const result = "@[Label](__value__)"

        let annotation = annotate(markup, "Label")
        expect(annotation).toBe(result)

        annotation = annotate(markup, "Label", undefined)
        expect(annotation).toBe(result)
    })
})
