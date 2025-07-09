# Default Feature

The Default feature provides automatic default values for props in the MarkedInput component. It ensures that essential
properties always have valid values, even when not explicitly specified by the user.

## How It Works

The feature works by parsing the input props and applying default values only when properties are `undefined`. This
means that explicitly provided values, including empty arrays or objects, are preserved.

## Default Values

The following default values are applied:

- **options**: If `undefined`, defaults to `[{ trigger: '@', markup: '@[__label__](__value__)', data: [] }]`
- **trigger**: If `undefined`, defaults to `'change'`
- **className**: If `undefined`, defaults to `'mk-input'`. If provided, appends to `'mk-input'`

For each option in the options array:

- **data**: If `undefined`, defaults to `[]`
- **markup**: If `undefined`, defaults to `'@[__label__](__value__)'`
- **trigger**: If `undefined`, defaults to `'@'`

## Usage Examples

The default feature allows you to provide minimal props while ensuring the component works correctly:

```jsx
// Using with minimal props
<MarkedInput/>  // All defaults applied

// Providing empty options array (preserved, not replaced with defaults)
<MarkedInput options={[]}/>

// Providing partial option properties (only undefined properties get defaults)
<MarkedInput options={[{data: ['item1', 'item2']}]}/>  // markup and trigger get defaults
```

This feature simplifies usage of the MarkedInput component by reducing the amount of boilerplate code needed for basic
functionality.
