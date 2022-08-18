import {ReactNode} from "react";
import {MarkedInputProps} from "../MarkedInput";
import {useMarkedInput} from "../hooks/useMarkedInput";
import {StoreProvider} from "../utils";

interface MarkedInputProviderProps<T, T1> {
    value: MarkedInputProps<T, T1>
    children: ReactNode
}

export const MarkedInputProvider = <T, T1>({value, children}: MarkedInputProviderProps<T, T1>) => {
    const store = useMarkedInput(value)
    return <StoreProvider value={store}> {children} </StoreProvider>
};