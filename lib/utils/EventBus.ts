import {DivEvents, EventName, Listener, Type} from "../types";
import {isEventName} from "./index";
import {PredefinedEvents} from "../constants";

export class EventBus {
    readonly #SystemEvents = new Map<Type, Set<Listener>>()
    readonly #ReactEvents = new Map<EventName, Set<Listener>>()
    readonly #map: Record<string, any> = {}

    get events() {
        let result: any = {}
        for (let eventName of this.#ReactEvents.keys())
            result[eventName] = (arg: any) => this.send(eventName, arg)
        return result
    }

    static initWithExternalEvents(events?: DivEvents) {
        return () => {
            const set = new Set<EventName>(PredefinedEvents)
            events && Object.keys(events).filter(isEventName).forEach(event => set.add(event))
            return new EventBus(...set);
        }
    }

    constructor(...initEvents: EventName[]) {
        initEvents.forEach(event => this.#ReactEvents.set(event, new Set()))
    }

    //TODO type
    //send(event: Type, arg?: Payload): void
    send(event: Type, arg?: any): void
    send(event: EventName, arg: any): void
    send(event: EventName | Type, arg: any): void {
        this.#getListeners(event).forEach((func) => func(arg));
    }

    listen(event: EventName | Type, listener: Listener): () => void {
        this.#getListeners(event).add(listener)
        return () => this.#getListeners(event).delete(listener)
    }

    #getListeners(event: EventName | Type) {
        const map: Map<EventName | Type, Set<Listener>> = isEventName(event) ? this.#ReactEvents : this.#SystemEvents
        if (!map.has(event))
            map.set(event, new Set())
        return map.get(event) as Set<Listener>
    }
}

export interface ListenerOptions {
    readonly preventDefault?: boolean
}