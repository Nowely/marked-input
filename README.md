# [Marked Input](https://marked-input.vercel.app) &middot; [![npm version](https://img.shields.io/npm/v/rc-marked-input.svg?style=flat)](https://www.npmjs.com/package/rc-marked-input) [![Storybook](https://gw.alipayobjects.com/mdn/ob_info/afts/img/A*CQXNTZfK1vwAAAAAAAAAAABjAQAAAQ/original)](https://marked-input.vercel.app)

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
[CodeSandbox](https://codesandbox.io/s/configured-marked-input-dnvuv9?file=/src/App.tsx).

Here is some examples to get you started.

### Static marks &middot; [![sandbox](https://user-images.githubusercontent.com/37639183/199624889-6129e303-6b44-4b82-859d-ada79942842c.svg)](https://codesandbox.io/s/marked-input-ywnplp?file=/src/App.tsx)

```javascript
import {MarkedInput} from "rc-marked-input";

const Mark = (props) => <mark onClick={_ => alert(props.value)}>{props.label}</mark>

const Marked = () => {
    const [value, setValue] = useState("Hello, clickable marked @[world](Hello! Hello!)!")
    return <MarkedInput Mark={Mark} value={value} onChange={setValue}/>
}
```

#### Advanced

The library allows you to configure the `MarkedInput` component in two ways.

Let's declare markups and suggestions data:

```tsx
const Data = ["First", "Second", "Third", "Fourth", "Fifth", "Sixth"]
const AnotherData = ["Seventh", "Eight", "Ninth"]
const Primary = "@[__label__](primary:__value__)"
const Default = "@[__label__](default)"
```

Using the components

```tsx
import {MarkedInput, Option} from "rc-marked-input";

export const App = () => {
    const [value, setValue] = useState(
        "Enter the '@' for creating @[Primary Mark](primary:Hello!) or '/' for @[Default mark](default)!"
    )

    return (
        <MarkedInput Mark={Button} value={value} onChange={setValue}>
            <Option
                markup={Primary}
                data={Data}
                initMark={({label, value}) => ({label, primary: true, onClick: () => alert(value)})}
            />
            <Option
                markup={Default}
                trigger="/"
                data={AnotherData}
            />
        </MarkedInput>
    )
}
```

Using the `createMarkedInput`:

```tsx
import {createMarkedInput} from "rc-marked-input";

const ConfiguredMarkedInput = createMarkedInput(Button, [{
    markup: Primary,
    data: Data,
    initMark: ({label, value}) => ({label, primary: true, onClick: () => alert(value)})
}, {
    trigger: '/',
    markup: Default,
    data: AnotherData
}])

const App = () => {
    const [value, setValue] = useState(
        "Enter the '@' for creating @[Primary Mark](primary:Hello!) or '/' for @[Default mark](default)!"
    )
    return <ConfiguredMarkedInput value={value} onChange={setValue}/>
}
```

### Dynamic mark

Marks can be dynamic: editable, removable, etc. via the `useMark` hook helper.

#### Editable

```tsx
import {MarkedInput, useMark} from "rc-marked-input";

const Mark = () => {
    const {label, onChange} = useMark()

    const handleInput = (e) =>
        onChange({label: e.currentTarget.textContent ?? "", value: " "}, {silent: true})

    return <mark contentEditable onInput={handleInput} children={label}/>
}

export const Dynamic = () => {
    const [value, setValue] = useState("Hello, dynamical mark @[world]( )!")
    return <MarkedInput Mark={Mark} value={value} onChange={setValue}/>
}
```

> **Note:** The silent option used to prevent re-rendering itself.

#### Removable

```tsx
const RemovableMark = () => {
    const {label, onRemove} = useMark()
    return <mark onClick={onRemove} children={label}/>
}

export const Removable = () => {
    const [value, setValue] = useState("I @[contain]( ) @[removable]( ) by click @[marks]( )!")
    return <MarkedInput Mark={RemovableMark} value={value} onChange={setValue}/>
}
```

#### Focusable

If passed the `reg` prop of the `useMark` hook in ref of a component then it component can be focused by key operations.

### Overlay

A default overlay is the suggestion component, but it can be easily replaced for any other.

#### Suggestions

```tsx
export const DefaultOverlay = () => {
    const [value, setValue] = useState("Hello, default - suggestion overlay by trigger @!")
    return <MarkedInput Mark={Mark} value={value} onChange={setValue}>
        <Option data={['First', 'Second', 'Third']}/>
    </MarkedInput>
}
```

#### Custom overlay

```tsx
const Overlay = () => <h1>I am the overlay</h1>
export const CustomOverlay = () => {
    const [value, setValue] = useState("Hello, custom overlay by trigger @!")
    return <MarkedInput Mark={Mark} Overlay={Overlay} value={value} onChange={setValue}/>
}
```

#### Custom trigger

```tsx
export const CustomTrigger = () => {
    const [value, setValue] = useState("Hello, custom overlay by trigger /!")
    return <MarkedInput Mark={Mark} Overlay={Overlay} value={value} onChange={setValue}>
        <Option trigger='/'/>
    </MarkedInput>
}
```

#### Positioned

The `OverlayProps` has a left and right absolute coordinate of a current caret position in the `style` prop.

```tsx
const Tooltip = (props: OverlayProps) => <div style={{position: 'absolute', ...props.style}}>I am the overlay</div>
export const PositionedOverlay = () => {
    const [value, setValue] = useState("Hello, positioned overlay by trigger @!")
    return <MarkedInput Mark={Mark} Overlay={Tooltip} value={value} onChange={setValue}/>
}
```

#### Selectable

The `OverlayProps` provide some methods like `onSelect` for creating a new annotation.

```tsx
const List = (props: OverlayProps) => <ul>
    <li onClick={() => props.onSelect({label: 'First'})}>Clickable First</li>
    <li onClick={() => props.onSelect({label: 'Second'})}>Clickable Second</li>
</ul>

export const SelectableOverlay = () => {
    const [value, setValue] = useState("Hello, suggest overlay by trigger @!")
    return <MarkedInput Mark={Mark} Overlay={List} value={value} onChange={setValue}/>
}
```

> **Note:** Recommend to use the `React.forwardRef` for an overlay component. It used to detect outside click.

### Event handlers

The `onContainer` prop allows to forward any of div events to a container of text.

```tsx
<ConfiguredMarkedInput
    value={value} 
    onChange={setValue}
    onContainer={{
        onClick: (e) => {
            console.log('onCLick')
        },
        onInput: (e) => {
            console.log('onInput')
        },
        onBlur: (e) => {
            console.log('onBlur')
        },
        onFocus: (e) => {
            console.log('onFocus')
        },
        onKeyDown: (e) => {
            console.log('onKeyDown')
        },
    }}
/>
```

### Overall view

```tsx
<MarkedInput Mark={Mark} Overlay={Overlay} value={value} onChange={setValue}>
    <Option
        trigger='@'
        markup='@[__label__](__value__)'
        data={Data}
        initMark={getCustomMarkProps}
        initOverlay={getCustomOverlayProps}
    />
    <Option
        trigger='/'
        markup='@(__label__)[__value__]'
        data={AnotherData}
        initMark={getAnotherCustomMarkProps}
        initOverlay={getAnotherCustomOverlayProps}
    />
</MarkedInput>
```

Or

```tsx
const MarkedInput = createMarkedInput(Mark, Overlay, [{
    trigger: '@',
    markup: '@[__label__](__value__)',
    data: Data,
    initMark: getCustomMarkProps,
    initOverlay: getCustomOverlayProps,
}, {
    trigger: '/',
    markup: '@(__label__)[__value__]',
    data: AnotherData,
    initMark: getAnotherCustomMarkProps,
    initOverlay: getAnotherCustomOverlayProps,
}])

const App = () => <MarkedInput value={value} onChange={setValue}/>
```

## API

### MarkedInput

| Name        | Type                            | Default       | Description                                |
|-------------|---------------------------------|---------------|--------------------------------------------|
| value       | string                          |               | Annotated text with markups for mark       |
| onChange    | (value: string) => void         |               | Change event                               |
| Mark        | ComponentType<T = MarkProps>    |               | Component that used for render markups     |
| Overlay     | ComponentType<T = OverlayProps> | `Suggestions` | Component that is rendered by trigger      |
| readOnly    | boolean                         | `undefined`   | Prevents from changing the value           |
| onContainer | DivEvents                       | `undefined`   | Forward any div events to a text container |

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
| useMark           | () => DynamicMark                                                                                                                                                                                 | Allow to use dynamic mark                    |

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
