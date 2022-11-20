import {ReactNode, useEffect, useState} from "react";
import {MarkedInputProps} from "../MarkedInput";
import {extractOptions, StoreContext, useStore, ValueContext} from "../../utils";
import {useParsed} from "./hooks/useParsed";
import {useMutationHandlers} from "./hooks/useMutationHandlers";
import {Store, useSelector} from "../../utils/useSelector";
import {useExternalEvents} from "./hooks/useExternalEvents";

interface MarkedInputProviderProps {
    props: MarkedInputProps<any, any>
    children: ReactNode
}

export const MarkedInputProvider = ({props, children}: MarkedInputProviderProps) => {
    const {children: options, ...other} = props

    const store = useState(() => Store.create(props))[0]

    useEffect(() => store.set({options: extractOptions(options)}), [options])
    useEffect(() => store.set({...other}))

    useExternalEvents(props.onContainer, store.bus)

    return (
        <StoreContext.Provider value={store}>
            <ProceedValueProvider value={props.value} onChange={props.onChange}>
                {children}
            </ProceedValueProvider>
        </StoreContext.Provider>
    )
}

//TODO
function ProceedValueProvider({value, children, onChange}: { onChange: (value: string) => void, value: string, children: ReactNode }) {
    const options = useSelector(state => state.options)
    const pieces = useParsed(value, options)
    useMutationHandlers(onChange, pieces)

    return <ValueContext.Provider value={pieces}>
        {children}
    </ValueContext.Provider>
}
