import {Children} from 'react'
import type {Store} from '@markput/core/src/utils/classes/Store'

export const getChildProps = (type: string) => (state: Store) =>
	Children.map(state.props.children, child => child)?.find(child => child.type === type)?.props
