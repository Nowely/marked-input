import {useState} from "react";
import {State, Type} from "../types";
import {useStore} from "./index";
import {useListener} from "./useListener";
import {shallow} from "./shallow";

export const useSelector = <T, >(selector: (state: State) => T, isShallow?: boolean) => {
    const store = useStore()
    const [value, setValue] = useState(() => selector(store.state))

    useListener(Type.State, newState => {
        setValue(value => {
            const newValue = selector(newState)
            if (isShallow && shallow(value, newValue)) return value
            return newValue
        })
    }, [])

    return value
}

//export const useAbc = useState.bind(null, () => Store1.create())

