---
title: Overlay
description: Customizing the overlay component
---

A default overlay is the suggestion component, but it can be easily replaced for any other.

## Suggestions

```tsx
export const DefaultOverlay = () => {
    const [value, setValue] = useState('Hello, default - suggestion overlay by trigger @!')
    return (
        <MarkedInput Mark={Mark} value={value} onChange={setValue} options={[{ slotProps: { overlay: { trigger: '@', data: ['First', 'Second', 'Third']}]} />
    )
}
```

## Custom overlay

[![sandbox](https://user-images.githubusercontent.com/37639183/199624889-6129e303-6b44-4b82-859d-ada79942842c.svg)](https://codesandbox.io/s/custom-overlay-1m5ctx?file=/src/App.tsx)

```tsx
const Overlay = () => <h1>I am the overlay</h1>
export const CustomOverlay = () => {
    const [value, setValue] = useState('Hello, custom overlay by trigger @!')
    return <MarkedInput Mark={Mark} Overlay={Overlay} value={value} onChange={setValue} />
}
```

## Custom trigger

```tsx
export const CustomTrigger = () => {
    const [value, setValue] = useState('Hello, custom overlay by trigger /!')
    return (
        <MarkedInput
            Mark={() => null}
            Overlay={Overlay}
            value={value}
            onChange={setValue}
            options={[{slotProps: {overlay: {trigger: '/'}}}]}
        />
    )
}
```

## Positioned

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

## Selectable

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

