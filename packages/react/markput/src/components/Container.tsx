import {memo, useCallback, useLayoutEffect} from 'react'
import type {Ref} from 'react'

import {useMarkput} from '../lib/hooks/useMarkput'
import {Block} from './Block'
import {Token} from './Token'

export const Container = memo(() => {
	const {host, isBlock, nodes, Component, props} = useMarkput(s => ({
		host: s.host,
		isBlock: s.props.layout.isBlock,
		nodes: s.tokens.nodes,
		// SUBSCRIBED, not read. `nodes` alone under-notifies: adoption writes `roots` only
		// when the ROOT LIST changes by reference, so a mark whose value changed and a
		// structural change inside a slot both leave it equal — and the `rendered()` below,
		// which is what drives `bind`, would never fire for either.
		renderEpoch: s.tokens.renderEpoch,
		Component: s.slots.containerComponent,
		props: s.slots.containerProps,
	}))

	useLayoutEffect(() => {
		host.rendered()
	})

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
				? nodes.map((n, i) => <Block key={n.id} node={n} blockIndex={i} />)
				: nodes.map(n => <Token key={n.id} node={n} depth={0} />)}
		</Component>
	)
})

Container.displayName = 'Container'