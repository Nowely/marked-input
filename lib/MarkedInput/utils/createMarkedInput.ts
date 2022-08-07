import {ComponentType} from "react";
import {OptionProps} from "../../Option";
import {assign, isFunction} from "./index";
import {MarkedInput, MarkedInputProps} from "../MarkedInput";

export function createMarkedInput<T>(Mark: ComponentType<T>, options: OptionProps<T>[]): any;
export function createMarkedInput<T, T1>(Mark: ComponentType<T>, Overlay: ComponentType<T1>, options: OptionProps<T, T1>[]): any;
export function createMarkedInput(
    Mark: ComponentType<any>,
    optionsOrOverlay?: ComponentType<any> | OptionProps[],
    options?: OptionProps[]
): ComponentType<any> {
    const predefinedProps = isFunction(optionsOrOverlay) ? {
        Mark,
        Overlay: optionsOrOverlay,
        children: options
    } : {
        Mark,
        children: optionsOrOverlay,
    }

    return (props: MarkedInputProps<any, any>) => {
        const assignedProps = assign({}, props, predefinedProps)
        return MarkedInput(assignedProps)
    }
}