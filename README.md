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
* Button handling (Left, Right, Delete, Backspace, Esc)
* Overlay with default the suggestion component
* Zero dependency

## Installation

Install the package via npm:

```
npm install rc-marked-input
```

## Examples

A lot of examples can be seen in the [storybook](https://marked-input.vercel.app). You can also try a template on
[CodeSandbox](https://codesandbox.io/s/marked-input-ywnplp?file=/src/App.tsx).

Here is some examples to get you started.

### Two ways to configure

The library allows you to configure the `MarkedInput` component in two ways.

Using the `createMarkedInput`:

```javascript
import {createMarkedInput} from "rc-marked-input";

const Mark = (props) => <mark onClick={_ => alert(props.value)}>{props.label}</mark>

const MarkedInput = createMarkedInput(Mark);

const Marked = () => {
    const [value, setValue] = useState("Hello, clickable marked @[world](Hello! Hello!)!")
    return <MarkedInput value={value} onChange={setValue}/>
}
```

Or using the components:

```javascript
import {MarkedInput, Option} from "rc-marked-input";

const Mark = (props) => <mark onClick={_ => alert(props.value)}>{props.label}</mark>

const Marked = () => {
    const [value, setValue] = useState("Hello, clickable marked @[world](Hello! Hello!)!")
    return <MarkedInput Mark={Mark} value={value} onChange={setValue}/>
}
```

> **Note:** Without options and an overlay passing it will just mark annotations.

## API

### MarkedInput

| Name     | Type                            | Default       | Description                                 |
|----------|---------------------------------|---------------|---------------------------------------------|
| value    | string                          |               | Annotated text with markups for mark        |
| onChange | (value: string) => void         |               | Change event                                |
| Mark     | ComponentType<T = MarkProps>    |               | Component that used for render markups      |
| Overlay  | ComponentType<T = OverlayProps> | `Suggestions` | Component that used for render any overlays |
| readOnly | boolean                         | `undefined`   | Prevents from changing the value            |

### Option

| Name        | Type                        | Default                   | Description                                                                                                                                                                       |
|-------------|-----------------------------|---------------------------|-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| markup      | string                      | `@[__label__](__value__)` | Template string instead of which the mark is rendered<br/>Must contain placeholders: `__label__` and optional `__value__` `__value__`<br/> For example: `@[__label__](__value__)` |
| trigger     | string                      | `"@"`                     | Sequence of symbols for calling the overlay.                                                                                                                                      |
| data        | string[]                    | `[]`                      | Data for a overlay component. By default, it is suggestions.                                                                                                                      |
| initMark    | (props: MarkProps) => T     | `undefined`               | Function to initialize props for mark render. Gets arguments from found markup                                                                                                    |
| initOverlay | (props: OverlayProps) => T1 | `undefined`               | Function to initialize overlay props to your requirements.<br/> If missing then passed overlay props directly.                                                                    |

### Helpers

| Name              | Type                                                                                                                                                                                              | Description                                  |
|-------------------|---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|----------------------------------------------|
| createMarkedInput | (Mark: ComponentType<T>, options: OptionProps<T>[]): ConfiguredMarkedInput<T> <br/> (Mark: ComponentType<T>, Overlay: ComponentType<T1>, options: OptionProps<T, T1>[]): ConfiguredMarkedInput<T> | Create the configured MarkedInput component. |
| annotate          | (markup: Markup, label: string, value?: string) => string                                                                                                                                         | Make annotation from the markup              |
| denote            | (value: string, callback: (mark: Mark) => string, ...markups: Markup[]) => string                                                                                                                 | Transform the annotated text                 |

### Types

```typescript
interface MarkProps {
    label: string
    value?: string
}
```

```typescript
interface OverlayProps {
    /**
     * Style with caret absolute position. Used for placing an overlay.
     */
    style: {
        left: number
        top: number
    }
    /**
     * Used for close overlay.
     */
    onClose: () => void
    /**
     * Used for insert an annotation instead a triggered value.
     */
    onSelect: (value: MarkProps) => void
    /**
     * Trigger details
     */
    trigger: Trigger
}
```

```typescript
type Trigger = {
    /**
     * Found value via a trigger
     */
    value: string,
    /**
     * Triggered value
     */
    source: string,
    /**
     * Piece of text, in which was a trigger
     */
    span: string,
    /**
     * Html element, in which was a trigger
     */
    node: Node,
    /**
     * Start position of a trigger
     */
    index: number,
    /**
     * Trigger's option
     */
    option: OptionType
}
```

## Contributing

If you want to contribute, you are welcome! Create an issue or start a discussion. 