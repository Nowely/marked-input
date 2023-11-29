//TODO annotate options to object with required only label?
import {PLACEHOLDER} from '../PLACEHOLDER'
//TODO function annotate(label: string, markup?: Markup, value?: string): string;
import type {Markup} from '../types'

/**
 * Make annotation from the markup
 */
export function annotate(markup: Markup, label: string, value?: string): string {
	let annotation = markup.replace(PLACEHOLDER.LABEL, label)
	return value ? annotation.replace(PLACEHOLDER.VALUE, value) : annotation
}