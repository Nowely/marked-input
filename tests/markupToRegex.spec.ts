import {annotate, markupToRegex} from "../lib/MarkedInput/utils";
import {faker} from "@faker-js/faker";
import {createRandomMarkup} from "./utils/createRandomMarkup";

describe(`Utility: ${markupToRegex.name}`, () => {
    it('should convert markup to regex', () => {
        const markup = createRandomMarkup()
        const regex = markupToRegex(markup)
        const annotation = annotate(markup, faker.lorem.words(), faker.lorem.words())
        const textWithAnnotation = faker.lorem.words() + annotation +faker.lorem.words()
        const textWithoutAnnotation = faker.lorem.sentences()
        expect(regex.test(textWithAnnotation)).toBeTruthy()
        expect(regex.test(textWithoutAnnotation)).toBeFalsy()
    });
})

