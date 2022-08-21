import {faker} from "@faker-js/faker";
import {Markup} from "../../lib/MarkedInput/types";

export const createRandomMarkup = () => {
    const str1 = faker.datatype.string(5)
    const str2 = faker.datatype.string(5)
    const str3 = faker.datatype.string(5)
    return str1 + "__label__" + str2 + "__value__" + str3 as Markup
};