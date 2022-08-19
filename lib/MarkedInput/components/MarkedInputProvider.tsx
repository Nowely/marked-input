import {ReactNode, useState} from "react";
import {MarkedInputProps} from "../MarkedInput";
import {StoreProvider} from "../utils";
import {useOptions} from "../hooks/useOptions";
import {useParsed} from "../hooks/useParsed";
import {useTrigger} from "../hooks/useTrigger";
import {EventBus} from "../utils/EventBus";
import {useMutationHandlers} from "../hooks/useMutationHandlers";

interface MarkedInputProviderProps<T, T1> {
    props: MarkedInputProps<T, T1>
    children: ReactNode
}

export const MarkedInputProvider = <T, T1>({props, children}: MarkedInputProviderProps<T, T1>) => {
    const options = useOptions(props.children)
    const pieces = useParsed(props.value, options)
    const trigger = useTrigger(options)
    const bus = useState(() => new EventBus())[0]

    const store = {options, props, pieces, trigger, bus}

    useMutationHandlers(store)

    return <StoreProvider value={store}> {children} </StoreProvider>
}

