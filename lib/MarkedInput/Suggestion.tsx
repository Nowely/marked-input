import React, {ReactNode} from "react";
import "./style.css";

export interface SuggestionProps {
    onClose: Function
    children: ReactNode,
    show: boolean
}

export const Suggestion = (props: SuggestionProps) => {
    const onClose = (e: any) => {
        props.onClose && props.onClose(e);
    };

    if (!props.show) {
        return null;
    }

    return (
        <div className="marked-modal">
            <div className="content">{props.children}</div>
            <div className="content">{props.children}</div>
        </div>
    );

}