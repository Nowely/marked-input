import {faker} from '@faker-js/faker'
import {Markup} from 'rc-marked-input'

export const createRandomMarkup = (excludeSymbols: string) => {
    const str1 = faker.datatype.string(5)
    const str2 = faker.datatype.string(5)
    const str3 = faker.datatype.string(5)
    const markup = str1 + '__label__' + str2 + '__value__' + str3
    const regExp = new RegExp(`[${excludeSymbols}]`, 'g')
    return markup.replace(regExp, '') as Markup
}