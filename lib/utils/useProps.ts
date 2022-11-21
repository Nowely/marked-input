import {useState} from "react";
import {State, Type} from "../types";
import {useStore} from "./index";
import {useListener} from "./useListener";
import {shallow} from "./shallow";

export const useProps = <T, >(selector: (state: State) => T, isShallow?: boolean) => {
    const store = useStore()
    const [value, setValue] = useState(() => selector(store.state))

    useListener(Type.State, newState => {
        setValue(currentValue => {
            const newValue = selector(newState)
            if (isShallow && shallow(currentValue, newValue)) return currentValue
            return newValue
        })
    }, [])

    return value
}