import {createMarkedInput} from "rc-marked-input";
import {UserList} from "./UserList";
import {Mention} from "./Mention";

export const MaterialMentions = createMarkedInput(Mention, UserList, [{
    markup: "@[__label__]",
}])