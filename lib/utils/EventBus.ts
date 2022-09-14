import {KeyMapper, EventName, Payload, Type} from "../types";
import {isEventName} from "./index";
import {MarkedInputProps} from "../components/MarkedInput";
import {PredefinedEvents} from "../constants";

export class EventBus {
    readonly #SystemEvents = new Map<Type, Set<EventListener>>()
    readonly #ReactEvents = new Map<EventName, Set<EventListener>>()
    readonly #map: Record<string, any> = {}

    get events() {
        let result: any = {}
        for (let eventName of this.#ReactEvents.keys())
            result[eventName] = (arg: any) => this.send(eventName, arg)
        return result
    }

    static withExternalEventsFrom(props: MarkedInputProps) {
        const set = new Set<EventName>(PredefinedEvents)
        //TODO Object.keys(props).filter(isEventName).forEach(event => set.add(event))
        return () => new EventBus(...set)
    }

    constructor(...initEvents: EventName[]) {
        initEvents.forEach(event => this.#ReactEvents.set(event, new Set()))
    }

    //TODO extract get and set over here
    get<T extends keyof KeyMapper>(key: T): KeyMapper[T] {
        const value = this.#map[key]
        if (value)
            return this.#map[key]
        throw new Error(`The ${key} is not exist!`)
    }

    set<T extends keyof KeyMapper>(key: T, value: KeyMapper[T]) {
        this.#map[key] = value
    }

    //TODO type
    //send(event: Type, arg?: Payload): void
    send(event: Type, arg?: any): void
    send(event: EventName, arg: any): void
    send(event: EventName | Type, arg: any): void {
        this.#getListeners(event).forEach((func) => func(arg));
    }

    //TODO hoc for useEffect
    //listen(event: Type, callback: (e: Payload) => void): void
    listen(event: Type, callback: (e: any) => void): void
    listen(event: EventName, callback: (e: any) => void): void
    listen(event: EventName | Type, callback: (e: any) => void) {
        this.#getListeners(event).add(callback)
        return () => this.#getListeners(event).delete(callback)
    }

    #getListeners(event: EventName | Type) {
        const map: Map<EventName | Type, Set<EventListener>> = isEventName(event) ? this.#ReactEvents : this.#SystemEvents
        if (!map.has(event))
            map.set(event, new Set())
        return map.get(event) as Set<EventListener>
    }
}

export interface ListenerOptions {
    readonly preventDefault?: boolean
}