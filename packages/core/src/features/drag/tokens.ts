import type {Token} from '../parsing'

export const EMPTY_TEXT_TOKEN: Token = {type: 'text', content: '', position: {start: 0, end: 0}}