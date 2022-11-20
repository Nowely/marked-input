import {ReactNode, useEffect, useState} from "react";
import {MarkedInputProps} from "../MarkedInput";
import {extractOptions, StoreContext} from "../../utils";
import {useExternalEvents} from "./hooks/useExternalEvents";
import {useMutationHandlers} from "./hooks/useMutationHandlers";
import {useParser} from "./hooks/useParser";
import {Store} from "../../utils/Store";

interface MarkedInputProviderProps {
    props: MarkedInputProps<any, any>
    children: ReactNode
}

export const MarkedInputProvider = ({props, children}: MarkedInputProviderProps) => {
    const {children: options, ...other} = props

    const store = useState(() => Store.create(props))[0]

    useEffect(() => store.setState({options: extractOptions(options)}), [options])
    useEffect(() => store.setState({...other}))

    useExternalEvents(props.onContainer, store.bus)


    return (
        <StoreContext.Provider value={store}>
            <Initializer>
                {children}
            </Initializer>
        </StoreContext.Provider>
    )
}

//TODO
const Initializer = ({children}: { children: ReactNode }) => {

    useMutationHandlers()
    useParser()

    return <>
        {children}
    </>
}