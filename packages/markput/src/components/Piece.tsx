import {ReactNode} from 'react'
import {useStore} from '../utils/hooks/useStore'
import {useToken} from '../utils/providers/TokenProvider'
import {Token} from './Token'

/**
 * Piece component - renders a MarkToken with its custom Mark component
 * 
 * This component:
 * 1. Retrieves the MarkToken from context
 * 2. Constructs props for the Mark component (value, meta, children)
 * 3. Recursively renders nested children if present
 * 4. Passes everything to the custom Mark component
 * 
 * Children rendering:
 * - If token.children is empty: children prop is undefined (backward compatible)
 * - If token.children has items: recursively renders them as ReactNode
 */
export function Piece() {
	const node = useToken()
	const {options, Mark, key} = useStore(
		store => ({
			options: store.props.options,
			Mark: store.props.Mark,
			key: store.key,
		}),
		true
	)

	// Ensure it's a MarkToken
	if (node.type !== 'mark') {
		throw new Error('Piece component expects a MarkToken')
	}

	// Construct children ReactNode from token.children if present
	// Nested tokens render as non-editable content (isNested=true)
	const children: ReactNode | undefined =
		node.children.length > 0
			? node.children.map(child => <Token key={key.get(child)} mark={child} isNested />)
			: undefined

	const markProps: import('../types').MarkProps = {
		value: node.value,
		meta: node.meta,
		nested: node.nested?.content,
		children
	}
	// TODO correct typing
	// @ts-expect-error
	const props = options[node.descriptor.index].initMark?.(markProps) ?? markProps

	//TODO correct typing
	// @ts-ignore
	return <Mark {...props} />
}
