import {useEffect} from 'react'
import {Activator, EventName} from '../../../types'
import {useStore} from '../../../utils'
import {useSelector} from '../../../utils/useSelector'

export const useContainerEvents = () => {
    const {bus} = useStore()
    const onContainer = useSelector(state => state.onContainer ?? {}, true)
    const eventNames = Object.keys(onContainer) as EventName[]
    const eventHandlers = Object.values(onContainer)

    useEffect(() => {
        const unlisten: Activator[] = []
        for (let i = 0; i < eventNames.length; i++) {
            let event = eventNames[i]
            let handler = eventHandlers[i]
            unlisten.push(bus.listen(event, handler))
        }

        return () => unlisten.forEach(l => l())
    }, eventHandlers)
}