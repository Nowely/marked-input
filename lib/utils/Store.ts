import {State, Type} from "../types";
import {EventBus} from "./EventBus";
import {MarkedInputProps} from "../components/MarkedInput";
import {extractOptions} from "./index";
import {EmptyList} from "../constants";

export class Store {
    #state: State;

    get state(): State {
        return this.#state;
    }

    static create(props: MarkedInputProps<any, any>) {
        const {children, ...other} = props

        const initialState = {
            options: extractOptions(children),
            pieces: EmptyList,
            ...other
        } as State

        const bus = EventBus.initWithExternalEvents(props.onContainer)()

        return new Store(initialState, bus)
    }

    constructor(state: State, readonly bus: EventBus) {
        this.#state = state;
    }

    setState(state: Partial<State>) {
        this.#state = {...this.#state, ...state}
        this.bus.send(Type.State, this.#state)
    }
}