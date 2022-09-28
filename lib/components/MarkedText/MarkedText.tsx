import {isObject, useStore, usePieces, RegisterProvider} from "../../utils";
import {EditableSpan} from "../EditableSpan";
import {DefaultClass} from "../../constants";
import {useFocus} from "./hooks/useFocus";
import {useSharedRef} from "./hooks/useSharedRef";
import {memo, ReactNode, useEffect, useMemo, useReducer} from "react";
import {useListener} from "../../utils/useListener";
import {Type} from "../../types";
import {useMark} from "../../utils/useMark";

export const MarkedText = memo(() => {
    const {bus, props} = useStore()
    const {className, style} = props.text //text container

    const className1 = className ? DefaultClass + " " + className : DefaultClass
    const ref = useSharedRef();
    const events = useMemo(() => bus.events, [bus])

    return (
        <div ref={ref} className={className1} style={style} {...events}>
            <Pieces/>
        </div>
    )
})

function Pieces() {
    const {options, props} = useStore()
    //Remove groupping?
    const {Mark} = props.text
    const pieces = usePieces()
    const {register} = useFocus()


    return <>
        <RegisterProvider value={register}>
        {[...pieces].map(([key, piece]) => {
            if (!isObject(piece))
                return <EditableSpan
                    //ref={register(key)}
                    key={key} label={piece}
                    useMark={useMark.bind(null, key, {label: piece})}
                />

            const markProps = options[piece.childIndex].initMark?.(piece) ?? piece
            return <Mark key={key} tabIndex={-1} {...markProps}/>
        })}
        </RegisterProvider>
    </>
}