import {ComponentType} from "react";
import {OptionProps} from "../components/Option";
import {assign} from "./index";
import {MarkedInput, MarkedInputProps} from "../components/MarkedInput";
import {ConfiguredMarkedInput, ConfiguredMarkedInputProps, Mark, OverlayProps} from "../types";

/**
 * Create the configured MarkedInput component.
 */
export function createMarkedInput<T = Mark>(Mark: ComponentType<T>, options?: OptionProps<T>[]): ConfiguredMarkedInput<T>;
export function createMarkedInput<T = Mark, T1 = OverlayProps>(Mark: ComponentType<T>, Overlay: ComponentType<T1>, options?: OptionProps<T, T1>[]): ConfiguredMarkedInput<T, T1>;
export function createMarkedInput(
    Mark: ComponentType<any>,
    optionsOrOverlay: ComponentType<any> | OptionProps[] | undefined,
    options?: OptionProps[]
): ConfiguredMarkedInput<any> {
    const predefinedProps = Array.isArray(optionsOrOverlay) ? {
        Mark,
        children: optionsOrOverlay,
    } : {
        Mark,
        Overlay: optionsOrOverlay,
        children: options
    }

    return (props: ConfiguredMarkedInputProps<any>) => {
        const assignedProps: MarkedInputProps<any> = assign({}, props, predefinedProps)
        return MarkedInput(assignedProps)
    }
}