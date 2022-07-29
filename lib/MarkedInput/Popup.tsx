import React, {ReactNode} from "react";
import "./style.css";

interface PopupProps {
    onClose: Function
    children: ReactNode,
    show: boolean
}

export const Popup = (props: PopupProps) => {
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