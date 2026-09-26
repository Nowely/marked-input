# Storybook's Vue docgen engine is deprecated

Status: needs-info

Since Storybook 10.6 (5e5d231d), the Vue Storybook build prints:

```
`vue-docgen-api` is deprecated and will be removed in the next major release of Storybook. It is
still the default docgen engine, so this also applies when you have not set the `docgen`
framework option. Enable server-side docgen with `features: { experimentalDocgenServer: true }`
in your `.storybook/main.ts`, which becomes the default in Storybook 11, or set
`framework: { name: '@storybook/vue3-vite', options: { docgen: 'vue-component-meta' } }` to keep
docgen in the builder.
```

`packages/storybook/.storybook/main.ts:61` configures `@storybook/vue3-vite` with no options, so the
Vue instance runs on `vue-docgen-api`.

Needs a choice between the two routes the warning names, before the next major removes the current
one. Whichever is picked, compare what docgen feeds — the Vue stories' controls and argTypes — before
and after, and time the Vue build both ways.
