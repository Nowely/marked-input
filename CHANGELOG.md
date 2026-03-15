# Changelog

## [0.6.0](https://github.com/Nowely/marked-input/compare/0.5.0...0.6.0) (2026-03-15)


### Features

* **blocks:** add block merging via Backspace/Delete and TodoList story ([#148](https://github.com/Nowely/marked-input/issues/148)) ([0685033](https://github.com/Nowely/marked-input/commit/0685033578d702aa223686f67f95fca656ea6a1f))
* **blocks:** Notion-like block editor with keyboard navigation, block operations, and drag-and-drop ([#146](https://github.com/Nowely/marked-input/issues/146)) ([4bd5534](https://github.com/Nowely/marked-input/commit/4bd5534859238019200eba2498b19590afec125a))
* **drag:** replace block mode with drag-and-drop row management ([#149](https://github.com/Nowely/marked-input/issues/149)) ([83034e8](https://github.com/Nowely/marked-input/commit/83034e8725994bd807cfeb93f05b02b3a0a668c8))
* **storybook:** add withPlainValue decorator and enhance drag/text stories ([#151](https://github.com/Nowely/marked-input/issues/151)) ([1d76c1f](https://github.com/Nowely/marked-input/commit/1d76c1fbeea2f790b672c3122dfed9f388d7434e))


### Refactoring

* **storybook:** standardize stories with PlainValuePanel and StoryObj types across React and Vue ([#152](https://github.com/Nowely/marked-input/issues/152)) ([42d21f3](https://github.com/Nowely/marked-input/commit/42d21f3ce949fc893f58181b6ea7da1c53fc0b32))


### Miscellaneous

* upgrade to Vite 8, Vitest 4.1, and Astro 6 ([#150](https://github.com/Nowely/marked-input/issues/150)) ([693966d](https://github.com/Nowely/marked-input/commit/693966d122260d5da28a4cba7cb53df10fea969a))

## [0.5.0](https://github.com/Nowely/marked-input/compare/0.4.0...0.5.0) (2026-03-07)


### Features

* **core:** add ContentEditableController for DOM-based editing ([#134](https://github.com/Nowely/marked-input/issues/134)) ([633133b](https://github.com/Nowely/marked-input/commit/633133bd924ecb1e96f48d0f3526d4e19b004041))


### Refactoring

* extract shared logic from framework adapters to core ([#145](https://github.com/Nowely/marked-input/issues/145)) ([795c0e8](https://github.com/Nowely/marked-input/commit/795c0e82d38c065f1f4e25c5695d1c0decd814cc))
* improve Signal typing with interface augmentation for framework-specific use() return types ([#143](https://github.com/Nowely/marked-input/issues/143)) ([e6d4efc](https://github.com/Nowely/marked-input/commit/e6d4efc5168029c6c75c60b43d2e6abc8ad654bb))


### Miscellaneous

* migrate to pnpm catalog for centralized dependency management ([#140](https://github.com/Nowely/marked-input/issues/140)) ([b71cd55](https://github.com/Nowely/marked-input/commit/b71cd55ad88966d629f4c90733488bfc73869f5d))
* update oxlint configuration ([#144](https://github.com/Nowely/marked-input/issues/144)) ([1db73ec](https://github.com/Nowely/marked-input/commit/1db73eca4d8846b911aa2c6875caf6b95bed228e))


### Tests

* add comprehensive Vue component tests with Vitest ([#142](https://github.com/Nowely/marked-input/issues/142)) ([231f3dc](https://github.com/Nowely/marked-input/commit/231f3dc902b88f6bfa683df5346c6343a6adbb0e))

## [0.4.0](https://github.com/Nowely/marked-input/compare/0.3.0...0.4.0) (2026-03-06)


### Features

* **core:** predictive input model via beforeinput ([#131](https://github.com/Nowely/marked-input/issues/131)) ([80d0369](https://github.com/Nowely/marked-input/commit/80d036958862b342a013eb189a60671614b25d62))


### Documentation

* Add AGENTS.md ([#135](https://github.com/Nowely/marked-input/issues/135)) ([675a8e2](https://github.com/Nowely/marked-input/commit/675a8e203c0abe8434e5c4d062a3cb1ac9e183d6))
* update Storybook links and reorganize badges by framewor ([#137](https://github.com/Nowely/marked-input/issues/137)) ([9884dc1](https://github.com/Nowely/marked-input/commit/9884dc14d61680f1a0394e8667be924344f8abd6))


### Miscellaneous

* migrate from prettier to oxfmt ([#139](https://github.com/Nowely/marked-input/issues/139)) ([4349b1b](https://github.com/Nowely/marked-input/commit/4349b1b0210c91119a872246a4ac94628da668c5))
* remove unused EditableSpan components ([#133](https://github.com/Nowely/marked-input/issues/133)) ([2e5388a](https://github.com/Nowely/marked-input/commit/2e5388afe14e51df44c34c82f89602f14f48f994))
* remove unused Vercel configuration file from Storybook ([#136](https://github.com/Nowely/marked-input/issues/136)) ([60129be](https://github.com/Nowely/marked-input/commit/60129be7ec1f530031e495035f5f113a73a551e4))
* upgrade vue-tsc to v3.2.5 ([#138](https://github.com/Nowely/marked-input/issues/138)) ([a189b53](https://github.com/Nowely/marked-input/commit/a189b532ddf373b57083e7ff52144edd6617eb27))

## [0.3.0](https://github.com/Nowely/marked-input/compare/0.2.0...0.3.0) (2026-03-04)


### Features

* add block reordering with drag-and-drop support ([#130](https://github.com/Nowely/marked-input/issues/130)) ([511c973](https://github.com/Nowely/marked-input/commit/511c9731aabe1251bf35ed14ce1e15ebf259cc12))
* **storybook:** add Vue Storybook ([#129](https://github.com/Nowely/marked-input/issues/129)) ([06f75c3](https://github.com/Nowely/marked-input/commit/06f75c39a20028e5147b85093f07f78bab7b5001))


### Documentation

* update README to include Vue package information and badges ([3a87989](https://github.com/Nowely/marked-input/commit/3a879893aae8ebc03e16c9a0a73d6a9eeab370ad))


### Miscellaneous

* add sync step to release workflow for main branch updates ([bde610f](https://github.com/Nowely/marked-input/commit/bde610fc35d41e7059bb9b8785ca9d532731f3e1))
* rename package from root to markput in package.json ([1cb8a8a](https://github.com/Nowely/marked-input/commit/1cb8a8a9146fb5b732509bdf54c26ac9a4ba204a))
* update release-please config to exclude component in tag ([1555898](https://github.com/Nowely/marked-input/commit/1555898f840c65fbebd96193758d44fd79d2dde5))

## [0.2.0](https://github.com/Nowely/marked-input/compare/root-0.1.0...root-0.2.0) (2026-03-03)


### Features

* **vue:** add initial Vue support ([#125](https://github.com/Nowely/marked-input/issues/125)) ([c479853](https://github.com/Nowely/marked-input/commit/c47985352e2dd8fbe3f0f735d249f9bcc386f723))


### Bug Fixes

* **storybook:** prevent caret reset in TextSpan and fix Storybook issues ([#122](https://github.com/Nowely/marked-input/issues/122)) ([3472085](https://github.com/Nowely/marked-input/commit/3472085bf7406448e9f2f6aac9eb44c5a9b88954))


### Refactoring

* extract core features and controllers from React package ([#124](https://github.com/Nowely/marked-input/issues/124)) ([c0ad3d7](https://github.com/Nowely/marked-input/commit/c0ad3d7e309404f98bf962d881fe4c5d2de2c5d8))


### Miscellaneous

* add release-please config for unified versioning ([db07f5e](https://github.com/Nowely/marked-input/commit/db07f5ee2e20016905058769190e17dc73f5cdfe))
* upgrade to React 19 ([#121](https://github.com/Nowely/marked-input/issues/121)) ([d9c9531](https://github.com/Nowely/marked-input/commit/d9c953144b2ce674f6a8e8a99dba0c4eb5328862))


### CI

* add automated release workflow and PR validation ([#120](https://github.com/Nowely/marked-input/issues/120)) ([85b6fc4](https://github.com/Nowely/marked-input/commit/85b6fc476a655447e9f24706734efd057453b8f2))
