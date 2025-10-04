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

// Базовый интерфейс для дескрипторов
export interface BaseMarkupDescriptor {
	markup: string
	index: number
	trigger: string
}

// Результат матчинга маркера
export interface MatchResult {
	start: number
	end: number
	content: string
	label: string
	value?: string
	descriptor: BaseMarkupDescriptor
}

// Кандидат на токен с информацией о конфликтах
export interface TokenCandidate {
	match: MatchResult
	conflicts: Set<TokenCandidate>
}
