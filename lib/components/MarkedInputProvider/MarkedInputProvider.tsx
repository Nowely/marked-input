import {ReactNode, useMemo, useState} from "react";
import {MarkedInputProps} from "../MarkedInput";
import {StoreProvider, StoreProvider1, useStore} from "../../utils";
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
    const bus = useState(EventBus.withExternalEventsFrom(props))[0]

    const {spanProps, overlayProps, textProps} = useExtractedProps(props)

    const store: Store = useMemo(
        () => ({options, bus, spanProps, textProps, overlayProps}),
        [options, spanProps, textProps, overlayProps, bus]
    )


    return (
        <StoreProvider value={store}>
            <PiecesProvider value={props.value} onChange={props.onChange}>
                {children}
            </PiecesProvider>
        </StoreProvider>
    )
}

function PiecesProvider({value, children, onChange}: { onChange: (value: string) => void, value: string, children: ReactNode }) {
    const {options} = useStore()
    const pieces = useParsed(value, options)
    useMutationHandlers(onChange, pieces)

    return <StoreProvider1 value={pieces}> {children} </StoreProvider1>
}
