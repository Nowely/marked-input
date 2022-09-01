import {render} from "@testing-library/react";
import { MarkedInput } from "lib";
import {useState} from "react";

const Mark = (props: any) => <mark onClick={_ => alert(props.value)}>{props.label}</mark>

const App = () => {
    const [value, setValue] = useState("Hello!")

    return <MarkedInput Mark={Mark} value={value} onChange={setValue}/>
}

describe(`Component: MarkedInput`, () => {
    it('should ', () => {
        render(<App/>)
    });
})