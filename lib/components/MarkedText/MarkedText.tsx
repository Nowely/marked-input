import {isAnnotated, NodeContext, useStore} from "../../utils";
import {DefaultClass} from "../../constants";
import {useFocus} from "./hooks/useFocus";
import {useSharedRef} from "./hooks/useSharedRef";
import {memo, useMemo} from "react";
import {Piece} from "../Piece";
import {EditableSpan} from "../EditableSpan";
import {useSelector} from "../../utils/useSelector";

export const MarkedText = memo(() => {
    const {bus} = useStore()
    const {className, style, pieces} = useSelector(state => ({
        className: state.className ? DefaultClass + " " + state.className : DefaultClass,
        style: state.style,
        pieces: state.pieces,
    }), true)

    const ref = useSharedRef();
    const events = useMemo(() => bus.events, [])
    useFocus()

    return (
        <div ref={ref} className={className} style={style} {...events}>
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