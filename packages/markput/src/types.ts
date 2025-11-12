import {FunctionComponent} from 'react'
import {MarkedInputProps} from './components/MarkedInput'
import {MarkStruct, ParserV1Markup} from '@markput/core'

export interface Option<T = Record<string, any>> {
	/**
	 * Template string instead of which the mark is rendered.
	 * Must contain placeholders: `__label__` and optional `__value__`
	 * @default "@[__label__](__value__)"
	 * 
	 * @deprecated ParserV1 markup format. Will migrate to ParserV2 format in v2.0
	 */
	markup?: ParserV1Markup
	/**
	 * Sequence of symbols for calling the overlay.
	 * @default "@"
	 */
	trigger?: string //| RegExp
	/**
	 * Data for an overlay component. By default, it is suggestions.
	 */
	data?: string[] //TODO | object[]
	/**
	 * Function to initialize props for the mark component. Gets arguments from found markup
	 */
	initMark?: (props: MarkStruct) => T
}

export type ConfiguredMarkedInput<T> = FunctionComponent<MarkedInputProps<T>>

export interface MarkedInputHandler {
	/**
	 * Container element
	 */
	readonly container: HTMLDivElement | null
	/**
	 * Overlay element if exists
	 */
	readonly overlay: HTMLElement | null

	focus(): void
}
