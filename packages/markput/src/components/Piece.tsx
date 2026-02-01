import {useStore} from '../utils/hooks/useStore'
import {useSlot} from '../utils/hooks/useSlot'
import {useToken} from '../utils/providers/TokenProvider'
// eslint-disable-next-line import/no-cycle -- Legitimate recursive component relationship: Token renders Piece, Piece uses useMark which renders Token for children
import {useMark} from '../utils/hooks/useMark'
import type {MarkProps} from '../types'

/**
 * Piece component - renders a MarkToken with its custom Mark component
 *
 * This component:
 * 1. Retrieves the MarkToken from context
 * 2. Uses useMark hook to get children ReactNode
 * 3. Constructs MarkProps (value, meta, nested, children)
 * 4. Resolves Mark component and props using useSlot hook
 * 5. Passes result to the resolved Mark component
 *
 * Children rendering is handled by useMark hook:
 * - If token.children is empty: children prop is undefined (backward compatible)
 * - If token.children has items: recursively renders them as ReactNode
 *
 * Slot resolution (via useSlot):
 * - component: option.slots.mark → global Mark → undefined
 * - props: slotProps.mark transformer or direct object, fallback to MarkProps
 */
export function Piece() {
	const node = useToken()
	const {options} = useStore(store => ({options: store.props.options}), true)
	const mark = useMark()

	// Ensure it's a MarkToken
	if (node.type !== 'mark') {
		throw new Error('Piece component expects a MarkToken')
	}

	// Get option and construct base MarkProps
	const option = options?.[node.descriptor.index]

	const markPropsData: MarkProps = {
		value: node.value,
		meta: node.meta,
		nested: node.nested?.content,
		children: mark.children,
	}

	// Resolve Mark component and props with proper fallback chain
	// (throws error if Mark component not found)
	const [Mark, props] = useSlot('mark', option, markPropsData)

	return <Mark {...props} />
}
