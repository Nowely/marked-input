# [Marked Input](https://marked-input.vercel.app) &middot; [![npm version](https://img.shields.io/npm/v/rc-marked-input.svg?style=flat)](https://www.npmjs.com/package/rc-marked-input) [![min zipped size](https://img.shields.io/bundlephobia/minzip/rc-marked-input)](https://bundlephobia.com/package/rc-marked-input) [![Storybook](https://gw.alipayobjects.com/mdn/ob_info/afts/img/A*CQXNTZfK1vwAAAAAAAAAAABjAQAAAQ/original)](https://marked-input.vercel.app)

<img width="521" alt="image" src="https://user-images.githubusercontent.com/37639183/182974441-49e4b247-449a-47ba-a090-2cb3aab7ce44.png">

A React component that lets you combine editable text with any component using annotated text.

## Feature

- Powerful annotations tool: add, edit, remove, visualize
- Nested marks support
- TypeScript
- Support for any components
- Flexible and customizable
- Two ways to configure
- Helpers for processing text
- Hooks for advanced components
- Button handling (Left, Right, Delete, Backspace, Esc)
- Overlay with the suggestions component by default
- Zero dependencies
- Cross selection

## Installation

You can install the package via npm:

```
npm install rc-marked-input
```

## Usage

There are many examples available in the [Storybook](https://marked-input.vercel.app). You can also try a template
on [CodeSandbox](https://codesandbox.io/s/configured-marked-input-305v6m).

Here are a few examples to get you started:

### Static marks &middot; [![sandbox](https://user-images.githubusercontent.com/37639183/199624889-6129e303-6b44-4b82-859d-ada79942842c.svg)](https://codesandbox.io/s/marked-input-x5wx6k?file=/src/App.tsx)

```javascript
import {MarkedInput} from 'rc-marked-input'

const Mark = props => <mark onClick={_ => alert(props.meta)}>{props.value}</mark>

const Marked = () => {
    const [value, setValue] = useState('Hello, clickable marked @[world](Hello! Hello!)!')
    return <MarkedInput Mark={Mark} value={value} onChange={setValue} />
}
```

#### Configured &middot; [![sandbox](https://user-images.githubusercontent.com/37639183/199624889-6129e303-6b44-4b82-859d-ada79942842c.svg)](https://codesandbox.io/s/configured-marked-input-305v6m)

The library allows you to configure the `MarkedInput` component in two ways.

Let's declare markups and suggestions data:

```tsx
const Data = ['First', 'Second', 'Third', 'Fourth', 'Fifth', 'Sixth']
const AnotherData = ['Seventh', 'Eight', 'Ninth']
const Primary = '@[__value__](primary:__meta__)'
const Default = '@[__value__](default)'
```

Using the components

```tsx
import {MarkedInput} from 'rc-marked-input'

export const App = () => {
    const [value, setValue] = useState(
        "Enter the '@' for creating @[Primary Mark](primary:Hello!) or '/' for @[Default mark](default)!"
    )

    return (
        <MarkedInput
            Mark={Button}
            value={value}
            onChange={setValue}
            options={[
                {
                    markup: Primary,
                    data: Data,
                    initMark: ({value, meta}) => ({label: value, primary: true, onClick: () => alert(meta)}),
                },
                {
                    overlayTrigger: '/',
                    markup: Default,
                    data: AnotherData,
                },
            ]}
        />
    )
}
```

Using the `createMarkedInput`:

```tsx
import {createMarkedInput} from 'rc-marked-input'

const ConfiguredMarkedInput = createMarkedInput({
    Mark: Button,
    options: [
        {
            markup: Primary,
            data: ['First', 'Second', 'Third', 'Fourth', 'Fifth', 'Sixth'],
            initMark: ({value, meta}) => ({label: value, primary: true, onClick: () => alert(meta)}),
        },
        {
            markup: Default,
            overlayTrigger: '/',
            data: ['Seventh', 'Eight', 'Ninth'],
            initMark: ({value}) => ({label: value}),
        },
    ],
})

const App = () => {
    const [value, setValue] = useState(
        "Enter the '@' for creating @[Primary Mark](primary:Hello!) or '/' for @[Default mark](default)!"
    )
    return <ConfiguredMarkedInput value={value} onChange={setValue} />
}
```

### Dynamic mark &middot; [![sandbox](https://user-images.githubusercontent.com/37639183/199624889-6129e303-6b44-4b82-859d-ada79942842c.svg)](https://codesandbox.io/s/dynamic-mark-w2nj82?file=/src/App.js)

Marks can be dynamic: editable, removable, etc. via the `useMark` hook helper.

#### Editable

```tsx
import {MarkedInput, useMark} from 'rc-marked-input'

const Mark = () => {
    const {label, change} = useMark()

    const handleInput = e => change({label: e.currentTarget.textContent ?? '', value: ' '}, {silent: true})

    return <mark contentEditable onInput={handleInput} children={label} />
}

export const Dynamic = () => {
    const [value, setValue] = useState('Hello, dynamical mark @[world]( )!')
    return <MarkedInput Mark={Mark} value={value} onChange={setValue} />
}
```

> **Note:** The silent option used to prevent re-rendering itself.

#### Removable

```tsx
const RemovableMark = () => {
    const {label, remove} = useMark()
    return <mark onClick={remove} children={label} />
}

export const Removable = () => {
    const [value, setValue] = useState('I @[contain]( ) @[removable]( ) by click @[marks]( )!')
    return <MarkedInput Mark={RemovableMark} value={value} onChange={setValue} />
}
```

#### Focusable

If passed the `ref` prop of the `useMark` hook in ref of a component then it component can be focused by key operations.

### Nested Marks

Marked Input supports nested marks, allowing you to create rich, hierarchical text structures. Nested marks enable complex formatting scenarios like markdown-style text, HTML-like tags, and multi-level annotations.

#### Enabling Nested Marks

To enable nesting, use the `__nested__` placeholder in your markup pattern instead of `__value__`:

```tsx
// ✅ Supports nesting
const NestedMarkup = '@[__nested__]'

// ❌ Does not support nesting (plain text only)
const FlatMarkup = '@[__value__]'
```

**Key Differences:**

- `__value__` - Content is treated as plain text, nested patterns are ignored
- `__nested__` - Content supports nested structures, nested patterns are parsed

#### Simple Nesting Example

```tsx
import {MarkedInput} from 'rc-marked-input'

const NestedMark = ({children, style}: {value?: string; children?: ReactNode; style?: React.CSSProperties}) => (
    <span style={style}>{children}</span>
)

const App = () => {
    const [value, setValue] = useState('This is **bold with *italic* inside**')

    return (
        <MarkedInput
            Mark={NestedMark}
            value={value}
            onChange={setValue}
            options={[
                {
                    markup: '**__nested__**',
                    initMark: ({value, children}) => ({
                        value,
                        children,
                        style: {fontWeight: 'bold'},
                    }),
                },
                {
                    markup: '*__nested__*',
                    initMark: ({value, children}) => ({
                        value,
                        children,
                        style: {fontStyle: 'italic'},
                    }),
                },
            ]}
        />
    )
}
```

#### HTML-like Tags with Two Values

ParserV2 supports **two values** patterns where a markup contains two `__value__` placeholders that must match. This is perfect for HTML-like tags where opening and closing tags should be identical.

```tsx
const HtmlLikeMark = ({children, value, nested}: {value?: string; children?: ReactNode; nested?: string}) => {
    // Use value as HTML element name (e.g., "div", "span", "mark")
    const Tag = value! as React.ElementType
    return <Tag>{children || nested}</Tag>
}

const App = () => {
    const [value, setValue] = useState(
        '<div>This is a div with <mark>a mark inside</mark> and <b>bold text with <del>nested del</del></b></div>'
    )

    return (
        <MarkedInput
            Mark={HtmlLikeMark}
            value={value}
            onChange={setValue}
            options={[
                // Two values pattern: both __value__ must be identical
                {markup: '<__value__>__nested__</__value__>'},
            ]}
        />
    )
}
```

**Two Values Pattern Rules:**

- Contains exactly two `__value__` placeholders
- Both values must be identical (e.g., `<div>` and `</div>`)
- If values don't match, the pattern won't be recognized
- Perfect for HTML/XML-like structures where tags must match

**Examples of valid two values patterns:**

- `<__value__>__nested__</__value__>` - HTML tags
- `[__value__]__nested__[/__value__]` - BBCode-style tags
- `{{__value__}}__nested__{{/__value__}}` - Template tags

### Overlay

A default overlay is the suggestion component, but it can be easily replaced for any other.

#### Suggestions

```tsx
export const DefaultOverlay = () => {
    const [value, setValue] = useState('Hello, default - suggestion overlay by trigger @!')
    return (
        <MarkedInput Mark={Mark} value={value} onChange={setValue} options={[{data: ['First', 'Second', 'Third']}]} />
    )
}
```

#### Custom overlay &middot; [![sandbox](https://user-images.githubusercontent.com/37639183/199624889-6129e303-6b44-4b82-859d-ada79942842c.svg)](https://codesandbox.io/s/custom-overlay-1m5ctx?file=/src/App.tsx)

```tsx
const Overlay = () => <h1>I am the overlay</h1>
export const CustomOverlay = () => {
    const [value, setValue] = useState('Hello, custom overlay by trigger @!')
    return <MarkedInput Mark={Mark} Overlay={Overlay} value={value} onChange={setValue} />
}
```

#### Custom trigger

```tsx
export const CustomTrigger = () => {
    const [value, setValue] = useState('Hello, custom overlay by trigger /!')
    return (
        <MarkedInput
            Mark={() => null}
            Overlay={Overlay}
            value={value}
            onChange={setValue}
            options={[{overlayTrigger: '/'}]}
        />
    )
}
```

#### Positioned

The `useOverlay` has a left and right absolute coordinate of a current caret position in the `style` prop.

```tsx
const Tooltip = () => {
    const {style} = useOverlay()
    return <div style={{position: 'absolute', ...style}}>I am the overlay</div>
}
export const PositionedOverlay = () => {
    const [value, setValue] = useState('Hello, positioned overlay by trigger @!')
    return <MarkedInput Mark={Mark} Overlay={Tooltip} value={value} onChange={setValue} />
}
```

#### Selectable

The `useOverlay` hook provide some methods like `select` for creating a new annotation.

```tsx
const List = () => {
    const {select} = useOverlay()
    return (
        <ul>
            <li onClick={() => select({label: 'First'})}>Clickable First</li>
            <li onClick={() => select({label: 'Second'})}>Clickable Second</li>
        </ul>
    )
}

export const SelectableOverlay = () => {
    const [value, setValue] = useState('Hello, suggest overlay by trigger @!')
    return <MarkedInput Mark={Mark} Overlay={List} value={value} onChange={setValue} />
}
```

> **Note:** Recommend to pass the `ref` for an overlay component. It used to detect outside click.

### Slots

The `slots` and `slotProps` props allow you to customize internal components with type safety and flexibility.

#### Available Slots

- **container** - Root div wrapper for the entire component
- **span** - Text span elements for rendering text tokens

#### Basic Usage

```tsx
<MarkedInput
    Mark={Mark}
    value={value}
    onChange={setValue}
    slotProps={{
        container: {
            onKeyDown: e => console.log('onKeyDown'),
            onFocus: e => console.log('onFocus'),
            style: {border: '1px solid #ccc', padding: '8px'},
        },
        span: {
            className: 'custom-text-span',
            style: {fontSize: '14px'},
        },
    }}
/>
```

#### Custom Components

You can also replace the default components entirely using the `slots` prop:

```tsx
const CustomContainer = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>((props, ref) => (
    <div {...props} ref={ref} style={{...props.style, border: '2px solid blue'}} />
))

const CustomSpan = forwardRef<HTMLSpanElement, HTMLAttributes<HTMLSpanElement>>((props, ref) => (
    <span {...props} ref={ref} style={{...props.style, fontWeight: 'bold'}} />
))

<MarkedInput
    Mark={Mark}
    value={value}
    onChange={setValue}
    slots={{
        container: CustomContainer,
        span: CustomSpan,
    }}
/>
```

See the [MUI documentation](https://mui.com/material-ui/customization/overriding-component-structure/) for more information about the slots pattern.

### Overall view

```tsx
<MarkedInput Mark={Mark} Overlay={Overlay} value={value} onChange={setValue}> option={[{
    overlayTrigger: '@',
    markup: '@[__value__](__meta__)',
    data: Data,
    initMark: getCustomMarkProps,
}, {
    overlayTrigger: '/',
    markup: '@(__value__)[__meta__]',
    data: AnotherData,
    initMark: getAnotherCustomMarkProps,
}]}/>
```

Or

```tsx
const MarkedInput = createMarkedInput({
    Mark,
    Overlay,
    options: [
        {
            overlayTrigger: '@',
            markup: '@[__label__](__value__)',
            data: Data,
            initMark: getCustomMarkProps,
        },
        {
            overlayTrigger: '/',
            markup: '@(__label__)[__value__]',
            data: AnotherData,
            initMark: getAnotherCustomMarkProps,
        },
    ],
})

const App = () => <MarkedInput value={value} onChange={setValue} />
```

## API

### MarkedInput

| Name          | Type                         | Default       | Description                                    |
| ------------- | ---------------------------- | ------------- | ---------------------------------------------- |
| value         | string                       | `undefined`   | Annotated text with markups for mark           |
| defaultValue  | string                       | `undefined`   | Default value                                  |
| onChange      | (value: string) => void      | `undefined`   | Change event                                   |
| Mark          | ComponentType<T = MarkProps> | `undefined`   | Component that used for render markups         |
| Overlay       | ComponentType                | `Suggestions` | Component that is rendered by trigger          |
| readOnly      | boolean                      | `undefined`   | Prevents from changing the value               |
| options       | OptionProps[]                | `[{}]`        | Passed options for configure                   |
| showOverlayOn | OverlayTrigger               | `change`      | Triggering events for overlay                  |
| slots         | Slots                        | `undefined`   | Override internal components (container, span) |
| slotProps     | SlotProps                    | `undefined`   | Props to pass to slot components               |

### Helpers

| Name              | Type                                                                                | Description                                  |
| ----------------- | ----------------------------------------------------------------------------------- | -------------------------------------------- |
| createMarkedInput | <T = MarkToken>(configs: MarkedInputProps<T>): ConfiguredMarkedInput<T>             | Create the configured MarkedInput component. |
| annotate          | (markup: Markup, params: {value: string, meta?: string}) => string                  | Make annotation from the markup              |
| denote            | (value: string, callback: (mark: MarkToken) => string, markups: Markup[]) => string | Transform the annotated text                 |
| useMark           | () => MarkHandler                                                                   | Allow to use dynamic mark                    |
| useOverlay        | () => OverlayHandler                                                                | Use overlay props                            |
| useListener       | (type, listener, deps) => void                                                      | Event listener                               |

### Types

```typescript
type OverlayTrigger = Array<'change' | 'selectionChange'> | 'change' | 'selectionChange' | 'none'
```

```typescript
interface MarkToken {
    type: 'mark'
    content: string
    position: {start: number; end: number}
    descriptor: MarkupDescriptor
    value: string
    meta?: string
    nested?: {
        content: string
        start: number
        end: number
    }
    children: Token[] // Nested tokens (empty array if no nesting)
}

interface TextToken {
    type: 'text'
    content: string
    position: {start: number; end: number}
}

interface MarkProps {
    value?: string
    meta?: string
    nested?: string // Raw nested content as string
    children?: ReactNode // Rendered nested content
}

type Token = TextToken | MarkToken
```

```typescript
interface OverlayHandler {
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
    close: () => void
    /**
     * Used for insert an annotation instead a triggered value.
     */
    select: (value: {value: string; meta?: string}) => void
    /**
     * Overlay match details
     */
    match: OverlayMatch
    ref: RefObject<HTMLElement>
}
```

```typescript
interface MarkHandler<T> {
    /**
     * MarkToken ref. Used for focusing and key handling operations.
     */
    ref: RefObject<T>
    /**
     * Change mark.
     * @options.silent doesn't change itself value and meta, only pass change event.
     */
    change: (props: {value: string; meta?: string}, options?: {silent: boolean}) => void
    /**
     * Remove itself.
     */
    remove: () => void
    /**
     * Passed the readOnly prop value
     */
    readOnly?: boolean
    /**
     * Nesting depth of this mark (0 for root-level marks)
     */
    depth: number
    /**
     * Whether this mark has nested children
     */
    hasChildren: boolean
    /**
     * Parent mark token (undefined for root-level marks)
     */
    parent?: MarkToken
    /**
     * Array of child tokens (read-only)
     */
    children: Token[]
}
```

```typescript
type OverlayMatch = {
    /**
     * Found value via a overlayMatch
     */
    value: string
    /**
     * Triggered value
     */
    source: string
    /**
     * Piece of text, in which was a overlayMatch
     */
    span: string
    /**
     * Html element, in which was a overlayMatch
     */
    node: Node
    /**
     * Start position of a overlayMatch
     */
    index: number
    /**
     * OverlayMatch's option
     */
    option: Option
}
```

```typescript jsx
export interface Option<T = Record<string, any>> {
    /**
     * Template string instead of which the mark is rendered.
     * Must contain placeholders: `__value__`, `__meta__`, and/or `__nested__`
     *
     * Placeholder types:
     * - `__value__` - main content (plain text, no nesting)
     * - `__meta__` - additional metadata (plain text, no nesting)
     * - `__nested__` - content supporting nested structures
     *
     * @default "@[__value__](__meta__)"
     */
    markup?: Markup
    /**
     * Sequence of symbols for calling the overlay.
     * @default "@"
     */
    overlayTrigger?: string
    /**
     * Data for an overlay component. By default, it is suggestions.
     */
    data?: string[]
    /**
     * Function to initialize props for the mark component. Gets arguments from found markup.
     * The MarkToken includes value, meta, children (if using __nested__), and descriptor.
     */
    initMark?: (props: MarkToken) => T
}
```

## Contributing

If you want to contribute, you are welcome! Create an issue or start a discussion.
