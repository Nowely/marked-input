import {faker} from '@faker-js/faker'
import * as fs from 'fs'
import {Markup} from 'rc-marked-input'

/**
 * @param length - length of output text
 * @param speed - speed of text changing
 * @param countSpeed - count of changed
 * @param annotated - from 0 to 1 ratio of annotations in text
 * @param markups - used markups for annotated
 */
export function generateTestData(length: number, speed: number, countSpeed: number, annotated: number, ...markups: Markup[]) {

}
