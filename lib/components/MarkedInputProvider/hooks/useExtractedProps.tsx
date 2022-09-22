import {MarkedInputProps} from "../../MarkedInput";
import {ExtractedOverlayProps, ExtractedSpanProps, ExtractedTextProps} from "../../../types";
import {useMemo} from "react";

export function useExtractedProps(props: MarkedInputProps<any, any>) {
    const spanProps = useSpanProps(props)
    const textProps = useTextProps(props)
    const overlayProps = useOverlayProps(props)

    return {spanProps, textProps, overlayProps}
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
    const {Overlay} = props
    return useMemo(() => ({Overlay}), [Overlay])
}
