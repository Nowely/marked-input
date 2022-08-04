# [Marked input](https://marked-input.vercel.app) &middot; [![npm version](https://img.shields.io/npm/v/rc-marked-input.svg?style=flat)](https://www.npmjs.com/package/rc-marked-input) [![Storybook](https://gw.alipayobjects.com/mdn/ob_info/afts/img/A*CQXNTZfK1vwAAAAAAAAAAABjAQAAAQ/original)](https://marked-input.vercel.app)

<img width="521" alt="image" src="https://user-images.githubusercontent.com/37639183/182974441-49e4b247-449a-47ba-a090-2cb3aab7ce44.png">

A React component that lets you combine editable text with any component using annotated text.

Examples can be seen in the [storybook](https://marked-input.vercel.app).

## Getting started

Install the package via npm:

```
npm install rc-marked-input
```

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

| Name        | Type                             | Default   | Description                                                                                                                                            |
|-------------|----------------------------------|-----------|--------------------------------------------------------------------------------------------------------------------------------------------------------|
| markup      | string                           |           | Template string instead of which the mark is rendered<br/>Must contain placeholders: `__value__` and `__id__`<br/> For example: `@[__value__](__id__)` |
| trigger     | string                           | undefined | Sequence of symbols for calling the overlay.                                                                                                           |
| data        | string[]                         | undefined | Data for a overlay component. By default, it is suggestions.                                                                                           |
| initOverlay | (props: OverlayProps) => T1      | undefined | Function to initialize overlay props to your requirements.<br/> If missing then passed overlay props directly.                                         |
| initializer | (value: string, id: string) => T |           | Function to initialize props for mark render. Gets arguments from found markup                                                                         |

Helpers:

| Name     | Type                                                                              | Description                     |
|----------|-----------------------------------------------------------------------------------|---------------------------------|
| annotate | (markup: Markup, value: string, id?: string) => string                            | Make annotation from the markup |
| denote   | (value: string, callback: (mark: Mark) => string, ...markups: Markup[]) => string | Transform the annotated text    |
