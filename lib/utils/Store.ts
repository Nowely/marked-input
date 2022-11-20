import {State, Type} from "../types";
import {EventBus} from "./EventBus";
import {MarkedInputProps} from "../components/MarkedInput";
import {assign, extractOptions} from "./index";
import {EmptyList} from "../constants";

export class Store {

    constructor(
        //TODO state getter
        public state: State,
        readonly bus: EventBus
    ) {
    }

    static create(props: MarkedInputProps) {
        const state = {} as State
        const {children, ...other} = props

        state.options = extractOptions(children)
        state.pieces = EmptyList
        assign(state, other)

        const bus = EventBus.initWithExternalEvents(props.onContainer)()

        return new Store(state, bus)
    }

    setState(state: Partial<State>) {
        this.state = {...this.state, ...state}
        this.bus.send(Type.State, this.state)
    }
}