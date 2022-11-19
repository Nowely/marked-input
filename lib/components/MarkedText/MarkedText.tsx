import {isAnnotated, NodeContext, useStore, useValue} from "../../utils";
import {DefaultClass} from "../../constants";
import {useFocus} from "./hooks/useFocus";
import {useSharedRef} from "./hooks/useSharedRef";
import {memo, useMemo} from "react";
import {Piece} from "../Piece";
import {EditableSpan} from "../EditableSpan";

export const MarkedText = memo(() => {
    const {bus, props: {className, style}} = useStore()
    const containerClass = className ? DefaultClass + " " + className : DefaultClass
    const ref = useSharedRef();
    const events = useMemo(() => bus.events, [])
    const pieces = useValue()
    useFocus()

    return (
        <div ref={ref} className={containerClass} style={style} {...events}>
            {pieces.toArray().map((node) =>
                <NodeContext.Provider key={node.key} value={node}>
                    {
                        isAnnotated(node.mark) ? <Piece/> : <EditableSpan/>
                    }
                </NodeContext.Provider>
            )}
        </div>
    )
})

MarkedText.displayName = 'MarkedText'