---
title: Slots
description: Customizing internal components
---

The `slots` and `slotProps` props allow you to customize internal components with type safety and flexibility.

## Available Slots

- **container** - Root div wrapper for the entire component
- **span** - Text span elements for rendering text tokens

## Basic Usage

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

## Custom Components

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

