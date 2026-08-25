import {memo, useCallback} from 'react'
import type {Ref} from 'react'

import {useMarkput} from '../lib/hooks/useMarkput'
import {BlockControls} from './BlockControls'
import {Rows} from './Rows'
import {Token} from './Token'

export const Container = memo(() => {
	const {host, rowConfig, nodes, Component, props} = useMarkput(s => ({
		host: s.host,
		rowConfig: s.tokens.rowConfig,
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
			{/* Branched on the PROPS-derived separator rather than per node, matching Vue's
			    Container: a configured separator is exactly when the parse yields rows. The roots
			    are then ONE sibling list of rows, painted by the same component a row's own
			    children are, so the depth index has one implementation at every depth. */}
			{rowConfig === undefined ? (
				nodes.map(n => <Token key={n.id} node={n} depth={0} />)
			) : (
				<Rows rows={nodes.filter(n => n.kind === 'row')} depth={0} />
			)}
			{/* The row controls, as one layer INSIDE the container rather than a copy inside every
			    row. It is therefore a container child that is not a row — `styles.BlockControls`
			    is how a caller tells them apart. Gated on the PROPS-derived separator, not on the
			    rows themselves: the tree is empty until the container attaches, so a tree-derived
			    gate would leave the layer out of the server pass and out of the first client
			    render. */}
			{rowConfig !== undefined && <BlockControls />}
		</Component>
	)
})

Container.displayName = 'Container'