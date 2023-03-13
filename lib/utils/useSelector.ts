import {useState} from 'react'
import {State, Type} from '../types'
import {useStore} from './index'
import {shallow} from './shallow'
import {useListener} from './useListener'

export const useSelector = <T, >(selector: (state: State) => T, byStruct?: boolean) => {
    const store = useStore()
    const [value, setValue] = useState(() => selector(store.state))

    useListener(Type.State, newState => {
        setValue(currentValue => {
            const newValue = selector(newState)
            if (byStruct && shallow(currentValue, newValue)) return currentValue
            return newValue
        })
    }, [])

    return value
}