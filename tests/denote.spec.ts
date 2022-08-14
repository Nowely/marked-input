import {denote} from "../lib/MarkedInput/utils";
import {Markup} from "../lib/MarkedInput/types";

describe("Util: denote", () => {
    const markup: Markup = "@[__label__](__value__)"

    it('should make a display text from annotated', () => {
        const annotatedText = "Enter the '@' for calling @[Hello](HelloValue) suggestions and '/' for @[Bye](ByeValue)!"
        const displayText = denote(annotatedText, mark => mark.label, markup)
        const expected = "Enter the '@' for calling Hello suggestions and '/' for Bye!"
        expect(displayText).toBe(expected)
    })

    it('should be able to accept a usual text without changing', () => {
        const text = "Enter the '@' for calling Hello suggestions and '/' for Bye!"
        expect(denote(text, mark => mark.label, markup)).toBe(text)
    })

    it('should be able to accept a empty text', () => {
        const empty = ""
        expect(denote(empty, mark => mark.label, markup)).toBe(empty)
    })

    it('should be ignore other annotations', () => {
        const annotatedText = "Enter the '@' for calling @[Hello](HelloValue) suggestions and '/' for @(Bye)[ByeValue]!"
        expect(denote(annotatedText, mark => mark.label, markup))
            .toBe("Enter the '@' for calling Hello suggestions and '/' for @(Bye)[ByeValue]!")
    })

    it('should accept zero markups', () => {
        const annotatedText = "Enter the '@' for calling @[Hello](HelloValue) suggestions and '/' for @[Bye](ByeValue)!"
        expect(denote(annotatedText, mark => mark.label)).toBe(annotatedText)
    })

    it('should accept many markups', () => {
        const markup2: Markup = "@(__label__)[__value__]"
        const annotatedText = "Enter the '@' for calling @[Hello](HelloValue) suggestions and '/' for @(Bye)[ByeValue]!"
        const actual = denote(annotatedText, mark => mark.label, markup, markup2)
        const expected = "Enter the '@' for calling Hello suggestions and '/' for Bye!"
        expect(actual).toBe(expected)
    })
})