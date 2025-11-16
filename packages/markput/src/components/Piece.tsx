import {ReactNode} from 'react'
import {useStore} from '../utils/hooks/useStore'
import {useToken} from '../utils/providers/TokenProvider'
import {Token} from './Token'

/**
 * Piece component - renders a MarkToken with its custom Mark component
 *
 * This component:
 * 1. Retrieves the MarkToken from context
 * 2. Constructs MarkProps (value, meta, nested, children)
 * 3. Recursively renders nested children if present
 * 4. Transforms props using markProps (object or function)
 * 5. Passes result to the custom Mark component
 *
 * Children rendering:
 * - If token.children is empty: children prop is undefined (backward compatible)
 * - If token.children has items: recursively renders them as ReactNode
 *
 * Props transformation:
 * - If markProps is an object: passes it directly (full replacement)
 * - If markProps is a function: calls it with MarkProps and uses the result
 * - If markProps is undefined: passes MarkProps directly (fallback)
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

	const markPropsData: import('../types').MarkProps = {
		value: node.value,
		meta: node.meta,
		nested: node.nested?.content,
		children,
	}

	// Handle both object and function forms of markProps
	const optionMarkProps = options?.[node.descriptor.index]?.markProps
	const props = optionMarkProps
		? typeof optionMarkProps === 'function'
			? optionMarkProps(markPropsData)
			: optionMarkProps
		: markPropsData

	// Type assertion needed: props can be either T (from markProps object/function) or MarkProps (fallback).
	// Since Mark expects ComponentType<T>, and we cannot infer T at runtime, we use type assertion here.
	// This is safe because:
	// 1. If markProps is defined, it returns T (correct type for Mark)
	// 2. If markProps is undefined, MarkProps is passed (backward compatible fallback)
	if (!Mark) {
		throw new Error('Mark component is required but not provided')
	}

	return <Mark {...(props as any)} />
}
