# [Marked input](https://marked-input.vercel.app) &middot; [![npm version](https://img.shields.io/npm/v/rc-marked-input.svg?style=flat)](https://www.npmjs.com/package/rc-marked-input) [![Storybook](https://gw.alipayobjects.com/mdn/ob_info/afts/img/A*CQXNTZfK1vwAAAAAAAAAAABjAQAAAQ/original)](https://marked-input.vercel.app)

<img width="521" alt="image" src="https://user-images.githubusercontent.com/37639183/182974441-49e4b247-449a-47ba-a090-2cb3aab7ce44.png">

A React component that lets you combine editable text with any component using annotated text.

## Feature

* Powerful annotation tool
* TypeScript
* Two ways to configure
* Support any components
* Props customization
* Utils for annotate and denote text
* Button handling (Left, Right, Delete, Backspace)
* Overlay with default the suggestion component

## Installation

Install the package via npm:

```
npm install rc-marked-input
```

## Examples

A lot of examples can be seen in the [storybook](https://marked-input.vercel.app). Here is some examples to get you started.

### Two ways to configure

The library allows you to configure the `MarkedInput` component in two ways. 

Using the `createMarkedInput`:

```javascript
import {createMarkedInput} from "rc-marked-input";

const Bolder = (props) => <b>{props.label}</b>

const MarkedInput = createMarkedInput(Bolder);

const App = () => {
    const [value, setValue] = useState("Hello, bold @[world](0)!")
    return <MarkedInput value={value} onChange={setValue}/>
}
```

Or using the components:

```javascript
import {MarkedInput, Option} from "rc-marked-input";

const Bolder = (props) => <b>{props.label}</b>

const App = () => {
    const [value, setValue] = useState("Hello, bold @[world](0)!")
    return <MarkedInput Mark={Bolder} value={value} onChange={setValue}/>
}
```

Without options passing it will just highlight annotations.  

## API

Props of the `MarkedInput` component:

| Name     | Type                    | Default    | Description                                 |
|----------|-------------------------|------------|---------------------------------------------|
| value    | string                  |            | Annotated text with markups for mark        |
| onChange | (value: string) => void |            | Change event                                |
| Mark     | ComponentType<T>        |            | Component that used for render markups      |
| Overlay  | ComponentType<T1>       | Suggestion | Component that used for render any overlays |
| readOnly | boolean                 | undefined  | Prevents from changing the value            |

Props of the `Option` component:

| Name        | Type                        | Default                   | Description                                                                                                                |
|-------------|-----------------------------|---------------------------|----------------------------------------------------------------------------------------------------------------------------|
| markup      | string                      | `@[__label__](__value__)` | Template string instead of which the mark is rendered<br/>Must contain placeholders: `__label__` and optional `__value__` `__value__`<br/> For example: `@[__label__](__value__)` |
| trigger     | string                      | "@"                       | Sequence of symbols for calling the overlay.                                                                               |
| data        | string[]                    | []                        | Data for a overlay component. By default, it is suggestions.                                                               |
| initOverlay | (props: OverlayProps) => T1 | undefined                 | Function to initialize overlay props to your requirements.<br/> If missing then passed overlay props directly.             |
| initMark    | (props: MarkProps) => T     | undefined                 | Function to initialize props for mark render. Gets arguments from found markup                                             |

Helpers:

| Name              | Type                                                                                                                                                                                              | Description                                  |
|-------------------|---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|----------------------------------------------|
| createMarkedInput | (Mark: ComponentType<T>, options: OptionProps<T>[]): ConfiguredMarkedInput<T> <br/> (Mark: ComponentType<T>, Overlay: ComponentType<T1>, options: OptionProps<T, T1>[]): ConfiguredMarkedInput<T> | Create the configured MarkedInput component. |
| annotate          | (markup: Markup, label: string, value?: string) => string                                                                                                                                         | Make annotation from the markup              |
| denote            | (value: string, callback: (mark: Mark) => string, ...markups: Markup[]) => string                                                                                                                 | Transform the annotated text                 |
