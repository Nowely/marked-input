export class EventBus {
    readonly #listeners: Record<string, EventListener[]> = {}

    get length () {
        return Object.keys(this.#listeners).length
    }
    get events() {
        /*for (let a of Object.entries(this.#listeners)) {

        }*/
        return Object.entries(this.#listeners).reduce((prev, [key, value]) => {
            prev[key] = this.notify1(key)
            return prev
        }, {} as Record<string, Function>)
    }

    notify1(eventName: string) {
        return (arg: any) => this.notify(eventName, arg)
    }

    notify(eventName: string, arg: any) {
        const notified = this.#listeners[eventName]
        if (!notified) return;
        notified.forEach((func) => func(arg));
    }

    listen(eventName: string, callback: (e: any) => void) {
        const listener: EventListener = callback

        this.#listeners[eventName] ??= [];
        this.#listeners[eventName].push(listener);

        return () => {
            this.#listeners[eventName] = this.#listeners[eventName]
                .filter((subscriber) => subscriber !== listener);

            if (this.#listeners[eventName].length === 0) delete this.#listeners[eventName];
        };
    }
}

export interface ListenerOptions {
    readonly preventDefault?: boolean
}