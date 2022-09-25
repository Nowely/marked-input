import {MarkedInputProps} from "../../MarkedInput";
import {ExtractedOverlayProps, ExtractedSpanProps, ExtractedTextProps} from "../../../types";
import {useMemo} from "react";
import {Suggestions} from "../../Suggestions";

export function useExtractedProps(props: MarkedInputProps<any, any>) {
    const span = useSpanProps(props)
    const text = useTextProps(props)
    const overlay = useOverlayProps(props)



    return {span, text, overlay}
}

function useTextProps(props: MarkedInputProps<any, any>): ExtractedTextProps {
    const {Mark, style, className} = props
    return useMemo(() => ({Mark, style, className}), [Mark, style, className])
}

export function useSpanProps(props: MarkedInputProps<any, any>): ExtractedSpanProps {
    const {readOnly, spanStyle, spanClassName} = props
    return useMemo(() => ({readOnly, spanStyle, spanClassName}), [readOnly, spanStyle, spanClassName])
}

function useOverlayProps(props: MarkedInputProps<any, any>): ExtractedOverlayProps {
    const {Overlay = Suggestions} = props
    return useMemo(() => ({Overlay}), [Overlay])
}
