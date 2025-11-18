import type {ReactNode} from 'react'
import {useStore} from '../utils/hooks/useStore'
import {useSlot} from '../utils/hooks/useSlot'
import {useToken} from '../utils/providers/TokenProvider'
import {Token} from './Token'
import type {MarkProps} from '../types'

/**
 * Piece component - renders a MarkToken with its custom Mark component
 *
 * This component:
 * 1. Retrieves the MarkToken from context
 * 2. Constructs MarkProps (value, meta, nested, children)
 * 3. Recursively renders nested children if present
 * 4. Resolves Mark component and props using useSlot hook
 * 5. Passes result to the resolved Mark component
 *
 * Children rendering:
 * - If token.children is empty: children prop is undefined (backward compatible)
 * - If token.children has items: recursively renders them as ReactNode
 *
 * Slot resolution (via useSlot):
 * - component: option.slots.mark → global Mark → undefined
 * - props: slotProps.mark transformer or direct object, fallback to MarkProps
 */
export function Piece() {
	const node = useToken()
	const {options, key} = useStore(
		store => ({
			options: store.props.options,
			key: store.key,
		}),
		true
	)

	// Ensure it's a MarkToken
	if (node.type !== 'mark') {
		throw new Error('Piece component expects a MarkToken')
	}

	// Get option and construct base MarkProps
	const option = options?.[node.descriptor.index]

	// Construct children ReactNode from token.children if present
	// Nested tokens render as non-editable content (isNested=true)
	const children: ReactNode | undefined =
		node.children.length > 0
			? node.children.map(child => <Token key={key.get(child)} mark={child} isNested />)
			: undefined

	const markPropsData: MarkProps = {
		value: node.value,
		meta: node.meta,
		nested: node.nested?.content,
		children,
	}

	// Resolve Mark component and props with proper fallback chain
	// (throws error if Mark component not found)
	const [Mark, props] = useSlot('mark', option, markPropsData)

	return <Mark {...props} />
}
