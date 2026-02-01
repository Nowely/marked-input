import type {MarkToken} from '@markput/core'
import {useStore} from '../lib/hooks/useStore'
import {useSlot} from '../lib/hooks/useSlot'
import {useToken} from '../lib/providers/TokenProvider'
import type {MarkProps} from '../types'
// eslint-disable-next-line import/no-cycle
import {Token} from './Token'

/** Renders a MarkToken using the resolved Mark component from useSlot */
export function MarkRenderer() {
	const node = useToken() as MarkToken
	const {options, key} = useStore(store => ({options: store.props.options, key: store.key}), true)

	const option = options?.[node.descriptor.index]

	const children = node.children.map(child => <Token key={key.get(child)} mark={child} isNested />)

	const markPropsData: MarkProps = {
		value: node.value,
		meta: node.meta,
		nested: node.nested?.content,
		children: node.children.length > 0 ? children : undefined,
	}

	const [Mark, props] = useSlot('mark', option, markPropsData)

	return <Mark {...props} />
}
