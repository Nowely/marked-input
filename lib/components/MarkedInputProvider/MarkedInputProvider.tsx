import {ReactNode, useMemo, useState} from "react";
import {MarkedInputProps} from "../MarkedInput";
import {StoreProvider, ValueProvider, useStore} from "../../utils";
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

    const extractedProps = useExtractedProps(props)

    const store: Store = useMemo(
        () => ({options, bus, props: extractedProps}),
        [options, extractedProps, bus]
    )

    return (
        <StoreProvider value={store}>
            <ProceedValueProvider value={props.value} onChange={props.onChange}>
                {children}
            </ProceedValueProvider>
        </StoreProvider>
    )
}

function ProceedValueProvider({value, children, onChange}: { onChange: (value: string) => void, value: string, children: ReactNode }) {
    const {options} = useStore()
    const pieces = useParsed(value, options)
    useMutationHandlers(onChange, pieces)

    return <ValueProvider value={pieces}>
        {children}
    </ValueProvider>
}
