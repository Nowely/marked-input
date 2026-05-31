import type {MarkupDescriptor} from '../parser/core/MarkupDescriptor'
import type {Token} from '../parser/types'

// oxlint-disable-next-line no-unsafe-type-assertion -- test fixture: buildIndex / reconcileTextSurfaces never read descriptor fields
const descriptor = {} as MarkupDescriptor

export function textToken(content: string, start: number): Token {
	return {type: 'text', content, position: {start, end: start + content.length}}
}

export function markToken(value: string, content: string, start: number, children: Token[] = []): Token {
	return {
		type: 'mark',
		content,
		value,
		position: {start, end: start + content.length},
		descriptor,
		children,
	}
}