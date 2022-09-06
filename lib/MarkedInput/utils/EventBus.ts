import {EventName, Payload, Type} from "../types";
import {isEventName} from "./index";
import {MarkedInputProps} from "../MarkedInput";
import {PredefinedEvents} from "../constants";

export class EventBus {
    readonly #listeners: Record<string, EventListener[]> = {}

    get length() {
        return Object.keys(this.#listeners).length
    }

    get events() {
        return Object.keys(this.#listeners)
            .filter(isEventName)
            .reduce((prev, key) => {
                prev[key] = (arg: any) => this.send(key, arg)
                return prev
            }, {} as Record<string, Function>)
    }

    static withExternalEventsFrom(props: MarkedInputProps){
        const set = new Set<string>(PredefinedEvents)
        //TODO Object.keys(props).filter(isEventName).forEach(event => set.add(event))
        return () => new EventBus(...set)
    }

    constructor(...initEvents: string[]) {
        initEvents.forEach(event => this.#listeners[event] ??= [])
    }

    send(event: Type, arg: Payload): void
    send(event: EventName, arg: any): void
    send(event: string | number, arg: any): void {
        const notified = this.#listeners[event]
        if (!notified) return;
        notified.forEach((func) => func(arg));
    }

    listen(event: Type, callback: (e: Payload) => void): void
    listen(event: EventName, callback: (e: any) => void): void
    listen(event: string | number, callback: (e: any) => void) {
        const listener: EventListener = callback

        this.#listeners[event] ??= []
        this.#listeners[event].push(listener)

        return () => {
            this.#listeners[event] = this.#listeners[event]
                .filter((subscriber) => subscriber !== listener);

            //if (this.#listeners[event].length === 0) delete this.#listeners[event];
        };
    }
}

export interface ListenerOptions {
    readonly preventDefault?: boolean
}