//TODO annotate options to object with required only label?
//TODO function annotate(label: string, markup?: Markup, value?: string): string;
import {PLACEHOLDER} from '../constants'
import {Markup} from '../types'

/**
 * Make annotation from the markup
 */
export function annotate(markup: Markup, label: string, value?: string): string {
	const annotation = markup.replace(PLACEHOLDER.LABEL, label)
	return value ? annotation.replace(PLACEHOLDER.VALUE, value) : annotation
}
