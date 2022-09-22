import {ReactNode, useMemo, useState} from "react";
import {MarkedInputProps} from "../MarkedInput";
import {StoreProvider} from "../../utils";
import {useOptions} from "./hooks/useOptions";
import {useParsed} from "./hooks/useParsed";
import {EventBus} from "../../utils/EventBus";
import {useMutationHandlers} from "./hooks/useMutationHandlers";
import {Store} from "../../types";
import {useExtractedProps} from "./hooks/useExtractedProps";

interface MarkedInputProviderProps {
    props: MarkedInputProps<any, any>
    children: ReactNode
}

export const MarkedInputProvider = ({props, children}: MarkedInputProviderProps) => {
    const options = useOptions(props.children)
    const pieces = useParsed(props.value, options)
    const {spanProps, overlayProps, textProps} = useExtractedProps(props)
    const bus = useState(EventBus.withExternalEventsFrom(props))[0]

    const store: Store = useMemo(
        () => ({options, pieces, bus, spanProps, textProps, overlayProps}),
        [options, pieces, spanProps, textProps, overlayProps, bus]
    )

    useMutationHandlers(store, props.onChange)

    return <StoreProvider value={store}> {children} </StoreProvider>
}

