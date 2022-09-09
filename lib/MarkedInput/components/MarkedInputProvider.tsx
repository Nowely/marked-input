import {ReactNode, useState} from "react";
import {MarkedInputProps} from "../MarkedInput";
import {StoreProvider} from "../utils";
import {useOptions} from "../hooks/useOptions";
import {useParsed} from "../hooks/useParsed";
import {EventBus} from "../utils/EventBus";
import {useMutationHandlers} from "../hooks/useMutationHandlers";
import {Store} from "../types";

interface MarkedInputProviderProps {
    props: MarkedInputProps<any, any>
    children: ReactNode
}

export const MarkedInputProvider = ({props, children}: MarkedInputProviderProps) => {
    const options = useOptions(props.children)
    const pieces = useParsed(props.value, options)
    const bus = useState(EventBus.withExternalEventsFrom(props))[0]
    const store: Store = {options, props, pieces, bus}

    useMutationHandlers(store)

    return <StoreProvider value={store}> {children} </StoreProvider>
}

