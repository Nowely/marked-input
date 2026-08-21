import {memo, useCallback} from 'react'
import type {Ref} from 'react'

import {useMarkput} from '../lib/hooks/useMarkput'
import type {BlockRow} from './Block'
import {Block} from './Block'
import {Token} from './Token'

export const Container = memo(() => {
	const {host, isBlock, nodes, Component, props} = useMarkput(s => ({
		host: s.host,
		isBlock: s.props.layout.isBlock,
		nodes: s.tokens.nodes,
		Component: s.slots.containerComponent,
		props: s.slots.containerProps,
	}))

	// Compose the host ref with a user-provided slotProps.container ref: the
	// model publishes tokens only once the container mounts, so letting a user
	// ref shadow the host ref would leave the editor permanently empty.
	// oxlint-disable-next-line no-unsafe-type-assertion -- slotProps.container.ref is raw user input
	const userRef = (props as {ref?: Ref<HTMLElement | null>} | undefined)?.ref
	const setRef = useCallback(
		(element: HTMLElement | null) => {
			host.container(element)
			if (typeof userRef === 'function') userRef(element)
			else if (userRef) userRef.current = element
		},
		[host, userRef]
	)

	return (
		<Component {...props} ref={setRef}>
			{isBlock
				? nodes.map((n, i) => (
						// oxlint-disable-next-line no-unsafe-type-assertion -- block-mode parse policy: parseRowsValue makes every root a RowNode
						<Block key={n.id} node={n as BlockRow} blockIndex={i} />
					))
				: nodes.map(n => <Token key={n.id} node={n} depth={0} />)}
		</Component>
	)
})

Container.displayName = 'Container'