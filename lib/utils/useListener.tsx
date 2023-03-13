import {DependencyList, useEffect} from 'react'
import {EventName, Listener, Type} from '../types'
import {useStore} from './index'
import {Store} from './Store'

export function useListener(type: EventName | Type, listener: Listener, deps?: DependencyList, store?: Store) {
    const {bus} = store ?? useStore()
    useEffect(() => bus.listen(type, listener), deps)
}