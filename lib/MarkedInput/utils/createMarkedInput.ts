import {Button} from "../../../stories/assets/Button";

//Sketch of headless
const MarkedInput1 = createMarkedInput(Button, Button, [{
    markup: "asd",
    trigger: "asd",
    initializer: "sd"
}, {
    markup: "asd",
    trigger: "asd",
    initializer: "sd"
}
]);

//TODO the alternative way to create component
function createMarkedInput(Mark: any, Overlay: any, options: any[]): any;
function createMarkedInput(Mark: any, options: any[]): any;
function createMarkedInput(Mark: any, optionsOrOverlay: any): any {
    return 1
}