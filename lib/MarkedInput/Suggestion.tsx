import React, {ReactNode} from "react";
import "./style.css";
import {OverlayProps} from "./types";

export interface SuggestionProps extends OverlayProps{
}

export const Suggestion = (props: SuggestionProps) => {
    /*if (!props.show) {
        return null;
    }*/

    debugger
    return (
        <div className="marked-modal" style={props.style}>
            <div className="content">{props.word}</div>
            <div className="content">{props.word}</div>
        </div>
    );

}