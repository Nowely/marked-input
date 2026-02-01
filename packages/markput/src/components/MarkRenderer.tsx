import type {MarkToken} from '@markput/core'
import {useStore} from '../lib/hooks/useStore'
import {useSlot} from '../lib/hooks/useSlot'
import {useToken} from '../lib/providers/TokenProvider'
import type {MarkProps} from '../types'
// eslint-disable-next-line import/no-cycle -- Legitimate recursive component relationship: Piece → Token → MarkTokenComponent → Piece
import {Token} from './Token'

/**
 * Piece component - renders a MarkToken with its custom Mark component
 *
 * This component:
 * 1. Retrieves the MarkToken from context (type-safe via MarkTokenComponent)
 * 2. Renders children directly (breaking circular import with useMark)
 * 3. Constructs MarkProps (value, meta, nested, children)
 * 4. Resolves Mark component and props using useSlot hook
 * 5. Passes result to the resolved Mark component
 *
 * Type safety:
 * - Piece is only rendered via MarkTokenComponent which guarantees MarkToken type
 * - Runtime check kept for defensive programming but should never trigger
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
	const {options, key} = useStore(store => ({options: store.props.options, key: store.key}), true)

	// Type guard - should never trigger since Piece is only rendered via MarkTokenComponent
	// Kept for defensive programming and to satisfy TypeScript
	if (node.type !== 'mark') {
		throw new Error('Piece component expects a MarkToken')
	}

	// Get option and construct base MarkProps
	const option = options?.[node.descriptor.index]

	// Render children directly in component (not in hook) to break circular import
	const children =
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
