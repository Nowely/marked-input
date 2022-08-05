import {ComponentType} from "react";
import {Suggestion} from "../Suggestion";
import {OptionProps} from "../../Option";

const MarkedInput1 = createMarkedInput(Suggestion, Suggestion, [{
    markup: "@[__value__](primary:__id__)",
    trigger: "@",
    initializer: (value, id) => ({} as any)
}, {
    markup: "@[__value__](secondary:__id__)",
    trigger: "/",
    initializer: (value, id) => ({} as any)
}]);

const MarkedInput2 = createMarkedInput(Suggestion, [{
    markup: "@[__value__](primary:__id__)",
    trigger: "@",
    initializer: (value, id) => ({} as any)
}, {
    markup: "@[__value__](secondary:__id__)",
    trigger: "/",
    initializer: (value, id) => ({} as any)
}]);

function createMarkedInput<T>(Mark: ComponentType<T>, options?: OptionProps<T>[]): any;
function createMarkedInput<T, T1>(Mark: ComponentType<T>, Overlay: ComponentType<T1>, options?:  OptionProps<T, T1>[]): any;
function createMarkedInput(Mark: ComponentType<any>, optionsOrOverlay?: ComponentType<any> | OptionProps[]): any {
    return 1
}