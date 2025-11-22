---
title: Dynamic Marks
description: Working with dynamic marks
---

Marks can be dynamic: editable, removable, etc. via the `useMark` hook helper.

[![sandbox](https://user-images.githubusercontent.com/37639183/199624889-6129e303-6b44-4b82-859d-ada79942842c.svg)](https://codesandbox.io/s/dynamic-mark-w2nj82?file=/src/App.js)

## Editable

```tsx
import {MarkedInput, useMark} from 'rc-marked-input'
import {useState} from 'react'

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

## Removable

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

## Focusable

If passed the `ref` prop of the `useMark` hook in ref of a component then it component can be focused by key operations.

