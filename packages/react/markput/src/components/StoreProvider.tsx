import type {ReactNode} from 'react'
import {useEffect, useMemo, useState} from 'react'
import {Store} from '@markput/core'
import type {MarkedInputProps} from './MarkedInput'
import {StoreContext} from '../lib/providers/StoreContext'
import {createUseSignalHook} from '../lib/hooks/createUseSignalHook'
import {normalizeProps} from '../lib/utils/normalizeProps'

interface StoreProviderProps {
	props: MarkedInputProps
	children: ReactNode
}

export const StoreProvider = ({props, children}: StoreProviderProps) => {
	const storeProps = normalizeProps(props)
	const createUseHook = useMemo(createUseSignalHook, [])
	const [store] = useState(() => new Store(storeProps, {createUseHook}))

	useEffect(() => {
		store.props = storeProps
	})

	return <StoreContext.Provider value={store} children={children} />
}
