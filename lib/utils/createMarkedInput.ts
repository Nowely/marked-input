import {ComponentType} from "react";
import {OptionProps} from "../components/Option";
import {assign, isFunction} from "./index";
import {MarkedInput, MarkedInputProps} from "../components/MarkedInput";
import {ConfiguredMarkedInput, ConfiguredMarkedInputProps, MarkProps} from "../types";

/**
* Create the configured MarkedInput component.
*/
export function createMarkedInput<T>(Mark: ComponentType<T>, options: OptionProps<T>[]): ConfiguredMarkedInput<T>;
export function createMarkedInput<T extends MarkProps>(Mark: ComponentType<T>, options?: OptionProps<T>[]): ConfiguredMarkedInput<T>;
export function createMarkedInput<T, T1>(Mark: ComponentType<T>, Overlay: ComponentType<T1>, options: OptionProps<T, T1>[]): ConfiguredMarkedInput<T, T1>;
export function createMarkedInput(
    Mark: ComponentType<any>,
    optionsOrOverlay: ComponentType<any> | OptionProps[] | undefined,
    options?: OptionProps[]
): ConfiguredMarkedInput<any> {
    const predefinedProps = isFunction(optionsOrOverlay)  ? {
        Mark,
        Overlay: optionsOrOverlay,
        children: options
    } : {
        Mark,
        children: optionsOrOverlay,
    }

    return (props: ConfiguredMarkedInputProps<any>) => {
        const assignedProps: MarkedInputProps<any> = assign({}, props, predefinedProps)
        return MarkedInput(assignedProps)
    }
}