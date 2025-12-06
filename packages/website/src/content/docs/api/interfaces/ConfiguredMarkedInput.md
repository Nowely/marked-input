---
editUrl: false
next: false
prev: false
title: "ConfiguredMarkedInput"
---

Defined in: [packages/markput/src/types.ts:63](https://github.com/Nowely/marked-input/blob/next/packages/markput/src/types.ts#L63)

## Extends

- `FunctionComponent`\<[`MarkedInputProps`](/api/interfaces/markedinputprops/)\<`TMarkProps`, `TOverlayProps`\>\>

## Type Parameters

| Type Parameter | Default type |
| ------ | ------ |
| `TMarkProps` | [`MarkProps`](/api/interfaces/markprops/) |
| `TOverlayProps` | [`OverlayProps`](/api/interfaces/overlayprops/) |

```ts
ConfiguredMarkedInput(props, deprecatedLegacyContext?): ReactNode;
```

Defined in: [packages/markput/src/types.ts:63](https://github.com/Nowely/marked-input/blob/next/packages/markput/src/types.ts#L63)

## Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `props` | [`MarkedInputProps`](/api/interfaces/markedinputprops/) | - |
| `deprecatedLegacyContext?` | `any` | **See** [React Docs](https://legacy.reactjs.org/docs/legacy-context.html#referencing-context-in-lifecycle-methods) :::caution[Deprecated] This API is no longer supported and may be removed in a future release. ::: |

## Returns

`ReactNode`

## Properties

### ~~contextTypes?~~

```ts
optional contextTypes: ValidationMap<any>;
```

Defined in: node\_modules/.pnpm/@types+react@18.3.27/node\_modules/@types/react/index.d.ts:1156

:::caution[Deprecated]
Lets you specify which legacy context is consumed by
this component.
:::

#### See

[Legacy React Docs](https://legacy.reactjs.org/docs/legacy-context.html)

#### Inherited from

```ts
FunctionComponent.contextTypes
```

***

### ~~defaultProps?~~

```ts
optional defaultProps: Partial<MarkedInputProps<TMarkProps, TOverlayProps>>;
```

Defined in: node\_modules/.pnpm/@types+react@18.3.27/node\_modules/@types/react/index.d.ts:1179

Used to define default values for the props accepted by
the component.

:::caution[Deprecated]
Use [values for destructuring assignments instead](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Destructuring_assignment#default_value|default).
:::

#### See

[React Docs](https://react.dev/reference/react/Component#static-defaultprops)

#### Example

```tsx
type Props = { name?: string }

const MyComponent: FC<Props> = (props) => {
  return <div>{props.name}</div>
}

MyComponent.defaultProps = {
  name: 'John Doe'
}
```

#### Inherited from

```ts
FunctionComponent.defaultProps
```

***

### displayName?

```ts
optional displayName: string;
```

Defined in: node\_modules/.pnpm/@types+react@18.3.27/node\_modules/@types/react/index.d.ts:1198

Used in debugging messages. You might want to set it
explicitly if you want to display a different name for
debugging purposes.

#### See

[Legacy React Docs](https://legacy.reactjs.org/docs/react-component.html#displayname)

#### Example

```tsx

const MyComponent: FC = () => {
  return <div>Hello!</div>
}

MyComponent.displayName = 'MyAwesomeComponent'
```

#### Inherited from

```ts
FunctionComponent.displayName
```

***

### propTypes?

```ts
optional propTypes: WeakValidationMap<MarkedInputProps<TMarkProps, TOverlayProps>>;
```

Defined in: node\_modules/.pnpm/@types+react@18.3.27/node\_modules/@types/react/index.d.ts:1147

Used to declare the types of the props accepted by the
component. These types will be checked during rendering
and in development only.

We recommend using TypeScript instead of checking prop
types at runtime.

#### See

[React Docs](https://react.dev/reference/react/Component#static-proptypes)

#### Inherited from

```ts
FunctionComponent.propTypes
```
