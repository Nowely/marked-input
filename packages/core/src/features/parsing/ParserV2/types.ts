import {InnerOption} from '../../default/types'

export type NestedToken =
	| TextToken
	| MarkToken

export interface TextToken {
	type: 'text'
	content: string
	position: {
		start: number
		end: number
	}
}

export interface MarkToken {
	type: 'mark'
	content: string
	children: NestedToken[]
	data: {
		label: string
		value?: string
		optionIndex: number
	}
	position: {
		start: number
		end: number
	}
}

export interface ParseContext {
	stack: NestedToken[]
	current: MarkToken
	position: number
	input: string
}

export interface ValidationResult {
	isValid: boolean
	errors: string[]
}

export interface MarkupDescriptor {
	index: number                    // Индекс в массиве markups
	trigger: string                 // Символ триггера (например, '@')
	startPattern: string           // Статическая часть начала ('[' для '@[__label__]')
	endPattern: string             // Статическая часть конца (']' для '@[__label__]')
	hasValue: boolean              // Есть ли часть __value__
	valueStartPattern?: string     // Статическая часть начала value ('(' для '@[__label__](__value__)')
	valueEndPattern?: string       // Статическая часть конца value (')' для '@[__label__](__value__)')
	fullStartPattern: string       // Полная строка начала (например, '@[')
	fullEndPattern: string         // Полная строка конца (например, ']')
	fullValueStartPattern?: string // Полная строка начала value (например, '](')
	fullValueEndPattern?: string   // Полная строка конца value (например, ')')
}
