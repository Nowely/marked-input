<h1 align="center">
  <a href="https://marked-input.vercel.app">Marked input</a>
</h1>

A React component that lets you combine editable text with any component using annotated text.

Examples can be seen in the [storybook](https://marked-input.vercel.app).

## Props

Props of the `MarkedInput` component:

| Name     | Type                    | Default   | Description                            |
|----------|-------------------------|-----------|----------------------------------------|
| value    | string                  |           | Annotated text with markups for mark   |
| onChange | (value: string) => void |           | Change event                           |
| Mark     | ComponentType<T>        |           | Component that used for render markups |
| readOnly | boolean?                | undefined | Prevents from changing the value       |

Props of the `Option` component:

| Name        | Type                             | Default | Description                                                                                                                                            |
|-------------|----------------------------------|---------|--------------------------------------------------------------------------------------------------------------------------------------------------------|
| markup      | string                           |         | Template string instead of which the mark is rendered<br/>Must contain placeholders: `__value__` and `__id__`<br/> For example: `@[__value__](__id__)` |
| initializer | (value: string, id: string) => T |         | Function to initialize props for mark render. Gets arguments from found markup                                                                         |
