import {MarkProps, Payload, Store, Trigger, Type} from "../../../types";
import {annotate, createNewSpan, findSpanKey, toString} from "../../../utils";
import {useListener} from "../../../utils/useListener";

//TODO upgrade to full members of react events to external
export function useMutationHandlers(store: Store) {
    const {bus, pieces, options, props} = store

    useListener(Type.Change, (event: Payload) => {
        const {key, value = ""} = event
        pieces.set(key, value)
        props.onChange(toString([...pieces.values()], options))
    }, [pieces], store)

    useListener(Type.Delete, (event: Payload) => {
        const {key} = event
        pieces.delete(key)
        props.onChange(toString([...pieces.values()], options))
    }, [pieces], store)

    useListener(Type.Select, (event: {value: MarkProps, trigger: Trigger}) => {
        const {value, trigger: {option, span, index, source}} = event

        const annotation = annotate(option.markup, value.label, value.value)
        const newSpan = createNewSpan(span, annotation, index, source);
        const key = findSpanKey(span, pieces)

        bus.send(Type.Change, {value: newSpan, key})
    }, [pieces], store)
}