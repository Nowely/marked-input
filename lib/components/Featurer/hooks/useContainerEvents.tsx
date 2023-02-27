import {Activator, EventName} from "../../../types";
import {useEffect} from "react";
import {useSelector} from "../../../utils/useSelector";
import {useStore} from "../../../utils";

export const useContainerEvents = () => {
    const {bus} = useStore()
    const onContainer = useSelector(state => state.onContainer ?? {}, true)
    const eventNames = Object.keys(onContainer) as EventName[]
    const eventHandlers = Object.values(onContainer)

    useEffect(() => {
        const unlisten: Activator[] = []
        for (let i = 0; i < eventNames.length; i++) {
            let event = eventNames[i];
            let handler = eventHandlers[i]
            unlisten.push(bus.listen(event, handler))
        }

        return () => unlisten.forEach(l => l())
    }, eventHandlers)
};