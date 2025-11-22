---
title: Configuration
description: Configuring Marked Input
---

## Configured

The library allows you to configure the `MarkedInput` component in two ways.

[![sandbox](https://user-images.githubusercontent.com/37639183/199624889-6129e303-6b44-4b82-859d-ada79942842c.svg)](https://codesandbox.io/s/configured-marked-input-305v6m)

Let's declare markups and suggestions data:

```tsx
const Data = ['First', 'Second', 'Third', 'Fourth', 'Fifth', 'Sixth']
const AnotherData = ['Seventh', 'Eight', 'Ninth']
const Primary = '@[__value__](primary:__meta__)'
const Default = '@[__value__](default)'
```

### Using the components

```tsx
import {MarkedInput} from 'rc-marked-input'
import {useState} from 'react'
import {Button} from './Button' // Your Button component

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
                    slotProps: {
                        mark: ({value, meta}) => ({label: value, primary: true, onClick: () => alert(meta)}),
                        overlay: {trigger: '@', data: Data},
                    },
                },
                {
                    markup: Default,
                    slotProps: {
                        overlay: {trigger: '/', data: AnotherData},
                    },
                },
            ]}
        />
    )
}
```

### Using `createMarkedInput`

```tsx
import {createMarkedInput} from 'rc-marked-input'
import {useState} from 'react'
import {Button} from './Button'

const ConfiguredMarkedInput = createMarkedInput({
    Mark: Button,
    options: [
        {
            markup: Primary,
            slotProps: {
                mark: ({value, meta}) => ({label: value, primary: true, onClick: () => alert(meta)}),
                overlay: {trigger: '@', data: ['First', 'Second', 'Third', 'Fourth', 'Fifth', 'Sixth']},
            },
        },
        {
            markup: Default,
            slotProps: {
                mark: ({value}) => ({label: value}),
                overlay: {trigger: '/', data: ['Seventh', 'Eight', 'Ninth']},
            },
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

## Static Props with Objects

You can use `slotProps.mark` as a static object instead of a function. This is useful when you want to pass fixed props to your Mark component:

```tsx
import {MarkedInput} from 'rc-marked-input'
import {Chip} from '@mui/material'
import {useState} from 'react'

const App = () => {
    const [value, setValue] = useState('This is a @[static] chip!')

    return (
        <MarkedInput
            Mark={Chip}
            value={value}
            onChange={setValue}
            options={[
                {
                    markup: '@[__value__]',
                    slotProps: {
                        // Static object - passed directly to Chip
                        mark: {
                            variant: 'outlined',
                            color: 'primary',
                            size: 'small',
                        },
                    },
                },
            ]}
        />
    )
}
```

**Key differences:**

- **Object form**: Props are passed directly to the Mark component (full replacement of MarkProps)
- **Function form**: You can access and transform `value`, `meta`, `nested`, and `children` from the markup

```tsx
// Object - static props
slotProps: { mark: { label: 'Fixed', color: 'primary' } }

// Function - dynamic props based on markup
slotProps: { mark: ({ value, meta }) => ({ label: value, onClick: () => alert(meta) }) }
```

## Overall view

```tsx
<MarkedInput
    Mark={Mark}
    Overlay={Overlay}
    value={value}
    onChange={setValue}
    options={[
        {
            markup: '@[__value__](__meta__)',
            slotProps: {
                mark: getCustomMarkProps,
                overlay: {trigger: '@', data: Data},
            },
        },
        {
            markup: '@(__value__)[__meta__]',
            slotProps: {
                mark: getAnotherCustomMarkProps,
                overlay: {trigger: '/', data: AnotherData},
            },
        },
    ]}
/>
```

Or

```tsx
const MarkedInput = createMarkedInput({
    Mark,
    Overlay,
    options: [
        {
            markup: '@[__label__](__value__)',
            slotProps: {
                mark: getCustomMarkProps,
                overlay: {trigger: '@', data: Data},
            },
        },
        {
            markup: '@(__label__)[__value__]',
            slotProps: {
                mark: getAnotherCustomMarkProps,
                overlay: {trigger: '/', data: AnotherData},
            },
        },
    ],
})

const App = () => <MarkedInput value={value} onChange={setValue} />
```

