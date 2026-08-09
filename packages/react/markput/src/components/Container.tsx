import {memo, useCallback, useLayoutEffect} from 'react'
import type {Ref} from 'react'

import {useMarkput} from '../lib/hooks/useMarkput'
import {Block} from './Block'
import {Token} from './Token'

export const Container = memo(() => {
	const {host, isBlock, tokens, keyOf, Component, props} = useMarkput(s => ({
		host: s.host,
		isBlock: s.props.layout.isBlock,
		tokens: s.tokens.renderTree,
		keyOf: s.tokens.keyOf,
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
				? tokens.map((t, i) => <Block key={keyOf(t)} token={t} blockIndex={i} />)
				: tokens.map((t, i) => <Token key={keyOf(t)} token={t} path={[i]} depth={0} />)}
		</Component>
	)
})

Container.displayName = 'Container'