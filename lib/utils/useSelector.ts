import {useState} from "react";
import {State, Type} from "../types";
import {assign, extractOptions, useStore} from "./index";
import {MarkedInputProps} from "../components/MarkedInput";
import {EventBus} from "./EventBus";
import {useListener} from "./useListener";

export const useSelector = <T, >(selector: (state: State) => T) => {
    const store = useStore()
    const [value, setValue] = useState(selector(store.state))

    useListener(Type.State, newState => setValue(selector(newState)), [])

    return value
}

export class Store {

    constructor(
        public state: State,
        readonly bus: EventBus
    ) {
    }

    static create(props: MarkedInputProps) {
        const state = {} as State
        const {children, ...other} = props

        state.options = extractOptions(children)
        assign(state, other)

        const bus = EventBus.initWithExternalEvents(props.onContainer)()

        return new Store(state, bus)
    }

    set(state: Partial<State>) {
        this.state = {...this.state, ...state}
        this.bus.send(Type.State, this.state)
    }
}

//export const useAbc = useState.bind(null, () => Store1.create())

