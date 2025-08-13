import {Children} from 'react'
import type {Store} from '@markput/core'

export const getChildProps = (type: string) => (state: Store) =>
	Children.map(state.props.children, child => child)?.find((child: {type: string}) => child.type === type)?.props
