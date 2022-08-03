import React, {ReactNode} from "react";
import "./style.css";
import {OverlayProps} from "./types";

export interface SuggestionProps extends OverlayProps{
    children: ReactNode,
    show: boolean
}

export const Suggestion = (props: SuggestionProps) => {
    /*if (!props.show) {
        return null;
    }*/

    return (
        <div className="marked-modal">
            <div className="content">{props.children}</div>
            <div className="content">{props.children}</div>
        </div>
    );

}